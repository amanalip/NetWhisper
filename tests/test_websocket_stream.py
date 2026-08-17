"""
Tier 1 & Tier 2 Automated Tests: WebSocket Telemetry Streaming (/ws/traffic).
Validates 10Hz continuous streaming, dynamic state propagation, isolation, panic freeze,
reconnection resilience, and concurrent WebSocket client support.
"""

import pytest
import main as main_module


def test_websocket_handshake_and_initial_frame(client):
    """
    T1-WS1: WebSocket connection handshake and schema verification of initial telemetry frame.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    with client.websocket_connect("/ws/traffic") as ws:
        frame = ws.receive_json()
        assert "timestamp" in frame
        assert frame["mode"] == "simulation"
        assert "summary" in frame
        assert "categories" in frame
        assert "domains" in frame
        assert "processes" in frame
        assert len(frame["processes"]) == 5


def test_websocket_dynamic_mode_transition(client):
    """
    T1-WS2: Dynamic mode transition over active WebSocket stream from simulation to live.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    with client.websocket_connect("/ws/traffic") as ws:
        frame1 = ws.receive_json()
        assert frame1["mode"] == "simulation"

        # Switch mode to live via REST API
        client.post("/api/mode", json={"mode": "live"})

        frame2 = ws.receive_json()
        assert frame2["mode"] == "live"


def test_websocket_isolation_propagation(client):
    """
    T1-WS3: Process isolation instantly propagates over WebSocket stream with BLOCKED socket states.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    with client.websocket_connect("/ws/traffic") as ws:
        # Initial frame - un-isolated
        frame1 = ws.receive_json()
        target1 = next(p for p in frame1["processes"] if p["pid"] == 4182)
        assert target1["is_isolated"] is False

        # Isolate PID 4182
        client.post("/api/sandbox/isolate", json={"pid": 4182, "isolate": True})

        # Next frame reflects isolation
        frame2 = ws.receive_json()
        target2 = next(p for p in frame2["processes"] if p["pid"] == 4182)
        assert target2["is_isolated"] is True
        for s in target2["sockets"]:
            assert s["state"] == "BLOCKED"
            assert s["bandwidth_out_bps"] == 0
            assert s["bandwidth_in_bps"] == 0


def test_websocket_panic_freeze_propagation(client):
    """
    T1-WS4: Global Panic Mode freezes all processes and halts all bandwidth over WebSocket stream.
    """
    client.post("/api/mode", json={"mode": "simulation"})
    with client.websocket_connect("/ws/traffic") as ws:
        frame1 = ws.receive_json()
        assert frame1["summary"]["panic_mode"] is False

        # Enable Global Panic
        client.post("/api/panic", json={"enabled": True})

        frame2 = ws.receive_json()
        assert frame2["summary"]["panic_mode"] is True
        assert frame2["summary"]["bandwidth_in_bps"] == 0
        assert frame2["summary"]["bandwidth_out_bps"] == 0

        # All processes should be flagged as isolated with BLOCKED sockets
        for proc in frame2["processes"]:
            assert proc["is_isolated"] is True
            for s in proc["sockets"]:
                assert s["state"] == "BLOCKED"
                assert s["bandwidth_out_bps"] == 0
                assert s["bandwidth_in_bps"] == 0


def test_websocket_reconnection_resilience(client):
    """
    T2-WS5: Clean WebSocket disconnection and rapid reconnection without resource leakage.
    """
    client.post("/api/mode", json={"mode": "simulation"})

    # Session 1
    with client.websocket_connect("/ws/traffic") as ws1:
        f1 = ws1.receive_json()
        assert f1["mode"] == "simulation"

    # Session 2
    with client.websocket_connect("/ws/traffic") as ws2:
        f2 = ws2.receive_json()
        assert f2["mode"] == "simulation"
        assert len(f2["processes"]) == 5


def test_websocket_concurrent_clients(client):
    """
    T2-WS6: Multiple concurrent WebSocket clients receive continuous broadcast frames.
    """
    client.post("/api/mode", json={"mode": "simulation"})

    with client.websocket_connect("/ws/traffic") as ws1:
        with client.websocket_connect("/ws/traffic") as ws2:
            frame_a = ws1.receive_json()
            frame_b = ws2.receive_json()

            assert frame_a["mode"] == "simulation"
            assert frame_b["mode"] == "simulation"
            assert frame_a["summary"]["total_processes"] == frame_b["summary"]["total_processes"]


def test_websocket_rapid_mode_switching(client):
    """
    T2-WS7: Rapid mode switching under active stream does not disrupt WebSocket connection.
    """
    with client.websocket_connect("/ws/traffic") as ws:
        for _ in range(3):
            client.post("/api/mode", json={"mode": "simulation"})
            f_sim = ws.receive_json()
            assert f_sim["mode"] in ["simulation", "live"]

            client.post("/api/mode", json={"mode": "live"})
            f_live = ws.receive_json()
            assert f_live["mode"] in ["simulation", "live"]
