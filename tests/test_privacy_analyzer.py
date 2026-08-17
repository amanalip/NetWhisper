"""
Tier 1 & Tier 2 Automated Tests: Privacy Analyzer.
Validates DNS caching & TTL expiration, reverse lookup fallbacks, endpoint classification,
multi-factor process risk scoring, and command-line secret scrubbing.
"""

import pytest
import time
import socket
from privacy_analyzer import PrivacyAnalyzer, SECRET_PATTERNS


def test_resolve_ip_loopback_and_empty():
    """
    T1-PA1: resolve_ip immediately returns without network lookups for loopback, wildcards, or empty inputs.
    """
    analyzer = PrivacyAnalyzer()
    assert analyzer.resolve_ip("127.0.0.1") == "localhost"
    assert analyzer.resolve_ip("::1") == "localhost"
    assert analyzer.resolve_ip("0.0.0.0") == "0.0.0.0"
    assert analyzer.resolve_ip("*") == "*"
    assert analyzer.resolve_ip("") == ""


def test_resolve_ip_caching_and_ttl_expiration(monkeypatch):
    """
    T1-PA2: resolve_ip caches DNS lookups with TTL and performs fresh lookup upon expiration.
    """
    analyzer = PrivacyAnalyzer(dns_ttl=2.0)
    lookup_calls = []

    def mock_gethostbyaddr(ip):
        lookup_calls.append(ip)
        return (f"host-{ip}.example.com", [], [ip])

    monkeypatch.setattr(socket, "gethostbyaddr", mock_gethostbyaddr)

    # First call: triggers lookup
    res1 = analyzer.resolve_ip("1.2.3.4")
    assert res1 == "host-1.2.3.4.example.com"
    assert len(lookup_calls) == 1
    assert "1.2.3.4" in analyzer.dns_cache

    # Second call (immediate): returns from cache
    res2 = analyzer.resolve_ip("1.2.3.4")
    assert res2 == "host-1.2.3.4.example.com"
    assert len(lookup_calls) == 1

    # Manually expire the cache entry
    host, _ = analyzer.dns_cache["1.2.3.4"]
    analyzer.dns_cache["1.2.3.4"] = (host, time.time() - 5.0)

    # Third call: triggers fresh lookup because TTL expired
    res3 = analyzer.resolve_ip("1.2.3.4")
    assert res3 == "host-1.2.3.4.example.com"
    assert len(lookup_calls) == 2


def test_resolve_ip_error_fallback(monkeypatch):
    """
    T2-PA3: resolve_ip falls back gracefully to raw IP string when socket lookup raises exception.
    """
    analyzer = PrivacyAnalyzer()

    def mock_gethostbyaddr_fail(ip):
        raise socket.gaierror("Name or service not known")

    monkeypatch.setattr(socket, "gethostbyaddr", mock_gethostbyaddr_fail)

    res = analyzer.resolve_ip("198.51.100.1")
    assert res == "198.51.100.1"
    assert "198.51.100.1" in analyzer.dns_cache


@pytest.mark.parametrize("host_or_ip, port, expected_cat, expected_risk", [
    ("localhost", 8080, "Local / Loopback", "low"),
    ("127.0.0.1", 3000, "Local / Loopback", "low"),
    ("192.168.1.100", 443, "Local / Loopback", "low"),
    ("10.0.0.5", 80, "Local / Loopback", "low"),
    ("sentry.io", 443, "Telemetry & Analytics", "high"),
    ("mixpanel.com", 443, "Telemetry & Analytics", "high"),
    ("datadoghq.com", 443, "Telemetry & Analytics", "high"),
    ("telemetry.cursor.sh", 443, "Telemetry & Analytics", "high"),
    ("telemetry.remote.visualstudio.com", 443, "Telemetry & Analytics", "high"),
    ("google-analytics.com", 443, "Telemetry & Analytics", "high"),
    ("vortex.data.microsoft.com", 443, "Telemetry & Analytics", "high"),
    ("amazonaws.com", 443, "Cloud Infrastructure", "low"),
    ("cloudfront.net", 443, "Cloud Infrastructure", "low"),
    ("cloudflare.com", 443, "Cloud Infrastructure", "low"),
    ("github.com", 443, "Cloud Infrastructure", "low"),
    ("185.220.101.5", 4444, "Direct IP (Non-standard Port)", "high"),
    ("185.220.101.5", 80, "Direct IP", "medium"),
    ("185.220.101.5", 443, "Direct IP", "medium"),
    ("example.com", 80, "Unencrypted Web (HTTP)", "medium"),
    ("example.com", 8080, "Unencrypted Web (HTTP)", "medium"),
    ("example.com", 443, "Encrypted Web (HTTPS)", "low"),
    ("example.com", 8443, "Encrypted Web (HTTPS)", "low"),
    ("custom-service.internal", 9090, "External Service", "low"),
])
def test_classify_endpoint_matrix(host_or_ip, port, expected_cat, expected_risk):
    """
    T1-PA4: classify_endpoint evaluates categories and privacy risks across all destination types.
    """
    analyzer = PrivacyAnalyzer()
    cat, risk = analyzer.classify_endpoint(host_or_ip, port)
    assert cat == expected_cat
    assert risk == expected_risk


