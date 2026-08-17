"""
Tier 1 & Tier 2 Automated Tests: FastAPI REST Endpoints & Validation.
Covers status, snapshots, mode transitions, sandbox actions, panic switch, and event history.
"""

import pytest
import os
import main as main_module
from main import log_event, MAX_EVENT_HISTORY


def test_status_endpoint_structure_and_metrics(client):
    """
    T1-EP1: GET /api/status returns 200 with standard schema keys and online status.
    """
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["mode"] in ["live", "simulation"]
    assert isinstance(data["daemon_pid"], int)
    assert data["daemon_pid"] == os.getpid()
    assert isinstance(data["isolated_pids"], list)
    assert isinstance(data["panic_mode"], bool)
    assert isinstance(data["dns_cache_size"], int)
    assert isinstance(data["event_count"], int)


def test_snapshot_endpoint_simulation_mode(client):
    """
    T1-EP2: GET /api/snapshot in simulation mode returns structured dataset with 5 scenario processes.
    """
    mode_res = client.post("/api/mode", json={"mode": "simulation"})
    assert mode_res.status_code == 200

    res = client.get("/api/snapshot")
    assert res.status_code == 200
    data = res.json()

    assert "timestamp" in data
    assert data["mode"] == "simulation"
    assert "summary" in data
    summary = data["summary"]
    assert summary["total_processes"] == 5
    assert summary["panic_mode"] is False
    assert summary["isolated_pids_count"] == 0

    assert "categories" in data
    assert "domains" in data
    assert "processes" in data
    assert len(data["processes"]) == 5

    pids = [p["pid"] for p in data["processes"]]
    for expected_pid in [4182, 5891, 7240, 9811, 11402]:
        assert expected_pid in pids


def test_snapshot_process_risk_priority_sorting(client):
    """
    T1-EP3: GET /api/snapshot returns processes ordered by risk priority (critical -> high -> medium -> low).
    """
    client.post("/api/mode", json={"mode": "simulation"})
    res = client.get("/api/snapshot")
    assert res.status_code == 200
    data = res.json()

    risk_weight_map = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    processes = data["processes"]
    assert len(processes) > 0

    for i in range(len(processes) - 1):
        curr_risk = processes[i].get("risk_level", "low")
        next_risk = processes[i + 1].get("risk_level", "low")
        assert risk_weight_map[curr_risk] >= risk_weight_map[next_risk]


def test_snapshot_live_mode_structure(client):
    """
    T1-EP4: GET /api/snapshot in live mode returns valid snapshot payload without crash.
    """
    client.post("/api/mode", json={"mode": "live"})
    res = client.get("/api/snapshot")
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "live"
    assert "summary" in data
    assert "processes" in data
    assert "domains" in data
    assert "categories" in data


def test_mode_transitions(client):
    """
    T1-EP5: POST /api/mode switches between live and simulation modes.
    """
    res1 = client.post("/api/mode", json={"mode": "simulation"})
    assert res1.status_code == 200
    assert res1.json() == {"success": True, "mode": "simulation"}
    assert main_module.current_mode == "simulation"

    res2 = client.post("/api/mode", json={"mode": "live"})
    assert res2.status_code == 200
    assert res2.json() == {"success": True, "mode": "live"}
    assert main_module.current_mode == "live"


@pytest.mark.parametrize("invalid_mode", [
    "unknown",
    "",
    "SIMULATION",
    "LIVE",
    "debug",
    "root"
])
def test_mode_invalid_payload_rejection(client, invalid_mode):
    """
    T2-EP6: POST /api/mode rejects invalid mode values with HTTP 400.
    """
    res = client.post("/api/mode", json={"mode": invalid_mode})
    assert res.status_code == 400
    assert "Mode must be either 'live' or 'simulation'" in res.json()["detail"]


@pytest.mark.parametrize("malformed_payload", [
    {},
    {"mode": 123},
    {"mode": None},
    {"mode": True},
    {"invalid_key": "simulation"}
])
def test_mode_malformed_json_rejection(client, malformed_payload):
    """
    T2-EP7: POST /api/mode rejects malformed request bodies with HTTP 400 or 422.
    """
    res = client.post("/api/mode", json=malformed_payload)
    assert res.status_code in [400, 422]


