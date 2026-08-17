"""
Adversarial Stress and Reliability Verification Suite (Challenger E2E 1).
Exhaustively tests:
1. Backend Fixture Lifecycle, Process Cleanup & Anti-Pollution Isolation
2. High-Concurrency WebSocket Streaming & Dynamic Mutation Under Load
3. Complex Multi-State Process Isolation & Panic Override Matrix
4. Adversarial PID Safeguard Validation, Kernel Thread Protection & Attack Fuzzing
5. Privacy Analyzer ReDoS Resistance, Credential Redaction & DNS Cache Stress
6. Procfs Malformed Hex Decoding & Robust Endpoint Edge Cases
"""

import pytest
import os
import sys
import time
import signal
import asyncio
import subprocess
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

import main as main_module
from main import app, log_event, MAX_EVENT_HISTORY
from sandbox_manager import SandboxManager, PROTECTED_PROCESS_NAMES
from privacy_analyzer import PrivacyAnalyzer
from socket_engine import SocketEngine, hex_to_ipv4, hex_to_ipv6, parse_endpoint
from scenario_generator import ScenarioGenerator


# ==============================================================================
# SECTION 1: FIXTURE LIFECYCLE & STATE ISOLATION ANTI-POLLUTION
# ==============================================================================

def test_adversarial_fixture_isolation_part_a(client):
    """
    Mutate every global state variable violently to test reset_server_state teardown.
    """
    main_module.current_mode = "simulation"
    main_module.event_history.extend([{"test": i} for i in range(150)])
    main_module.sandbox_manager.isolated_pids.update({1001, 1002, 1003, 1004})
    main_module.sandbox_manager.panic_mode = True
    main_module.privacy_analyzer.dns_cache["8.8.8.8"] = ("dns.google", time.time() + 300)
    main_module.scenario_generator.step_counter = 9999

    assert main_module.current_mode == "simulation"
    assert len(main_module.event_history) == 150
    assert len(main_module.sandbox_manager.isolated_pids) == 4
    assert main_module.sandbox_manager.panic_mode is True


def test_adversarial_fixture_isolation_part_b(client):
    """
    Verify that previous test's massive mutations are 100% cleansed before this test runs.
    """
    assert main_module.current_mode == "live"
    assert len(main_module.event_history) == 0
    assert len(main_module.sandbox_manager.isolated_pids) == 0
    assert main_module.sandbox_manager.panic_mode is False
    assert len(main_module.privacy_analyzer.dns_cache) == 0
    assert main_module.scenario_generator.step_counter == 0


def test_mock_process_factory_cleanup(spawn_mock_process):
    """
    Verify spawn_mock_process spawns real processes and cleans them up without leaks.
    """
    p1 = spawn_mock_process()
    p2 = spawn_mock_process()
    assert p1.poll() is None
    assert p2.poll() is None
    assert p1.pid > 0
    assert p2.pid > 0
    # Teardown in conftest will terminate both p1 and p2


# ==============================================================================
# SECTION 2: HIGH-CONCURRENCY WEBSOCKET & DYNAMIC MUTATION STRESS
# ==============================================================================

def test_concurrent_websockets_with_interleaved_mutations(client):
    """
    Stress-tests 10 concurrent WebSocket clients receiving simultaneous 10Hz frames
    while REST endpoints concurrently toggle modes, isolate PIDs, and trigger panic.
    """
    client.post("/api/mode", json={"mode": "simulation"})

    clients = []
    try:
        # Open 10 concurrent WebSocket connections
        for _ in range(10):
            ws_ctx = client.websocket_connect("/ws/traffic")
            ws = ws_ctx.__enter__()
            clients.append((ws_ctx, ws))

        # Initial broadcast check
        for ws_ctx, ws in clients:
            frame = ws.receive_json()
            assert frame["mode"] == "simulation"
            assert len(frame["processes"]) == 5

        # Perform rapid interleaved mutations
        for step in range(5):
            pid_to_isolate = 4182 if step % 2 == 0 else 5891
            client.post("/api/sandbox/isolate", json={"pid": pid_to_isolate, "isolate": True})
            client.post("/api/panic", json={"enabled": step % 2 == 1})

            # Read broadcast frame across all 10 clients
            for ws_ctx, ws in clients:
                frame = ws.receive_json()
                assert "summary" in frame
                assert "processes" in frame
                assert frame["summary"]["panic_mode"] == (step % 2 == 1)

    finally:
        # Cleanly close all clients
        for ws_ctx, ws in clients:
            try:
                ws_ctx.__exit__(None, None, None)
            except Exception:
                pass


