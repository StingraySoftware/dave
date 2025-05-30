"""
Test covariance and RMS spectrum functionality with modern stack.

This validates scientific accuracy of covariance and RMS calculations
after migration to Python 3.13, NumPy 2.2, and Stingray 2.2.7.
"""

import json

import numpy as np


class TestCovarianceRMSValidation:
    """Test covariance and RMS spectrum calculations."""

    def setup_dual_band_data(self, tmp_path):
        """Create test data with two energy bands for covariance analysis."""
        # Parameters
        duration = 100.0
        dt = 0.1
        n_bins = int(duration / dt)
        times = np.arange(0, duration, dt)

        # Create correlated signals with different bands
        # Band 1: Lower energy (softer)
        freq1 = 0.1  # 10s period
        band1_mean = 100.0
        band1_signal = band1_mean + 20 * np.sin(2 * np.pi * freq1 * times)
        band1_counts = np.random.poisson(band1_signal)
        band1_err = np.sqrt(band1_counts)

        # Band 2: Higher energy (harder) - correlated but with phase lag
        phase_lag = np.pi / 4  # 45 degree phase lag
        band2_mean = 50.0
        band2_signal = band2_mean + 10 * np.sin(2 * np.pi * freq1 * times + phase_lag)
        band2_counts = np.random.poisson(band2_signal)
        band2_err = np.sqrt(band2_counts)

        # Write 8-column format file
        filename = str(tmp_path / "dual_band_test.txt")
        with open(filename, "w") as f:
            f.write("# Dual band test data\n")
            f.write("# TIME TIME_ERR RATE RATE_ERR COLOR1 COLOR1_ERR COLOR2 COLOR2_ERR\n")
            for i in range(n_bins):
                f.write(
                    f"{times[i]:.6f} {dt / 2:.6f} {band1_counts[i] + band2_counts[i]:.1f} "
                    f"{np.sqrt(band1_err[i] ** 2 + band2_err[i] ** 2):.3f} "
                    f"{band1_counts[i]:.1f} {band1_err[i]:.3f} "
                    f"{band2_counts[i]:.1f} {band2_err[i]:.3f}\n"
                )

        return filename

    def test_covariance_spectrum_basic(self, client, tmp_path):
        """Test basic covariance spectrum calculation."""
        # Create test data
        filename = self.setup_dual_band_data(tmp_path)

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "test_covariance.txt")},
                content_type="multipart/form-data",
            )

        assert response.status_code == 200
        uploaded_filename = response.get_json()[0]

        # Calculate covariance spectrum
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "dt": 1.0,
            "ref_band_interest": "COLOR1:COLOR2",
            "energy_range": [[0.0, 10.0], [0.0, 10.0]],
            "n_bands": 2,
            "std": 0.0,
        }

        response = client.post(
            "/get_covariance_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Validate result structure
        assert "freq" in result["values"]
        assert "covariance" in result["values"]
        assert "covariance_err" in result["values"]

        # Validate data
        freq = np.array(result["values"]["freq"])
        cov = np.array(result["values"]["covariance"])
        cov_err = np.array(result["values"]["covariance_err"])

        assert len(freq) > 0
        assert len(cov) == len(freq)
        assert len(cov_err) == len(freq)

        # Check frequency range
        assert freq[0] > 0
        assert freq[-1] < 5.0  # Nyquist frequency for dt=0.1

        # Covariance should show peak at signal frequency
        peak_idx = np.argmax(np.abs(cov[1:11])) + 1  # Skip DC, check first 10 bins
        peak_freq = freq[peak_idx]
        assert 0.08 < peak_freq < 0.12  # Should be near 0.1 Hz

    def test_covariance_different_normalizations(self, client, tmp_path):
        """Test covariance with different normalizations."""
        # Create test data
        filename = self.setup_dual_band_data(tmp_path)

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "test_cov_norm.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        normalizations = ["frac", "abs", "none"]
        results = {}

        for norm in normalizations:
            params = {
                "filename": uploaded_filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "dt": 1.0,
                "ref_band_interest": f"COLOR1:COLOR2:{norm}",
                "energy_range": [[0.0, 10.0], [0.0, 10.0]],
                "n_bands": 2,
                "std": 0.0,
            }

            response = client.post(
                "/get_covariance_spectrum", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            results[norm] = response.get_json()

        # Compare normalizations
        cov_frac = np.array(results["frac"]["values"]["covariance"])
        cov_abs = np.array(results["abs"]["values"]["covariance"])
        cov_none = np.array(results["none"]["values"]["covariance"])

        # Different normalizations should give different magnitudes
        assert not np.allclose(cov_frac, cov_abs)
        assert not np.allclose(cov_frac, cov_none)

        # But shapes should be similar (peaks at same frequencies)
        peak_frac = np.argmax(np.abs(cov_frac[1:11])) + 1
        peak_abs = np.argmax(np.abs(cov_abs[1:11])) + 1
        peak_none = np.argmax(np.abs(cov_none[1:11])) + 1

        assert peak_frac == peak_abs == peak_none

    def test_rms_spectrum_basic(self, client, tmp_path):
        """Test basic RMS spectrum calculation."""
        # Create test data with variable signal
        duration = 100.0
        dt = 0.1
        n_bins = int(duration / dt)
        times = np.arange(0, duration, dt)

        # Create signal with frequency-dependent RMS
        mean_rate = 100.0
        low_freq_amp = 20.0  # Low frequency variability
        high_freq_amp = 5.0  # High frequency variability

        signal = (
            mean_rate
            + low_freq_amp * np.sin(2 * np.pi * 0.1 * times)
            + high_freq_amp * np.sin(2 * np.pi * 1.0 * times)
        )

        counts = np.random.poisson(signal)
        errors = np.sqrt(counts)

        # Write test file
        filename = str(tmp_path / "rms_test.txt")
        with open(filename, "w") as f:
            f.write("# RMS test data\n")
            f.write("# TIME TIME_ERR RATE RATE_ERR\n")
            for i in range(n_bins):
                f.write(f"{times[i]:.6f} {dt / 2:.6f} {counts[i]:.1f} {errors[i]:.3f}\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test_rms.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Calculate RMS spectrum
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": 1.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "frac",
            "type": "Srmsspectrum",
            "df": 0,
            "freq_range": [0.01, 5.0],
            "energy_range": [0.0, 10.0],
            "n_bands": 1,
            "white_noise": 0.0,
        }

        response = client.post(
            "/get_rms_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Validate result structure
        assert "freq" in result["values"]
        assert "rms" in result["values"]
        assert "rms_err" in result["values"]

        # Validate data
        freq = np.array(result["values"]["freq"])
        rms = np.array(result["values"]["rms"])
        rms_err = np.array(result["values"]["rms_err"])

        assert len(freq) > 0
        assert len(rms) == len(freq)
        assert len(rms_err) == len(freq)

        # RMS values should be positive
        assert np.all(rms >= 0)

        # Should see higher RMS at signal frequencies
        # Find bins near 0.1 Hz and 1.0 Hz
        idx_01hz = np.argmin(np.abs(freq - 0.1))
        idx_1hz = np.argmin(np.abs(freq - 1.0))

        # RMS should be elevated at these frequencies
        mean_rms = np.mean(rms)
        assert rms[idx_01hz] > mean_rms
        assert rms[idx_1hz] > mean_rms

    def test_rms_frequency_binning(self, client, tmp_path):
        """Test RMS spectrum with frequency binning."""
        # Create simple test data
        filename = self.setup_dual_band_data(tmp_path)

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "test_rms_binning.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Test different frequency binning factors
        df_values = [0, 2, 5]
        results = {}

        for df in df_values:
            params = {
                "filename": uploaded_filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "COLOR1"},
                ],
                "dt": 1.0,
                "nsegm": 1,
                "segment_size": 0,
                "norm": "frac",
                "type": "Srmsspectrum",
                "df": df,
                "freq_range": [0.01, 5.0],
                "energy_range": [0.0, 10.0],
                "n_bands": 1,
                "white_noise": 0.0,
            }

            response = client.post(
                "/get_rms_spectrum", data=json.dumps(params), content_type="application/json"
            )

            assert response.status_code == 200
            results[df] = response.get_json()

        # Check that binning reduces number of frequency bins
        n_freq_0 = len(results[0]["values"]["freq"])
        n_freq_2 = len(results[2]["values"]["freq"])
        n_freq_5 = len(results[5]["values"]["freq"])

        assert n_freq_2 < n_freq_0
        assert n_freq_5 < n_freq_2

        # Binning should preserve total RMS power
        rms_0 = np.array(results[0]["values"]["rms"])
        rms_5 = np.array(results[5]["values"]["rms"])

        # Average RMS should be similar (not exact due to binning)
        assert np.abs(np.mean(rms_0) - np.mean(rms_5)) / np.mean(rms_0) < 0.2

    def test_covariance_vs_rms_consistency(self, client, tmp_path):
        """Test that covariance and RMS give consistent results for same band."""
        # Create single band data
        duration = 100.0
        dt = 0.1
        n_bins = int(duration / dt)
        times = np.arange(0, duration, dt)

        # Simple sinusoidal signal
        mean_rate = 100.0
        amplitude = 20.0
        frequency = 0.2  # Hz

        signal = mean_rate + amplitude * np.sin(2 * np.pi * frequency * times)
        counts = np.random.poisson(signal)
        errors = np.sqrt(counts)

        # Write file with same data in both color bands
        filename = str(tmp_path / "consistency_test.txt")
        with open(filename, "w") as f:
            f.write("# Consistency test data\n")
            f.write("# TIME TIME_ERR RATE RATE_ERR COLOR1 COLOR1_ERR COLOR2 COLOR2_ERR\n")
            for i in range(n_bins):
                f.write(
                    f"{times[i]:.6f} {dt / 2:.6f} {counts[i]:.1f} {errors[i]:.3f} "
                    f"{counts[i]:.1f} {errors[i]:.3f} "
                    f"{counts[i]:.1f} {errors[i]:.3f}\n"
                )

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "test_consistency.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Calculate covariance (same band with itself)
        cov_params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "dt": 1.0,
            "ref_band_interest": "COLOR1:COLOR1",  # Same band
            "energy_range": [[0.0, 10.0], [0.0, 10.0]],
            "n_bands": 2,
            "std": 0.0,
        }

        response = client.post(
            "/get_covariance_spectrum", data=json.dumps(cov_params), content_type="application/json"
        )

        assert response.status_code == 200
        cov_result = response.get_json()

        # Calculate RMS
        rms_params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "COLOR1"},
            ],
            "dt": 1.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "frac",
            "type": "Srmsspectrum",
            "df": 0,
            "freq_range": [0.01, 5.0],
            "energy_range": [0.0, 10.0],
            "n_bands": 1,
            "white_noise": 0.0,
        }

        response = client.post(
            "/get_rms_spectrum", data=json.dumps(rms_params), content_type="application/json"
        )

        assert response.status_code == 200
        rms_result = response.get_json()

        # Covariance of signal with itself should equal power (RMS squared)
        cov = np.array(cov_result["values"]["covariance"])
        rms = np.array(rms_result["values"]["rms"])

        # Check at peak frequency
        freq_cov = np.array(cov_result["values"]["freq"])
        freq_rms = np.array(rms_result["values"]["freq"])

        # Find peak near signal frequency
        idx_cov = np.argmin(np.abs(freq_cov - frequency))
        idx_rms = np.argmin(np.abs(freq_rms - frequency))

        # Covariance should approximately equal RMS squared
        # (within numerical precision and normalization factors)
        assert np.abs(cov[idx_cov] - rms[idx_rms] ** 2) / rms[idx_rms] ** 2 < 0.3

    def test_numpy_2_compatibility_covariance(self, client, tmp_path):
        """Test NumPy 2.0 compatibility for covariance calculations."""
        # Create test data
        filename = self.setup_dual_band_data(tmp_path)

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "test_numpy2_cov.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Calculate covariance
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "dt": 1.0,
            "ref_band_interest": "COLOR1:COLOR2",
            "energy_range": [[0.0, 10.0], [0.0, 10.0]],
            "n_bands": 2,
            "std": 0.0,
        }

        response = client.post(
            "/get_covariance_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Verify NumPy 2.0 array handling
        freq = np.array(result["values"]["freq"])
        cov = np.array(result["values"]["covariance"])

        # Check array properties
        assert freq.dtype in [np.float32, np.float64]
        assert cov.dtype in [np.float32, np.float64]
        assert freq.shape[0] == cov.shape[0]

        # Verify no NaN or inf values
        assert not np.any(np.isnan(freq))
        assert not np.any(np.isnan(cov))
        assert not np.any(np.isinf(freq))
        assert not np.any(np.isinf(cov))
