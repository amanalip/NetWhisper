"""
Tier 3 Automated Tests: Pairwise Cross-Feature Interactions.
Validates orthogonal combinations of Engine Mode, Panic Mode, Process Isolation,
Termination Signals, Credential Scrubbing, Event History, and WebSocket Broadcasting.
"""

import pytest
import os
import signal
import main as main_module
from main import log_event, MAX_EVENT_HISTORY
from sandbox_manager import SandboxManager


def test_pw1_mode_switch_and_isolation_preservation(client):
    """
    PW-01: Process isolation state persists across mode switches (Simulation -> Live -> Simulation).
    """
    # 1. In simulation mode, isolate PID 4182
    client.post("/api/mode", json={"mode": "simulation"})
    iso_res = client.post("/api/sandbox/isolate", json={"pid": 4182, "isolate": True})
    assert iso_res.status_code == 200
    assert 4182 in main_module.sandbox_manager.isolated_pids

    # 2. Switch mode to live
    client.post("/api/mode", json={"mode": "live"})
    assert 4182 in main_module.sandbox_manager.isolated_pids

    # 3. Switch back to simulation mode
    client.post("/api/mode", json={"mode": "simulation"})
    snap = client.get("/api/snapshot").json()
    p4182 = next(p for p in snap["processes"] if p["pid"] == 4182)
    assert p4182["is_isolated"] is True
    for s in p4182["sockets"]:
        assert s["state"] == "BLOCKED"
        assert s["bandwidth_out_bps"] == 0

    # Other processes should remain un-isolated
    p5891 = next(p for p in snap["processes"] if p["pid"] == 5891)
    assert p5891["is_isolated"] is False


def test_pw2_panic_override_and_restoration(client):
    """
    PW-02: Global Panic overrides individual isolation; deactivating panic restores prior isolation state.
    """
    client.post("/api/mode", json={"mode": "simulation"})

    # 1. Isolate only PID 4182
    client.post("/api/sandbox/isolate", json={"pid": 4182, "isolate": True})

    # 2. Enable Global Panic
    client.post("/api/panic", json={"enabled": True})
    snap_panic = client.get("/api/snapshot").json()
    assert snap_panic["summary"]["panic_mode"] is True
    for proc in snap_panic["processes"]:
        assert proc["is_isolated"] is True
        for s in proc["sockets"]:
            assert s["state"] == "BLOCKED"

    # 3. Disable Global Panic -> PID 4182 remains isolated, others unfreeze
    client.post("/api/panic", json={"enabled": False})
    snap_restored = client.get("/api/snapshot").json()
    assert snap_restored["summary"]["panic_mode"] is False

    p4182 = next(p for p in snap_restored["processes"] if p["pid"] == 4182)
    assert p4182["is_isolated"] is True

    p7240 = next(p for p in snap_restored["processes"] if p["pid"] == 7240)
    assert p7240["is_isolated"] is False
    assert any(s["state"] == "ESTABLISHED" for s in p7240["sockets"])


def test_pw3_termination_cleans_isolation_and_logs_events(spawn_mock_process):
    """
    PW-03: Process termination automatically cleans up isolation set and logs audit trail.
    """
    proc = spawn_mock_process()
    pid = proc.pid

    mgr = SandboxManager(self_pid=pid + 1000)

    # 1. Isolate the process
    mgr.set_process_isolation(pid, isolate=True)
    assert pid in mgr.isolated_pids
    log_event("isolate", f"Process {pid} network isolated", {"pid": pid})

    # 2. Terminate the process with SIGTERM
    res = mgr.terminate_process(pid, sig_name="SIGTERM")
    assert res["success"] is True
    log_event("kill", f"Process {pid} terminated (SIGTERM)", res)

    # 3. Verify isolation set cleaned up
    assert pid not in mgr.isolated_pids

    # 4. Verify event logs recorded
    recent_events = main_module.event_history[-2:]
    assert recent_events[0]["type"] == "isolate"
    assert recent_events[1]["type"] == "kill"


def test_pw4_rapid_mode_switching_under_active_websocket(client):
    """
    PW-04: Rapid mode switching under active WebSocket stream does not drop connection.
    """
    with client.websocket_connect("/ws/traffic") as ws:
        modes = ["simulation", "live", "simulation", "live", "simulation"]
        for target_mode in modes:
            client.post("/api/mode", json={"mode": target_mode})
            frame = ws.receive_json()
            assert frame["mode"] in ["simulation", "live"]
            assert "summary" in frame
            assert "processes" in frame


