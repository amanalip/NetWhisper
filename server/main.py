"""
Main FastAPI Server for NetWhisper.
Provides REST management endpoints and a 10Hz WebSocket streaming interface
bound strictly to the local loopback interface (127.0.0.1).
"""

# Import asyncio for asynchronous sleep delays in the WebSocket broadcasting loop.
import asyncio
# Import os for operating system interaction and environment variable retrieval.
import os
# Import sys for system exit and path management.
import sys
# Ensure the server directory is on sys.path for direct module imports.
sys.path.insert(0, os.path.dirname(__file__))
# Import time for timestamp generation and performance timing.
import time
# Import logging for structured server output.
import logging
# Import typing helpers for clear function type annotations.
from typing import Dict, List, Optional
# Import FastAPI web framework primitives and HTTP exception handlers.
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Body
# Import CORS middleware to permit local frontend requests.
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic BaseModel for JSON request body validation.
from pydantic import BaseModel

# Import custom NetWhisper core engine classes.
from socket_engine import SocketEngine
from privacy_analyzer import PrivacyAnalyzer
from sandbox_manager import SandboxManager
from scenario_generator import ScenarioGenerator

# Configure standard logging format and root log level.
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
# Create designated server logger instance.
logger = logging.getLogger("netwhisper.server")

# Instantiate FastAPI application instance with metadata.
app = FastAPI(title="NetWhisper Telemetry Daemon", version="1.0.0")

# Configure Cross-Origin Resource Sharing (CORS) for local development frontends.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:3000", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate singletons for the core telemetry components.
socket_engine = SocketEngine()
privacy_analyzer = PrivacyAnalyzer()
sandbox_manager = SandboxManager(self_pid=os.getpid())
scenario_generator = ScenarioGenerator()

# Global state tracking the active engine mode (defaults to LIVE Linux kernel monitoring).
current_mode: str = "live"
# Sliding window history of recent network events and sandbox interventions.
event_history: List[Dict] = []
# Maximum number of event entries to retain in memory.
MAX_EVENT_HISTORY = 200


# Pydantic schema for process termination requests.
class KillRequest(BaseModel):
    pid: int
    signal: Optional[str] = "SIGTERM"


# Pydantic schema for per-process network isolation requests.
class IsolateRequest(BaseModel):
    pid: int
    isolate: bool


# Pydantic schema for engine operating mode toggle requests.
class ModeRequest(BaseModel):
    mode: str


# Pydantic schema for global panic button toggle requests.
class PanicRequest(BaseModel):
    enabled: bool


def log_event(event_type: str, title: str, details: Dict):
    """
    Appends a new event entry to the sliding in-memory event log.
    """
    # Create structured event dictionary.
    evt = {
        "id": int(time.time() * 1000),
        "timestamp": time.strftime("%H:%M:%S"),
        "type": event_type,
        "title": title,
        "details": details
    }
    # Append to event list.
    event_history.append(evt)
    # Evict oldest entry if maximum history length is exceeded.
    if len(event_history) > MAX_EVENT_HISTORY:
        event_history.pop(0)


@app.get("/api/status")
async def get_status():
    """
    REST endpoint returning current daemon status, operating mode, and active metrics.
    """
    return {
        "status": "online",
        "mode": current_mode,
        "daemon_pid": os.getpid(),
        "isolated_pids": list(sandbox_manager.isolated_pids),
        "panic_mode": sandbox_manager.panic_mode,
        "dns_cache_size": len(privacy_analyzer.dns_cache),
        "event_count": len(event_history)
    }


@app.get("/api/snapshot")
async def get_snapshot():
    """
    REST endpoint returning an immediate full telemetry snapshot.
    """
    return build_telemetry_snapshot()


@app.post("/api/mode")
async def set_mode(req: ModeRequest):
    """
    REST endpoint to switch between live Linux kernel inspection and simulated scenario mode.
    """
    global current_mode
    # Validate requested mode string.
    if req.mode not in ["live", "simulation"]:
        raise HTTPException(status_code=400, detail="Mode must be either 'live' or 'simulation'")
    # Update active mode.
    current_mode = req.mode
    # Record mode change in event log.
    log_event("mode_change", f"Engine mode switched to {current_mode}", {"mode": current_mode})
    return {"success": True, "mode": current_mode}


@app.post("/api/sandbox/kill")
async def kill_process(req: KillRequest):
    """
    REST endpoint to terminate a target process by PID using POSIX signals.
    """
    # Dispatch termination command through sandbox manager with safeguard validation.
    res = sandbox_manager.terminate_process(req.pid, sig_name=req.signal or "SIGTERM")
    # Raise HTTP exception if action was rejected or failed.
    if not res["success"]:
        raise HTTPException(status_code=res.get("code", 400), detail=res.get("error"))
    # Record successful termination event.
    log_event("kill", f"Process {req.pid} terminated ({req.signal})", res)
    return res


@app.post("/api/sandbox/isolate")
async def isolate_process(req: IsolateRequest):
    """
    REST endpoint to toggle network isolation state for a specific process ID.
    """
    # Apply network isolation state update.
    res = sandbox_manager.set_process_isolation(req.pid, isolate=req.isolate)
    # Raise HTTP exception on failure.
    if not res["success"]:
        raise HTTPException(status_code=res.get("code", 400), detail=res.get("error"))
    # Record isolation change in event log.
    action = "isolated" if req.isolate else "restored"
    log_event("isolate", f"Process {req.pid} network {action}", res)
    return res


@app.post("/api/panic")
async def toggle_panic(req: PanicRequest):
    """
    REST endpoint to toggle global panic mode across all non-system processes.
    """
    # Toggle global panic state.
    res = sandbox_manager.toggle_panic_mode(req.enabled)
    # Record panic state transition in event log.
    status_str = "ENABLED" if req.enabled else "DISABLED"
    log_event("panic", f"Global Panic Mode {status_str}", res)
    return res


