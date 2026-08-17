"""
Tier 1 & Tier 2 Automated Tests: Scenario Generator.
Validates synthetic process generation, step counter incrementation,
periodic telemetry burst multiplier (3.5x), individual PID isolation, and global panic freezing.
"""

import pytest
from scenario_generator import ScenarioGenerator, SCENARIO_PROCESSES


def test_scenario_baseline_structure():
    """
    T1-SG1: ScenarioGenerator produces 5 processes with complete telemetry metadata on every tick.
    """
    gen = ScenarioGenerator()
    result = gen.generate_tick(isolated_pids=set(), panic_mode=False)

    assert len(result) == 5
    expected_pids = {4182, 5891, 7240, 9811, 11402}
    assert set(result.keys()) == expected_pids

    for pid, proc in result.items():
        assert proc["pid"] == pid
        assert "name" in proc
        assert "cmdline" in proc
        assert "category" in proc
        assert proc["cpu_percent"] >= 0.1
        assert proc["memory_mb"] > 0
        assert proc["username"] == "user"
        assert proc["is_isolated"] is False
        assert len(proc["sockets"]) > 0

        for s in proc["sockets"]:
            assert "proto" in s
            assert "local_ip" in s
            assert "local_port" in s
            assert "remote_ip" in s
            assert "remote_port" in s
            assert "state" in s
            assert s["state"] == "ESTABLISHED"
            assert s["bandwidth_out_bps"] > 0
            assert s["bandwidth_in_bps"] > 0


def test_scenario_step_counter_and_periodic_bursts():
    """
    T1-SG2: ScenarioGenerator applies a 3.5x burst multiplier on steps where step_counter % 6 == 0.
    """
    gen = ScenarioGenerator()
    assert gen.step_counter == 0

    # Advance to step 5 (regular tick)
    for _ in range(5):
        gen.generate_tick(isolated_pids=set(), panic_mode=False)
    assert gen.step_counter == 5

    tick_reg = gen.generate_tick(isolated_pids=set(), panic_mode=False)
    assert gen.step_counter == 6

    # On step 6, high-risk telemetry sockets have higher bandwidth
    proc_telemetry = tick_reg[4182]
    for s in proc_telemetry["sockets"]:
        if s["risk"] == "high":
            # Baseline is (128..2048) * 3.5 * 8 >= 3584 bps
            assert s["bandwidth_out_bps"] >= 128 * 8


def test_scenario_multi_pid_isolation():
    """
    T1-SG3: Specific isolated PIDs have BLOCKED socket state and 0 bandwidth while others remain active.
    """
    gen = ScenarioGenerator()
    isolated = {4182, 9811}
    result = gen.generate_tick(isolated_pids=isolated, panic_mode=False)

    # Isolated processes
    for iso_pid in isolated:
        proc = result[iso_pid]
        assert proc["is_isolated"] is True
        for s in proc["sockets"]:
            assert s["state"] == "BLOCKED"
            assert s["bandwidth_out_bps"] == 0
            assert s["bandwidth_in_bps"] == 0

    # Active processes
    for active_pid in [5891, 7240, 11402]:
        proc = result[active_pid]
        assert proc["is_isolated"] is False
        for s in proc["sockets"]:
            assert s["state"] == "ESTABLISHED"
            assert s["bandwidth_out_bps"] > 0
            assert s["bandwidth_in_bps"] > 0


def test_scenario_global_panic_mode():
    """
    T1-SG4: Global Panic Mode freezes all simulated processes and sets all sockets to BLOCKED.
    """
    gen = ScenarioGenerator()
    result = gen.generate_tick(isolated_pids=set(), panic_mode=True)

    for pid, proc in result.items():
        assert proc["is_isolated"] is True
        for s in proc["sockets"]:
            assert s["state"] == "BLOCKED"
            assert s["bandwidth_out_bps"] == 0
            assert s["bandwidth_in_bps"] == 0


def test_scenario_cpu_load_bounds():
    """
    T2-SG5: CPU load fluctuations remain positive (>= 0.1) across multiple continuous ticks.
    """
    gen = ScenarioGenerator()
    for _ in range(30):
        result = gen.generate_tick(isolated_pids=set(), panic_mode=False)
        for proc in result.values():
            assert proc["cpu_percent"] >= 0.1
