"""
Integration tests for Flask endpoints in DAVE server.
Tests all API endpoints with correct parameters.
"""

import json


class TestFileUploadEndpoints:
    """Test file upload and management endpoints."""

    def test_upload_text_file(self, client, sample_text_file):
        """Test uploading a text lightcurve file."""
        with open(sample_text_file, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test_data.txt")}, content_type="multipart/form-data"
            )

        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0] == "test_data.txt"

    def test_upload_no_file(self, client):
        """Test upload endpoint with no file."""
        response = client.post("/upload", data={}, content_type="multipart/form-data")

        assert response.status_code == 200
        data = response.get_json()
        assert "error" in data


class TestDatasetSchemaEndpoints:
    """Test dataset schema and metadata endpoints."""

    def test_get_dataset_schema(self, client, uploaded_file_id):
        """Test getting dataset schema."""
        response = client.get(f"/get_dataset_schema?filename={uploaded_file_id}")

        assert response.status_code == 200
        data = response.get_json()
        # Schema returns table structure directly
        assert isinstance(data, dict)
        assert "EVENTS" in data  # Should have EVENTS table
        assert "TIME" in data["EVENTS"]  # Should have TIME column

    def test_get_dataset_header(self, client, uploaded_file_id):
        """Test getting dataset header."""
        response = client.get(f"/get_dataset_header?filename={uploaded_file_id}")

        assert response.status_code == 200
        data = response.get_json()
        # Header returns header info directly
        assert isinstance(data, dict)
        assert "EVENTS" in data  # Should have EVENTS header


class TestPlotDataEndpoints:
    """Test plot data generation endpoints."""

    def test_get_plot_data(self, client, uploaded_file_id):
        """Test getting plot data."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "scatter"},  # Need to specify plot type
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
        }

        response = client.post(
            "/get_plot_data", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_get_lightcurve(self, client, uploaded_file_id):
        """Test getting lightcurve data."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "baseline_opts": {},
            "meanflux_opts": {},
            "variance_opts": {},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_get_joined_lightcurves(self, client, uploaded_file_id):
        """Test joining lightcurves."""
        params = {
            "lc0_filename": uploaded_file_id,
            "lc1_filename": uploaded_file_id,
            "lc0_bck_filename": "",
            "lc1_bck_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
        }

        response = client.post(
            "/get_joined_lightcurves", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data


class TestSpectralAnalysisEndpoints:
    """Test spectral analysis endpoints."""

    def test_get_power_density_spectrum(self, client, uploaded_file_id):
        """Test PDS calculation."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "nsegm": 1,
            "segment_size": 10,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
        }

        response = client.post(
            "/get_power_density_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_get_cross_spectrum(self, client, uploaded_file_id):
        """Test cross spectrum calculation."""
        params = {
            "filename1": uploaded_file_id,
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt1": 1.0,
            "filename2": uploaded_file_id,
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt2": 1.0,
            "nsegm": 1,
            "segment_size": 10,
            "norm": "leahy",
            "type": "Sng",
        }

        response = client.post(
            "/get_cross_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data


class TestTimingAnalysisEndpoints:
    """Test timing analysis endpoints."""

    def test_get_phase_lag_spectrum(self, client, uploaded_file_id):
        """Test phase lag spectrum calculation."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "nsegm": 1,
            "segment_size": 10,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "freq_range": [0.1, 10],
            "energy_range": [0.5, 10],
            "n_bands": 2,
        }

        response = client.post(
            "/get_phase_lag_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_get_rms_spectrum(self, client, uploaded_file_id):
        """Test RMS spectrum calculation."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "nsegm": 1,
            "segment_size": 10,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "freq_range": [0.1, 10],
            "energy_range": [0.5, 10],
            "n_bands": 2,
            "white_noise": 0,
        }

        response = client.post(
            "/get_rms_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data


class TestModelFittingEndpoints:
    """Test model fitting endpoints."""

    def test_get_fit_powerspectrum_result(self, client, uploaded_file_id):
        """Test power spectrum fitting."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "nsegm": 1,
            "segment_size": 10,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "models": [{"type": "Lorentzian"}],
            "priors": {},
            "sampling_params": {},
        }

        response = client.post(
            "/get_fit_powerspectrum_result",
            data=json.dumps(params),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_get_plot_data_from_models(self, client):
        """Test model plot generation."""
        params = {
            "models": [
                {"type": "Lorentzian", "params": {"amplitude": 1.0, "gamma": 0.1, "x_0": 1.0}}
            ],
            "x_values": list(range(100)),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data


class TestPulseAnalysisEndpoints:
    """Test pulse and phase analysis endpoints."""

    def test_get_pulse_search(self, client, uploaded_file_id):
        """Test pulse search."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "freq_range": [0.1, 10],
            "mode": "z2n",
            "oversampling": 2,
            "nharm": 1,
            "nbin": 16,
            "segment_size": 10,
        }

        response = client.post(
            "/get_pulse_search", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_get_phaseogram(self, client, uploaded_file_id):
        """Test phaseogram generation."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "f": 1.0,
            "nph": 64,
            "nt": 32,
            "fdot": 0,
            "fddot": 0,
            "binary_params": {},
        }

        response = client.post(
            "/get_phaseogram", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data


class TestUtilityEndpoints:
    """Test utility and analysis endpoints."""

    def test_get_lomb_scargle_results(self, client, uploaded_file_id):
        """Test Lomb-Scargle periodogram."""
        params = {
            "filename": uploaded_file_id,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "PHA"}],
            "dt": 1.0,
            "freq_range": [0.1, 10],
            "nyquist_factor": 1,
            "ls_norm": "standard",
            "samples_per_peak": 5,
        }

        response = client.post(
            "/get_lomb_scargle_results", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_bulk_analysis(self, client, uploaded_file_id):
        """Test bulk analysis endpoint."""
        params = {
            "filenames": [uploaded_file_id],
            "plotConfigs": {
                "dt": 1.0,
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "PHA"},
                ],
            },
            "outdir": "test_output",
        }

        response = client.post(
            "/bulk_analisys", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data

    def test_publish_endpoint(self, client):
        """Test publish endpoint."""
        params = {"message": "test_message"}

        response = client.post("/publish", data=json.dumps(params), content_type="application/json")

        assert response.status_code == 200


class TestErrorHandling:
    """Test error handling across endpoints."""

    def test_missing_parameters(self, client):
        """Test endpoints with missing required parameters."""
        response = client.post(
            "/get_plot_data", data=json.dumps({}), content_type="application/json"
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "success" in data
        assert data["success"] is False

    def test_invalid_json(self, client):
        """Test endpoints with invalid JSON."""
        response = client.post(
            "/get_plot_data", data="invalid json", content_type="application/json"
        )

        assert response.status_code == 400
