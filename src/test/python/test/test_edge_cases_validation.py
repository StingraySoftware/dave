"""
Test edge cases and error handling with modern stack.

This validates that DAVE handles various edge cases gracefully
after migration to Python 3.13, NumPy 2.2, and Stingray 2.2.7.
"""

import json

import numpy as np


class TestEdgeCasesValidation:
    """Test edge cases and error handling."""

    def test_empty_file_upload(self, client, tmp_path):
        """Test uploading an empty file."""
        # Create empty file
        filename = str(tmp_path / "empty.txt")
        with open(filename, "w") as f:
            pass  # Empty file

        # Try to upload
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "empty.txt")}, content_type="multipart/form-data"
            )

        # Should return error or handle gracefully
        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            # If upload succeeds, getting dataset should fail gracefully
            uploaded_filename = response.get_json()[0]

            response = client.get(f"/get_dataset_schema?filename={uploaded_filename}")
            # Should return error rather than crash
            assert response.status_code in [200, 400, 422]

    def test_invalid_file_format(self, client, tmp_path):
        """Test uploading file with invalid format."""
        # Create file with invalid data
        filename = str(tmp_path / "invalid.txt")
        with open(filename, "w") as f:
            f.write("This is not valid astronomical data\n")
            f.write("Random text without proper columns\n")
            f.write("123 abc def\n")

        # Try to upload
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "invalid.txt")}, content_type="multipart/form-data"
            )

        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]

            # Getting schema should fail gracefully
            response = client.get(f"/get_dataset_schema?filename={uploaded_filename}")
            assert response.status_code in [200, 400, 422]

    def test_malformed_json_request(self, client, tmp_path):
        """Test sending malformed JSON to endpoints."""
        # Create valid test data first
        filename = str(tmp_path / "test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            f.write("0.0 100.0 10.0\n")
            f.write("1.0 105.0 10.2\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Send malformed JSON
        response = client.post(
            "/get_lightcurve", data='{"invalid": json}', content_type="application/json"
        )

        # Should return 400 Bad Request
        assert response.status_code == 400

    def test_missing_required_parameters(self, client, tmp_path):
        """Test endpoints with missing required parameters."""
        # Create valid test data
        filename = str(tmp_path / "test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            f.write("0.0 100.0 10.0\n")
            f.write("1.0 105.0 10.2\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Send request with missing required parameters
        params = {
            "filename": uploaded_filename
            # Missing other required parameters
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        # Should return error
        assert response.status_code in [400, 422, 500]

    def test_extremely_large_dt(self, client, tmp_path):
        """Test analysis with extremely large time binning."""
        # Create test data
        filename = str(tmp_path / "test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            for i in range(100):
                f.write(f"{i * 0.1:.1f} 100.0 10.0\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Request with extremely large dt (larger than data duration)
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "lightcurve"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": 1000.0,  # Much larger than data duration
            "baseline_opts": {"start": 0, "stop": 0},
            "meanflux_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            result = response.get_json()
            # Should return valid structure even if data is sparse
            assert "values" in result or "error" in result

    def test_extremely_small_dt(self, client, tmp_path):
        """Test analysis with extremely small time binning."""
        # Create test data
        filename = str(tmp_path / "test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            for i in range(10):
                f.write(f"{i:.1f} 100.0 10.0\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Request with extremely small dt
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "lightcurve"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": 1e-6,  # Microsecond binning
            "baseline_opts": {"start": 0, "stop": 0},
            "meanflux_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_invalid_time_order(self, client, tmp_path):
        """Test data with time values not in ascending order."""
        # Create data with jumbled time order
        filename = str(tmp_path / "unordered.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            times = [0.0, 2.0, 1.0, 4.0, 3.0]  # Not ordered
            for t in times:
                f.write(f"{t:.1f} 100.0 10.0\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "unordered.txt")}, content_type="multipart/form-data"
            )

        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]

            # Try to get lightcurve
            params = {
                "filename": uploaded_filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "styles": {"type": "lightcurve"},
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

            # Should handle gracefully (Stingray might sort automatically)
            assert response.status_code in [200, 400, 422]

    def test_negative_time_values(self, client, tmp_path):
        """Test data with negative time values."""
        # Create data with negative times
        filename = str(tmp_path / "negative_time.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            for i in range(-5, 5):
                f.write(f"{i:.1f} 100.0 10.0\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "negative_time.txt")},
                content_type="multipart/form-data",
            )

        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]

            # Try to get lightcurve
            params = {
                "filename": uploaded_filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "styles": {"type": "lightcurve"},
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

            assert response.status_code in [200, 400, 422]

    def test_nan_and_inf_values(self, client, tmp_path):
        """Test data containing NaN and infinite values."""
        # Create data with NaN and inf values
        filename = str(tmp_path / "nan_inf.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            f.write("0.0 100.0 10.0\n")
            f.write("1.0 nan 10.0\n")
            f.write("2.0 inf 10.0\n")
            f.write("3.0 -inf 10.0\n")
            f.write("4.0 100.0 nan\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "nan_inf.txt")}, content_type="multipart/form-data"
            )

        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]

            # Try to get dataset schema
            response = client.get(f"/get_dataset_schema?filename={uploaded_filename}")
            assert response.status_code in [200, 400, 422]

    def test_zero_and_negative_rates(self, client, tmp_path):
        """Test data with zero and negative count rates."""
        # Create data with zero/negative rates
        filename = str(tmp_path / "zero_negative.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            f.write("0.0 0.0 0.0\n")  # Zero rate
            f.write("1.0 -10.0 5.0\n")  # Negative rate
            f.write("2.0 100.0 10.0\n")  # Normal rate

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "zero_negative.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Try PDS analysis (which might have issues with zero/negative rates)
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
            "type": "Powerspectrum",
            "freq_range": [0.01, 1.0],
        }

        response = client.post(
            "/get_power_density_spectrum", data=json.dumps(params), content_type="application/json"
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_single_data_point(self, client, tmp_path):
        """Test analysis with only one data point."""
        # Create file with single data point
        filename = str(tmp_path / "single_point.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            f.write("0.0 100.0 10.0\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "single_point.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Try PDS analysis (should fail gracefully)
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
            "type": "Powerspectrum",
            "freq_range": [0.01, 1.0],
        }

        response = client.post(
            "/get_power_density_spectrum", data=json.dumps(params), content_type="application/json"
        )

        # Should return error gracefully
        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            result = response.get_json()
            # Should contain error message
            assert "error" in result or "values" in result

    def test_corrupted_fits_file(self, client, tmp_path):
        """Test uploading corrupted FITS file."""
        # Create file that looks like FITS but is corrupted
        filename = str(tmp_path / "corrupted.fits")
        with open(filename, "wb") as f:
            f.write(b"SIMPLE  =                    T")  # Start of FITS header
            f.write(b"corrupted data here" * 100)  # Corrupted content

        # Try to upload
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "corrupted.fits")}, content_type="multipart/form-data"
            )

        assert response.status_code in [200, 400, 422]

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]

            # Getting schema should fail gracefully
            response = client.get(f"/get_dataset_schema?filename={uploaded_filename}")
            assert response.status_code in [200, 400, 422]

    def test_huge_filter_ranges(self, client, tmp_path):
        """Test filters with extremely large ranges."""
        # Create normal test data
        filename = str(tmp_path / "test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            for i in range(10):
                f.write(f"{i:.1f} 100.0 10.0\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Apply filter with huge range
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [{"table": "EVENTS", "column": "TIME", "from": -1e10, "to": 1e10}],
            "styles": {"type": "2d"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
        }

        response = client.post(
            "/get_plot_data", data=json.dumps(params), content_type="application/json"
        )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_memory_stress_large_dataset(self, client, tmp_path):
        """Test with moderately large dataset to check memory handling."""
        # Create larger dataset (but not too large for CI)
        filename = str(tmp_path / "large_test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            # Create 10,000 data points
            for i in range(10000):
                time = i * 0.001  # 10 seconds of 1ms data
                rate = 100 + 10 * np.sin(2 * np.pi * 0.1 * time)
                error = np.sqrt(rate)
                f.write(f"{time:.6f} {rate:.3f} {error:.3f}\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "large_test.txt")}, content_type="multipart/form-data"
            )

        assert response.status_code == 200
        uploaded_filename = response.get_json()[0]

        # Try PDS analysis on large dataset
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": 0.01,
            "nsegm": 10,
            "segment_size": 1.0,
            "norm": "frac",
            "type": "Powerspectrum",
            "freq_range": [0.01, 50.0],
        }

        response = client.post(
            "/get_power_density_spectrum", data=json.dumps(params), content_type="application/json"
        )

        # Should complete successfully
        assert response.status_code == 200
        result = response.get_json()
        assert "values" in result

        # Check memory didn't explode - arrays should be reasonable size
        freq = result["values"]["freq"]
        power = result["values"]["power"]
        assert len(freq) < 100000  # Shouldn't be excessive
        assert len(power) == len(freq)

    def test_unicode_filename_handling(self, client, tmp_path):
        """Test handling of files with unicode characters in names."""
        # Create file with unicode name
        filename = str(tmp_path / "测试_file_français.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            f.write("0.0 100.0 10.0\n")
            f.write("1.0 105.0 10.2\n")

        # Try to upload
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "测试_file_français.txt")},
                content_type="multipart/form-data",
            )

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_concurrent_requests(self, client, tmp_path):
        """Test handling multiple concurrent requests."""
        # Create test data
        filename = str(tmp_path / "concurrent_test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            for i in range(100):
                f.write(f"{i * 0.1:.1f} 100.0 10.0\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "concurrent_test.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Make multiple requests rapidly
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "2d"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
        }

        # Send 5 requests in sequence (simulating concurrent access)
        responses = []
        for i in range(5):
            response = client.post(
                "/get_plot_data", data=json.dumps(params), content_type="application/json"
            )
            responses.append(response)

        # All should succeed
        for response in responses:
            assert response.status_code == 200
            result = response.get_json()
            assert "values" in result

    def test_numpy_2_edge_cases(self, client, tmp_path):
        """Test NumPy 2.0 specific edge cases."""
        # Create data that might expose NumPy version differences
        filename = str(tmp_path / "numpy_edge.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            # Data with extreme values that might behave differently in NumPy 2
            f.write("0.0 1e-100 1e-50\n")  # Very small values
            f.write("1.0 1e100 1e50\n")  # Very large values
            f.write("2.0 100.0 10.0\n")  # Normal values

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "numpy_edge.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Try analysis that might expose NumPy differences
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "2d"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
        }

        response = client.post(
            "/get_plot_data", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Verify all values are JSON serializable (no numpy.float64, etc.)
        def check_json_serializable(obj):
            try:
                json.dumps(obj)
                return True
            except (TypeError, ValueError):
                return False

        assert check_json_serializable(result)

        # Check that extreme values are handled properly
        if "values" in result:
            time_values = result["values"][0]
            rate_values = result["values"][1]

            # All should be standard Python types
            for val in time_values + rate_values:
                assert isinstance(val, (int, float))
                assert not isinstance(val, np.number)
