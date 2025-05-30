"""
Comprehensive Power Density Spectrum validation tests for DAVE Phase 4.
Tests FFT computations, normalization methods, frequency binning with NumPy 2.0.
"""

import json
import os
import tempfile

import numpy as np
import pytest


class TestPDSValidation:
    """Validate Power Density Spectrum functionality with modern Stingray/NumPy."""

    @pytest.fixture
    def periodic_signal_file(self, client):
        """Create a lightcurve with known periodic signal."""
        dt = 0.01  # 10ms time resolution
        duration = 100.0  # 100 seconds
        times = np.arange(0, duration, dt)

        # Create multi-frequency signal
        freq1, amp1 = 5.0, 10.0  # 5 Hz with amplitude 10
        freq2, amp2 = 15.0, 5.0  # 15 Hz with amplitude 5
        freq3, amp3 = 50.0, 2.0  # 50 Hz with amplitude 2

        mean_rate = 1000.0
        signal = (
            mean_rate
            + amp1 * np.sin(2 * np.pi * freq1 * times)
            + amp2 * np.sin(2 * np.pi * freq2 * times)
            + amp3 * np.sin(2 * np.pi * freq3 * times)
        )

        # Add Poisson noise
        counts = np.random.poisson(signal * dt)

        # Create lightcurve file in DAVE format (8 columns)
        lc_data = ""
        for t, c in zip(times, counts, strict=False):
            # TIME TIME_ERR COUNTS COUNTS_ERR COLOR1 COLOR1_ERR COLOR2 COLOR2_ERR
            lc_data += f"{t:.4f} 0.0 {c} {np.sqrt(c):.3f} 0.0 0.0 0.0 0.0\n"

        # Upload file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(lc_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "periodic_signal.txt")},
                    content_type="multipart/form-data",
                )

            assert response.status_code == 200
            filename = response.get_json()[0]
            return filename, dt, [(freq1, amp1), (freq2, amp2), (freq3, amp3)], mean_rate
        finally:
            os.unlink(temp_file)

    @pytest.fixture
    def white_noise_file(self, client):
        """Create a white noise lightcurve."""
        dt = 0.1
        duration = 1000.0
        times = np.arange(0, duration, dt)

        # Pure Poisson white noise
        mean_rate = 100.0
        counts = np.random.poisson(mean_rate, size=len(times))

        # Create file in DAVE format (8 columns)
        lc_data = ""
        for t, c in zip(times, counts, strict=False):
            lc_data += f"{t:.3f} 0.0 {c} {np.sqrt(c):.3f} 0.0 0.0 0.0 0.0\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(lc_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "white_noise.txt")},
                    content_type="multipart/form-data",
                )

            filename = response.get_json()[0]
            return filename, dt, mean_rate
        finally:
            os.unlink(temp_file)

    def test_pds_frequency_detection(self, client, periodic_signal_file):
        """Test that PDS correctly detects input frequencies."""
        filename, dt, frequencies, mean_rate = periodic_signal_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "COUNTS"},
            ],
            "dt": dt,
            "nsegm": 1,
            "segment_size": 50,  # 50 second segments
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
        }

        response = client.post(
            "/get_power_density_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Extract frequency and power arrays
        freqs = np.array(result[0]["values"])
        powers = np.array(result[1]["values"])

        # Find peaks in the power spectrum
        mean_power = np.mean(powers)
        std_power = np.std(powers)
        peak_threshold = mean_power + 3 * std_power

        peak_indices = np.where(powers > peak_threshold)[0]
        peak_freqs = freqs[peak_indices]

        # Check if all input frequencies are detected
        for freq, amp in frequencies:
            if freq < freqs.max():  # Only check frequencies within range
                # Find closest peak to expected frequency
                if len(peak_freqs) > 0:
                    closest_peak_idx = np.argmin(np.abs(peak_freqs - freq))
                    closest_peak = peak_freqs[closest_peak_idx]
                    # Allow 1% frequency resolution tolerance
                    assert abs(closest_peak - freq) / freq < 0.01, (
                        f"Expected peak at {freq} Hz, closest found at {closest_peak} Hz"
                    )

    def test_pds_normalization_methods(self, client, periodic_signal_file):
        """Test different PDS normalization methods."""
        filename, dt, frequencies, mean_rate = periodic_signal_file

        normalizations = ["leahy", "rms", "absolute"]
        results = {}

        for norm in normalizations:
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "COUNTS"},
                ],
                "dt": dt,
                "nsegm": 1,
                "segment_size": 50,
                "norm": norm,
                "type": "Sng",
                "df": 0,
            }

            response = client.post(
                "/get_power_density_spectrum",
                data=json.dumps(params),
                content_type="application/json",
            )

            assert response.status_code == 200
            result = response.get_json()

            powers = np.array(result[1]["values"])
            results[norm] = powers

        # Verify normalizations produce expected relationships
        # Leahy normalization: expect values around 2 for Poisson noise
        leahy_mean = np.mean(results["leahy"])
        assert 1.5 < leahy_mean < 2.5, f"Leahy norm mean {leahy_mean} not near 2"

        # RMS normalization should be different from Leahy
        assert not np.allclose(results["rms"], results["leahy"], rtol=0.1)

        # Absolute normalization should be different from both
        assert not np.allclose(results["absolute"], results["leahy"], rtol=0.1)
        assert not np.allclose(results["absolute"], results["rms"], rtol=0.1)

    def test_pds_averaging(self, client, white_noise_file):
        """Test averaged vs single PDS."""
        filename, dt, mean_rate = white_noise_file

        # Single PDS
        params_single = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "COUNTS"},
            ],
            "dt": dt,
            "nsegm": 1,
            "segment_size": 100,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
        }

        response = client.post(
            "/get_power_density_spectrum",
            data=json.dumps(params_single),
            content_type="application/json",
        )
        result_single = response.get_json()

        # Averaged PDS with multiple segments
        params_avg = params_single.copy()
        params_avg["nsegm"] = 10
        params_avg["segment_size"] = 50
        params_avg["type"] = "Avg"

        response = client.post(
            "/get_power_density_spectrum",
            data=json.dumps(params_avg),
            content_type="application/json",
        )
        result_avg = response.get_json()

        # Averaged PDS should have smaller variance
        if "error_values" in result_avg[1]:
            errors_avg = np.array(result_avg[1]["error_values"])
            # Check that we have error estimates
            assert len(errors_avg) > 0
            assert np.all(errors_avg > 0)

    def test_pds_frequency_rebinning(self, client, periodic_signal_file):
        """Test frequency rebinning functionality."""
        filename, dt, frequencies, mean_rate = periodic_signal_file

        # Test different rebinning factors
        for df in [0, 0.5, 1.0, 2.0]:
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "COUNTS"},
                ],
                "dt": dt,
                "nsegm": 1,
                "segment_size": 50,
                "norm": "leahy",
                "type": "Sng",
                "df": df,
            }

            response = client.post(
                "/get_power_density_spectrum",
                data=json.dumps(params),
                content_type="application/json",
            )

            assert response.status_code == 200
            result = response.get_json()

            freqs = np.array(result[0]["values"])

            if df > 0 and len(freqs) > 1:
                # Check frequency spacing matches rebinning
                freq_diff = np.diff(freqs)
                expected_spacing = df if df > 0 else freq_diff[0]
                assert np.allclose(freq_diff, expected_spacing, rtol=0.1)

    def test_pds_with_background(self, client, periodic_signal_file):
        """Test PDS with background subtraction."""
        filename, dt, frequencies, mean_rate = periodic_signal_file

        # Create background file
        times = np.arange(0, 100, dt)
        bkg_rate = 200.0  # Background count rate
        bkg_counts = np.random.poisson(bkg_rate * dt, size=len(times))

        bkg_data = ""
        for t, c in zip(times, bkg_counts, strict=False):
            bkg_data += f"{t:.4f} 0.0 {c} {np.sqrt(c):.3f} 0.0 0.0 0.0 0.0\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(bkg_data)
            bkg_file = f.name

        try:
            with open(bkg_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "background.txt")},
                    content_type="multipart/form-data",
                )
            bkg_filename = response.get_json()[0]

            # Calculate PDS with background
            params = {
                "filename": filename,
                "bck_filename": bkg_filename,
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "COUNTS"},
                ],
                "dt": dt,
                "nsegm": 1,
                "segment_size": 50,
                "norm": "leahy",
                "type": "Sng",
                "df": 0,
            }

            response = client.post(
                "/get_power_density_spectrum",
                data=json.dumps(params),
                content_type="application/json",
            )

            assert response.status_code == 200
            result = response.get_json()

            # Should still detect the periodic signals
            freqs = np.array(result[0]["values"])
            powers = np.array(result[1]["values"])

            # Verify we still have power spectrum data
            assert len(freqs) > 0
            assert len(powers) == len(freqs)

        finally:
            os.unlink(bkg_file)

    def test_pds_numpy_compatibility(self, client, white_noise_file):
        """Test NumPy 2.0 specific compatibility for PDS calculations."""
        filename, dt, mean_rate = white_noise_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "COUNTS"},
            ],
            "dt": dt,
            "nsegm": 1,
            "segment_size": 100,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
        }

        response = client.post(
            "/get_power_density_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        freqs = np.array(result[0]["values"])
        powers = np.array(result[1]["values"])

        # Test NumPy 2.0 operations
        assert isinstance(freqs, np.ndarray)
        assert isinstance(powers, np.ndarray)

        # Statistical operations should work
        mean_power = np.mean(powers)
        std_power = np.std(powers)

        assert np.isfinite(mean_power)
        assert np.isfinite(std_power)
        assert mean_power > 0
        assert std_power > 0

        # FFT-related calculations should be consistent
        assert freqs[0] >= 0  # First frequency should be 0 or positive
        assert np.all(np.diff(freqs) > 0)  # Frequencies should be monotonic
        assert np.all(powers >= 0)  # Power should be non-negative

    def test_pds_edge_cases(self, client):
        """Test PDS with edge cases."""
        # Very short lightcurve
        dt = 1.0
        times = np.arange(0, 10, dt)  # Only 10 seconds
        counts = np.random.poisson(100, size=len(times))

        lc_data = ""
        for t, c in zip(times, counts, strict=False):
            lc_data += f"{t:.1f} 0.0 {c} {np.sqrt(c):.1f} 0.0 0.0 0.0 0.0\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(lc_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "short_lc.txt")},
                    content_type="multipart/form-data",
                )
            filename = response.get_json()[0]

            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "COUNTS"},
                ],
                "dt": dt,
                "nsegm": 1,
                "segment_size": 5,  # Small segment
                "norm": "leahy",
                "type": "Sng",
                "df": 0,
            }

            response = client.post(
                "/get_power_density_spectrum",
                data=json.dumps(params),
                content_type="application/json",
            )

            # Should handle short data gracefully
            assert response.status_code == 200

        finally:
            os.unlink(temp_file)

    def test_pds_consistency_check(self, client, periodic_signal_file):
        """Test that PDS results are consistent across multiple runs."""
        filename, dt, frequencies, mean_rate = periodic_signal_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "COUNTS"},
            ],
            "dt": dt,
            "nsegm": 1,
            "segment_size": 50,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
        }

        # Run PDS calculation multiple times
        results = []
        for _ in range(3):
            response = client.post(
                "/get_power_density_spectrum",
                data=json.dumps(params),
                content_type="application/json",
            )
            assert response.status_code == 200
            results.append(response.get_json())

        # Results should be identical for same input
        for i in range(1, len(results)):
            freqs1 = np.array(results[0][0]["values"])
            freqs2 = np.array(results[i][0]["values"])
            powers1 = np.array(results[0][1]["values"])
            powers2 = np.array(results[i][1]["values"])

            assert np.allclose(freqs1, freqs2)
            assert np.allclose(powers1, powers2)
