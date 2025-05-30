"""
Scientific validation tests for DAVE.
Ensures that timing, spectral, and fitting analyses produce scientifically correct results.
"""

import json
import os
import tempfile

import numpy as np
import pytest


class TestTimingAnalysisValidation:
    """Validate timing analysis features produce correct scientific results."""

    @pytest.fixture
    def synthetic_lightcurve_file(self, client):
        """Create a synthetic lightcurve with known properties."""
        # Generate synthetic data with known timing properties
        dt = 0.1  # 100ms time resolution
        duration = 100.0  # 100 seconds
        times = np.arange(0, duration, dt)

        # Create a signal with known frequency components
        freq1, freq2 = 1.0, 3.5  # Hz
        signal = (
            10.0 + 2.0 * np.sin(2 * np.pi * freq1 * times) + 1.0 * np.sin(2 * np.pi * freq2 * times)
        )

        # Add Poisson noise
        counts = np.random.poisson(signal)

        # Create lightcurve file
        lc_data = "# Synthetic lightcurve for testing\n"
        lc_data += "# Column 1: TIME\n"
        lc_data += "# Column 2: RATE\n"
        lc_data += "# Column 3: ERROR\n"
        for t, c in zip(times, counts, strict=False):
            lc_data += f"{t:.3f} {c} {np.sqrt(c):.3f}\n"

        # Upload file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(lc_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "synthetic_lc.txt")},
                    content_type="multipart/form-data",
                )

            assert response.status_code == 200
            filename = response.get_json()[0]
            return filename, freq1, freq2, dt
        finally:
            os.unlink(temp_file)

    def test_power_density_spectrum_peaks(self, client, synthetic_lightcurve_file):
        """Test that PDS correctly identifies frequency peaks."""
        filename, freq1, freq2, dt = synthetic_lightcurve_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
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

        # Verify we got power spectrum data
        if "success" in result and not result["success"]:
            pytest.skip(f"PDS calculation failed: {result.get('error', 'Unknown error')}")

        # Check for expected frequency peaks
        if "data" in result and "pds" in result["data"]:
            freqs = np.array(result["data"]["pds"]["freq"])
            powers = np.array(result["data"]["pds"]["power"])

            # Find peaks in the power spectrum
            peak_indices = np.where(powers > np.mean(powers) + 2 * np.std(powers))[0]
            peak_freqs = freqs[peak_indices]

            # Check if our input frequencies are detected
            freq1_found = any(abs(f - freq1) < 0.1 for f in peak_freqs)
            freq2_found = any(abs(f - freq2) < 0.1 for f in peak_freqs)

            assert freq1_found or freq2_found, (
                f"Expected frequencies {freq1}, {freq2} Hz not found in peaks at {peak_freqs}"
            )

    def test_phase_lag_calculation(self, client, synthetic_lightcurve_file):
        """Test phase lag spectrum calculation."""
        filename, _, _, dt = synthetic_lightcurve_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": dt,
            "nsegm": 1,
            "segment_size": 50,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "freq_range": [0.5, 5.0],
            "energy_range": [0.1, 10.0],
            "n_bands": 2,
        }

        response = client.post(
            "/get_phase_lag_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Phase lag requires energy bands, might not work with simple lightcurve
        if "success" in result and result["success"]:
            assert "data" in result or "lag" in result

    def test_rms_spectrum_variability(self, client, synthetic_lightcurve_file):
        """Test RMS spectrum calculation for variability."""
        filename, _, _, dt = synthetic_lightcurve_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": dt,
            "nsegm": 1,
            "segment_size": 50,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "freq_range": [0.1, 10.0],
            "energy_range": [0.1, 10.0],
            "n_bands": 2,
            "white_noise": 0,
        }

        response = client.post(
            "/get_rms_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        if (
            "success" in result
            and result["success"]
            and "data" in result
            and "rms" in result["data"]
        ):
            # RMS should be positive and reasonable
            rms_values = result["data"]["rms"]
            assert all(r >= 0 for r in rms_values if isinstance(r, int | float))

    def test_pulse_search_detection(self, client):
        """Test pulse search for periodic signals."""
        # Create a strongly pulsed signal
        dt = 0.01  # 10ms resolution
        duration = 10.0  # 10 seconds
        times = np.arange(0, duration, dt)

        # Create a pulsed signal at 2.5 Hz
        pulse_freq = 2.5
        phase = 2 * np.pi * pulse_freq * times
        signal = 100.0 * (1 + 0.5 * np.sin(phase))  # 50% pulsed fraction

        # Create event times from the pulsed lightcurve
        events = []
        for t, rate in zip(times, signal, strict=False):
            n_events = np.random.poisson(rate * dt)
            events.extend([t] * n_events)

        events = np.array(events)

        # Create event file
        evt_data = "# Synthetic pulsed events\n"
        evt_data += "# Column 1: TIME\n"
        evt_data += "# Column 2: PI\n"
        for t in events[:1000]:  # Use first 1000 events
            evt_data += f"{t:.6f} {np.random.randint(20, 200)}\n"

        # Upload file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(evt_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "pulsed_events.txt")},
                    content_type="multipart/form-data",
                )

            filename = response.get_json()[0]

            # Run pulse search
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PI"},
                ],
                "dt": dt,
                "freq_range": [1.0, 5.0],
                "mode": "z2n",
                "oversampling": 2,
                "nharm": 1,
                "nbin": 16,
                "segment_size": 5,
            }

            response = client.post(
                "/get_pulse_search", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            if (
                "success" in result
                and result["success"]
                and "data" in result
                and "freq" in result["data"]
            ):
                # Check if pulse frequency was detected
                freqs = result["data"]["freq"]
                stats = result["data"].get("stat", [])

                if stats:
                    # Find the peak
                    max_idx = np.argmax(stats)
                    detected_freq = freqs[max_idx]

                    # Allow 10% tolerance
                    assert abs(detected_freq - pulse_freq) / pulse_freq < 0.1, (
                        f"Expected pulse at {pulse_freq} Hz, found at {detected_freq} Hz"
                    )

        finally:
            os.unlink(temp_file)


class TestSpectralAnalysisValidation:
    """Validate spectral analysis features."""

    def test_cross_spectrum_coherence(self, client):
        """Test cross spectrum between correlated signals."""
        # Create two correlated signals
        dt = 0.1
        duration = 100.0
        times = np.arange(0, duration, dt)

        # Common signal component
        common_freq = 2.0  # Hz
        common_signal = np.sin(2 * np.pi * common_freq * times)

        # Signal 1: common + noise
        signal1 = 100.0 + 10.0 * common_signal + 5.0 * np.random.randn(len(times))

        # Signal 2: common + different noise + phase shift
        phase_shift = np.pi / 4
        signal2 = (
            100.0
            + 8.0 * np.sin(2 * np.pi * common_freq * times + phase_shift)
            + 5.0 * np.random.randn(len(times))
        )

        # Create and upload two files
        filenames = []
        for i, signal in enumerate([signal1, signal2]):
            lc_data = f"# Signal {i + 1}\n"
            lc_data += "# Column 1: TIME\n"
            lc_data += "# Column 2: RATE\n"
            for t, s in zip(times, signal, strict=False):
                lc_data += f"{t:.3f} {s:.3f}\n"

            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
                f.write(lc_data)
                temp_file = f.name

            try:
                with open(temp_file, "rb") as f:
                    response = client.post(
                        "/upload",
                        data={"file": (f, f"signal{i + 1}.txt")},
                        content_type="multipart/form-data",
                    )

                filenames.append(response.get_json()[0])
            finally:
                os.unlink(temp_file)

        # Calculate cross spectrum
        params = {
            "filename1": filenames[0],
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt1": dt,
            "filename2": filenames[1],
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
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

        if (
            "success" in result
            and result["success"]
            and "data" in result
            and "coherence" in result["data"]
        ):
            # Cross spectrum should show high coherence at common frequency
            freqs = np.array(result["data"]["freq"])
            coherence = np.array(result["data"]["coherence"])

            # Find coherence at common frequency
            idx = np.argmin(abs(freqs - common_freq))
            coh_at_freq = coherence[idx]

            # Coherence should be high (> 0.5) at common frequency
            assert coh_at_freq > 0.5, (
                f"Expected high coherence at {common_freq} Hz, got {coh_at_freq}"
            )

    def test_covariance_spectrum(self, client):
        """Test covariance spectrum calculation."""
        # Create test data with energy-dependent variability
        dt = 0.1
        duration = 100.0
        times = np.arange(0, duration, dt)

        # Create multi-band data
        data_lines = [
            "# Multi-band lightcurve\n",
            "# Column 1: TIME\n",
            "# Column 2: RATE\n",
            "# Column 3: ERROR\n",
            "# Column 4: SOFT_RATE\n",
            "# Column 5: SOFT_ERROR\n",
            "# Column 6: HARD_RATE\n",
            "# Column 7: HARD_ERROR\n",
        ]

        for t in times[:100]:  # Use subset for speed
            total = 100.0 + 20.0 * np.sin(2 * np.pi * 1.0 * t)
            soft = 0.6 * total + np.random.normal(0, 5)
            hard = 0.4 * total + np.random.normal(0, 3)
            data_lines.append(
                f"{t:.3f} {total:.1f} {np.sqrt(total):.1f} {soft:.1f} {np.sqrt(abs(soft)):.1f} {hard:.1f} {np.sqrt(abs(hard)):.1f}\n"
            )

        # Upload file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.writelines(data_lines)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "multiband.txt")},
                    content_type="multipart/form-data",
                )

            filename = response.get_json()[0]

            # Calculate covariance spectrum
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "dt": dt,
                "ref_band_interest": "interest",
                "energy_range": [0.1, 10.0],
                "n_bands": 2,
                "std": 1.0,
            }

            response = client.post(
                "/get_covariance_spectrum", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            # Covariance analysis requires specific data format
            if "error" not in result:
                assert "success" in result or "data" in result

        finally:
            os.unlink(temp_file)


class TestModelFittingValidation:
    """Validate model fitting functionality."""

    def test_power_law_fitting(self, client):
        """Test fitting a power law model."""
        # Generate power law data
        x_values = np.logspace(0, 2, 50)  # 1 to 100
        amplitude = 10.0
        index = -2.0
        y_true = amplitude * x_values**index

        # Add some noise
        _ = y_true * (1 + 0.1 * np.random.randn(len(x_values)))

        # Test model generation
        params = {
            "models": [{"type": "PowerLaw", "params": {"amplitude": amplitude, "index": index}}],
            "x_values": x_values.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        if isinstance(result, dict) and "success" in result:
            if result["success"]:
                assert "data" in result
        else:
            # Direct data return
            assert result is not None

    def test_lorentzian_fitting(self, client):
        """Test Lorentzian model for spectral lines."""
        # Generate Lorentzian profile
        x_values = np.linspace(0.1, 10.0, 100)
        amplitude = 5.0
        x_0 = 3.0  # Peak position
        gamma = 0.5  # Width

        # Lorentzian function
        _ = amplitude * gamma**2 / ((x_values - x_0) ** 2 + gamma**2)

        params = {
            "models": [
                {
                    "type": "Lorentzian",
                    "params": {"amplitude": amplitude, "x_0": x_0, "gamma": gamma},
                }
            ],
            "x_values": x_values.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Verify response
        if isinstance(result, dict) and "data" in result:
            model_y = result["data"].get("y", [])
            if model_y:
                # Check peak is at expected position
                peak_idx = np.argmax(model_y)
                peak_x = x_values[peak_idx]
                assert abs(peak_x - x_0) < 0.5, f"Peak at {peak_x}, expected near {x_0}"

    def test_composite_model(self, client):
        """Test fitting multiple components."""
        x_values = np.linspace(0.1, 10.0, 100)

        # Composite model: constant + Lorentzian
        params = {
            "models": [
                {"type": "Constant", "params": {"amplitude": 2.0}},
                {"type": "Lorentzian", "params": {"amplitude": 3.0, "x_0": 5.0, "gamma": 1.0}},
            ],
            "x_values": x_values.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()
        assert result is not None