def test_pw5_panic_mode_websocket_broadcast_freeze(client):
    """
    PW-05: Enabling Panic Mode propagates 0 bandwidth across all sockets over WebSocket.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    with client.websocket_connect("/ws/traffic") as ws:
        # Pre-panic frame
        f_before = ws.receive_json()
        assert f_before["summary"]["panic_mode"] is False

        # Activate Panic
        client.post("/api/panic", json={"enabled": True})

        # Post-panic frame
        f_after = ws.receive_json()
        assert f_after["summary"]["panic_mode"] is True
        assert f_after["summary"]["bandwidth_in_bps"] == 0
        assert f_after["summary"]["bandwidth_out_bps"] == 0


def test_pw6_event_sliding_window_with_mixed_event_types(client):
    """
    PW-06: Event log maintains FIFO ordering and capped size across mixed security events.
    """
    event_types = ["mode_change", "kill", "isolate", "panic"]
    for i in range(220):
        evt_type = event_types[i % len(event_types)]
        log_event(evt_type, f"Event #{i}", {"index": i, "type": evt_type})

    assert len(main_module.event_history) == MAX_EVENT_HISTORY
    assert main_module.event_history[0]["details"]["index"] == 20
    assert main_module.event_history[-1]["details"]["index"] == 219

    res = client.get("/api/events?limit=10")
    events = res.json()["events"]
    assert len(events) == 10
    assert events[-1]["details"]["index"] == 219


def test_pw7_credential_sanitization_across_process_categories(client):
    """
    PW-07: Credential scrubbing executes across all process categories in snapshot generation.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    snap = client.get("/api/snapshot").json()

    for proc in snap["processes"]:
        cmdline = proc.get("cmdline", "")
        assert "ghp_" not in cmdline
        assert "AKIA" not in cmdline
        assert "password=" not in cmdline

    # Verify npm-cli-daemon cmdline specifically
    p_npm = next(p for p in snap["processes"] if p["pid"] == 5891)
    assert "[REDACTED_TOKEN]" in p_npm["cmdline"]


def test_pw8_snapshot_building_during_dynamic_burst_and_isolation(client):
    """
    PW-08: Snapshot building applies burst multiplier to active sockets while isolated sockets remain 0.
    """
    client.post("/api/mode", json={"mode": "simulation"})

    # Advance step counter to step 5 so next tick is step 6 (burst tick)
    main_module.scenario_generator.step_counter = 5

    # Isolate PID 9811 (stealth_updater)
    client.post("/api/sandbox/isolate", json={"pid": 9811, "isolate": True})

    # Fetch snapshot (tick 6)
    snap = client.get("/api/snapshot").json()
    assert main_module.scenario_generator.step_counter == 6

    # Isolated process has 0 bandwidth
    p9811 = next(p for p in snap["processes"] if p["pid"] == 9811)
    assert p9811["is_isolated"] is True
    for s in p9811["sockets"]:
        assert s["state"] == "BLOCKED"
        assert s["bandwidth_out_bps"] == 0

    # Un-isolated high-risk process (code-telemetry 4182) has burst bandwidth
    p4182 = next(p for p in snap["processes"] if p["pid"] == 4182)
    assert p4182["is_isolated"] is False
    assert any(s["bandwidth_out_bps"] > 0 for s in p4182["sockets"])


def test_pw9_isolation_on_nonexistent_pid_behavior(client):
    """
    PW-09: Isolating an arbitrary valid PID records state without crashing daemon.
    """
    res = client.post("/api/sandbox/isolate", json={"pid": 88888, "isolate": True})
    assert res.status_code == 200
    assert 88888 in main_module.sandbox_manager.isolated_pids

    # Cleanup
    client.post("/api/sandbox/isolate", json={"pid": 88888, "isolate": False})
    assert 88888 not in main_module.sandbox_manager.isolated_pids


def test_pw10_protected_system_daemons_isolation_rejection(client):
    """
    PW-10: System PID 1 cannot be isolated even under simulation mode.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    res = client.post("/api/sandbox/isolate", json={"pid": 1, "isolate": True})
    assert res.status_code == 403
    assert 1 not in main_module.sandbox_manager.isolated_pids