def test_events_endpoint_and_pagination(client):
    """
    T1-EP8: GET /api/events returns event list and respects the limit query parameter.
    """
    # Trigger events
    client.post("/api/mode", json={"mode": "simulation"})
    client.post("/api/panic", json={"enabled": True})
    client.post("/api/panic", json={"enabled": False})
    client.post("/api/mode", json={"mode": "live"})

    res_all = client.get("/api/events")
    assert res_all.status_code == 200
    events = res_all.json()["events"]
    assert len(events) >= 4

    # Verify event schema
    first = events[0]
    assert "id" in first
    assert "timestamp" in first
    assert "type" in first
    assert "title" in first
    assert "details" in first

    # Test limit parameter
    res_limit = client.get("/api/events?limit=2")
    assert res_limit.status_code == 200
    limited_events = res_limit.json()["events"]
    assert len(limited_events) == 2


def test_event_history_sliding_window_overflow(client):
    """
    T2-EP9: Event history maintains a strict FIFO sliding window capped at MAX_EVENT_HISTORY (200).
    """
    for i in range(250):
        log_event("test_event", f"Test event #{i}", {"index": i})

    assert len(main_module.event_history) == MAX_EVENT_HISTORY
    assert main_module.event_history[0]["details"]["index"] == 50
    assert main_module.event_history[-1]["details"]["index"] == 249

    # Default limit is 50
    res_default = client.get("/api/events")
    assert len(res_default.json()["events"]) == 50

    # With larger limit, returns full 200 history
    res_all = client.get("/api/events?limit=300")
    assert len(res_all.json()["events"]) == 200


def test_sandbox_isolate_endpoint(client):
    """
    T1-EP10: POST /api/sandbox/isolate toggles network isolation on target PID.
    """
    # Isolate PID 4182
    res_iso = client.post("/api/sandbox/isolate", json={"pid": 4182, "isolate": True})
    assert res_iso.status_code == 200
    assert res_iso.json()["success"] is True
    assert res_iso.json()["is_isolated"] is True
    assert 4182 in main_module.sandbox_manager.isolated_pids

    # Un-isolate PID 4182
    res_rest = client.post("/api/sandbox/isolate", json={"pid": 4182, "isolate": False})
    assert res_rest.status_code == 200
    assert res_rest.json()["success"] is True
    assert res_rest.json()["is_isolated"] is False
    assert 4182 not in main_module.sandbox_manager.isolated_pids


def test_sandbox_isolate_system_pid_rejection(client):
    """
    T1-EP11: POST /api/sandbox/isolate rejects system PID 1 with HTTP 403 Forbidden.
    """
    res = client.post("/api/sandbox/isolate", json={"pid": 1, "isolate": True})
    assert res.status_code == 403
    assert "protected" in res.json()["detail"].lower()


def test_sandbox_kill_safeguards(client):
    """
    T1-EP12: POST /api/sandbox/kill rejects protected PIDs (PID 0, PID 1, self PID) with HTTP 403.
    """
    # PID 0
    res0 = client.post("/api/sandbox/kill", json={"pid": 0, "signal": "SIGTERM"})
    assert res0.status_code == 403

    # PID 1
    res1 = client.post("/api/sandbox/kill", json={"pid": 1, "signal": "SIGKILL"})
    assert res1.status_code == 403

    # Self PID
    res_self = client.post("/api/sandbox/kill", json={"pid": os.getpid(), "signal": "SIGTERM"})
    assert res_self.status_code == 403


def test_sandbox_kill_nonexistent_pid(client):
    """
    T2-EP13: POST /api/sandbox/kill on non-existent PID returns HTTP 404.
    """
    res = client.post("/api/sandbox/kill", json={"pid": 9999999, "signal": "SIGTERM"})
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


@pytest.mark.parametrize("invalid_pid", [
    -1,
    -100,
    "invalid",
    None
])
def test_sandbox_kill_invalid_pid_format(client, invalid_pid):
    """
    T2-EP14: POST /api/sandbox/kill with negative or malformed PID returns HTTP 400 or 422.
    """
    res = client.post("/api/sandbox/kill", json={"pid": invalid_pid, "signal": "SIGTERM"})
    assert res.status_code in [400, 422]


def test_panic_endpoint_toggle(client):
    """
    T1-EP15: POST /api/panic enables and disables global panic mode.
    """
    res_on = client.post("/api/panic", json={"enabled": True})
    assert res_on.status_code == 200
    assert res_on.json()["success"] is True
    assert res_on.json()["panic_mode"] is True
    assert main_module.sandbox_manager.panic_mode is True

    res_off = client.post("/api/panic", json={"enabled": False})
    assert res_off.status_code == 200
    assert res_off.json()["success"] is True
    assert res_off.json()["panic_mode"] is False
    assert main_module.sandbox_manager.panic_mode is False


def test_panic_malformed_payload(client):
    """
    T2-EP16: POST /api/panic rejects non-boolean payload with HTTP 422.
    """
    res = client.post("/api/panic", json={"enabled": "invalid_string"})
    assert res.status_code == 422
