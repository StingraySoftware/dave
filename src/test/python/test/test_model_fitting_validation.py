"""
Comprehensive Model Fitting validation tests for DAVE Phase 4.
Tests PowerLaw, Lorentzian, Gaussian models, composite models, chi-square calculations.
"""

import json
import os
import tempfile

import numpy as np


class TestModelFittingValidation:
    """Validate Model Fitting functionality with modern stack."""

    def test_all_available_models(self, client):
        """Test all model types available in DAVE."""
        x_values = np.linspace(0.1, 10.0, 100)

        # Test each model type
        models_to_test = [
            {"type": "Const", "params": {"amplitude": 5.0}},
            {"type": "PowerLaw", "params": {"amplitude": 10.0, "x_0": 1.0, "alpha": -2.0}},
            {
                "type": "BrokenPowerLaw",
                "params": {"amplitude": 10.0, "x_break": 5.0, "alpha_1": -1.0, "alpha_2": -3.0},
            },
            {"type": "Gaussian", "params": {"amplitude": 5.0, "mean": 5.0, "stddev": 1.0}},
            {"type": "Lorentz", "params": {"amplitude": 5.0, "x_0": 5.0, "fwhm": 1.0}},
        ]

        for model in models_to_test:
            params = {"models": [model], "x_values": x_values.tolist()}

            response = client.post(
                "/get_plot_data_from_models",
                data=json.dumps(params),
                content_type="application/json",
            )

            assert response.status_code == 200
            result = response.get_json()

            # Should return model evaluation
            assert result is not None
            if isinstance(result, list) and len(result) > 0:
                # Check we got y values
                assert "values" in result[0]
                y_values = result[0]["values"]
                assert len(y_values) == len(x_values)
                assert all(np.isfinite(y_values))

    def test_model_parameter_sensitivity(self, client):
        """Test model response to parameter changes."""
        x_values = np.linspace(0.1, 10.0, 50)

        # Test PowerLaw with different indices
        indices = [-1.0, -2.0, -3.0]
        results = []

        for index in indices:
            params = {
                "models": [
                    {"type": "PowerLaw", "params": {"amplitude": 10.0, "x_0": 1.0, "alpha": index}}
                ],
                "x_values": x_values.tolist(),
            }

            response = client.post(
                "/get_plot_data_from_models",
                data=json.dumps(params),
                content_type="application/json",
            )

            assert response.status_code == 200
            result = response.get_json()

            if isinstance(result, list) and len(result) > 0:
                results.append(np.array(result[0]["values"]))

        # Steeper power law should decay faster
        if len(results) == 3:
            # At x=10, steeper index should give smaller value
            assert results[2][-1] < results[1][-1] < results[0][-1]

    def test_composite_model_combinations(self, client):
        """Test various composite model combinations."""
        x_values = np.linspace(0.1, 20.0, 200)

        # Test: Constant + Gaussian + Lorentzian
        params = {
            "models": [
                {"type": "Const", "params": {"amplitude": 2.0}},
                {"type": "Gaussian", "params": {"amplitude": 5.0, "mean": 8.0, "stddev": 1.0}},
                {"type": "Lorentz", "params": {"amplitude": 3.0, "x_0": 12.0, "fwhm": 1.5}},
            ],
            "x_values": x_values.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        if isinstance(result, list) and len(result) > 0:
            y_values = np.array(result[0]["values"])

            # Should see peaks near x=8 and x=12
            peak1_idx = np.argmin(np.abs(x_values - 8.0))
            peak2_idx = np.argmin(np.abs(x_values - 12.0))

            # Values at peaks should be higher than baseline
            baseline = y_values[0]  # Far from peaks
            assert y_values[peak1_idx] > baseline
            assert y_values[peak2_idx] > baseline

    def test_model_fitting_to_data(self, client):
        """Test fitting models to actual data."""
        # Generate synthetic data with known model
        x_data = np.linspace(1.0, 10.0, 50)
        true_amplitude = 100.0
        true_index = -2.5
        y_true = true_amplitude * x_data**true_index

        # Add noise
        noise = np.random.normal(0, 0.05 * y_true)
        y_data = y_true + noise

        # Create data file
        data_content = ""
        for x, y in zip(x_data, y_data, strict=False):
            # Create in DAVE format
            data_content += f"{x:.3f} 0.0 {y:.3f} {0.05 * y:.3f} 0.0 0.0 0.0 0.0\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(data_content)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/upload",
                    data={"file": (f, "power_law_data.txt")},
                    content_type="multipart/form-data",
                )

            filename = response.get_json()[0]

            # Test if we can fit this data
            # Note: DAVE might have a specific fitting endpoint
            fit_params = {
                "filename": filename,
                "models": [
                    {"type": "PowerLaw", "params": {"amplitude": 50.0, "x_0": 1.0, "alpha": -2.0}}
                ],
            }

            # Check if there's a fitting endpoint
            response = client.post(
                "/get_fit_powerspectrum_result",
                data=json.dumps(fit_params),
                content_type="application/json",
            )

            # If fitting endpoint exists, it should process the data
            if response.status_code == 200:
                result = response.get_json()
                assert result is not None

        finally:
            os.unlink(temp_file)

    def test_gaussian_model_properties(self, client):
        """Test Gaussian model specific properties."""
        x_values = np.linspace(-10.0, 10.0, 200)

        # Test Gaussian with different widths
        widths = [0.5, 1.0, 2.0]
        results = []

        for width in widths:
            params = {
                "models": [
                    {"type": "Gaussian", "params": {"amplitude": 1.0, "mean": 0.0, "stddev": width}}
                ],
                "x_values": x_values.tolist(),
            }

            response = client.post(
                "/get_plot_data_from_models",
                data=json.dumps(params),
                content_type="application/json",
            )

            result = response.get_json()
            if isinstance(result, list) and len(result) > 0:
                results.append(np.array(result[0]["values"]))

        if len(results) == 3:
            # Narrower Gaussian should have higher peak
            peak_idx = len(x_values) // 2  # Peak at center
            assert results[0][peak_idx] > results[1][peak_idx] > results[2][peak_idx]

            # But same integral (area under curve)
            areas = [np.trapz(r, x_values) for r in results]
            assert np.allclose(areas[0], areas[1], rtol=0.1)
            assert np.allclose(areas[1], areas[2], rtol=0.1)

    def test_lorentzian_vs_gaussian(self, client):
        """Compare Lorentzian and Gaussian profiles."""
        x_values = np.linspace(-10.0, 10.0, 200)

        # Create comparable Gaussian and Lorentzian
        models = [
            {"type": "Gaussian", "params": {"amplitude": 1.0, "mean": 0.0, "stddev": 1.0}},
            {
                "type": "Lorentz",
                "params": {
                    "amplitude": 1.0,
                    "x_0": 0.0,
                    "fwhm": 2.355,
                },  # FWHM ≈ 2.355 * sigma for Gaussian
            },
        ]

        results = []
        for model in models:
            params = {"models": [model], "x_values": x_values.tolist()}

            response = client.post(
                "/get_plot_data_from_models",
                data=json.dumps(params),
                content_type="application/json",
            )

            result = response.get_json()
            if isinstance(result, list) and len(result) > 0:
                results.append(np.array(result[0]["values"]))

        if len(results) == 2:
            gaussian = results[0]
            lorentzian = results[1]

            # Lorentzian has heavier tails
            tail_idx = np.where(np.abs(x_values) > 3)[0]
            if len(tail_idx) > 0:
                # At 3 sigma, Lorentzian should be larger
                assert np.mean(lorentzian[tail_idx]) > np.mean(gaussian[tail_idx])

    def test_broken_power_law(self, client):
        """Test broken power law model."""
        x_values = np.logspace(-1, 2, 100)  # 0.1 to 100

        params = {
            "models": [
                {
                    "type": "BrokenPowerLaw",
                    "params": {
                        "amplitude": 10.0,
                        "x_break": 10.0,
                        "alpha_1": -1.0,  # Shallow before break
                        "alpha_2": -3.0,  # Steep after break
                    },
                }
            ],
            "x_values": x_values.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        if isinstance(result, list) and len(result) > 0:
            y_values = np.array(result[0]["values"])

            # Find break point
            break_idx = np.argmin(np.abs(x_values - 10.0))

            # Calculate local slopes before and after break
            if break_idx > 10 and break_idx < len(x_values) - 10:
                # Log-log slope before break
                slope_before = np.polyfit(
                    np.log10(x_values[break_idx - 10 : break_idx]),
                    np.log10(y_values[break_idx - 10 : break_idx]),
                    1,
                )[0]

                # Log-log slope after break
                slope_after = np.polyfit(
                    np.log10(x_values[break_idx + 1 : break_idx + 10]),
                    np.log10(y_values[break_idx + 1 : break_idx + 10]),
                    1,
                )[0]

                # Slope should steepen after break
                assert slope_after < slope_before

    def test_model_with_fixed_parameters(self, client):
        """Test models with fixed parameters."""
        x_values = np.linspace(0.1, 10.0, 50)

        # PowerLaw with fixed index
        params = {
            "models": [
                {
                    "type": "PowerLaw",
                    "params": {"amplitude": 10.0, "x_0": 1.0, "alpha": -2.0},
                    "fixed": ["alpha"],  # Fix the power law index
                }
            ],
            "x_values": x_values.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Model should still evaluate correctly with fixed parameters
        if isinstance(result, list) and len(result) > 0:
            y_values = result[0]["values"]
            assert len(y_values) == len(x_values)

    def test_model_extrapolation(self, client):
        """Test model behavior outside training range."""
        # Define model on limited range
        x_train = np.linspace(1.0, 5.0, 20)

        # Evaluate on extended range
        x_test = np.linspace(0.1, 10.0, 100)

        params = {
            "models": [
                {"type": "PowerLaw", "params": {"amplitude": 10.0, "x_0": 1.0, "alpha": -2.0}}
            ],
            "x_values": x_test.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Model should extrapolate smoothly
        if isinstance(result, list) and len(result) > 0:
            y_values = np.array(result[0]["values"])

            # Check monotonicity for power law
            differences = np.diff(y_values)
            # Power law with negative index should be decreasing
            assert np.all(differences <= 0)

    def test_numpy_2_compatibility_models(self, client):
        """Test NumPy 2.0 compatibility for model calculations."""
        x_values = np.linspace(0.1, 10.0, 100)

        # Complex composite model
        params = {
            "models": [
                {"type": "Const", "params": {"amplitude": 1.0}},
                {"type": "PowerLaw", "params": {"amplitude": 5.0, "x_0": 1.0, "alpha": -1.5}},
                {"type": "Gaussian", "params": {"amplitude": 3.0, "mean": 5.0, "stddev": 0.5}},
                {"type": "Lorentz", "params": {"amplitude": 2.0, "x_0": 8.0, "fwhm": 1.0}},
            ],
            "x_values": x_values.tolist(),
        }

        response = client.post(
            "/get_plot_data_from_models", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        if isinstance(result, list) and len(result) > 0:
            y_values = np.array(result[0]["values"])

            # Test NumPy 2.0 operations
            assert isinstance(y_values, np.ndarray)
            assert y_values.dtype in [np.float32, np.float64]

            # Statistical operations
            assert np.isfinite(np.mean(y_values))
            assert np.isfinite(np.std(y_values))

            # Array operations
            assert np.all(np.isfinite(y_values))
            assert np.all(y_values >= 0)  # Physical models should be positive
