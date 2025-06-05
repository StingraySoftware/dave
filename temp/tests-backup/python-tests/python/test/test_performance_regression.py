"""
Performance regression testing suite for DAVE
Tracks performance metrics over time to detect regressions
"""

import json
import os
import time
from pathlib import Path
from typing import Dict, List, Any
import numpy as np
import pytest
from memory_profiler import memory_usage

from model.dataset import DataSet
from model.column import Column
from model.table import Table
from utils.dave_engine import (
    get_lightcurve,
    get_power_density_spectrum,
    get_cross_spectrum,
    get_bootstrap_results,
)
from utils.dave_engine import get_filtered_dataset


class PerformanceBenchmark:
    """Base class for performance benchmarks"""

    def __init__(self, name: str):
        self.name = name
        self.results = []
        self.baseline_file = Path("benchmarks") / f"{name}_baseline.json"

    def measure_time(self, func, *args, **kwargs):
        """Measure execution time of a function"""
        start = time.perf_counter()
        result = func(*args, **kwargs)
        end = time.perf_counter()
        return end - start, result

    def measure_memory(self, func, *args, **kwargs):
        """Measure peak memory usage of a function"""

        def wrapper():
            return func(*args, **kwargs)

        mem_usage = memory_usage(wrapper, interval=0.1, timeout=60)
        return max(mem_usage) - min(mem_usage)

    def save_baseline(self, metrics: Dict[str, float]):
        """Save baseline metrics to file"""
        self.baseline_file.parent.mkdir(exist_ok=True)
        with open(self.baseline_file, "w") as f:
            json.dump(metrics, f, indent=2)

    def load_baseline(self) -> Dict[str, float]:
        """Load baseline metrics from file"""
        if self.baseline_file.exists():
            with open(self.baseline_file, "r") as f:
                return json.load(f)
        return {}

    def check_regression(self, current: float, baseline: float, threshold: float = 0.2):
        """Check if current performance regressed vs baseline"""
        if baseline == 0:
            return False
        regression = (current - baseline) / baseline
        return regression > threshold


class TestDatasetPerformance(PerformanceBenchmark):
    """Performance tests for dataset operations"""

    def __init__(self):
        super().__init__("dataset_operations")

    def create_large_dataset(self, size: int) -> DataSet:
        """Create a large dataset for testing"""
        dataset = DataSet()
        dataset.tables["EVENTS"] = Table("EVENTS")

        # Create columns
        time = np.linspace(0, 1000, size)
        rate = np.random.poisson(100, size).astype(float)
        energy = np.random.uniform(0.5, 10.0, size)

        dataset.tables["EVENTS"].columns["TIME"] = Column("TIME", time)
        dataset.tables["EVENTS"].columns["RATE"] = Column("RATE", rate)
        dataset.tables["EVENTS"].columns["ENERGY"] = Column("ENERGY", energy)

        return dataset

    @pytest.mark.benchmark
    def test_dataset_creation_performance(self):
        """Benchmark dataset creation"""
        sizes = [10000, 100000, 1000000]
        metrics = {}

        for size in sizes:
            # Time measurement
            time_taken, _ = self.measure_time(self.create_large_dataset, size)

            # Memory measurement
            mem_used = self.measure_memory(self.create_large_dataset, size)

            metrics[f"creation_time_{size}"] = time_taken
            metrics[f"creation_memory_{size}"] = mem_used

            # Check performance per element
            time_per_element = time_taken / size
            memory_per_element = mem_used / size * 1024 * 1024  # Convert to bytes

            # Assert reasonable performance
            assert time_per_element < 1e-5  # Less than 10 microseconds per element
            assert memory_per_element < 100  # Less than 100 bytes per element

        # Check for regression
        baseline = self.load_baseline()
        if baseline:
            for key, value in metrics.items():
                if key in baseline:
                    assert not self.check_regression(
                        value, baseline[key], threshold=0.2
                    ), f"Performance regression detected for {key}"

        # Save new baseline if running with --benchmark-save
        if os.environ.get("BENCHMARK_SAVE"):
            self.save_baseline(metrics)

    @pytest.mark.benchmark
    def test_filter_performance(self):
        """Benchmark filter operations"""
        dataset = self.create_large_dataset(1000000)

        filter_configs = [
            {"filters": [{"column": "TIME", "min": 100, "max": 900}]},
            {
                "filters": [
                    {"column": "TIME", "min": 100, "max": 900},
                    {"column": "ENERGY", "min": 2.0, "max": 8.0},
                ]
            },
            {
                "filters": [
                    {"column": "TIME", "min": 100, "max": 900},
                    {"column": "ENERGY", "min": 2.0, "max": 8.0},
                    {"column": "RATE", "min": 50, "max": 150},
                ]
            },
        ]

        metrics = {}

        for i, config in enumerate(filter_configs):
            # Time measurement
            time_taken, filtered = self.measure_time(dataset.apply_filters, config["filters"])

            metrics[f"filter_{i+1}_cols_time"] = time_taken

            # Performance assertions
            assert time_taken < 0.5  # Should complete in under 500ms

        # Check for regression
        baseline = self.load_baseline()
        if baseline:
            for key, value in metrics.items():
                if key in baseline:
                    assert not self.check_regression(
                        value, baseline[key], threshold=0.3
                    ), f"Performance regression detected for {key}"


