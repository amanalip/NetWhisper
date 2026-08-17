"""
Scenario Generator for NetWhisper.
Generates realistic multi-application background network telemetry streams,
fluctuating bandwidth bursts, and mock CLI beacons for testing and demonstration.
"""

# Import time module for timestamp tracking.
import time
# Import random module for simulating bandwidth fluctuations and transfer bursts.
import random
# Import typing primitives for clear static annotations.
from typing import Dict, List

# Define a static template list of simulated processes representing realistic background activity.
SCENARIO_PROCESSES = [
    {
        # Developer tool process template.
        "pid": 4182,
        "ppid": 1205,
        "name": "code-telemetry",
        "cmdline": "/usr/share/code/code --type=crash-reporter --telemetry-endpoint=https://telemetry.remote.visualstudio.com",
        "category": "developer_tool",
        "cpu_percent": 1.2,
        "memory_mb": 184.2,
        "username": "user",
        "sockets": [
            {
                # Active HTTPS telemetry socket to VS Code remote telemetry service.
                "inode": 104201,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 51240,
                "remote_ip": "13.107.42.16",
                "remote_port": 443,
                "remote_domain": "telemetry.remote.visualstudio.com",
                "state": "ESTABLISHED",
                "category": "Telemetry & Analytics",
                "risk": "high",
                "bytes_sent": 14200,
                "bytes_recv": 2048,
                "is_encrypted": True
            },
            {
                # Secondary telemetry pipe to Microsoft Aria telemetry backend.
                "inode": 104202,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 51242,
                "remote_ip": "20.189.173.1",
                "remote_port": 443,
                "remote_domain": "browser.pipe.aria.microsoft.com",
                "state": "ESTABLISHED",
                "category": "Telemetry & Analytics",
                "risk": "high",
                "bytes_sent": 8450,
                "bytes_recv": 1024,
                "is_encrypted": True
            }
        ]
    },
    {
        # CLI utility process template (Node/NPM background telemetry).
        "pid": 5891,
        "ppid": 3410,
        "name": "npm-cli-daemon",
        "cmdline": "node /usr/local/bin/npm fund --analytics=true --token=[REDACTED_TOKEN]",
        "category": "cli_tool",
        "cpu_percent": 0.8,
        "memory_mb": 94.6,
        "username": "user",
        "sockets": [
            {
                # Standard npm registry package manifest download.
                "inode": 105891,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 48210,
                "remote_ip": "104.16.27.35",
                "remote_port": 443,
                "remote_domain": "registry.npmjs.org",
                "state": "ESTABLISHED",
                "category": "Cloud Infrastructure",
                "risk": "low",
                "bytes_sent": 24500,
                "bytes_recv": 128400,
                "is_encrypted": True
            },
            {
                # Unencrypted HTTP background analytics ping.
                "inode": 105892,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 48212,
                "remote_ip": "151.101.65.140",
                "remote_port": 80,
                "remote_domain": "telemetry.npmjs.com",
                "state": "ESTABLISHED",
                "category": "Unencrypted Web (HTTP)",
                "risk": "high",
                "bytes_sent": 5120,
                "bytes_recv": 512,
                "is_encrypted": False
            }
        ]
    },
    {
        # Desktop audio streaming application template.
        "pid": 7240,
        "ppid": 1400,
        "name": "spotify-client",
        "cmdline": "/usr/bin/spotify --enable-crash-dump",
        "category": "desktop_app",
        "cpu_percent": 3.4,
        "memory_mb": 312.0,
        "username": "user",
        "sockets": [
            {
                # High-bandwidth audio stream chunk fetching.
                "inode": 107241,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 53210,
                "remote_ip": "35.186.224.25",
                "remote_port": 443,
                "remote_domain": "audio-ak.spotify.com.edgesuite.net",
                "state": "ESTABLISHED",
                "category": "Cloud Infrastructure",
                "risk": "low",
                "bytes_sent": 12000,
                "bytes_recv": 524000,
                "is_encrypted": True
            },
            {
                # User playback telemetry endpoint.
                "inode": 107242,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 53214,
                "remote_ip": "104.18.32.7",
                "remote_port": 443,
                "remote_domain": "analytics.spotify.com",
                "state": "ESTABLISHED",
                "category": "Telemetry & Analytics",
                "risk": "high",
                "bytes_sent": 9400,
                "bytes_recv": 840,
                "is_encrypted": True
            }
        ]
    },
    {
        # Suspicious background updater beaconing to a non-standard port.
        "pid": 9811,
        "ppid": 1,
        "name": "stealth_updater",
        "cmdline": "/tmp/.cache/stealth_updater --beacon --interval=5s",
        "category": "background_daemon",
        "cpu_percent": 4.1,
        "memory_mb": 45.2,
        "username": "user",
        "sockets": [
            {
                # Direct IP connection over non-standard port 4444.
                "inode": 109811,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 41209,
                "remote_ip": "185.220.101.5",
                "remote_port": 4444,
                "remote_domain": "185.220.101.5",
                "state": "ESTABLISHED",
                "category": "Direct IP (Non-standard Port)",
                "risk": "high",
                "bytes_sent": 32800,
                "bytes_recv": 4096,
                "is_encrypted": False
            }
        ]
    },
    {
        # Web browser process template.
        "pid": 11402,
        "ppid": 1400,
        "name": "chromium-browser",
        "cmdline": "/usr/lib/chromium/chromium --user-data-dir=/home/user/.config/chromium",
        "category": "browser",
        "cpu_percent": 5.8,
        "memory_mb": 580.4,
        "username": "user",
        "sockets": [
            {
                # Background analytics tag.
                "inode": 111401,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 54890,
                "remote_ip": "142.250.190.46",
                "remote_port": 443,
                "remote_domain": "google-analytics.com",
                "state": "ESTABLISHED",
                "category": "Telemetry & Analytics",
                "risk": "high",
                "bytes_sent": 15400,
                "bytes_recv": 1200,
                "is_encrypted": True
            },
            {
                # GitHub API integration socket.
                "inode": 111402,
                "proto": "TCP",
                "local_ip": "192.168.1.42",
                "local_port": 54892,
                "remote_ip": "140.82.121.4",
                "remote_port": 443,
                "remote_domain": "api.github.com",
                "state": "ESTABLISHED",
                "category": "Cloud Infrastructure",
                "risk": "low",
                "bytes_sent": 4200,
                "bytes_recv": 18900,
                "is_encrypted": True
            }
        ]
    }
]


