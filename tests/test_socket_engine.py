"""
Tier 1 & Tier 2 Automated Tests: Socket Engine.
Validates procfs kernel decoding, IPv4/IPv6 hex conversions, endpoint parsing,
process categorization, ss fallback parsing, and error resilience.
"""

import pytest
import os
import tempfile
from socket_engine import (
    SocketEngine,
    hex_to_ipv4,
    hex_to_ipv6,
    parse_endpoint,
    TCP_STATES
)


def test_hex_to_ipv4_conversions():
    """
    T1-SE1: hex_to_ipv4 converts little-endian kernel hex strings to standard IPv4 dotted decimals.
    """
    # 127.0.0.1 in little-endian hex: 01 00 00 7F
    assert hex_to_ipv4("0100007F") == "127.0.0.1"
    # 0.0.0.0
    assert hex_to_ipv4("00000000") == "0.0.0.0"
    # 192.168.1.1: 01 01 A8 C0
    assert hex_to_ipv4("0101A8C0") == "192.168.1.1"
    # 8.8.8.8: 08 08 08 08
    assert hex_to_ipv4("08080808") == "8.8.8.8"
    # Fallback on malformed / invalid hex
    assert hex_to_ipv4("invalid_hex") == "invalid_hex"
    assert hex_to_ipv4("") == ""


def test_hex_to_ipv6_conversions():
    """
    T1-SE2: hex_to_ipv6 converts 32-character little-endian hex to standard IPv6 notation.
    """
    # ::1 loopback
    v6_loopback = "00000000000000000000000001000000"
    assert hex_to_ipv6(v6_loopback) == "::1"

    # :: unspecified address
    v6_unspecified = "00000000000000000000000000000000"
    assert hex_to_ipv6(v6_unspecified) == "::"

    # Fallback on invalid hex
    assert hex_to_ipv6("invalid_hex_string") == "invalid_hex_string"
    assert hex_to_ipv6("123") == "123"


def test_parse_endpoint_ipv4_and_ipv6():
    """
    T1-SE3: parse_endpoint decomposes HEX_IP:HEX_PORT into IP string and integer port.
    """
    # IPv4 port 80 (0x0050)
    ip4, port4 = parse_endpoint("0100007F:0050", is_v6=False)
    assert ip4 == "127.0.0.1"
    assert port4 == 80

    # IPv4 port 443 (0x01BB)
    ip_ssl, port_ssl = parse_endpoint("0101A8C0:01BB", is_v6=False)
    assert ip_ssl == "192.168.1.1"
    assert port_ssl == 443

    # IPv6 port 8080 (0x1F90)
    ip6, port6 = parse_endpoint("00000000000000000000000001000000:1F90", is_v6=True)
    assert ip6 == "::1"
    assert port6 == 8080

    # Fallback on malformed endpoint string
    ip_err, port_err = parse_endpoint("malformed_endpoint")
    assert ip_err == "0.0.0.0"
    assert port_err == 0


@pytest.mark.parametrize("endpoint_str, expected_host, expected_port", [
    ("192.168.1.1:80", "192.168.1.1", 80),
    ("10.0.0.1:443", "10.0.0.1", 443),
    ("[::1]:8080", "::1", 8080),
    ("[2001:db8::1]:22", "2001:db8::1", 22),
    ("*:*", "*", 0),
    ("0.0.0.0:0", "0.0.0.0", 0),
    ("no_port_string", "no_port_string", 0),
    ("", "", 0),
])
def test_split_host_port_edge_cases(endpoint_str, expected_host, expected_port):
    """
    T1-SE4: _split_host_port handles IPv4, bracketed IPv6, wildcards, and missing port formats.
    """
    engine = SocketEngine()
    host, port = engine._split_host_port(endpoint_str)
    assert host == expected_host
    assert port == expected_port


