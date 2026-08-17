"""
Privacy Analyzer for NetWhisper.
Performs asynchronous reverse DNS caching, destination service classification,
privacy risk evaluation, and regex credential scrubbing for process command lines.
"""

# Import the regular expressions module for signature matching and secret scrubbing.
import re
# Import the socket module for reverse DNS lookups.
import socket
# Import time for timestamp generation and TTL cache expiration tracking.
import time
# Import typing helpers for clear function annotations and readability.
from typing import Dict, Optional, Tuple

# Define regex patterns for known analytics, crash reporting, and telemetry services.
TELEMETRY_SIGNATURES = [
    r"telemetry",
    r"analytics",
    r"metrics",
    r"tracking",
    r"sentry\.io",
    r"mixpanel\.com",
    r"datadoghq\.com",
    r"vortex\.data\.microsoft\.com",
    r"browser\.pipe\.aria\.microsoft\.com",
    r"events\.data\.microsoft\.com",
    r"crashlytics",
    r"bugsnag",
    r"segment\.io",
    r"newrelic\.com",
    r"google-analytics\.com",
    r"app-measurement\.com",
    r"telemetry\.cursor\.sh",
    r"telemetry\.remote\.visualstudio\.com",
    r"stats\.",
    r"beacon\."
]

# Define regex patterns for major cloud hosts and content delivery networks.
CLOUD_SIGNATURES = [
    r"amazonaws\.com",
    r"cloudfront\.net",
    r"1e100\.net",
    r"googleusercontent\.com",
    r"cloudflare\.com",
    r"azure\.com",
    r"fastly\.net",
    r"akamai",
    r"github\.com",
    r"githubusercontent\.com",
    r"gitlab\.com"
]

# Define tuples of (regex_pattern, replacement_mask) to scrub credentials from command lines.
SECRET_PATTERNS = [
    (r"(bearer\s+)[A-Za-z0-9\-\._~\+\/]+=*", r"\1[REDACTED_TOKEN]"),
    (r"(token=)[A-Za-z0-9_\-]+", r"\1[REDACTED_TOKEN]"),
    (r"(password=)[^\s&]+", r"\1[REDACTED_PASSWORD]"),
    (r"(pwd=)[^\s&]+", r"\1[REDACTED_PASSWORD]"),
    (r"(secret=)[^\s&]+", r"\1[REDACTED_SECRET]"),
    (r"(api[_-]?key=)[A-Za-z0-9_\-]+", r"\1[REDACTED_API_KEY]"),
    (r"(AKIA[0-9A-Z]{16})", r"[REDACTED_AWS_KEY]"),
    (r"(ghp_[A-Za-z0-9]{36})", r"[REDACTED_GH_TOKEN]"),
    (r"(eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)", r"[REDACTED_JWT]")
]