class ScenarioGenerator:
    """
    Simulates dynamic packet transfer velocity and process states for interactive visualization.
    """

    def __init__(self):
        # Step counter incremented on every tick to create periodic burst effects.
        self.step_counter: int = 0

    def generate_tick(self, isolated_pids: set, panic_mode: bool) -> Dict[int, Dict]:
        """
        Calculates simulated bandwidth deltas and connection states for each simulated process.
        """
        # Increment the tick step counter.
        self.step_counter += 1
        # Initialize an empty dictionary to collect the updated process states.
        result: Dict[int, Dict] = {}

        # Iterate over each process template in the scenario dataset.
        for p_tmpl in SCENARIO_PROCESSES:
            # Extract the simulated process ID.
            pid = p_tmpl["pid"]
            # Determine if this process is subject to per-PID isolation or global panic.
            is_isolated = pid in isolated_pids or panic_mode

            # Create a shallow copy of the process dictionary.
            p_copy = dict(p_tmpl)
            # Assign the current isolation state boolean.
            p_copy["is_isolated"] = is_isolated

            # Simulate minor organic CPU load fluctuations.
            base_cpu = p_tmpl["cpu_percent"]
            p_copy["cpu_percent"] = max(0.1, round(base_cpu + random.uniform(-0.3, 0.5), 1))

            # Process individual sockets for this process.
            sockets = []
            for s_tmpl in p_tmpl["sockets"]:
                # Copy socket dictionary template.
                s_copy = dict(s_tmpl)
                # If the process is not isolated, simulate active network traffic.
                if not is_isolated:
                    # Inject intermittent burst multiplier for telemetry sockets.
                    burst_multiplier = 3.5 if (self.step_counter % 6 == 0 and s_copy["risk"] == "high") else 1.0
                    # Calculate transmission byte delta.
                    bytes_tx_delta = int(random.randint(128, 2048) * burst_multiplier)
                    # Calculate reception byte delta.
                    bytes_rx_delta = int(random.randint(64, 4096) * burst_multiplier)
                    # Accumulate byte counters.
                    s_copy["bytes_sent"] = s_tmpl["bytes_sent"] + (self.step_counter * bytes_tx_delta)
                    s_copy["bytes_recv"] = s_tmpl["bytes_recv"] + (self.step_counter * bytes_rx_delta)
                    # Calculate throughput in bits per second (bps).
                    s_copy["bandwidth_out_bps"] = bytes_tx_delta * 8
                    s_copy["bandwidth_in_bps"] = bytes_rx_delta * 8
                else:
                    # If isolated, mark connection state as BLOCKED and zero out bandwidth.
                    s_copy["state"] = "BLOCKED"
                    s_copy["bandwidth_out_bps"] = 0
                    s_copy["bandwidth_in_bps"] = 0
                    s_copy["risk"] = "low"
                # Add enriched socket to process socket list.
                sockets.append(s_copy)

            # Assign sockets list to the process copy.
            p_copy["sockets"] = sockets
            # Store process in the result dictionary keyed by PID.
            result[pid] = p_copy

        # Return the populated dictionary of simulated processes.
        return result
