"""
Pytest configuration and shared fixtures for NetWhisper test suite.
Provides server state resetting, FastAPI TestClient, and mock process factories.
"""

import pytest
import subprocess
import sys
import os
from fastapi.testclient import TestClient

# Ensure both server and root directories are on sys.path.
SERVER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server"))
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from main import app, socket_engine, privacy_analyzer, sandbox_manager, scenario_generator
import main as main_module


@pytest.fixture(autouse=True)
def reset_server_state():
    """
    Ensures deterministic, isolated state before and after every test.
    Clears event history, resets mode to live, clears isolation set, resets panic mode,
    clears DNS cache, and resets scenario step counter.
    """
    # Reset before test execution
    main_module.current_mode = "live"
    main_module.event_history.clear()
    sandbox_manager.isolated_pids.clear()
    sandbox_manager.panic_mode = False
    sandbox_manager.self_pid = os.getpid()
    privacy_analyzer.dns_cache.clear()
    scenario_generator.step_counter = 0

    yield

    # Clean up after test execution
    main_module.current_mode = "live"
    main_module.event_history.clear()
    sandbox_manager.isolated_pids.clear()
    sandbox_manager.panic_mode = False
    privacy_analyzer.dns_cache.clear()
    scenario_generator.step_counter = 0


@pytest.fixture
def client():
    """
    FastAPI TestClient fixture for REST and WebSocket testing.
    """
    return TestClient(app)


@pytest.fixture
def spawn_mock_process():
    """
    Factory fixture that spawns an unprivileged mock worker process and handles cleanup.
    """
    procs = []

    def _spawn():
        p = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        procs.append(p)
        return p

    yield _spawn

    for p in procs:
        try:
            p.kill()
            p.wait(timeout=1)
        except Exception:
            pass
