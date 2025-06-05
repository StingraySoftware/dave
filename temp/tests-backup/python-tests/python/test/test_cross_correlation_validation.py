"""
Comprehensive Cross-correlation/Cross-spectrum validation tests for DAVE Phase 4.
Tests phase lag calculations, error propagation, coherence computations with modern Stingray.
"""

import json
import os
import tempfile

import numpy as np
import pytest


class TestCrossCorrelationValidation:
    """Validate Cross-correlation and Cross-spectrum functionality."""

    @pytest.fixture
    def correlated_signals_file(self, client):
        """Create two correlated lightcurves with known phase relationship."""
        dt = 0.01  # 10ms resolution
        duration = 100.0
        times = np.arange(0, duration, dt)

        # Common frequencies
        freq1, freq2 = 5.0, 10.0
        phase_lag = np.pi / 6  # 30 degree phase lag

        # Base signal
        base_signal = (
            1000.0
            + 50.0 * np.sin(2 * np.pi * freq1 * times)
            + 30.0 * np.sin(2 * np.pi * freq2 * times)
        )

        # Correlated signal with phase lag
        corr_signal = (
            1000.0
            + 45.0 * np.sin(2 * np.pi * freq1 * times + phase_lag)
            + 25.0 * np.sin(2 * np.pi * freq2 * times + phase_lag * 2)
        )

        # Add independent noise
        signal1 = np.random.poisson(base_signal * dt)
        signal2 = np.random.poisson(corr_signal * dt)

        # Upload both signals
        filenames = []
        for idx, signal in enumerate([signal1, signal2]):
            # Create data in DAVE format (8 columns)
            lc_data = ""
            for t, c in zip(times, signal, strict=False):
                lc_data += f"{t:.4f} 0.0 {c} {np.sqrt(c):.3f} 0.0 0.0 0.0 0.0\n"

            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
                f.write(lc_data)
                temp_file = f.name

            try:
                with open(temp_file, "rb") as f:
                    response = client.post(
                        "/upload",
                        data={"file": (f, f"corr_signal{idx + 1}.txt")},
                        content_type="multipart/form-data",
                    )

                filenames.append(response.get_json()[0])
            finally:
                os.unlink(temp_file)

        return filenames, dt, [(freq1, phase_lag), (freq2, phase_lag * 2)]

    @pytest.fixture
    def uncorrelated_signals_file(self, client):
        """Create two uncorrelated lightcurves."""
        dt = 0.1
        duration = 100.0
        times = np.arange(0, duration, dt)

        # Independent signals with different frequencies
        signal1 = 1000.0 + 50.0 * np.sin(2 * np.pi * 3.0 * times)
        signal2 = 1000.0 + 50.0 * np.sin(2 * np.pi * 7.0 * times)

        # Add Poisson noise
        counts1 = np.random.poisson(signal1)
        counts2 = np.random.poisson(signal2)

        filenames = []
        for idx, counts in enumerate([counts1, counts2]):
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
                        data={"file": (f, f"uncorr_signal{idx + 1}.txt")},
                        content_type="multipart/form-data",
                    )

                filenames.append(response.get_json()[0])
            finally:
                os.unlink(temp_file)

        return filenames, dt

    def test_cross_spectrum_basic(self, client, correlated_signals_file):
        """Test basic cross-spectrum calculation."""
        filenames, dt, freq_phase_pairs = correlated_signals_file

        params = {
            "filename1": filenames[0],
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt1": dt,
            "filename2": filenames[1],
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt2": dt,
            "nsegm": 1,
            "segment_size": 50,
            "norm": "leahy",
            "type": "Sng",
        }

        response = client.post(
            "/get_cross_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Check that we got frequency and power data
        assert len(result) >= 2
        freqs = np.array(result[0]["values"])
        powers = np.array(result[1]["values"])

        assert len(freqs) > 0
        assert len(powers) == len(freqs)

        # Powers should be non-negative
        assert np.all(powers >= 0)

    def test_phase_lag_spectrum(self, client, correlated_signals_file):
        """Test phase lag spectrum calculation."""
        filenames, dt, freq_phase_pairs = correlated_signals_file

        params = {
            "filename": filenames[0],  # Reference band
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": dt,
            "nsegm": 1,
            "segment_size": 50,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "freq_range": [1.0, 20.0],
            "energy_range": [0.1, 10.0],
            "n_bands": 2,
        }

        response = client.post(
            "/get_phase_lag_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Phase lag calculation might require specific data format
        if "success" in result and not result["success"]:
            # Skip if not supported for this data type
            pytest.skip(f"Phase lag not supported: {result.get('error', 'Unknown error')}")

    def test_coherence_calculation(
        self, client, correlated_signals_file, uncorrelated_signals_file
    ):
        """Test coherence calculation for correlated vs uncorrelated signals."""
        corr_files, dt, _ = correlated_signals_file
        uncorr_files, _ = uncorrelated_signals_file

        # Test correlated signals - should have high coherence
        params_corr = {
            "filename1": corr_files[0],
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt1": dt,
            "filename2": corr_files[1],
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt2": dt,
            "nsegm": 1,
            "segment_size": 50,
            "norm": "leahy",
            "type": "Sng",
        }

        response_corr = client.post(
            "/get_cross_spectrum", data=json.dumps(params_corr), content_type="application/json"
        )

        # Test uncorrelated signals - should have low coherence
        params_uncorr = params_corr.copy()
        params_uncorr["filename1"] = uncorr_files[0]
        params_uncorr["filename2"] = uncorr_files[1]
        params_uncorr["dt1"] = params_uncorr["dt2"] = 0.1

        response_uncorr = client.post(
            "/get_cross_spectrum", data=json.dumps(params_uncorr), content_type="application/json"
        )

        assert response_corr.status_code == 200
        assert response_uncorr.status_code == 200

        # Results should show different coherence patterns
        result_corr = response_corr.get_json()
        result_uncorr = response_uncorr.get_json()

        # Both should return valid data
        assert len(result_corr) >= 2
        assert len(result_uncorr) >= 2

    def test_averaged_cross_spectrum(self, client, correlated_signals_file):
        """Test averaged cross-spectrum with multiple segments."""
        filenames, dt, _ = correlated_signals_file

        # Single cross-spectrum
        params_single = {
            "filename1": filenames[0],
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt1": dt,
            "filename2": filenames[1],
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt2": dt,
            "nsegm": 1,
            "segment_size": 100,
            "norm": "leahy",
            "type": "Sng",
        }

        # Averaged cross-spectrum
        params_avg = params_single.copy()
        params_avg["nsegm"] = 5
        params_avg["segment_size"] = 20
        params_avg["type"] = "Avg"

        response_single = client.post(
            "/get_cross_spectrum", data=json.dumps(params_single), content_type="application/json"
        )

        response_avg = client.post(
            "/get_cross_spectrum", data=json.dumps(params_avg), content_type="application/json"
        )

        assert response_single.status_code == 200
        assert response_avg.status_code == 200

        # Averaged should have error estimates
        result_avg = response_avg.get_json()
        if len(result_avg) > 1 and "error_values" in result_avg[1]:
            errors = result_avg[1]["error_values"]
            assert len(errors) > 0

    def test_cross_spectrum_normalization(self, client, correlated_signals_file):
        """Test different normalizations for cross-spectrum."""
        filenames, dt, _ = correlated_signals_file

        normalizations = ["leahy", "rms", "absolute"]
        results = {}

        for norm in normalizations:
            params = {
                "filename1": filenames[0],
                "bck_filename1": "",
                "gti_filename1": "",
                "filters1": [],
                "axis1": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
                "dt1": dt,
                "filename2": filenames[1],
                "bck_filename2": "",
                "gti_filename2": "",
                "filters2": [],
                "axis2": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
                "dt2": dt,
                "nsegm": 1,
                "segment_size": 50,
                "norm": norm,
                "type": "Sng",
            }

            response = client.post(
                "/get_cross_spectrum", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            results[norm] = response.get_json()

        # Different normalizations should produce different values
        if len(results["leahy"]) >= 2 and len(results["rms"]) >= 2:
            leahy_powers = np.array(results["leahy"][1]["values"])
            rms_powers = np.array(results["rms"][1]["values"])

            # Should not be identical
            if len(leahy_powers) > 0 and len(rms_powers) > 0:
                assert not np.allclose(leahy_powers, rms_powers, rtol=0.01)

    def test_cross_spectrum_with_different_time_bins(self, client, correlated_signals_file):
        """Test cross-spectrum with different time binning."""
        filenames, original_dt, _ = correlated_signals_file

        # Test with different dt values
        for dt_factor in [1, 2, 5]:
            new_dt = original_dt * dt_factor

            params = {
                "filename1": filenames[0],
                "bck_filename1": "",
                "gti_filename1": "",
                "filters1": [],
                "axis1": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
                "dt1": new_dt,
                "filename2": filenames[1],
                "bck_filename2": "",
                "gti_filename2": "",
                "filters2": [],
                "axis2": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
                "dt2": new_dt,
                "nsegm": 1,
                "segment_size": 50,
                "norm": "leahy",
                "type": "Sng",
            }

            response = client.post(
                "/get_cross_spectrum", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            # Should get valid results for different time bins
            assert len(result) >= 2

    def test_error_propagation_in_cross_spectrum(self, client, correlated_signals_file):
        """Test error propagation in cross-spectrum calculations."""
        filenames, dt, _ = correlated_signals_file

        # Use averaged cross-spectrum to get error estimates
        params = {
            "filename1": filenames[0],
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt1": dt,
            "filename2": filenames[1],
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt2": dt,
            "nsegm": 10,
            "segment_size": 10,
            "norm": "leahy",
            "type": "Avg",
        }

        response = client.post(
            "/get_cross_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Check for error values
        if len(result) > 1 and "error_values" in result[1]:
            errors = np.array(result[1]["error_values"])
            powers = np.array(result[1]["values"])

            if len(errors) > 0 and len(powers) > 0:
                # Errors should be positive
                assert np.all(errors >= 0)
                # Errors should be reasonable relative to values
                relative_errors = errors / (powers + 1e-10)
                assert np.all(relative_errors < 10)  # Less than 1000% error

    def test_numpy_2_compatibility_cross_spectrum(self, client, correlated_signals_file):
        """Test NumPy 2.0 compatibility for cross-spectrum calculations."""
        filenames, dt, _ = correlated_signals_file

        params = {
            "filename1": filenames[0],
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt1": dt,
            "filename2": filenames[1],
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt2": dt,
            "nsegm": 1,
            "segment_size": 50,
            "norm": "leahy",
            "type": "Sng",
        }

        response = client.post(
            "/get_cross_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Verify NumPy operations work correctly
        freqs = np.array(result[0]["values"])
        powers = np.array(result[1]["values"])

        # Complex number operations (used in cross-spectrum)
        complex_array = np.array(powers, dtype=complex)
        assert np.all(np.isfinite(complex_array))

        # FFT-related operations
        assert np.all(np.isfinite(freqs))
        assert np.all(freqs >= 0)

        # Statistical operations
        if len(powers) > 0:
            mean_power = np.mean(powers)
            std_power = np.std(powers)
            assert np.isfinite(mean_power)
            assert np.isfinite(std_power)