@app.get("/api/events")
async def get_events(limit: int = 50):
    """
    REST endpoint returning recent network and security events.
    """
    return {"events": event_history[-limit:]}


def build_telemetry_snapshot() -> Dict:
    """
    Constructs an enriched process and socket telemetry snapshot for WebSocket broadcasting.
    """
    # Select data source based on current operating mode.
    if current_mode == "simulation":
        raw_process_map = scenario_generator.generate_tick(
            sandbox_manager.isolated_pids,
            sandbox_manager.panic_mode
        )
    else:
        raw_process_map = socket_engine.get_active_process_sockets()

    # Initialize accumulators for summary metrics.
    processes = []
    total_sockets = 0
    total_tx_bps = 0
    total_rx_bps = 0
    high_risk_count = 0
    category_counts: Dict[str, int] = {}
    domain_map: Dict[str, Dict] = {}

    # Iterate over every process in the map.
    for pid, proc in raw_process_map.items():
        # Check if process is isolated.
        is_isolated = pid in sandbox_manager.isolated_pids or sandbox_manager.panic_mode
        proc["is_isolated"] = is_isolated
        # Scrub credentials and tokens from process command line.
        proc["cmdline"] = privacy_analyzer.sanitize_command_line(proc.get("cmdline", ""))

        enriched_sockets = []
        for s in proc.get("sockets", []):
            total_sockets += 1
            remote_ip = s.get("remote_ip", "0.0.0.0")
            remote_port = s.get("remote_port", 0)

            # Resolve reverse DNS hostname if not already present.
            remote_domain = s.get("remote_domain")
            if not remote_domain:
                remote_domain = privacy_analyzer.resolve_ip(remote_ip)
                s["remote_domain"] = remote_domain

            # Classify destination service and privacy risk if not already categorized.
            if "category" not in s or "risk" not in s:
                cat, risk = privacy_analyzer.classify_endpoint(remote_domain, remote_port)
                s["category"] = cat
                s["risk"] = risk

            # Determine encryption status.
            if "is_encrypted" not in s:
                s["is_encrypted"] = remote_port in [443, 8443, 22] or s.get("proto") == "TLS"

            # Track count of high-risk sockets.
            if s["risk"] == "high" or s["risk"] == "critical":
                high_risk_count += 1

            # Accumulate category counts.
            cat_key = s["category"]
            category_counts[cat_key] = category_counts.get(cat_key, 0) + 1

            # Group domain metrics.
            if remote_domain not in domain_map:
                domain_map[remote_domain] = {
                    "domain": remote_domain,
                    "category": s["category"],
                    "risk": s["risk"],
                    "socket_count": 0,
                    "processes": set()
                }
            domain_map[remote_domain]["socket_count"] += 1
            domain_map[remote_domain]["processes"].add(proc.get("name", f"PID {pid}"))

            # Accumulate bandwidth throughput.
            tx = s.get("bandwidth_out_bps", 256) if not is_isolated else 0
            rx = s.get("bandwidth_in_bps", 512) if not is_isolated else 0
            total_tx_bps += tx
            total_rx_bps += rx

            enriched_sockets.append(s)

        # Attach enriched sockets back to the process object.
        proc["sockets"] = enriched_sockets
        # Compute process-level composite risk score.
        proc["risk_level"] = privacy_analyzer.compute_process_risk(proc)
        # Add process to process list.
        processes.append(proc)

    # Convert sets in domain_map for JSON serialization.
    serialized_domains = []
    for d, data in domain_map.items():
        data_copy = dict(data)
        data_copy["processes"] = list(data["processes"])
        serialized_domains.append(data_copy)

    # Sort processes by risk priority (critical -> high -> medium -> low) then by active socket count.
    risk_weights = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    processes.sort(key=lambda p: (risk_weights.get(p.get("risk_level", "low"), 0), len(p.get("sockets", []))), reverse=True)

    # Return structured telemetry snapshot payload.
    return {
        "timestamp": time.time(),
        "mode": current_mode,
        "summary": {
            "total_processes": len(processes),
            "active_sockets": total_sockets,
            "bandwidth_in_bps": total_rx_bps,
            "bandwidth_out_bps": total_tx_bps,
            "high_risk_count": high_risk_count,
            "panic_mode": sandbox_manager.panic_mode,
            "isolated_pids_count": len(sandbox_manager.isolated_pids)
        },
        "categories": category_counts,
        "domains": serialized_domains[:30],
        "processes": processes
    }


@app.websocket("/ws/traffic")
async def websocket_traffic_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint streaming real-time process socket telemetry snapshots at 10Hz (every 100ms).
    """
    # Accept incoming WebSocket client connection.
    await websocket.accept()
    logger.info("WebSocket client connected to /ws/traffic")
    try:
        # Enter high-frequency streaming loop.
        while True:
            # Build enriched snapshot.
            snapshot = build_telemetry_snapshot()
            # Transmit snapshot as JSON packet.
            await websocket.send_json(snapshot)
            # Sleep for 100 milliseconds to maintain 10Hz cadence.
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        # Log clean client disconnection.
        logger.info("WebSocket client disconnected")
    except Exception as e:
        # Log unexpected error during streaming.
        logger.error("Error in websocket telemetry stream: %s", e)


if __name__ == "__main__":
    # Import uvicorn ASGI server.
    import uvicorn
    # Read optional port from environment variable or default to 8765.
    port = int(os.getenv("PORT", 8765))
    # Launch Uvicorn bound strictly to 127.0.0.1 loopback interface.
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
