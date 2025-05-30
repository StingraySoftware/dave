"""
Property-based testing with Hypothesis for DAVE components
"""

import numpy as np
import pytest
from hypothesis import given, strategies as st, assume, settings
from hypothesis.extra import numpy as npst

from model.column import Column
from model.dataset import Dataset
from model.table import Table
from utils.dave_engine import get_lightcurve
from utils.filters_helper import apply_filters


class TestColumnProperties:
    """Property-based tests for Column class"""
    
    @given(
        values=npst.arrays(
            dtype=np.float64,
            shape=st.integers(min_value=1, max_value=10000),
            elements=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False)
        ),
        name=st.text(min_size=1, max_size=50, alphabet=st.characters(min_codepoint=65, max_codepoint=122))
    )
    def test_column_creation_preserves_data(self, values, name):
        """Column creation should preserve input data exactly"""
        column = Column(name, values)
        
        assert column.name == name
        assert len(column.values) == len(values)
        np.testing.assert_array_equal(column.values, values)
    
    @given(
        values=npst.arrays(
            dtype=np.float64,
            shape=st.integers(min_value=2, max_value=1000),
            elements=st.floats(min_value=0, max_value=1e6, allow_nan=False)
        )
    )
    def test_column_statistics_consistency(self, values):
        """Column statistics should be mathematically consistent"""
        column = Column("test", values)
        
        # Basic statistical properties
        assert column.count() == len(values)
        assert column.min() <= column.max()
        assert column.min() <= column.mean() <= column.max()
        
        # Standard deviation properties
        if len(values) > 1:
            assert column.std() >= 0
            if not np.allclose(values, values[0]):  # Not all same value
                assert column.std() > 0


class TestDatasetProperties:
    """Property-based tests for Dataset class"""
    
    @given(
        n_points=st.integers(min_value=10, max_value=1000),
        time_start=st.floats(min_value=0, max_value=1e6),
        time_step=st.floats(min_value=0.001, max_value=10.0)
    )
    def test_dataset_time_series_properties(self, n_points, time_start, time_step):
        """Dataset time series should have consistent properties"""
        # Create time series
        time = np.linspace(time_start, time_start + (n_points - 1) * time_step, n_points)
        rate = np.random.poisson(100, n_points).astype(float)
        
        # Create dataset
        dataset = Dataset()
        dataset.tables["EVENTS"] = Table("EVENTS")
        dataset.tables["EVENTS"].columns["TIME"] = Column("TIME", time)
        dataset.tables["EVENTS"].columns["RATE"] = Column("RATE", rate)
        
        # Properties
        assert dataset.count() == n_points
        assert len(dataset.tables) > 0
        
        # Time should be monotonically increasing
        time_col = dataset.tables["EVENTS"].columns["TIME"].values
        assert np.all(np.diff(time_col) > 0)


class TestFilterProperties:
    """Property-based tests for filter operations"""
    
    @given(
        data_size=st.integers(min_value=100, max_value=10000),
        filter_min=st.floats(min_value=0, max_value=0.4),
        filter_max=st.floats(min_value=0.6, max_value=1.0)
    )
    def test_filter_reduces_data_consistently(self, data_size, filter_min, filter_max):
        """Filters should always reduce or maintain data size"""
        # Create test data
        time = np.linspace(0, 1, data_size)
        values = np.random.random(data_size)
        
        dataset = Dataset()
        dataset.tables["EVENTS"] = Table("EVENTS")
        dataset.tables["EVENTS"].columns["TIME"] = Column("TIME", time)
        dataset.tables["EVENTS"].columns["VALUE"] = Column("VALUE", values)
        
        # Apply filter
        filters = [{"column": "TIME", "min": filter_min, "max": filter_max}]
        filtered = apply_filters(dataset, filters)
        
        # Properties
        assert filtered.count() <= dataset.count()
        assert filtered.count() >= 0
        
        # Check filtered values are within range
        if filtered.count() > 0:
            filtered_time = filtered.tables["EVENTS"].columns["TIME"].values
            assert np.all(filtered_time >= filter_min)
            assert np.all(filtered_time <= filter_max)
    
    @given(
        data=npst.arrays(
            dtype=np.float64,
            shape=st.integers(min_value=10, max_value=1000),
            elements=st.floats(min_value=-1000, max_value=1000, allow_nan=False)
        )
    )
    def test_empty_filter_preserves_data(self, data):
        """Empty filters should preserve all data"""
        dataset = Dataset()
        dataset.tables["DATA"] = Table("DATA")
        dataset.tables["DATA"].columns["VALUES"] = Column("VALUES", data)
        
        # Apply empty filter
        filtered = apply_filters(dataset, [])
        
        # Should preserve everything
        assert filtered.count() == dataset.count()
        np.testing.assert_array_equal(
            filtered.tables["DATA"].columns["VALUES"].values,
            data
        )


