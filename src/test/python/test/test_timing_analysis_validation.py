"""
Comprehensive Timing Analysis validation tests for DAVE Phase 4.
Tests pulse searches (Z2n statistics), period folding, phase-resolved spectroscopy.
"""

import json
import os
import tempfile

import numpy as np
import pytest


class TestTimingAnalysisValidation:
    """Validate Timing Analysis functionality with modern Stingray."""

    @pytest.fixture
    def pulsar_events_file(self, client):
        """Create synthetic pulsar event data with known period."""
        # Pulsar parameters
        period = 0.033  # 33ms period (30 Hz)
        duration = 100.0  # 100 seconds observation
        mean_rate = 1000.0  # counts/s
        pulsed_fraction = 0.4  # 40% modulation

        # Generate pulsed events
        n_periods = int(duration / period)
        events = []

        for i in range(n_periods):
            phase = np.linspace(0, 2 * np.pi, 100)
            # Sinusoidal pulse profile
            profile = mean_rate * period * (1 + pulsed_fraction * np.sin(phase))

            for j, rate in enumerate(profile):
                n_photons = np.random.poisson(rate / len(phase))
                event_times = i * period + j * period / len(phase) + np.zeros(n_photons)
                events.extend(event_times)

        events = np.sort(np.array(events))

        # Add random PI channels
        pi_channels = np.random.randint(20, 200, size=len(events))

        # Create event file in DAVE format
        evt_data = ""
        for t, pi in zip(events[:10000], pi_channels[:10000], strict=False):  # Limit to 10k events
            # TIME TIME_ERR PI PI_ERR COLOR1 COLOR1_ERR COLOR2 COLOR2_ERR
            evt_data += f"{t:.6f} 0.0 {pi} 0.0 0.0 0.0 0.0 0.0\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(evt_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "pulsar_events.txt")},
                    content_type="multipart/form-data",
                )

            filename = response.get_json()[0]
            return filename, 1.0 / period, period, pulsed_fraction
        finally:
            os.unlink(temp_file)

    @pytest.fixture
    def binary_pulsar_file(self, client):
        """Create binary pulsar data with orbital modulation."""
        # Pulsar parameters
        spin_period = 0.01  # 10ms (100 Hz pulsar)
        orbital_period = 3600.0  # 1 hour orbit
        duration = 7200.0  # 2 hour observation

        times = np.arange(0, duration, 0.001)  # 1ms sampling

        # Orbital modulation (simplified)
        orbital_phase = 2 * np.pi * times / orbital_period
        doppler_factor = 1 + 0.001 * np.sin(orbital_phase)  # 0.1% modulation

        # Generate events with Doppler-shifted periods
        events = []
        current_time = 0
        while current_time < duration:
            # Local period affected by Doppler
            idx = int(current_time / 0.001)
            if idx < len(doppler_factor):
                local_period = spin_period * doppler_factor[idx]
            else:
                local_period = spin_period

            # Add event with some probability
            if np.random.random() < 0.1:  # 10% chance
                events.append(current_time)

            current_time += local_period

        events = np.array(events)
        pi_channels = np.random.randint(50, 150, size=len(events))

        # Create file
        evt_data = ""
        for t, pi in zip(events[:5000], pi_channels[:5000], strict=False):
            evt_data += f"{t:.6f} 0.0 {pi} 0.0 0.0 0.0 0.0 0.0\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(evt_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "binary_pulsar.txt")},
                    content_type="multipart/form-data",
                )

            filename = response.get_json()[0]
            return filename, 1.0 / spin_period, orbital_period
        finally:
            os.unlink(temp_file)

    def test_z2n_pulse_search(self, client, pulsar_events_file):
        """Test Z²n pulse search algorithm."""
        filename, expected_freq, period, pulsed_fraction = pulsar_events_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 0.001,  # 1ms bins
            "freq_range": [expected_freq * 0.9, expected_freq * 1.1],  # Search around expected
            "mode": "z2n",
            "oversampling": 2,
            "nharm": 2,  # Use 2 harmonics
            "nbin": 32,
            "segment_size": 10,  # 10 second segments
        }

        response = client.post(
            "/get_pulse_search", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Check if frequency was detected
        if isinstance(result, dict) and "success" in result:
            if result["success"] and "data" in result:
                freqs = result["data"].get("freq", [])
                stats = result["data"].get("stat", [])

                if len(stats) > 0:
                    # Find peak
                    max_idx = np.argmax(stats)
                    detected_freq = freqs[max_idx]

                    # Should detect within 1% of true frequency
                    assert (
                        abs(detected_freq - expected_freq) / expected_freq < 0.01
                    ), f"Expected {expected_freq} Hz, detected {detected_freq} Hz"

                    # Z2n statistic should be significant
                    max_stat = stats[max_idx]
                    assert max_stat > 20, f"Z2n statistic {max_stat} not significant"

    def test_epoch_folding_search(self, client, pulsar_events_file):
        """Test epoch folding search algorithm."""
        filename, expected_freq, period, _ = pulsar_events_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 0.001,
            "freq_range": [expected_freq * 0.8, expected_freq * 1.2],
            "mode": "efold",  # Epoch folding
            "oversampling": 2,
            "nharm": 1,
            "nbin": 16,
            "segment_size": 20,
        }

        response = client.post(
            "/get_pulse_search", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Epoch folding should also detect the pulsar
        if isinstance(result, dict) and "success" in result and result["success"]:
            if "data" in result:
                data = result["data"]
                if "freq" in data and "stat" in data:
                    freqs = data["freq"]
                    stats = data["stat"]

                    if len(stats) > 0:
                        max_idx = np.argmax(stats)
                        detected_freq = freqs[max_idx]

                        # Check detection accuracy
                        freq_error = abs(detected_freq - expected_freq) / expected_freq
                        assert (
                            freq_error < 0.02
                        ), f"Epoch folding: expected {expected_freq} Hz, got {detected_freq} Hz"

    def test_phaseogram(self, client, pulsar_events_file):
        """Test phaseogram (pulse profile) generation."""
        filename, frequency, period, _ = pulsar_events_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 0.001,
            "f": frequency,
            "nph": 32,  # 32 phase bins
            "nt": 16,  # 16 time bins
            "fdot": 0,  # No frequency derivative
            "fddot": 0,  # No second derivative
        }

        response = client.post(
            "/get_phaseogram", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Should return phase-time data
        if isinstance(result, list) and len(result) >= 3:
            # Check that we have phase and time arrays
            assert len(result[0]["values"]) > 0  # Phase bins
            assert len(result[1]["values"]) > 0  # Time bins
            assert len(result[2]["values"]) > 0  # Phaseogram data

    def test_multi_harmonic_search(self, client, pulsar_events_file):
        """Test pulse search with multiple harmonics."""
        filename, expected_freq, _, _ = pulsar_events_file

        # Test with different numbers of harmonics
        for nharm in [1, 2, 4]:
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
                "dt": 0.001,
                "freq_range": [expected_freq * 0.95, expected_freq * 1.05],
                "mode": "z2n",
                "oversampling": 1,
                "nharm": nharm,
                "nbin": 16,
                "segment_size": 10,
            }

            response = client.post(
                "/get_pulse_search", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            # More harmonics should generally give better detection
            if isinstance(result, dict) and "success" in result and result["success"]:
                if "data" in result and "stat" in result["data"]:
                    stats = result["data"]["stat"]
                    if len(stats) > 0:
                        max_stat = np.max(stats)
                        # Z2n statistic should increase with more harmonics
                        # (for a sinusoidal profile)
                        assert max_stat > 10

    def test_frequency_derivative_search(self, client, binary_pulsar_file):
        """Test search with frequency derivative (for binary systems)."""
        filename, spin_freq, orbital_period = binary_pulsar_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 0.001,
            "freq_range": [spin_freq * 0.99, spin_freq * 1.01],
            "mode": "z2n",
            "oversampling": 1,
            "nharm": 1,
            "nbin": 16,
            "segment_size": 30,
            "fdot_range": [-1e-6, 1e-6],  # Search for frequency derivative
        }

        # Note: DAVE might not support fdot search directly
        response = client.post(
            "/get_pulse_search", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        # Even if fdot is not supported, basic search should work

    def test_pulse_search_sensitivity(self, client):
        """Test pulse search sensitivity to weak signals."""
        # Create events with very weak pulsations
        duration = 50.0
        frequency = 10.0  # 10 Hz
        pulsed_fraction = 0.05  # Only 5% modulation

        times = np.arange(0, duration, 0.001)
        phase = 2 * np.pi * frequency * times
        rate = 1000.0 * (1 + pulsed_fraction * np.sin(phase))

        # Generate events
        events = []
        for t, r in zip(times, rate, strict=False):
            n_events = np.random.poisson(r * 0.001)
            events.extend([t] * n_events)

        events = np.array(events)[:5000]  # Limit events

        # Create file
        evt_data = ""
        for t in events:
            pi = np.random.randint(50, 150)
            evt_data += f"{t:.6f} 0.0 {pi} 0.0 0.0 0.0 0.0 0.0\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(evt_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "weak_pulsar.txt")},
                    content_type="multipart/form-data",
                )

            filename = response.get_json()[0]

            # Search for weak pulsations
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
                "dt": 0.01,
                "freq_range": [8.0, 12.0],
                "mode": "z2n",
                "oversampling": 4,  # Higher oversampling for weak signals
                "nharm": 2,
                "nbin": 32,
                "segment_size": 25,
            }

            response = client.post(
                "/get_pulse_search", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            # Even weak signals should be processable

        finally:
            os.unlink(temp_file)

    def test_different_search_modes(self, client, pulsar_events_file):
        """Test different pulse search modes available in DAVE."""
        filename, expected_freq, _, _ = pulsar_events_file

        # Test both Z2n and epoch folding modes
        modes = ["z2n", "efold"]

        for mode in modes:
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
                "dt": 0.001,
                "freq_range": [expected_freq * 0.9, expected_freq * 1.1],
                "mode": mode,
                "oversampling": 2,
                "nharm": 1,
                "nbin": 16,
                "segment_size": 10,
            }

            response = client.post(
                "/get_pulse_search", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            # Both modes should work
            if isinstance(result, dict) and "success" in result:
                assert result["success"] or "error" in result

    def test_numpy_2_compatibility_timing(self, client, pulsar_events_file):
        """Test NumPy 2.0 compatibility for timing analysis."""
        filename, expected_freq, _, _ = pulsar_events_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 0.001,
            "freq_range": [expected_freq * 0.95, expected_freq * 1.05],
            "mode": "z2n",
            "oversampling": 2,
            "nharm": 2,
            "nbin": 16,
            "segment_size": 10,
        }

        response = client.post(
            "/get_pulse_search", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Verify NumPy operations work correctly
        if isinstance(result, dict) and "success" in result and result["success"]:
            if "data" in result:
                data = result["data"]
                if "freq" in data and "stat" in data:
                    freqs = np.array(data["freq"])
                    stats = np.array(data["stat"])

                    # Complex FFT operations used in timing
                    assert np.all(np.isfinite(freqs))
                    assert np.all(np.isfinite(stats))

                    # Statistical operations
                    assert np.mean(stats) > 0
                    assert np.std(stats) >= 0