@pytest.mark.parametrize("proc_name, cmdline, expected_cat", [
    ("google-chrome", "/usr/bin/google-chrome --enable-features", "browser"),
    ("firefox", "/usr/lib/firefox/firefox", "browser"),
    ("brave", "/opt/brave.com/brave/brave", "browser"),
    ("code", "/usr/share/code/code", "developer_tool"),
    ("cursor", "/opt/cursor/cursor", "developer_tool"),
    ("python3", "python3 -m http.server 8000", "developer_tool"),
    ("curl", "curl https://example.com", "cli_tool"),
    ("wget", "wget http://example.com/file", "cli_tool"),
    ("npm", "npm install", "cli_tool"),
    ("spotify", "/usr/bin/spotify", "desktop_app"),
    ("discord", "/usr/share/discord/Discord", "desktop_app"),
    ("slack", "/usr/lib/slack/slack", "desktop_app"),
    ("systemd", "/lib/systemd/systemd --user", "system_service"),
    ("dbus-daemon", "/usr/bin/dbus-daemon --system", "system_service"),
    ("wireplumber", "/usr/bin/wireplumber", "system_service"),
    ("avahi-daemon", "/usr/sbin/avahi-daemon", "system_service"),
    ("custom_worker", "/opt/bin/worker", "background_daemon"),
])
def test_categorize_process_exhaustive(proc_name, cmdline, expected_cat):
    """
    T1-SE5: _categorize_process accurately classifies processes into functional groups.
    """
    engine = SocketEngine()
    assert engine._categorize_process(proc_name, cmdline) == expected_cat


def test_parse_proc_net_file_mock_data():
    """
    T2-SE6: parse_proc_net_file correctly parses synthetic /proc/net/tcp data with various TCP states.
    """
    # Mock procfs file content: header line + 3 socket entries
    mock_content = (
        "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n"
        "   0: 0100007F:0050 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 100201 1 0000000000000000 100 0 0 10 0\n"
        "   1: 0101A8C0:C000 08080808:0035 01 00000000:00000000 00:00000000 00000000  1000        0 100202 1 0000000000000000 100 0 0 10 0\n"
        "   2: 0100007F:C001 0100007F:1F90 08 00000000:00000000 00:00000000 00000000  1000        0 100203 1 0000000000000000 100 0 0 10 0\n"
    )

    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        f.write(mock_content)
        temp_path = f.name

    try:
        engine = SocketEngine()
        sockets = engine.parse_proc_net_file(temp_path, proto="TCP", is_v6=False)

        assert len(sockets) == 3

        # Entry 0: LISTEN on 127.0.0.1:80
        assert sockets[0]["inode"] == 100201
        assert sockets[0]["local_ip"] == "127.0.0.1"
        assert sockets[0]["local_port"] == 80
        assert sockets[0]["state"] == "LISTEN"

        # Entry 1: ESTABLISHED to 8.8.8.8:53
        assert sockets[1]["inode"] == 100202
        assert sockets[1]["remote_ip"] == "8.8.8.8"
        assert sockets[1]["remote_port"] == 53
        assert sockets[1]["state"] == "ESTABLISHED"

        # Entry 2: CLOSE_WAIT on port 8080
        assert sockets[2]["inode"] == 100203
        assert sockets[2]["state"] == "CLOSE_WAIT"
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def test_parse_proc_net_file_missing_and_corrupt():
    """
    T2-SE7: parse_proc_net_file handles missing files and truncated lines gracefully.
    """
    engine = SocketEngine()
    # Missing file returns empty list
    assert engine.parse_proc_net_file("/proc/net/nonexistent_file_xyz", "TCP") == []

    # File with short/corrupted lines
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        f.write("header line\nshort line\n   1: 0100007F:0050 incomplete\n")
        temp_path = f.name

    try:
        assert engine.parse_proc_net_file(temp_path, "TCP") == []
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def test_get_process_metadata_active_and_fallback():
    """
    T1-SE8: _get_process_metadata returns rich metadata for active PID and safe fallback for non-existent PID.
    """
    engine = SocketEngine()

    # Current process metadata
    meta = engine._get_process_metadata(os.getpid())
    assert meta["pid"] == os.getpid()
    assert isinstance(meta["name"], str)
    assert isinstance(meta["cpu_percent"], float)
    assert isinstance(meta["memory_mb"], float)
    assert isinstance(meta["sockets"], list)
    assert meta["is_isolated"] is False

    # Non-existent PID fallback
    meta_fake = engine._get_process_metadata(9999999)
    assert meta_fake["pid"] == 9999999
    assert meta_fake["name"] == "Process [9999999]"
    assert meta_fake["category"] == "unknown"
    assert meta_fake["cpu_percent"] == 0.0
    assert meta_fake["memory_mb"] == 0.0


def test_get_active_process_sockets_structure():
    """
    T1-SE9: get_active_process_sockets returns a dictionary mapping PIDs to process metadata dictionaries.
    """
    engine = SocketEngine()
    result = engine.get_active_process_sockets()
    assert isinstance(result, dict)
    for pid, proc in result.items():
        assert isinstance(pid, int)
        assert "pid" in proc
        assert "name" in proc
        assert "sockets" in proc
        assert isinstance(proc["sockets"], list)
