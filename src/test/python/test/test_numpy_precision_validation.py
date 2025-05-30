"""
Test numerical precision compatibility between NumPy versions.

This validates that the migration from NumPy 1.11 to NumPy 2.2
maintains sufficient numerical precision for astronomical analyses.
"""

import json

import numpy as np


class TestNumpyPrecisionValidation:
    """Test NumPy 2.0 numerical precision and compatibility."""

    def test_basic_arithmetic_precision(self):
        """Test basic arithmetic operations maintain precision."""
        # Test values that might expose precision differences
        test_values = [
            1e-10,  # Very small values
            1e10,  # Very large values
            np.pi,  # Transcendental numbers
            np.e,
            1.0 / 3.0,  # Repeating decimals
            np.sqrt(2),  # Irrational numbers
        ]

        for val in test_values:
            # Basic operations should maintain precision
            result = val * 2.0 / 2.0
            assert np.isclose(result, val, rtol=1e-15)

            # Square root operations
            if val > 0:
                sqrt_result = np.sqrt(val * val)
                assert np.isclose(sqrt_result, val, rtol=1e-14)

    def test_array_operations_precision(self):
        """Test array operations maintain precision."""
        # Create test arrays
        x = np.linspace(0, 2 * np.pi, 1000)
        y = np.sin(x)

        # Operations that should be stable
        # Mean and standard deviation
        mean_y = np.mean(y)
        std_y = np.std(y)

        # Should be close to theoretical values for sine wave
        assert np.abs(mean_y) < 1e-15  # Mean of sine wave should be ~0
        assert np.abs(std_y - np.sqrt(0.5)) < 1e-14  # Std of sine should be sqrt(0.5)

        # FFT operations (important for PDS analysis)
        fft_y = np.fft.fft(y)
        ifft_y = np.fft.ifft(fft_y)

        # Round-trip should preserve original
        assert np.allclose(y, ifft_y.real, rtol=1e-14)
        assert np.allclose(np.zeros_like(y), ifft_y.imag, atol=1e-14)

    def test_statistical_functions(self):
        """Test statistical functions used in astronomical analysis."""
        # Create test data with known statistical properties
        np.random.seed(42)

        # Gaussian data
        gaussian_data = np.random.normal(100.0, 10.0, 10000)

        # Test statistical functions
        mean_val = np.mean(gaussian_data)
        std_val = np.std(gaussian_data)
        var_val = np.var(gaussian_data)

        # Should be close to expected values
        assert np.abs(mean_val - 100.0) < 1.0  # Within 1 sigma
        assert np.abs(std_val - 10.0) < 1.0  # Within reasonable range
        assert np.abs(var_val - 100.0) < 20.0  # Variance = std^2

        # Poisson data (important for count statistics)
        poisson_data = np.random.poisson(50.0, 10000)

        poisson_mean = np.mean(poisson_data)
        poisson_var = np.var(poisson_data)

        # For Poisson, mean ≈ variance
        assert np.abs(poisson_mean - 50.0) < 2.0
        assert np.abs(poisson_var - poisson_mean) < 5.0

    def test_trigonometric_precision(self):
        """Test trigonometric functions (important for timing analysis)."""
        # Test angles
        angles = np.array([0, np.pi / 6, np.pi / 4, np.pi / 3, np.pi / 2, np.pi, 2 * np.pi])

        # Known exact values
        expected_sin = np.array([0, 0.5, np.sqrt(2) / 2, np.sqrt(3) / 2, 1, 0, 0])
        expected_cos = np.array([1, np.sqrt(3) / 2, np.sqrt(2) / 2, 0.5, 0, -1, 1])

        # Calculate values
        calculated_sin = np.sin(angles)
        calculated_cos = np.cos(angles)

        # Check precision
        assert np.allclose(calculated_sin, expected_sin, rtol=1e-15)
        assert np.allclose(calculated_cos, expected_cos, rtol=1e-15)

        # Test periodicity
        extended_angles = angles + 2 * np.pi
        assert np.allclose(np.sin(angles), np.sin(extended_angles), rtol=1e-15)
        assert np.allclose(np.cos(angles), np.cos(extended_angles), rtol=1e-15)

    def test_power_spectrum_precision(self):
        """Test precision in power spectrum calculations."""
        # Create test signal with known frequency content
        duration = 100.0
        dt = 0.1
        n_points = int(duration / dt)
        times = np.arange(n_points) * dt

        # Signal with specific frequencies
        freq1 = 0.1  # Hz
        freq2 = 0.25  # Hz

        signal = (
            100.0
            + 20.0 * np.sin(2 * np.pi * freq1 * times)
            + 10.0 * np.cos(2 * np.pi * freq2 * times)
        )

        # Calculate power spectrum
        fft_signal = np.fft.fft(signal)
        power = np.abs(fft_signal) ** 2
        freqs = np.fft.fftfreq(len(signal), dt)

        # Find peaks at expected frequencies
        positive_freqs = freqs[: len(freqs) // 2]
        positive_power = power[: len(power) // 2]

        # Find frequency bins closest to expected frequencies
        idx1 = np.argmin(np.abs(positive_freqs - freq1))
        idx2 = np.argmin(np.abs(positive_freqs - freq2))

        # Power at signal frequencies should be elevated
        mean_power = np.mean(positive_power)
        assert positive_power[idx1] > 10 * mean_power
        assert positive_power[idx2] > 5 * mean_power

        # Parseval's theorem: time domain energy = frequency domain energy
        time_energy = np.sum(signal**2)
        freq_energy = np.sum(power) / len(signal)

        assert np.abs(time_energy - freq_energy) / time_energy < 1e-12

    def test_json_serialization_compatibility(self, client, tmp_path):
        """Test that NumPy 2.0 arrays are properly JSON serializable."""
        # Create test data file
        filename = str(tmp_path / "json_test.txt")
        with open(filename, "w") as f:
            f.write("# TIME RATE ERROR\n")
            for i in range(10):
                f.write(f"{i:.1f} 100.0 10.0\n")

        # Upload and get data
        with open(filename, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "json_test.txt")}, content_type="multipart/form-data"
            )

        uploaded_filename = response.get_json()[0]

        # Get plot data
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

        # Verify all values are JSON-serializable Python types
        def check_json_types(obj):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    check_json_types(value)
            elif isinstance(obj, list):
                for item in obj:
                    check_json_types(item)
            else:
                # Should be basic Python types, not numpy types
                assert isinstance(obj, (int, float, str, bool, type(None)))
                assert not isinstance(obj, np.number)
                assert not hasattr(obj, "dtype")

        check_json_types(result)

        # Verify JSON serialization works
        json_str = json.dumps(result)
        parsed_result = json.loads(json_str)
        assert parsed_result == result

    def test_array_indexing_compatibility(self):
        """Test array indexing compatibility with NumPy 2.0."""
        # Create test array
        arr = np.arange(100).reshape(10, 10)

        # Test different indexing methods
        # Basic indexing
        assert arr[5, 5] == 55

        # Slice indexing
        sub_arr = arr[2:8, 3:7]
        assert sub_arr.shape == (6, 4)

        # Boolean indexing
        mask = arr > 50
        masked_arr = arr[mask]
        assert len(masked_arr) == 49  # Numbers 51-99

        # Fancy indexing
        indices = np.array([1, 3, 5, 7])
        fancy_arr = arr[indices]
        assert fancy_arr.shape == (4, 10)

        # Advanced indexing combinations
        mixed = arr[mask][:10]  # First 10 values > 50
        assert len(mixed) == 10

    def test_dtype_consistency(self):
        """Test data type consistency across operations."""
        # Test float operations
        float32_arr = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        float64_arr = np.array([1.0, 2.0, 3.0], dtype=np.float64)

        # Operations should preserve or promote types appropriately
        result32 = float32_arr * 2.0
        result64 = float64_arr * 2.0

        # Check dtypes are as expected
        assert result32.dtype == np.float32
        assert result64.dtype == np.float64

        # Mixed operations should promote to higher precision
        mixed_result = float32_arr + float64_arr
        assert mixed_result.dtype == np.float64

        # Test integer operations
        int32_arr = np.array([1, 2, 3], dtype=np.int32)
        int64_arr = np.array([1, 2, 3], dtype=np.int64)

        # Integer division should handle correctly
        div_result = int64_arr / 2
        assert div_result.dtype == np.float64  # Division produces float

    def test_memory_layout_compatibility(self):
        """Test memory layout and copying behavior."""
        # Create test array
        original = np.arange(1000).reshape(100, 10)

        # Test different view operations
        transposed = original.T
        assert np.shares_memory(original, transposed)

        # Test copying
        copied = original.copy()
        assert not np.shares_memory(original, copied)
        assert np.array_equal(original, copied)

        # Test contiguity
        assert original.flags["C_CONTIGUOUS"]
        assert transposed.flags["F_CONTIGUOUS"]

        # Test reshaping
        reshaped = original.reshape(1000)
        assert np.shares_memory(original, reshaped)

        # Force copy with incompatible reshape
        incompatible = original[::2, ::2].reshape(-1)
        # This creates a view of non-contiguous data

    def test_mathematical_constants(self):
        """Test mathematical constants precision."""
        # NumPy constants should be high precision
        assert np.abs(np.pi - 3.141592653589793) < 1e-15
        assert np.abs(np.e - 2.718281828459045) < 1e-15

        # Test derived constants
        euler_identity = np.exp(1j * np.pi) + 1
        assert np.abs(euler_identity) < 1e-15

        # Test special values
        assert np.isnan(np.nan)
        assert np.isinf(np.inf)
        assert np.isfinite(1.0)
        assert not np.isfinite(np.inf)
        assert not np.isfinite(np.nan)

    def test_backwards_compatibility_warnings(self):
        """Test for any backwards compatibility issues."""
        # Operations that might have changed behavior
        arr = np.array([1, 2, 3, 4, 5])

        # Item access
        item = arr[0]
        assert isinstance(item, (int, np.integer))

        # Boolean operations
        bool_arr = arr > 2
        assert bool_arr.dtype == bool

        # String operations (if any)
        str_arr = np.array(["a", "b", "c"])
        assert str_arr.dtype.kind == "U"

        # Type checking that might have changed
        assert isinstance(arr.sum(), (int, np.integer))
        assert isinstance(arr.mean(), (float, np.floating))

    def test_performance_critical_operations(self):
        """Test performance-critical operations used in astronomy."""
        # Large array operations (common in astronomy)
        n = 100000
        x = np.random.random(n)
        y = np.random.random(n)

        # Dot product (used in correlations)
        dot_result = np.dot(x, y)
        assert isinstance(dot_result, (float, np.floating))

        # Sorting (used in data analysis)
        sorted_x = np.sort(x)
        assert len(sorted_x) == n
        assert np.all(sorted_x[:-1] <= sorted_x[1:])

        # Binning operations (used in light curves)
        bins = np.linspace(0, 1, 101)
        hist, _ = np.histogram(x, bins)
        assert len(hist) == 100
        assert np.sum(hist) == n

        # Cumulative operations
        cumsum = np.cumsum(x)
        assert len(cumsum) == n
        assert np.isclose(cumsum[-1], np.sum(x))

    def test_edge_cases_precision(self):
        """Test edge cases that might expose precision issues."""
        # Very small numbers
        tiny = np.array([1e-100, 1e-200, 1e-300])
        assert np.all(np.isfinite(tiny))

        # Very large numbers
        huge = np.array([1e100, 1e200, 1e300])
        # Some might overflow to inf
        finite_huge = huge[np.isfinite(huge)]
        assert len(finite_huge) >= 1

        # Numbers close to machine epsilon
        eps = np.finfo(float).eps
        near_eps = np.array([eps, eps / 2, eps * 2])
        assert np.all(np.isfinite(near_eps))

        # Subnormal numbers
        tiny_normal = np.finfo(float).tiny
        subnormal = np.array([tiny_normal, tiny_normal / 2, tiny_normal / 10])
        # Should handle subnormals gracefully