def test_compute_process_risk_scoring():
    """
    T1-PA5: compute_process_risk assigns composite risk level (critical, high, medium, low).
    """
    analyzer = PrivacyAnalyzer()

    # 1. No sockets -> low
    assert analyzer.compute_process_risk({"sockets": []}) == "low"

    # 2. Telemetry + Unencrypted HTTP -> critical
    proc_crit = {
        "sockets": [
            {"category": "Telemetry & Analytics", "risk": "high", "remote_port": 80},
            {"category": "Unencrypted Web (HTTP)", "risk": "medium", "remote_port": 80}
        ]
    }
    assert analyzer.compute_process_risk(proc_crit) == "critical"

    # 3. Telemetry + Encrypted HTTPS -> high
    proc_high_telemetry = {
        "sockets": [
            {"category": "Telemetry & Analytics", "risk": "high", "remote_port": 443}
        ]
    }
    assert analyzer.compute_process_risk(proc_high_telemetry) == "high"

    # 4. Direct IP Non-standard port -> high
    proc_high_direct = {
        "sockets": [
            {"category": "Direct IP (Non-standard Port)", "risk": "high", "remote_port": 4444}
        ]
    }
    assert analyzer.compute_process_risk(proc_high_direct) == "high"

    # 5. Plain HTTP only -> medium
    proc_med = {
        "sockets": [
            {"category": "Unencrypted Web (HTTP)", "risk": "medium", "remote_port": 80}
        ]
    }
    assert analyzer.compute_process_risk(proc_med) == "medium"

    # 6. Encrypted HTTPS only -> low
    proc_low = {
        "sockets": [
            {"category": "Encrypted Web (HTTPS)", "risk": "low", "remote_port": 443},
            {"category": "Cloud Infrastructure", "risk": "low", "remote_port": 443}
        ]
    }
    assert analyzer.compute_process_risk(proc_low) == "low"


@pytest.mark.parametrize("raw_cmd, expected_redactions, forbidden_leak", [
    (
        "curl -H 'Authorization: Bearer my_secret_bearer_token_123' https://api.com",
        ["[REDACTED_TOKEN]"],
        "my_secret_bearer_token_123"
    ),
    (
        "curl -H 'X-Custom-JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.secret' https://api.com",
        ["[REDACTED_JWT]"],
        "eyJhbGciOi"
    ),
    (
        "app --token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        ["[REDACTED_TOKEN]"],
        "ghp_ABCDEFGHIJK"
    ),
    (
        "db_connect --password=SuperSecretPassword123 --user=admin",
        ["[REDACTED_PASSWORD]"],
        "SuperSecretPassword123"
    ),
    (
        "db_connect --pwd=AnotherSecretPass&host=localhost",
        ["[REDACTED_PASSWORD]"],
        "AnotherSecretPass"
    ),
    (
        "service --secret=MyTopSecretVaultKey",
        ["[REDACTED_SECRET]"],
        "MyTopSecretVaultKey"
    ),
    (
        "fetch --api-key=AIzaSyD_XYZ1234567890_secretkey",
        ["[REDACTED_API_KEY]"],
        "AIzaSyD_XYZ1234567890_secretkey"
    ),
    (
        "fetch --api_key=sec_key_val_1234",
        ["[REDACTED_API_KEY]"],
        "sec_key_val_1234"
    ),
    (
        "aws s3 cp file s3://bucket --access-key=AKIAIOSFODNN7EXAMPLE",
        ["[REDACTED_AWS_KEY]"],
        "AKIAIOSFODNN7EXAMPLE"
    ),
    (
        "git clone https://ghp_1234567890abcdefghijklmnopqrstuvwxyz@github.com/repo",
        ["[REDACTED_GH_TOKEN]"],
        "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
    ),
    (
        "composite --access-key=AKIAIOSFODNN7EXAMPLE --token=sec123 --password=pwd999",
        ["[REDACTED_AWS_KEY]", "[REDACTED_TOKEN]", "[REDACTED_PASSWORD]"],
        "AKIAIOSFODNN7EXAMPLE"
    ),
])
def test_sanitize_command_line_exhaustive(raw_cmd, expected_redactions, forbidden_leak):
    """
    T2-PA6: sanitize_command_line scrubs all known secret patterns without credential leakage.
    """
    analyzer = PrivacyAnalyzer()
    sanitized = analyzer.sanitize_command_line(raw_cmd)

    for redaction_tag in expected_redactions:
        assert redaction_tag in sanitized

    assert forbidden_leak not in sanitized


def test_sanitize_command_line_empty_and_benign():
    """
    T2-PA7: sanitize_command_line preserves benign command lines without modifying non-secret arguments.
    """
    analyzer = PrivacyAnalyzer()
    assert analyzer.sanitize_command_line("") == ""
    assert analyzer.sanitize_command_line(None) == ""

    benign = "/usr/bin/python3 -m unittest discover -s tests -p 'test_*.py'"
    assert analyzer.sanitize_command_line(benign) == benign
