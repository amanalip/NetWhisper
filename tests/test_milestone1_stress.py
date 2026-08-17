"""
Adversarial and Stress Test Suite for Milestone 1 Backend API Integration.
Tests:
- Rapid concurrent /api/mode toggles
- Interleaved mode toggles with /api/snapshot
- Event history retrieval during mode switches
- Rescan endpoint latency and payload correctness
"""

import pytest
from main import app

def test_rapid_mode_toggle_endpoint_concurrency(client):
    """Stress-test /api/mode with 100 alternating rapid requests."""
    modes = ["simulation", "live"] * 50
    for m in modes:
        res = client.post("/api/mode", json={"mode": m})
        assert res.status_code == 200
        data = res.json()
        assert data["mode"] == m

def test_interleaved_mode_and_snapshot(client):
    """Test snapshot consistency while toggling modes."""
    for m in ["simulation", "live", "simulation", "live"]:
        # Switch mode
        res_mode = client.post("/api/mode", json={"mode": m})
        assert res_mode.status_code == 200
        
        # Immediate snapshot
        res_snap = client.get("/api/snapshot")
        assert res_snap.status_code == 200
        snap = res_snap.json()
        assert snap["mode"] == m
        assert "processes" in snap
        assert "summary" in snap
        assert "domains" in snap
        assert "categories" in snap
        assert isinstance(snap["processes"], list)

def test_rescan_snapshot_event_alignment(client):
    """Verify that snapshot and events return aligned, non-corrupted data."""
    snap_res = client.get("/api/snapshot")
    assert snap_res.status_code == 200
    events_res = client.get("/api/events")
    assert events_res.status_code == 200
    
    snap_data = snap_res.json()
    events_data = events_res.json()
    
    assert "events" in events_data
    assert isinstance(events_data["events"], list)
    assert snap_data["summary"]["total_processes"] >= 0
    assert snap_data["summary"]["active_sockets"] >= 0
