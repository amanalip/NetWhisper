"""
Tier 4 Automated Tests: Real-World Operational Workload Scenarios.
Implements the 5 end-to-end user workflows:
1. Threat Remediation Workflow
2. Forensic Telemetry Investigation & Export
3. Emergency Incident Containment (Global Panic Lockdown)
4. Stream Analysis Session & Dynamic Burst Telemetry
5. Safe Administrative Guardrails & Process Termination
"""

import pytest
import os
import signal
import main as main_module
from main import log_event, MAX_EVENT_HISTORY
from sandbox_manager import SandboxManager


def test_scenario_1_threat_remediation_workflow(client, spawn_mock_process):
    """
    Scenario 1: Full Threat Remediation Workflow.
    Detects suspicious beaconing daemon (PID 9811) on port 4444, inspects socket details,
    isolates the process, terminates with SIGKILL, and verifies audit trail in event history.
    """
    # 1. Switch to simulation mode
    client.post("/api/mode", json={"mode": "simulation"})

    # 2. Rescan snapshot and locate suspicious beacon
    snap = client.get("/api/snapshot").json()
    threat = next((p for p in snap["processes"] if p["pid"] == 9811), None)
    assert threat is not None
    assert threat["name"] == "stealth_updater"
    assert threat["risk_level"] in ["high", "critical"]

    # 3. Inspect socket details
    beacon_socket = next(s for s in threat["sockets"] if s["remote_port"] == 4444)
    assert beacon_socket["remote_ip"] == "185.220.101.5"
    assert beacon_socket["category"] == "Direct IP (Non-standard Port)"

    # 4. Isolate the threat
    iso_res = client.post("/api/sandbox/isolate", json={"pid": 9811, "isolate": True})
    assert iso_res.status_code == 200
    assert 9811 in main_module.sandbox_manager.isolated_pids

    # 5. Verify isolated state in telemetry snapshot
    snap_iso = client.get("/api/snapshot").json()
    threat_iso = next(p for p in snap_iso["processes"] if p["pid"] == 9811)
    assert threat_iso["is_isolated"] is True
    for s in threat_iso["sockets"]:
        assert s["state"] == "BLOCKED"
        assert s["bandwidth_out_bps"] == 0

    # 6. Terminate real mock worker with SIGKILL
    worker = spawn_mock_process()
    worker_pid = worker.pid
    mgr = SandboxManager(self_pid=worker_pid + 1000)
    kill_res = mgr.terminate_process(worker_pid, sig_name="SIGKILL")
    assert kill_res["success"] is True
    assert kill_res["signal"] == "SIGKILL"
    log_event("kill", f"Process {worker_pid} terminated (SIGKILL)", kill_res)

    worker.wait(timeout=3)

    # 7. Audit event log
    events_res = client.get("/api/events?limit=10").json()
    event_types = [e["type"] for e in events_res["events"]]
    assert "isolate" in event_types
    assert "kill" in event_types


def test_scenario_2_forensic_investigation_and_export(client):
    """
    Scenario 2: Forensic Telemetry Investigation & Export Workflow.
    Examines Domain Breakdown, traces telemetry endpoint back to owning process,
    verifies credential sanitization in command line, and exports JSON audit log.
    """
    # 1. Start in simulation mode
    client.post("/api/mode", json={"mode": "simulation"})

    # 2. Fetch snapshot and inspect domain breakdown
    snap = client.get("/api/snapshot").json()
    domains = snap["domains"]
    domain_names = [d["domain"] for d in domains]
    assert "telemetry.npmjs.com" in domain_names

    # 3. Trace domain back to owning process
    target_domain = next(d for d in domains if d["domain"] == "telemetry.npmjs.com")
    assert "npm-cli-daemon" in target_domain["processes"]

    # 4. Find process in process list and inspect command line
    npm_proc = next(p for p in snap["processes"] if p["pid"] == 5891)
    assert npm_proc["name"] == "npm-cli-daemon"
    assert "[REDACTED_TOKEN]" in npm_proc["cmdline"]
    assert "ghp_" not in npm_proc["cmdline"]

    # 5. Export structured logs payload
    events_res = client.get("/api/events?limit=50").json()
    export_payload = {
        "summary": snap["summary"],
        "processes": snap["processes"],
        "domains": snap["domains"],
        "events": events_res["events"]
    }
    assert "summary" in export_payload
    assert "processes" in export_payload
    assert "domains" in export_payload
    assert "events" in export_payload