class PrivacyAnalyzer:
    """
    Evaluates privacy risks, matches telemetry signatures, and sanitizes sensitive process information.
    """

    def __init__(self, dns_ttl: float = 300.0):
        # Initialize an in-memory cache mapping IP strings to (hostname, expiration_timestamp).
        self.dns_cache: Dict[str, Tuple[str, float]] = {}
        # Set cache time-to-live duration in seconds.
        self.dns_ttl = dns_ttl
        # Precompile telemetry regex patterns for fast evaluation.
        self.telemetry_regexes = [re.compile(sig, re.IGNORECASE) for sig in TELEMETRY_SIGNATURES]
        # Precompile cloud regex patterns for fast evaluation.
        self.cloud_regexes = [re.compile(sig, re.IGNORECASE) for sig in CLOUD_SIGNATURES]

    def resolve_ip(self, ip_str: str) -> str:
        """
        Resolves an IP address into a human-readable domain name with TTL caching to avoid blocking.
        """
        # Immediately return for empty, loopback, or wildcard addresses without performing network queries.
        if not ip_str or ip_str in ["0.0.0.0", "127.0.0.1", "::", "::1", "*"]:
            return "localhost" if ip_str in ["127.0.0.1", "::1"] else ip_str

        # Get the current epoch timestamp.
        now = time.time()
        # Check if the IP is already cached and has not expired.
        if ip_str in self.dns_cache:
            # Unpack cached hostname and expiration timestamp.
            hostname, expire_at = self.dns_cache[ip_str]
            # Return cached hostname if still within valid TTL.
            if now < expire_at:
                return hostname

        try:
            # Set a very short DNS timeout (0.3s) so reverse lookups do not stall the telemetry loop.
            socket.setdefaulttimeout(0.3)
            # Perform reverse DNS lookup.
            hostname = socket.gethostbyaddr(ip_str)[0]
        except Exception:
            # If resolution fails or times out, fallback to displaying the raw IP.
            hostname = ip_str

        # Store the resolved hostname in cache with the calculated expiration timestamp.
        self.dns_cache[ip_str] = (hostname, now + self.dns_ttl)
        # Return the resolved domain name or fallback IP.
        return hostname

    def classify_endpoint(self, host_or_ip: str, port: int) -> Tuple[str, str]:
        """
        Classifies an endpoint into a functional category and privacy risk level (low, medium, high, critical).
        Returns a tuple of (category_name, risk_level).
        """
        # Check for local loopback or private network ranges.
        if host_or_ip in ["localhost", "127.0.0.1", "::1", "0.0.0.0"] or host_or_ip.startswith("192.168.") or host_or_ip.startswith("10."):
            return "Local / Loopback", "low"

        # Check if the domain matches any known telemetry or tracking signature.
        for rgx in self.telemetry_regexes:
            if rgx.search(host_or_ip):
                return "Telemetry & Analytics", "high"

        # Check if the domain matches known cloud providers or CDNs.
        for rgx in self.cloud_regexes:
            if rgx.search(host_or_ip):
                return "Cloud Infrastructure", "low"

        # Check if destination is a raw IPv4 address without resolved domain name.
        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", host_or_ip):
            # If communicating with a raw IP on a non-standard port, flag as high risk.
            if port not in [80, 443, 8080, 8443, 22]:
                return "Direct IP (Non-standard Port)", "high"
            # Otherwise, categorize as regular direct IP communication.
            return "Direct IP", "medium"

        # Check for unencrypted HTTP traffic.
        if port in [80, 8080]:
            return "Unencrypted Web (HTTP)", "medium"
        # Check for encrypted HTTPS traffic.
        if port in [443, 8443]:
            return "Encrypted Web (HTTPS)", "low"

        # Default classification for generic external services.
        return "External Service", "low"

    def compute_process_risk(self, process_dict: Dict) -> str:
        """
        Calculates an aggregate privacy risk score for a process based on all its active sockets.
        """
        # Extract the list of sockets associated with this process.
        sockets = process_dict.get("sockets", [])
        # If no sockets are active, risk is low.
        if not sockets:
            return "low"

        # State tracking flags for composite risk evaluation.
        has_telemetry = False
        has_plain_http = False
        has_direct_unknown = False

        # Evaluate each active socket connection.
        for s in sockets:
            # Check individual socket risk tag.
            risk = s.get("risk", "low")
            if risk == "high":
                has_telemetry = True
            # Check for unencrypted communication.
            category = s.get("category", "")
            if "Unencrypted" in category or s.get("remote_port") in [80, 8080]:
                has_plain_http = True
            # Check for raw direct IP connections.
            if "Direct IP" in category:
                has_direct_unknown = True

        # Assign composite risk:
        # Critical if transmitting telemetry over unencrypted channels.
        if has_telemetry and has_plain_http:
            return "critical"
        # High if transmitting telemetry or contacting unknown raw IPs.
        if has_telemetry or has_direct_unknown:
            return "high"
        # Medium if transmitting unencrypted data.
        if has_plain_http:
            return "medium"
        # Low otherwise.
        return "low"

    def sanitize_command_line(self, cmdline: str) -> str:
        """
        Applies redaction regexes to remove API keys, JWTs, Bearer tokens, and passwords from command lines.
        """
        # Return empty string if input command line is empty.
        if not cmdline:
            return ""
        # Initialize sanitized string with the original command line.
        sanitized = cmdline
        # Iterate over all defined secret regex pattern pairs.
        for pattern, replacement in SECRET_PATTERNS:
            # Substitute matching sensitive tokens with safe redaction masks.
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
        # Return the sanitized command line.
        return sanitized
