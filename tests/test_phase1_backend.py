"""
Phase 1 Backend Verification Tests for NetWhisper.
Validates kernel socket conversions, reverse DNS classification, credential redaction,
PID safeguards, scenario generation, and FastAPI endpoints.
"""

# Import os for directory and path manipulation.
import os
# Import sys to modify Python module search path.
import sys
# Import pytest testing framework.
import pytest
# Import TestClient from FastAPI for testing HTTP endpoints synchronously.
from fastapi.testclient import TestClient

# Insert the server directory at the beginning of the system path for direct imports.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server")))

# Import classes and helper functions from server components.
from socket_engine import SocketEngine, hex_to_ipv4, hex_to_ipv6, parse_endpoint
from privacy_analyzer import PrivacyAnalyzer
from sandbox_manager import SandboxManager
from scenario_generator import ScenarioGenerator
from main import app

# Instantiate FastAPI TestClient.
client = TestClient(app)


def test_hex_conversion():
    """
    Tests little-endian hexadecimal network address decoding into dotted-decimal IPv4.
    """
    # Hex string '0100007F' in little endian corresponds to '127.0.0.1'.
    ipv4 = hex_to_ipv4("0100007F")
    assert ipv4 == "127.0.0.1"

    # Test endpoint decoding (IP and port).
    ip, port = parse_endpoint("0100007F:0050", is_v6=False)
    assert ip == "127.0.0.1"
    assert port == 80


def test_privacy_analyzer_signatures():
    """
    Tests signature classification for telemetry endpoints and unencrypted HTTP ports.
    """
    analyzer = PrivacyAnalyzer()
    # Classify a known telemetry domain.
    cat, risk = analyzer.classify_endpoint("telemetry.cursor.sh", 443)
    assert cat == "Telemetry & Analytics"
    assert risk == "high"

    # Classify a raw IP destination over unencrypted port 80.
    cat, risk = analyzer.classify_endpoint("142.250.190.46", 80)
    assert "Unencrypted" in cat or "Direct IP" in cat


def test_secret_scrubber():
    """
    Tests regex redacting of Bearer tokens and passwords in process command lines.
    """
    analyzer = PrivacyAnalyzer()
    # Sample command containing mock credentials.
    cmd = "curl -H 'Authorization: Bearer mySecretToken12345' https://api.com?token=abc123456&password=supersecret"
    sanitized = analyzer.sanitize_command_line(cmd)
    # Ensure sensitive credentials are masked.
    assert "mySecretToken12345" not in sanitized
    assert "supersecret" not in sanitized
    assert "[REDACTED_TOKEN]" in sanitized
    assert "[REDACTED_PASSWORD]" in sanitized


def test_sandbox_system_pid_protection():
    """
    Tests that critical system PIDs (PID 0, PID 1, own PID) are protected against termination.
    """
    mgr = SandboxManager(self_pid=12345)

    # PID 0, PID 1, and own PID must be identified as protected.
    assert mgr.is_pid_protected(0)[0] is True
    assert mgr.is_pid_protected(1)[0] is True
    assert mgr.is_pid_protected(12345)[0] is True

    # Attempting to terminate PID 1 must return 403 Forbidden.
    res = mgr.terminate_process(1)
    assert res["success"] is False
    assert res["code"] == 403


def test_sandbox_pid_validation():
    """
    Tests PID format and bounds validation against non-integers and negative numbers.
    """
    mgr = SandboxManager()
    # Negative number should be rejected.
    assert mgr.validate_pid("-5")[0] is False
    # Non-numeric string should be rejected.
    assert mgr.validate_pid("abc")[0] is False
    # Boolean values should be rejected.
    assert mgr.validate_pid(True)[0] is False
    # Valid positive integers should be accepted.
    assert mgr.validate_pid(1234)[0] is True
    assert mgr.validate_pid("5678")[1] == 5678


def test_scenario_generator():
    """
    Tests simulated scenario generation and network isolation state transitions.
    """
    gen = ScenarioGenerator()
    # Generate initial tick.
    tick1 = gen.generate_tick(isolated_pids=set(), panic_mode=False)
    assert len(tick1) > 0
    assert 4182 in tick1
    assert tick1[4182]["is_isolated"] is False

    # Isolate PID 4182 and verify socket state changes to BLOCKED.
    tick2 = gen.generate_tick(isolated_pids={4182}, panic_mode=False)
    assert tick2[4182]["is_isolated"] is True
    for s in tick2[4182]["sockets"]:
        assert s["state"] == "BLOCKED"


def test_fastapi_endpoints():
    """
    Tests REST API endpoints for status, mode switching, isolation, panic, and kill safeguards.
    """
    # GET /api/status
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"

    # POST /api/mode
    res = client.post("/api/mode", json={"mode": "simulation"})
    assert res.status_code == 200
    assert res.json()["mode"] == "simulation"

    # POST /api/sandbox/isolate
    res = client.post("/api/sandbox/isolate", json={"pid": 4182, "isolate": True})
    assert res.status_code == 200
    assert res.json()["is_isolated"] is True

    # POST /api/panic
    res = client.post("/api/panic", json={"enabled": True})
    assert res.status_code == 200
    assert res.json()["panic_mode"] is True

    # Attempt to terminate protected PID 1 should return 403 Forbidden.
    res = client.post("/api/sandbox/kill", json={"pid": 1})
    assert res.status_code == 403