class TestAnalysisPerformance(PerformanceBenchmark):
    """Performance tests for analysis operations"""

    def __init__(self):
        super().__init__("analysis_operations")

    def create_mock_lightcurve_data(self, size: int) -> tuple:
        """Create mock data for lightcurve analysis"""
        lc = type(
            "obj",
            (object,),
            {
                "time": np.linspace(0, 1000, size),
                "counts": np.random.poisson(100, size),
                "gti": np.array([[0, 1000]]),
                "mjdref": 0,
                "dt": 1.0,
                "err_dist": "poisson",
            },
        )()

        dataset = DataSet()
        dataset.tables["EVENTS"] = Table("EVENTS")
        dataset.tables["EVENTS"].columns["TIME"] = Column("TIME", lc.time)
        dataset.tables["EVENTS"].columns["COUNTS"] = Column("COUNTS", lc.counts)

        return lc, dataset

    @pytest.mark.benchmark
    def test_lightcurve_performance(self):
        """Benchmark lightcurve generation"""
        sizes = [10000, 100000]
        metrics = {}

        for size in sizes:
            lc, dataset = self.create_mock_lightcurve_data(size)

            # Mock the actual lightcurve generation
            def mock_lc_generation():
                # Simulate binning operation
                bins = np.arange(0, 1000, 1.0)
                counts, _ = np.histogram(lc.time, bins=bins)
                return {"counts": counts, "time": bins[:-1]}

            # Time measurement
            time_taken, _ = self.measure_time(mock_lc_generation)

            metrics[f"lightcurve_{size}_time"] = time_taken

            # Performance assertions
            assert time_taken < size / 50000  # Roughly linear scaling

        # Save metrics
        if os.environ.get("BENCHMARK_SAVE"):
            self.save_baseline(metrics)

    @pytest.mark.benchmark
    def test_pds_performance(self):
        """Benchmark power density spectrum calculation"""
        from scipy import signal

        sizes = [8192, 16384, 32768]
        metrics = {}

        for size in sizes:
            # Create time series
            time = np.arange(size) * 0.01
            signal_data = np.sin(2 * np.pi * 10 * time) + np.random.normal(0, 0.1, size)

            def compute_pds():
                # Simulate PDS computation
                freqs, powers = signal.periodogram(signal_data, fs=100)
                return freqs, powers

            # Time measurement
            time_taken, _ = self.measure_time(compute_pds)

            metrics[f"pds_{size}_time"] = time_taken

            # Performance assertions
            expected_time = size * np.log2(size) / 1e7  # O(n log n) for FFT
            assert time_taken < expected_time * 2

        # Save metrics
        if os.environ.get("BENCHMARK_SAVE"):
            self.save_baseline(metrics)