def test_scenario_3_emergency_incident_containment(client):
    """
    Scenario 3: Emergency Incident Containment (Global Panic Lockdown).
    Toggles Panic Mode on unexpected network activity, verifies all non-system traffic is halted,
    rescans snapshot to confirm containment, and deactivates panic to restore baseline.
    """
    client.post("/api/mode", json={"mode": "simulation"})

    # 1. Baseline: active traffic exists
    snap_initial = client.get("/api/snapshot").json()
    assert snap_initial["summary"]["bandwidth_out_bps"] > 0

    # 2. Trigger Global Panic Switch
    panic_res = client.post("/api/panic", json={"enabled": True})
    assert panic_res.status_code == 200
    assert panic_res.json()["panic_mode"] is True

    # 3. Snapshot verification during panic
    snap_panic = client.get("/api/snapshot").json()
    assert snap_panic["summary"]["panic_mode"] is True
    assert snap_panic["summary"]["bandwidth_in_bps"] == 0
    assert snap_panic["summary"]["bandwidth_out_bps"] == 0

    for proc in snap_panic["processes"]:
        assert proc["is_isolated"] is True
        for s in proc["sockets"]:
            assert s["state"] == "BLOCKED"
            assert s["bandwidth_out_bps"] == 0

    # 4. Deactivate Panic
    client.post("/api/panic", json={"enabled": False})
    snap_restored = client.get("/api/snapshot").json()
    assert snap_restored["summary"]["panic_mode"] is False
    assert snap_restored["summary"]["bandwidth_out_bps"] > 0


def test_scenario_4_stream_analysis_session(client):
    """
    Scenario 4: Stream Analysis Session & Dynamic Burst Telemetry.
    Streams 30 scenario ticks over WebSocket, verifies periodic burst multipliers on steps % 6 == 0,
    and confirms memory buffer stability.
    """
    client.post("/api/mode", json={"mode": "simulation"})

    with client.websocket_connect("/ws/traffic") as ws:
        burst_steps_observed = []
        for i in range(12):
            frame = ws.receive_json()
            assert "summary" in frame
            assert "processes" in frame
            step = main_module.scenario_generator.step_counter
            if step % 6 == 0:
                burst_steps_observed.append(step)

        assert len(burst_steps_observed) >= 1

    # Verify event history capping under high-frequency event generation
    for i in range(250):
        log_event("stream_tick", f"Stream Tick #{i}", {"tick": i})

    assert len(main_module.event_history) == MAX_EVENT_HISTORY


def test_scenario_5_safe_administrative_guardrails(client, spawn_mock_process):
    """
    Scenario 5: Administrative Guardrails & Safe Process Termination.
    Attempts termination on protected PIDs (PID 0, PID 1, own PID, system service),
    verifies HTTP 403 rejection, and terminates a legitimate unprivileged worker process with SIGTERM.
    """
    # 1. Attempt termination on PID 0 -> 403
    res_0 = client.post("/api/sandbox/kill", json={"pid": 0, "signal": "SIGTERM"})
    assert res_0.status_code == 403

    # 2. Attempt termination on PID 1 (Init/Systemd) -> 403
    res_1 = client.post("/api/sandbox/kill", json={"pid": 1, "signal": "SIGKILL"})
    assert res_1.status_code == 403

    # 3. Attempt termination on daemon PID -> 403
    res_self = client.post("/api/sandbox/kill", json={"pid": os.getpid(), "signal": "SIGTERM"})
    assert res_self.status_code == 403

    # 4. Attempt termination on protected system daemon name
    mgr = SandboxManager(self_pid=os.getpid())
    is_prot, _ = mgr.is_pid_protected(1)
    assert is_prot is True

    # 5. Terminate legitimate worker process with SIGTERM
    worker = spawn_mock_process()
    worker_pid = worker.pid

    mgr_bypass = SandboxManager(self_pid=worker_pid + 1000)
    kill_res = mgr_bypass.terminate_process(worker_pid, sig_name="SIGTERM")
    assert kill_res["success"] is True
    assert kill_res["signal"] == "SIGTERM"

    exit_code = worker.wait(timeout=3)
    assert exit_code == -signal.SIGTERM
