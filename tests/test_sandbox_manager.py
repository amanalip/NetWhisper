"""
Tier 1 & Tier 2 Automated Tests: Sandbox Manager.
Validates PID input validation, protected system component immutability,
real unprivileged signal termination (SIGTERM/SIGKILL), process isolation, and global panic state.
"""

import pytest
import os
import signal
from sandbox_manager import SandboxManager, PROTECTED_PROCESS_NAMES


@pytest.mark.parametrize("pid_val, expected_valid, expected_pid", [
    (1234, True, 1234),
    ("1234", True, 1234),
    (1, True, 1),
    (99999, True, 99999),
    ("0", True, 0),
    (0, True, 0),
])
def test_validate_pid_valid_inputs(pid_val, expected_valid, expected_pid):
    """
    T1-SM1: validate_pid accepts valid positive integers and numeric strings.
    """
    mgr = SandboxManager()
    is_valid, pid, err = mgr.validate_pid(pid_val)
    assert is_valid is expected_valid
    assert pid == expected_pid
    assert err == ""


@pytest.mark.parametrize("invalid_val", [
    -1,
    -999,
    "-5",
    True,
    False,
    "3.14",
    "abc",
    "12a",
    None,
    [],
    {}
])
def test_validate_pid_invalid_inputs(invalid_val):
    """
    T2-SM2: validate_pid rejects negative numbers, booleans, floats, strings, and structures.
    """
    mgr = SandboxManager()
    is_valid, pid, err = mgr.validate_pid(invalid_val)
    assert is_valid is False
    assert pid is None
    assert len(err) > 0


def test_is_pid_protected_core_pids():
    """
    T1-SM3: is_pid_protected safeguards PID 0, PID 1, and NetWhisper's self PID.
    """
    self_pid = os.getpid()
    mgr = SandboxManager(self_pid=self_pid)

    # PID 0
    p0, r0 = mgr.is_pid_protected(0)
    assert p0 is True
    assert "0" in r0

    # PID 1
    p1, r1 = mgr.is_pid_protected(1)
    assert p1 is True
    assert "1" in r1

    # Self PID
    ps, rs = mgr.is_pid_protected(self_pid)
    assert ps is True
    assert "own" in rs.lower() or "self" in rs.lower() or "cannot terminate" in rs.lower()


def test_protected_process_names_set():
    """
    T1-SM4: PROTECTED_PROCESS_NAMES contains all critical Linux system daemons and display servers.
    """
    expected_daemons = {
        "systemd", "init", "kthreadd", "dbus-daemon",
        "pipewire", "wireplumber", "kwin", "gnome-shell", "xorg", "wayland"
    }
    for daemon in expected_daemons:
        assert daemon in PROTECTED_PROCESS_NAMES


def test_terminate_protected_pid_rejection():
    """
    T1-SM5: terminate_process refuses to kill protected PIDs and returns code 403.
    """
    mgr = SandboxManager(self_pid=os.getpid())
    res1 = mgr.terminate_process(1, "SIGKILL")
    assert res1["success"] is False
    assert res1["code"] == 403

    res_self = mgr.terminate_process(os.getpid(), "SIGTERM")
    assert res_self["success"] is False
    assert res_self["code"] == 403


def test_terminate_invalid_pid_rejection():
    """
    T2-SM6: terminate_process rejects invalid PID types with code 400.
    """
    mgr = SandboxManager()
    res = mgr.terminate_process("invalid_pid", "SIGTERM")
    assert res["success"] is False
    assert res["code"] == 400


def test_terminate_nonexistent_pid():
    """
    T2-SM7: terminate_process returns 404 when target PID is not found on the system.
    """
    mgr = SandboxManager(self_pid=os.getpid())
    res = mgr.terminate_process(9999999, "SIGTERM")
    assert res["success"] is False
    assert res["code"] == 404


def test_terminate_real_process_sigterm(spawn_mock_process):
    """
    T1-SM8: terminate_process successfully sends SIGTERM to a live mock worker process.
    """
    proc = spawn_mock_process()
    pid = proc.pid

    # Instantiate SandboxManager with dummy self_pid to bypass child worker safeguard
    mgr = SandboxManager(self_pid=pid + 1000)

    res = mgr.terminate_process(pid, sig_name="SIGTERM")
    assert res["success"] is True
    assert res["pid"] == pid
    assert res["signal"] == "SIGTERM"

    # Wait for process exit and assert terminated by SIGTERM (-15)
    exit_code = proc.wait(timeout=3)
    assert exit_code == -signal.SIGTERM


def test_terminate_real_process_sigkill(spawn_mock_process):
    """
    T1-SM9: terminate_process successfully sends SIGKILL to a live mock worker process.
    """
    proc = spawn_mock_process()
    pid = proc.pid

    mgr = SandboxManager(self_pid=pid + 1000)

    res = mgr.terminate_process(pid, sig_name="SIGKILL")
    assert res["success"] is True
    assert res["pid"] == pid
    assert res["signal"] == "SIGKILL"

    exit_code = proc.wait(timeout=3)
    assert exit_code == -signal.SIGKILL


def test_set_process_isolation_toggle():
    """
    T1-SM10: set_process_isolation adds and removes PIDs from isolated_pids set.
    """
    mgr = SandboxManager(self_pid=os.getpid())

    # Isolate PID 7000
    res1 = mgr.set_process_isolation(7000, isolate=True)
    assert res1["success"] is True
    assert res1["is_isolated"] is True
    assert 7000 in mgr.isolated_pids

    # Un-isolate PID 7000
    res2 = mgr.set_process_isolation(7000, isolate=False)
    assert res2["success"] is True
    assert res2["is_isolated"] is False
    assert 7000 not in mgr.isolated_pids

    # Attempt to isolate PID 1 -> rejected with 403
    res_p1 = mgr.set_process_isolation(1, isolate=True)
    assert res_p1["success"] is False
    assert res_p1["code"] == 403


def test_toggle_panic_mode():
    """
    T1-SM11: toggle_panic_mode sets global panic mode boolean state.
    """
    mgr = SandboxManager()
    assert mgr.panic_mode is False

    res_on = mgr.toggle_panic_mode(True)
    assert res_on["success"] is True
    assert res_on["panic_mode"] is True
    assert mgr.panic_mode is True

    res_off = mgr.toggle_panic_mode(False)
    assert res_off["success"] is True
    assert res_off["panic_mode"] is False
    assert mgr.panic_mode is False
