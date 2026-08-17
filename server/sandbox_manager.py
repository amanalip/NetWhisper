"""
Sandbox Manager for NetWhisper.
Manages per-process network isolation, process termination signals,
input validation, and safeguards for critical operating system processes.
"""

# Import the operating system module to execute POSIX kill syscalls.
import os
# Import signal module for standard POSIX signal constants (SIGTERM, SIGKILL).
import signal
# Import logging for reporting process actions and security rejections.
import logging
# Import typing primitives for clear static types.
from typing import Set, Dict, Tuple, Optional
# Import psutil for checking process hierarchies and parent-child relationships.
import psutil

# Create a logger instance for the sandbox management module.
logger = logging.getLogger("netwhisper.sandbox_manager")

# Define a set of protected process names that must never be terminated by NetWhisper.
PROTECTED_PROCESS_NAMES = {
    "systemd",
    "init",
    "kthreadd",
    "xorg",
    "wayland",
    "sway",
    "gnome-shell",
    "kwin",
    "kwin_wayland",
    "dbus-daemon",
    "dbus-broker",
    "pipewire",
    "wireplumber",
    "systemd-journald"
}


class SandboxManager:
    """
    Handles process termination and network isolation with strict system safeguards.
    """

    def __init__(self, self_pid: Optional[int] = None):
        # Store the process ID of NetWhisper itself to prevent self-termination.
        self.self_pid = self_pid or os.getpid()
        # Maintain a set of PIDs currently flagged for network isolation.
        self.isolated_pids: Set[int] = set()
        # Boolean flag indicating whether global panic mode is active.
        self.panic_mode: bool = False

    def is_pid_protected(self, pid: int) -> Tuple[bool, str]:
        """
        Verifies whether a given PID belongs to an immutable system component or NetWhisper itself.
        Returns a tuple of (is_protected: bool, reason: str).
        """
        # Protect PID 0 and PID 1 (Init/Systemd).
        if pid <= 1:
            return True, "PID 0 and PID 1 (Init/Systemd) are protected core system components."

        # Prevent NetWhisper from killing its own daemon process.
        if pid == self.self_pid:
            return True, "NetWhisper cannot terminate its own monitoring process."

        try:
            # Inspect target process metadata via psutil.
            p = psutil.Process(pid)
            # Protect child worker processes spawned by NetWhisper.
            if p.ppid() == self.self_pid:
                return True, "Target process is a child worker of NetWhisper."

            # Check if process executable matches protected system services.
            proc_name = p.name().lower()
            if proc_name in PROTECTED_PROCESS_NAMES:
                return True, f"Process '{proc_name}' is a protected system service or display manager."

            # Check if the process is a kernel thread (empty command line and parented by kthreadd PID 2).
            if not p.cmdline() and (p.ppid() == 2 or pid == 2):
                return True, "Target is a protected kernel thread."
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            # If the process does not exist or access is restricted, allow standard handling.
            pass

        # PID is not protected.
        return False, ""

    def validate_pid(self, pid_val) -> Tuple[bool, Optional[int], str]:
        """
        Validates that a PID input is a positive integer, rejecting strings, booleans, and negatives.
        Returns a tuple of (is_valid: bool, pid_integer: Optional[int], error_message: str).
        """
        try:
            # Booleans are a subclass of int in Python; explicitly disallow boolean types.
            if isinstance(pid_val, bool):
                return False, None, "Invalid PID format: boolean values not allowed."
            # Attempt conversion to standard integer.
            pid = int(pid_val)
            # Reject negative PID values.
            if pid < 0:
                return False, None, "Invalid PID: negative values not allowed."
            # Return valid integer PID.
            return True, pid, ""
        except (ValueError, TypeError):
            # Return error on conversion failure.
            return False, None, "Invalid PID format: must be an integer."

    def find_root_process(self, pid: int) -> int:
        """
        Walks up the process parent chain to find the topmost application process.
        Stops when the parent is a session/display manager (e.g. systemd, gnome-shell, plasmashell)
        or the parent is PID 1/2, meaning we have reached the root of the user session.

        For example: chrome renderer (pid=1760) -> chrome main (pid=1676) -> plasmashell (pid=1055)
        This returns pid=1676 (the chrome main), not the renderer or the session manager.
        """
        SESSION_MANAGERS = {
            "systemd", "init", "plasmashell", "gnome-shell", "xfce4-session",
            "sway", "openbox", "kwin", "kwin_wayland", "xorg", "wayland",
            "xdg-desktop-portal", "startplasma-wayland", "startplasma-x11",
            "dbus-daemon", "dbus-broker", "login", "gdm", "sddm", "lightdm",
        }
        try:
            current_pid = pid
            # Walk up the tree up to 20 hops to avoid infinite loops.
            for _ in range(20):
                proc = psutil.Process(current_pid)
                ppid = proc.ppid()
                # Stop if parent is PID 0, 1, or 2 (kernel/init boundary).
                if ppid <= 2:
                    return current_pid
                parent = psutil.Process(ppid)
                parent_name = parent.name().lower()
                # Stop if parent is a desktop session manager — we found the app root.
                if parent_name in SESSION_MANAGERS:
                    return current_pid
                # Traverse upward.
                current_pid = ppid
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            # If we lose the process during traversal, return last known good PID.
            pass
        return current_pid

    def terminate_process(self, pid_val, sig_name: str = "SIGTERM") -> Dict:
        """
        Sends a POSIX termination signal to a validated, non-protected PID.

        Strategy:
        1. Walk up the process tree to find the root application process (not a renderer child).
        2. Attempt to kill the entire process group (os.killpg) so all child processes
           (renderers, GPU helpers, crash handlers) are also terminated in one syscall.
        3. Fall back to single-PID kill if the process group approach fails (e.g. pgid == 1).
        """
        # Validate PID input format.
        is_valid, pid, err = self.validate_pid(pid_val)
        if not is_valid or pid is None:
            return {"success": False, "error": err, "code": 400}

        # Check if the original target PID is protected before doing anything.
        is_protected, reason = self.is_pid_protected(pid)
        if is_protected:
            return {"success": False, "error": reason, "code": 403}

        # Select signal constant based on requested signal name.
        sig = signal.SIGKILL if sig_name.upper() == "SIGKILL" else signal.SIGTERM

        # Walk up to the root application process so we kill the whole app, not just one child.
        root_pid = self.find_root_process(pid)

        # Re-check that the root PID is also not protected.
        if root_pid != pid:
            root_protected, root_reason = self.is_pid_protected(root_pid)
            if root_protected:
                # Fall back to killing the originally requested PID.
                root_pid = pid
                logger.warning(
                    "Root process PID %d is protected (%s); falling back to original PID %d",
                    root_pid, root_reason, pid
                )

        try:
            # Attempt to get the process group ID for the root process.
            pgid = os.getpgid(root_pid)

            # Safety check: never kill process group 0 or 1 (would signal the kernel).
            if pgid <= 1:
                logger.warning("PGID %d is a system group; falling back to single-PID kill for %d", pgid, root_pid)
                os.kill(root_pid, sig)
            else:
                # Kill every process in the group atomically — this terminates parent + all children.
                os.killpg(pgid, sig)
                logger.info("Sent %s to process group %d (root PID %d, requested PID %d)", sig_name, pgid, root_pid, pid)

            # Clean up isolation state if process was being tracked.
            self.isolated_pids.discard(pid)
            self.isolated_pids.discard(root_pid)

            return {
                "success": True,
                "pid": pid,
                "root_pid": root_pid,
                "signal": sig_name,
                "message": f"Sent {sig_name} to process group of {root_pid} (requested PID {pid})"
            }

        except ProcessLookupError:
            # Process already terminated or invalid PID.
            return {"success": False, "error": f"Process {root_pid} not found (may have already exited).", "code": 404}
        except PermissionError:
            # Lack of permission to signal this specific process.
            return {"success": False, "error": f"Permission denied sending signal to PID {root_pid}.", "code": 403}
        except Exception as e:
            # Generic error handling.
            return {"success": False, "error": str(e), "code": 500}

    def set_process_isolation(self, pid_val, isolate: bool) -> Dict:
        """
        Toggles network isolation status for a target process.
        """
        # Validate PID input format.
        is_valid, pid, err = self.validate_pid(pid_val)
        if not is_valid or pid is None:
            return {"success": False, "error": err, "code": 400}

        # Verify target is not a protected system PID.
        is_protected, reason = self.is_pid_protected(pid)
        if is_protected:
            return {"success": False, "error": reason, "code": 403}

        # Add or remove from isolated PIDs set.
        if isolate:
            self.isolated_pids.add(pid)
        else:
            self.isolated_pids.discard(pid)

        # Return status confirmation.
        return {
            "success": True,
            "pid": pid,
            "is_isolated": isolate,
            "message": f"Process {pid} network isolation set to {isolate}"
        }

    def toggle_panic_mode(self, enabled: bool) -> Dict:
        """
        Toggles global panic mode state across all non-system processes.
        """
        # Set panic mode boolean flag.
        self.panic_mode = enabled
        # Return state confirmation.
        return {
            "success": True,
            "panic_mode": self.panic_mode,
            "message": f"Global panic mode set to {self.panic_mode}"
        }