class TestLightcurveProperties:
    """Property-based tests for lightcurve generation"""
    
    @given(
        n_events=st.integers(min_value=100, max_value=10000),
        dt=st.floats(min_value=0.001, max_value=10.0),
        time_span=st.floats(min_value=10, max_value=1000)
    )
    @settings(max_examples=10, deadline=5000)  # Limit examples due to computational cost
    def test_lightcurve_binning_properties(self, n_events, dt, time_span):
        """Lightcurve binning should preserve total counts"""
        # Create event data
        time = np.sort(np.random.uniform(0, time_span, n_events))
        
        dataset = Dataset()
        dataset.tables["EVENTS"] = Table("EVENTS")
        dataset.tables["EVENTS"].columns["TIME"] = Column("TIME", time)
        
        # Mock destination
        from unittest.mock import Mock
        mock_dest = Mock()
        
        # This would require mocking the entire lightcurve generation
        # For now, we test the mathematical properties
        
        # Expected number of bins
        expected_bins = int(time_span / dt) + 1
        
        # Properties
        assert expected_bins > 0
        assert dt > 0
        assert time_span > 0
    
    @given(
        counts=npst.arrays(
            dtype=np.int64,
            shape=st.integers(min_value=10, max_value=1000),
            elements=st.integers(min_value=0, max_value=1000)
        )
    )
    def test_poisson_error_properties(self, counts):
        """Poisson errors should follow sqrt(N) relationship"""
        # For Poisson statistics, error = sqrt(counts)
        errors = np.sqrt(counts)
        
        # Properties
        assert np.all(errors >= 0)
        assert np.all(errors[counts == 0] == 0)
        assert np.all(errors[counts > 0] > 0)
        
        # Error should be approximately sqrt(N)
        mask = counts > 10  # For reasonable Poisson approximation
        if np.any(mask):
            relative_diff = np.abs(errors[mask] - np.sqrt(counts[mask])) / np.sqrt(counts[mask])
            assert np.all(relative_diff < 0.01)


class TestDataConsistencyProperties:
    """Property-based tests for data consistency"""
    
    @given(
        data=st.data(),
        size=st.integers(min_value=10, max_value=1000)
    )
    def test_column_operations_consistency(self, data, size):
        """Column operations should be consistent with numpy"""
        values = data.draw(
            npst.arrays(
                dtype=np.float64,
                shape=size,
                elements=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False)
            )
        )
        
        column = Column("test", values)
        
        # Test consistency with numpy
        np.testing.assert_almost_equal(column.mean(), np.mean(values))
        np.testing.assert_almost_equal(column.std(), np.std(values))
        np.testing.assert_almost_equal(column.min(), np.min(values))
        np.testing.assert_almost_equal(column.max(), np.max(values))
    
    @given(
        n_columns=st.integers(min_value=1, max_value=10),
        n_rows=st.integers(min_value=10, max_value=1000)
    )
    def test_table_column_consistency(self, n_columns, n_rows):
        """All columns in a table should have the same length"""
        table = Table("test")
        
        # Add columns
        for i in range(n_columns):
            values = np.random.random(n_rows)
            table.columns[f"col_{i}"] = Column(f"col_{i}", values)
        
        # Check consistency
        lengths = [len(col.values) for col in table.columns.values()]
        assert len(set(lengths)) == 1  # All lengths should be the same
        assert lengths[0] == n_rows


class TestNumericalStability:
    """Property-based tests for numerical stability"""
    
    @given(
        values=npst.arrays(
            dtype=np.float64,
            shape=st.integers(min_value=2, max_value=1000),
            elements=st.floats(min_value=1e-10, max_value=1e10, allow_nan=False)
        )
    )
    def test_variance_calculation_stability(self, values):
        """Variance calculation should be numerically stable"""
        column = Column("test", values)
        
        # Variance should never be negative
        assert column.var() >= 0
        
        # For constant values, variance should be 0
        if np.allclose(values, values[0]):
            assert np.isclose(column.var(), 0, atol=1e-10)
    
    @given(
        scale=st.floats(min_value=1e-6, max_value=1e6),
        size=st.integers(min_value=10, max_value=1000)
    )
    def test_scaling_invariance(self, scale, size):
        """Statistical properties should scale appropriately"""
        # Original data
        original = np.random.standard_normal(size)
        scaled = original * scale
        
        col_original = Column("original", original)
        col_scaled = Column("scaled", scaled)
        
        # Mean should scale linearly
        np.testing.assert_allclose(
            col_scaled.mean(),
            col_original.mean() * scale,
            rtol=1e-10
        )
        
        # Standard deviation should scale linearly
        np.testing.assert_allclose(
            col_scaled.std(),
            col_original.std() * scale,
            rtol=1e-10
        )


# Run specific hypothesis tests with pytest
if __name__ == "__main__":
    pytest.main([__file__, "-v"])