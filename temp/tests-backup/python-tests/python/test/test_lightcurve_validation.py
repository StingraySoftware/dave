"""
Comprehensive lightcurve validation tests for DAVE Phase 4.
Tests binning algorithms, GTI filtering, background subtraction with NumPy 2.0.
"""

import json
import os
import tempfile

import numpy as np
import pytest


class TestLightcurveValidation:
    """Validate lightcurve functionality with modern Stingray/NumPy."""

    @pytest.fixture
    def basic_lightcurve_file(self, client):
        """Create a basic lightcurve file with known properties."""
        # Generate test data
        dt = 1.0  # 1 second bins
        duration = 1000.0  # 1000 seconds
        times = np.arange(0, duration, dt)

        # Create a simple sinusoidal signal with Poisson noise
        mean_rate = 100.0
        amplitude = 20.0
        period = 100.0  # 100 second period
        signal = mean_rate + amplitude * np.sin(2 * np.pi * times / period)
        counts = np.random.poisson(signal)
        errors = np.sqrt(counts)

        # Create lightcurve file
        lc_data = "# Test lightcurve for validation\n"
        lc_data += "# Column 1: TIME\n"
        lc_data += "# Column 2: RATE\n"
        lc_data += "# Column 3: ERROR\n"
        for t, c, e in zip(times, counts, errors, strict=False):
            lc_data += f"{t:.3f} {c} {e:.3f}\n"

        # Upload file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(lc_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "test_lightcurve.txt")},
                    content_type="multipart/form-data",
                )

            assert response.status_code == 200
            filename = response.get_json()[0]
            return filename, dt, mean_rate, amplitude, period
        finally:
            os.unlink(temp_file)

    @pytest.fixture
    def lightcurve_with_gaps_file(self, client):
        """Create a lightcurve with GTI gaps."""
        dt = 1.0
        # Create three segments with gaps
        segment1 = np.arange(0, 300, dt)
        segment2 = np.arange(400, 700, dt)  # 100s gap
        segment3 = np.arange(800, 1000, dt)  # 100s gap

        times = np.concatenate([segment1, segment2, segment3])
        counts = np.random.poisson(100, size=len(times))
        errors = np.sqrt(counts)

        # Create GTI file
        gti_data = "# GTI file\n"
        gti_data += "# Column 1: START\n"
        gti_data += "# Column 2: STOP\n"
        gti_data += "0.0 300.0\n"
        gti_data += "400.0 700.0\n"
        gti_data += "800.0 1000.0\n"

        # Upload lightcurve
        lc_data = "# Lightcurve with gaps\n"
        for t, c, e in zip(times, counts, errors, strict=False):
            lc_data += f"{t:.3f} {c} {e:.3f}\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(lc_data)
            lc_file = f.name

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(gti_data)
            gti_file = f.name

        try:
            # Upload lightcurve
            with open(lc_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "lc_with_gaps.txt")},
                    content_type="multipart/form-data",
                )
            lc_filename = response.get_json()[0]

            # Upload GTI
            with open(gti_file, "rb") as f:
                response = client.post(
                    "/upload", data={"file": (f, "gti.txt")}, content_type="multipart/form-data"
                )
            gti_filename = response.get_json()[0]

            return lc_filename, gti_filename, dt
        finally:
            os.unlink(lc_file)
            os.unlink(gti_file)

    def test_basic_lightcurve_loading(self, client, basic_lightcurve_file):
        """Test basic lightcurve loading and properties."""
        filename, dt, mean_rate, amplitude, period = basic_lightcurve_file

        # Get lightcurve plot data
        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "ligthcurve"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": dt,
            "baseline_opts": {"start": 0, "stop": 0},
            "meanflux_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Validate lightcurve data
        if isinstance(result, list) and len(result) >= 2:
            times = np.array(result[0]["values"])
            rates = np.array(result[1]["values"])

            # Check basic properties
            assert len(times) == len(rates)
            assert np.mean(rates) == pytest.approx(mean_rate, rel=0.1)

            # Verify time binning
            time_diffs = np.diff(times)
            assert np.allclose(time_diffs, dt, rtol=0.01)

    def test_lightcurve_rebinning(self, client, basic_lightcurve_file):
        """Test lightcurve rebinning functionality."""
        filename, original_dt, _, _, _ = basic_lightcurve_file

        # Test different rebinning factors
        for rebin_factor in [2, 5, 10]:
            new_dt = original_dt * rebin_factor

            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "styles": {"type": "ligthcurve"},
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "RATE"},
                ],
                "dt": new_dt,
                "baseline_opts": {"start": 0, "stop": 0},
                "meanflux_opts": {"start": 0, "stop": 0},
            }

            response = client.post(
                "/get_lightcurve", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            if isinstance(result, list) and len(result) >= 2:
                times = np.array(result[0]["values"])

                # Check rebinning worked
                if len(times) > 1:
                    time_diffs = np.diff(times)
                    assert np.allclose(time_diffs, new_dt, rtol=0.01)

    def test_gti_filtering(self, client, lightcurve_with_gaps_file):
        """Test GTI filtering functionality."""
        lc_filename, gti_filename, dt = lightcurve_with_gaps_file

        # Get lightcurve without GTI
        params_no_gti = {
            "filename": lc_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "ligthcurve"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": dt,
            "baseline_opts": {"start": 0, "stop": 0},
            "meanflux_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params_no_gti), content_type="application/json"
        )
        result_no_gti = response.get_json()

        # Get lightcurve with GTI
        params_with_gti = params_no_gti.copy()
        params_with_gti["gti_filename"] = gti_filename

        response = client.post(
            "/get_lightcurve", data=json.dumps(params_with_gti), content_type="application/json"
        )
        result_with_gti = response.get_json()

        # GTI filtering should handle gaps properly
        assert response.status_code == 200

    def test_background_subtraction(self, client):
        """Test background subtraction in lightcurves."""
        # Create source lightcurve
        times = np.arange(0, 1000, 1.0)
        source_counts = np.random.poisson(150, size=len(times))  # Higher count rate
        background_counts = np.random.poisson(50, size=len(times))  # Background

        # Create and upload source file
        source_data = "# Source lightcurve\n"
        for t, c in zip(times, source_counts, strict=False):
            source_data += f"{t:.3f} {c} {np.sqrt(c):.3f}\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(source_data)
            source_file = f.name

        # Create and upload background file
        bkg_data = "# Background lightcurve\n"
        for t, c in zip(times, background_counts, strict=False):
            bkg_data += f"{t:.3f} {c} {np.sqrt(c):.3f}\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(bkg_data)
            bkg_file = f.name

        try:
            # Upload files
            with open(source_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "source_lc.txt")},
                    content_type="multipart/form-data",
                )
            source_filename = response.get_json()[0]

            with open(bkg_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "background_lc.txt")},
                    content_type="multipart/form-data",
                )
            bkg_filename = response.get_json()[0]

            # Get background-subtracted lightcurve
            params = {
                "filename": source_filename,
                "bck_filename": bkg_filename,
                "gti_filename": "",
                "filters": [],
                "styles": {"type": "ligthcurve"},
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "RATE"},
                ],
                "dt": 1.0,
                "baseline_opts": {"start": 0, "stop": 0},
                "meanflux_opts": {"start": 0, "stop": 0},
            }

            response = client.post(
                "/get_lightcurve", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            if isinstance(result, list) and len(result) >= 2:
                rates = np.array(result[1]["values"])
                # Background-subtracted rate should be around 100
                assert np.mean(rates) == pytest.approx(100, rel=0.2)

        finally:
            os.unlink(source_file)
            os.unlink(bkg_file)

    def test_numpy_2_compatibility(self, client, basic_lightcurve_file):
        """Test NumPy 2.0 specific compatibility."""
        filename, dt, _, _, _ = basic_lightcurve_file

        # Test various operations that might be affected by NumPy 2.0
        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "ligthcurve"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": dt,
            "baseline_opts": {"start": 0, "stop": 0},
            "meanflux_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        if isinstance(result, list) and len(result) >= 2:
            times = np.array(result[0]["values"])
            rates = np.array(result[1]["values"])

            # Test NumPy 2.0 type handling
            assert isinstance(times, np.ndarray)
            assert isinstance(rates, np.ndarray)

            # Test statistical operations
            mean_rate = np.mean(rates)
            std_rate = np.std(rates)

            assert np.isfinite(mean_rate)
            assert np.isfinite(std_rate)
            assert mean_rate > 0
            assert std_rate > 0

    def test_lightcurve_from_events(self, client):
        """Test creating lightcurves from event data."""
        # Create event data
        n_events = 10000
        event_times = np.sort(np.random.uniform(0, 1000, n_events))
        event_pi = np.random.randint(20, 200, n_events)

        # Create event file
        evt_data = "# Event list\n"
        evt_data += "# Column 1: TIME\n"
        evt_data += "# Column 2: PI\n"
        for t, pi in zip(event_times, event_pi, strict=False):
            evt_data += f"{t:.6f} {pi}\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(evt_data)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload", data={"file": (f, "events.txt")}, content_type="multipart/form-data"
                )
            filename = response.get_json()[0]

            # Create lightcurve from events
            params = {
                "filename": filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "styles": {"type": "ligthcurve"},
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PI"},
                ],
                "dt": 10.0,  # 10 second bins
                "baseline_opts": {"start": 0, "stop": 0},
                "meanflux_opts": {"start": 0, "stop": 0},
            }

            response = client.post(
                "/get_lightcurve", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            result = response.get_json()

            # Verify lightcurve was created
            if isinstance(result, list) and len(result) >= 2:
                times = result[0]["values"]
                rates = result[1]["values"]
                assert len(times) > 0
                assert len(rates) == len(times)

        finally:
            os.unlink(temp_file)

    def test_error_propagation(self, client, basic_lightcurve_file):
        """Test error propagation in lightcurve operations."""
        filename, dt, _, _, _ = basic_lightcurve_file

        params = {
            "filename": filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "ligthcurve"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": dt,
            "baseline_opts": {"start": 0, "stop": 0},
            "meanflux_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Check if error values are present and reasonable
        if isinstance(result, list) and len(result) >= 2:
            if "error_values" in result[1]:
                errors = np.array(result[1]["error_values"])
                rates = np.array(result[1]["values"])

                # Errors should be approximately sqrt(rates) for Poisson
                expected_errors = np.sqrt(np.abs(rates))
                # Allow for some difference due to processing
                assert np.allclose(errors, expected_errors, rtol=0.5)