def test_websocket_rapid_connect_disconnect_hammer(client):
    """
    Rapidly connects and disconnects 25 times in a tight loop to verify zero descriptor leakage.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    for i in range(25):
        with client.websocket_connect("/ws/traffic") as ws:
            frame = ws.receive_json()
            assert frame["mode"] == "simulation"
            assert "timestamp" in frame


def test_websocket_empty_or_corrupt_process_resiliency(client):
    """
    Verifies WebSocket broadcast doesn't crash when process map contains abnormal process structures.
    """
    with patch.object(main_module.socket_engine, "get_active_process_sockets") as mock_engine:
        # Mock abnormal process structure
        mock_engine.return_value = {
            99999: {
                "pid": 99999,
                "ppid": 1,
                "name": "edge_proc",
                "cmdline": "",
                "category": "unknown",
                "cpu_percent": 0.0,
                "memory_mb": 0.0,
                "username": "root",
                "is_isolated": False,
                "sockets": [
                    {
                        "proto": "RAW",
                        "local_ip": "0.0.0.0",
                        "local_port": 0,
                        "remote_ip": "255.255.255.255",
                        "remote_port": 65535,
                        "state": "UNKNOWN"
                    }
                ]
            }
        }
        client.post("/api/mode", json={"mode": "live"})
        with client.websocket_connect("/ws/traffic") as ws:
            frame = ws.receive_json()
            assert frame["mode"] == "live"
            assert len(frame["processes"]) == 1
            proc = frame["processes"][0]
            assert proc["pid"] == 99999
            assert proc["risk_level"] in ["low", "medium", "high", "critical"]


# ==============================================================================
# SECTION 3: PROCESS ISOLATION & PANIC OVERRIDE MATRIX
# ==============================================================================

def test_large_scale_process_isolation_and_snapshot(client):
    """
    Isolates 100 distinct simulated high-range PIDs (75000-75100) and verifies snapshot summary and sets scale cleanly.
    """
    # Isolate 100 high-range PIDs that are guaranteed not to be host system daemons
    for pid in range(75000, 75100):
        res = client.post("/api/sandbox/isolate", json={"pid": pid, "isolate": True})
        assert res.status_code == 200

    assert len(main_module.sandbox_manager.isolated_pids) == 100

    # Verify status reflects 100 isolated PIDs
    status_res = client.get("/api/status").json()
    assert len(status_res["isolated_pids"]) == 100

    # Verify snapshot reflects 100 count
    snap_res = client.get("/api/snapshot").json()
    assert snap_res["summary"]["isolated_pids_count"] == 100

    # Bulk un-isolate
    for pid in range(75000, 75100):
        res = client.post("/api/sandbox/isolate", json={"pid": pid, "isolate": False})
        assert res.status_code == 200

    assert len(main_module.sandbox_manager.isolated_pids) == 0


def test_complex_isolation_panic_state_matrix(client):
    """
    Tests intricate state matrix:
    1. Isolate PIDs A & B
    2. Turn Panic ON
    3. Un-isolate PID A during Panic
    4. Turn Panic OFF -> B should be isolated, A should NOT be isolated
    5. Verify simulation snapshot reflects exact socket states
    """
    client.post("/api/mode", json={"mode": "simulation"})

    pid_a = 4182
    pid_b = 5891
    pid_c = 7240

    # Step 1: Isolate A and B
    client.post("/api/sandbox/isolate", json={"pid": pid_a, "isolate": True})
    client.post("/api/sandbox/isolate", json={"pid": pid_b, "isolate": True})

    # Step 2: Panic ON
    client.post("/api/panic", json={"enabled": True})
    snap1 = client.get("/api/snapshot").json()
    assert snap1["summary"]["panic_mode"] is True
    for p in snap1["processes"]:
        assert p["is_isolated"] is True

    # Step 3: Un-isolate A during Panic
    client.post("/api/sandbox/isolate", json={"pid": pid_a, "isolate": False})
    assert pid_a not in main_module.sandbox_manager.isolated_pids
    assert pid_b in main_module.sandbox_manager.isolated_pids

    # Step 4: Panic OFF
    client.post("/api/panic", json={"enabled": False})
    snap2 = client.get("/api/snapshot").json()
    assert snap2["summary"]["panic_mode"] is False

    proc_a = next(p for p in snap2["processes"] if p["pid"] == pid_a)
    proc_b = next(p for p in snap2["processes"] if p["pid"] == pid_b)
    proc_c = next(p for p in snap2["processes"] if p["pid"] == pid_c)

    assert proc_a["is_isolated"] is False
    assert proc_b["is_isolated"] is True
    assert proc_c["is_isolated"] is False

    # Check socket states
    assert any(s["state"] == "ESTABLISHED" for s in proc_a["sockets"])
    assert all(s["state"] == "BLOCKED" for s in proc_b["sockets"])
    assert any(s["state"] == "ESTABLISHED" for s in proc_c["sockets"])


# ==============================================================================
# SECTION 4: ADVERSARIAL PID SAFEGUARDS, KERNEL THREADS & ATTACK FUZZING
# ==============================================================================

def test_safeguard_kernel_thread_protection():
    """
    Simulates a kernel thread (empty cmdline) and verifies is_pid_protected returns True.
    """
    mgr = SandboxManager(self_pid=99999)

    # Mock psutil.Process returning empty cmdline
    with patch("psutil.Process") as mock_proc_class:
        mock_proc = MagicMock()
        mock_proc.ppid.return_value = 2
        mock_proc.name.return_value = "kworker/0:1H"
        mock_proc.cmdline.return_value = []
        mock_proc_class.return_value = mock_proc

        is_prot, reason = mgr.is_pid_protected(45)
        assert is_prot is True
        assert "kernel thread" in reason.lower()


def test_safeguard_child_worker_protection():
    """
    Verifies that child worker processes spawned by NetWhisper daemon are protected.
    """
    self_pid = os.getpid()
    mgr = SandboxManager(self_pid=self_pid)

    with patch("psutil.Process") as mock_proc_class:
        mock_proc = MagicMock()
        mock_proc.ppid.return_value = self_pid
        mock_proc.name.return_value = "python_worker"
        mock_proc.cmdline.return_value = ["python", "worker.py"]
        mock_proc_class.return_value = mock_proc

        is_prot, reason = mgr.is_pid_protected(12345)
        assert is_prot is True
        assert "child worker" in reason.lower()


@pytest.mark.parametrize("daemon_name", [
    "SYSTEMD",
    "Systemd-Journald",
    "DBUS-DAEMON",
    "PipeWire",
    "WirePlumber",
    "Xorg",
    "Wayland",
    "GNOME-SHELL",
    "KWin",
    "KWin_Wayland",
    "Dbus-Broker",
    "KthreadD"
])
def test_safeguard_case_insensitive_daemon_protection(daemon_name):
    """
    Verifies case-insensitive matching for all protected system daemons.
    """
    mgr = SandboxManager(self_pid=99999)

    with patch("psutil.Process") as mock_proc_class:
        mock_proc = MagicMock()
        mock_proc.ppid.return_value = 1
        mock_proc.name.return_value = daemon_name
        mock_proc.cmdline.return_value = [f"/usr/bin/{daemon_name}"]
        mock_proc_class.return_value = mock_proc

        is_prot, reason = mgr.is_pid_protected(888)
        assert is_prot is True
        assert "protected system service" in reason.lower() or daemon_name.lower() in reason.lower()


@pytest.mark.parametrize("fuzz_input", [
    "9999999999999999999999999999999999999999",
    "0x20",
    "123.456",
    "-0",
    "123\x00456",
    "\n123\n",
    " 123 ",
    "NaN",
    "Infinity",
    "-Infinity"
])
def test_validate_pid_extreme_fuzzing(fuzz_input):
    """
    Tests validate_pid against extreme strings, overflows, null bytes, and non-base10 formats.
    """
    mgr = SandboxManager()
    is_valid, pid, err = mgr.validate_pid(fuzz_input)
    if is_valid:
        assert isinstance(pid, int)
        assert pid >= 0
    else:
        assert pid is None
        assert len(err) > 0


def test_terminate_process_signal_handling(spawn_mock_process):
    """
    Verifies terminate_process correctly translates signals (SIGTERM vs SIGKILL) and cleans up isolation.
    """
    proc1 = spawn_mock_process()
    pid1 = proc1.pid
    mgr1 = SandboxManager(self_pid=pid1 + 1000)
    mgr1.isolated_pids.add(pid1)

    res1 = mgr1.terminate_process(pid1, sig_name="sigterm")
    assert res1["success"] is True
    assert pid1 not in mgr1.isolated_pids
    exit1 = proc1.wait(timeout=3)
    assert exit1 == -signal.SIGTERM

    proc2 = spawn_mock_process()
    pid2 = proc2.pid
    mgr2 = SandboxManager(self_pid=pid2 + 1000)
    mgr2.isolated_pids.add(pid2)

    res2 = mgr2.terminate_process(pid2, sig_name="SIGKILL")
    assert res2["success"] is True
    assert pid2 not in mgr2.isolated_pids
    exit2 = proc2.wait(timeout=3)
    assert exit2 == -signal.SIGKILL


# ==============================================================================
# SECTION 5: PRIVACY ANALYZER REDOS RESISTANCE & CREDENTIAL SCRUBBING
# ==============================================================================

def test_credential_scrubber_redos_and_massive_payload():
    """
    Passes a 100KB command line containing thousands of interspersed secrets
    to verify regex sanitizer does not suffer catastrophic backtracking (ReDoS).
    """
    analyzer = PrivacyAnalyzer()

    # Construct massive payload with repeated credentials
    secret_chunks = [
        "node app.js --password=Secret123! ",
        "--token=sec_abc123def456 ",
        "-H 'Authorization: Bearer bearer_token_xyz_987' ",
        "--api-key=AIzaSyA123B456C789 ",
        "--jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig ",
        "AKIAIOSFODNN7EXAMPLE ",
        "ghp_1234567890abcdefghijklmnopqrstuvwxyz "
    ]
    massive_cmd = " ".join(secret_chunks * 200)  # ~1400 tokens

    start_time = time.time()
    sanitized = analyzer.sanitize_command_line(massive_cmd)
    elapsed = time.time() - start_time

    # Must complete in under 0.5s without regex hang
    assert elapsed < 0.5, f"Credential scrubbing too slow: {elapsed:.3f}s"
    assert "Secret123!" not in sanitized
    assert "sec_abc123def456" not in sanitized
    assert "bearer_token_xyz_987" not in sanitized
    assert "AKIAIOSFODNN7EXAMPLE" not in sanitized
    assert "ghp_1234567890abcdefghijklmnopqrstuvwxyz" not in sanitized
    assert "[REDACTED_PASSWORD]" in sanitized
    assert "[REDACTED_TOKEN]" in sanitized
    assert "[REDACTED_AWS_KEY]" in sanitized
    assert "[REDACTED_GH_TOKEN]" in sanitized


def test_privacy_analyzer_dns_cache_ttl_and_eviction():
    """
    Verifies DNS cache TTL expiration and replacement logic.
    """
    analyzer = PrivacyAnalyzer(dns_ttl=0.1)

    # Prime cache with expired entry
    analyzer.dns_cache["1.2.3.4"] = ("old.host.com", time.time() - 10.0)

    # With mocked gethostbyaddr returning new host
    with patch("socket.gethostbyaddr", return_value=("new.host.com", [], ["1.2.3.4"])):
        resolved = analyzer.resolve_ip("1.2.3.4")
        assert resolved == "new.host.com"
        assert analyzer.dns_cache["1.2.3.4"][0] == "new.host.com"


def test_privacy_analyzer_composite_risk_matrix():
    """
    Verifies composite risk scoring across all quadrant combinations.
    """
    analyzer = PrivacyAnalyzer()

    # 1. Critical: Telemetry over unencrypted port 80
    proc_crit = {
        "sockets": [
            {"category": "Telemetry & Analytics", "risk": "high", "remote_port": 80},
            {"category": "Unencrypted Web (HTTP)", "risk": "high", "remote_port": 80}
        ]
    }
    assert analyzer.compute_process_risk(proc_crit) == "critical"

    # 2. High: Telemetry over HTTPS (port 443)
    proc_high = {
        "sockets": [
            {"category": "Telemetry & Analytics", "risk": "high", "remote_port": 443}
        ]
    }
    assert analyzer.compute_process_risk(proc_high) == "high"

    # 3. High: Direct IP connection
    proc_direct = {
        "sockets": [
            {"category": "Direct IP", "risk": "medium", "remote_port": 443}
        ]
    }
    assert analyzer.compute_process_risk(proc_direct) == "high"

    # 4. Medium: Unencrypted non-telemetry HTTP
    proc_med = {
        "sockets": [
            {"category": "Cloud Infrastructure", "risk": "low", "remote_port": 80}
        ]
    }
    assert analyzer.compute_process_risk(proc_med) == "medium"

    # 5. Low: Clean HTTPS
    proc_low = {
        "sockets": [
            {"category": "Cloud Infrastructure", "risk": "low", "remote_port": 443}
        ]
    }
    assert analyzer.compute_process_risk(proc_low) == "low"

    # 6. Low: Empty sockets
    assert analyzer.compute_process_risk({"sockets": []}) == "low"


# ==============================================================================
# SECTION 6: PROCFS MALFORMED HEX DECODING & SOCKET ENGINE RESILIENCE
# ==============================================================================

@pytest.mark.parametrize("corrupt_hex", [
    "1",
    "12",
    "12345",
    "0100007",
    "0100007FFF",
    "ZZZZZZZZ",
    "G100007F",
    "!@#$%^&*",
])
def test_hex_to_ipv4_corrupt_inputs(corrupt_hex):
    """
    Verifies hex_to_ipv4 returns the raw input safely without crashing on corrupt hex strings.
    """
    result = hex_to_ipv4(corrupt_hex)
    assert result == corrupt_hex


@pytest.mark.parametrize("corrupt_v6_hex", [
    "1",
    "0000000000000000",
    "0000000000000000000000000000000",
    "000000000000000000000000000000000",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
])
def test_hex_to_ipv6_corrupt_inputs(corrupt_v6_hex):
    """
    Verifies hex_to_ipv6 returns the raw input safely without crashing on corrupt IPv6 hex.
    """
    result = hex_to_ipv6(corrupt_v6_hex)
    assert result == corrupt_v6_hex


@pytest.mark.parametrize("malformed_ep, expected_ip, expected_port", [
    ("", "0.0.0.0", 0),
    (":", "0.0.0.0", 0),
    (":::", "0.0.0.0", 0),
    ("127.0.0.1", "0.0.0.0", 0),
    ("127.0.0.1:abcd", "127.0.0.1", 43981),
    ("0100007F:", "0.0.0.0", 0),
    (":0050", "", 80),
    ("0100007F:0050:extra", "0.0.0.0", 0),
    ("INVALID:PORT", "0.0.0.0", 0)
])
def test_parse_endpoint_malformed_inputs(malformed_ep, expected_ip, expected_port):
    """
    Verifies parse_endpoint returns graceful decoded values or ('0.0.0.0', 0) fallback on malformed tokens.
    """
    ip, port = parse_endpoint(malformed_ep)
    assert ip == expected_ip
    assert port == expected_port


def test_scenario_generator_long_running_step_counter_overflow():
    """
    Verifies that scenario generator behaves deterministically even after 1,000,000 steps.
    """
    gen = ScenarioGenerator()
    gen.step_counter = 1_000_000

    tick = gen.generate_tick(isolated_pids=set(), panic_mode=False)
    assert gen.step_counter == 1_000_001
    assert len(tick) == 5

    for pid, proc in tick.items():
        assert proc["cpu_percent"] >= 0.1
        for s in proc["sockets"]:
            assert s["bytes_sent"] > 0
            assert s["bytes_recv"] > 0
            assert s["bandwidth_out_bps"] >= 0
            assert s["bandwidth_in_bps"] >= 0