class TestMemoryEfficiency(PerformanceBenchmark):
    """Test memory efficiency of operations"""

    def __init__(self):
        super().__init__("memory_efficiency")

    @pytest.mark.benchmark
    def test_memory_scaling(self):
        """Test memory usage scales linearly with data size"""
        sizes = [10000, 50000, 100000]
        memory_per_element = []

        for size in sizes:

            def create_data():
                dataset = DataSet()
                dataset.tables["DATA"] = Table("DATA")

                # Create multiple columns
                for i in range(5):
                    data = np.random.random(size)
                    dataset.tables["DATA"].columns[f"col_{i}"] = Column(f"col_{i}", data)

                return dataset

            # Measure memory
            mem_used = self.measure_memory(create_data)
            mem_per_elem = mem_used * 1024 * 1024 / size  # Convert to bytes per element
            memory_per_element.append(mem_per_elem)

            # Should be reasonably efficient
            assert mem_per_elem < 200  # Less than 200 bytes per element with 5 columns

        # Check linear scaling
        # Memory per element should be roughly constant
        std_dev = np.std(memory_per_element)
        mean_mem = np.mean(memory_per_element)
        assert std_dev / mean_mem < 0.2  # Less than 20% variation


class TestConcurrentPerformance(PerformanceBenchmark):
    """Test performance under concurrent load"""

    def __init__(self):
        super().__init__("concurrent_operations")

    @pytest.mark.benchmark
    def test_cache_performance(self):
        """Test dataset cache performance"""
        import utils.dataset_cache as DsCache

        # Create test datasets
        datasets = []
        for i in range(10):
            ds = DataSet()
            ds.tables["TEST"] = Table("TEST")
            ds.tables["TEST"].columns["DATA"] = Column("DATA", np.random.random(10000))
            datasets.append((f"key_{i}", ds))

        # Measure cache insertion time
        start = time.perf_counter()
        for key, ds in datasets:
            DsCache.add(key, ds)
        insert_time = time.perf_counter() - start

        # Measure cache retrieval time
        start = time.perf_counter()
        for key, _ in datasets:
            retrieved = DsCache.get(key)
            assert retrieved is not None
        retrieve_time = time.perf_counter() - start

        # Performance assertions
        assert insert_time < 0.1  # Should be fast
        assert retrieve_time < 0.01  # Retrieval should be very fast

        # Clear cache
        DsCache.clear()


@pytest.mark.benchmark
class TestRegressionSuite:
    """Main regression test suite"""

    def test_full_analysis_pipeline(self):
        """Test complete analysis pipeline performance"""
        # Create realistic dataset
        size = 100000
        time = np.sort(np.random.uniform(0, 1000, size))

        dataset = DataSet()
        dataset.tables["EVENTS"] = Table("EVENTS")
        dataset.tables["EVENTS"].columns["TIME"] = Column("TIME", time)
        dataset.tables["EVENTS"].columns["PI"] = Column("PI", np.random.randint(20, 200, size))

        pipeline_times = {}

        # 1. Filter data
        start = time.perf_counter()
        filters = [{"column": "TIME", "min": 100, "max": 900}]
        filtered = dataset.apply_filters(filters)
        pipeline_times["filter"] = time.perf_counter() - start

        # 2. Create lightcurve (mock)
        start = time.perf_counter()
        # Simulate lightcurve binning
        bins = np.arange(100, 900, 1.0)
        counts, _ = np.histogram(filtered.tables["EVENTS"].columns["TIME"].values, bins=bins)
        pipeline_times["lightcurve"] = time.perf_counter() - start

        # 3. Compute PDS (mock)
        start = time.perf_counter()
        from scipy import signal

        freqs, powers = signal.periodogram(counts, fs=1.0)
        pipeline_times["pds"] = time.perf_counter() - start

        # Total pipeline time
        total_time = sum(pipeline_times.values())

        # Performance assertions
        assert total_time < 2.0  # Should complete in under 2 seconds
        assert pipeline_times["filter"] < 0.5
        assert pipeline_times["lightcurve"] < 0.5
        assert pipeline_times["pds"] < 1.0

        # Report
        print("\nPipeline Performance:")
        for step, time_taken in pipeline_times.items():
            print(f"  {step}: {time_taken:.3f}s")
        print(f"  Total: {total_time:.3f}s")


def run_benchmarks(save_baseline=False):
    """Run all benchmarks and optionally save baselines"""
    if save_baseline:
        os.environ["BENCHMARK_SAVE"] = "1"

    pytest.main([__file__, "-v", "-m", "benchmark"])


if __name__ == "__main__":
    run_benchmarks()
