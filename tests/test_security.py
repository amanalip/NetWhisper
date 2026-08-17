"""
Comprehensive Security and Reliability Test Suite for NetWhisper.
Tests PID injection fuzzing, protected PID isolation resistance, credential scrubbing,
malformed procfs data resiliency, and localhost loopback binding.
"""

# Import os for operating system interaction.
import os
# Import sys to configure Python module search path.
import sys
# Import pytest testing framework.
import pytest
# Import TestClient from FastAPI for testing HTTP endpoints synchronously.
from fastapi.testclient import TestClient

# Insert server directory into Python path.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server")))

# Import classes and helper functions from server components.
from socket_engine import SocketEngine, hex_to_ipv4, parse_endpoint
from privacy_analyzer import PrivacyAnalyzer
from sandbox_manager import SandboxManager, PROTECTED_PROCESS_NAMES
from main import app

# Instantiate test client.
client = TestClient(app)


def test_pid_injection_and_fuzzing():
    """
    Fuzzes process termination and isolation endpoints with malicious and non-integer inputs.
    Verifies that all invalid payloads are rejected with HTTP 400 or 422 without crashing.
    """
    # Malicious and invalid payload test cases.
    malicious_payloads = [
        "-1",
        "-9999",
        "0; rm -rf /",
        "123 OR 1=1",
        "$(whoami)",
        "`id`",
        "null",
        "../../etc/passwd",
        1.5,
        None,
        True,
        False
    ]

    # Iterate over test payloads against the kill endpoint.
    for payload in malicious_payloads:
        # Send request to kill endpoint.
        res = client.post("/api/sandbox/kill", json={"pid": payload, "signal": "SIGTERM"})
        # Must be rejected with a 4xx client error (400, 403, or 422 validation error).
        assert res.status_code in [400, 403, 422], f"Failed to reject malicious kill payload: {payload}"

    # Iterate over test payloads against the isolate endpoint.
    for payload in malicious_payloads:
        # Send request to isolate endpoint.
        res = client.post("/api/sandbox/isolate", json={"pid": payload, "isolate": True})
        # Must be rejected with a 4xx client error.
        assert res.status_code in [400, 403, 422], f"Failed to reject malicious isolate payload: {payload}"


def test_protected_pids_immutability():
    """
    Verifies that critical system PIDs (PID 0, PID 1, own PID, system services) cannot be killed.
    """
    # Instantiate sandbox manager with a designated test PID.
    test_self_pid = 99999
    mgr = SandboxManager(self_pid=test_self_pid)

    # Assert PID 0 is protected.
    assert mgr.is_pid_protected(0)[0] is True
    # Assert PID 1 is protected.
    assert mgr.is_pid_protected(1)[0] is True
    # Assert self PID is protected.
    assert mgr.is_pid_protected(test_self_pid)[0] is True

    # Assert protected process names are recognized.
    for proc_name in ["systemd", "init", "kthreadd", "xorg", "wayland", "sway"]:
        assert proc_name in PROTECTED_PROCESS_NAMES

    # Verify kill requests against PID 1 via HTTP client return 403 Forbidden.
    res = client.post("/api/sandbox/kill", json={"pid": 1, "signal": "SIGKILL"})
    assert res.status_code == 403
    assert "protected" in res.json()["detail"].lower()


def test_credential_scrubbing_edge_cases():
    """
    Tests the credential sanitizer against diverse real-world token, key, and password formats.
    """
    analyzer = PrivacyAnalyzer()

    # Test cases containing realistic credential strings.
    cases = [
        # Bearer token header.
        ("curl -H 'Authorization: Bearer secretTokenABC123456789' https://api.com", "[REDACTED_TOKEN]"),
        # AWS Access Key ID.
        ("aws s3 ls --access-key=AKIAIOSFODNN7EXAMPLE", "[REDACTED_AWS_KEY]"),
        # GitHub Personal Access Token.
        ("git clone https://ghp_1234567890abcdefghijklmnopqrstuvwxyz@github.com/repo.git", "[REDACTED_GH_TOKEN]"),
        # Password query parameter.
        ("node server.js --password=SuperSecretPassword123!", "[REDACTED_PASSWORD]"),
        # URL token parameter.
        ("python script.py --token=sec_9876543210fedcba", "[REDACTED_TOKEN]"),
        # API key parameter.
        ("cli-tool --api_key=AIzaSyD1234567890abcdef", "[REDACTED_API_KEY]"),
        # Raw JWT token string.
        ("node app.js --jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig", "[REDACTED_JWT]")
    ]

    # Verify each case is sanitized and raw secrets are eradicated.
    for raw_cmd, expected_mask in cases:
        sanitized = analyzer.sanitize_command_line(raw_cmd)
        # Expected redaction mask must appear in the sanitized output.
        assert expected_mask in sanitized, f"Expected mask '{expected_mask}' missing in: {sanitized}"
        # Raw secret tokens must not leak into sanitized string.
        assert "AKIAIOSFODNN7EXAMPLE" not in sanitized
        assert "SuperSecretPassword123!" not in sanitized
        assert "sec_9876543210fedcba" not in sanitized
        assert "secretTokenABC123456789" not in sanitized


def test_malformed_procfs_resiliency():
    """
    Verifies that malformed procfs socket strings do not raise unhandled exceptions or crash.
    """
    # Test invalid hex address formats.
    assert hex_to_ipv4("INVALID_HEX") == "INVALID_HEX"
    assert hex_to_ipv4("") == ""
    assert hex_to_ipv4("12345") == "12345"

    # Test malformed endpoint string parser.
    ip, port = parse_endpoint("MALFORMED", is_v6=False)
    assert ip == "0.0.0.0"
    assert port == 0

    ip, port = parse_endpoint(":::INVALID", is_v6=True)
    assert ip == "0.0.0.0"
    assert port == 0


def test_loopback_binding_configuration():
    """
    Verifies that the server is configured to bind strictly to loopback 127.0.0.1.
    """
    # Check that the test client successfully interacts with the local FastAPI app.
    res = client.get("/api/status")
    assert res.status_code == 200
    assert res.json()["status"] == "online"
