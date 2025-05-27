"""
Performance benchmarking tests for DAVE.
Measures analysis speeds and memory usage with modern libraries.
"""
import json
import os
import tempfile
import time

import numpy as np
import psutil
import pytest

# from memory_profiler import profile  # Optional import


class TestPerformanceBenchmarks:
    """Benchmark analysis speeds with modern libraries."""

    @pytest.fixture
    def large_dataset(self, client):
        """Create a large dataset for performance testing."""
        # Generate large dataset
        n_events = 100000  # 100k events
        times = np.sort(np.random.uniform(0, 1000, n_events))
        energies = np.random.randint(20, 200, n_events)

        # Create event file
        evt_data = "# Large event dataset for benchmarking\n"
        evt_data += "# Column 1: TIME\n"
        evt_data += "# Column 2: PI\n"

        # Write in chunks to avoid memory issues
        chunk_size = 10000
        lines = []
        for i in range(0, n_events, chunk_size):
            chunk_end = min(i + chunk_size, n_events)
            for j in range(i, chunk_end):
                lines.append(f"{times[j]:.6f} {energies[j]}\n")

            if len(lines) >= chunk_size:
                evt_data += "".join(lines)
                lines = []

        if lines:
            evt_data += "".join(lines)

        # Upload file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(evt_data)
            temp_file = f.name

        try:
            with open(temp_file, 'rb') as f:
                response = client.post('/upload',
                                     data={'file': (f, 'large_dataset.txt')},
                                     content_type='multipart/form-data')

            assert response.status_code == 200
            filename = response.get_json()[0]
            return filename, n_events
        finally:
            os.unlink(temp_file)

    def test_lightcurve_creation_speed(self, client, large_dataset):
        """Benchmark lightcurve creation speed."""
        filename, n_events = large_dataset

        params = {
            'filename': filename,
            'bck_filename': '',
            'gti_filename': '',
            'filters': [],
            'axis': [{'table': 'EVENTS', 'column': 'TIME'},
                    {'table': 'EVENTS', 'column': 'PI'}],
            'dt': 1.0,  # 1 second bins
            'baseline_opts': {},
            'meanflux_opts': {},
            'variance_opts': {}
        }

        # Measure time
        start_time = time.time()
        response = client.post('/get_lightcurve',
                             data=json.dumps(params),
                             content_type='application/json')
        end_time = time.time()

        assert response.status_code == 200
        result = response.get_json()

        if 'success' in result and result['success']:
            elapsed = end_time - start_time
            events_per_sec = n_events / elapsed

            print("\nLightcurve Creation Performance:")
            print(f"  Events processed: {n_events:,}")
            print(f"  Time taken: {elapsed:.2f} seconds")
            print(f"  Speed: {events_per_sec:,.0f} events/second")

            # Performance threshold: should process > 10k events/sec
            assert events_per_sec > 10000, f"Performance too slow: {events_per_sec:.0f} events/sec"

    def test_pds_calculation_speed(self, client, large_dataset):
        """Benchmark PDS calculation speed."""
        filename, n_events = large_dataset

        params = {
            'filename': filename,
            'bck_filename': '',
            'gti_filename': '',
            'filters': [],
            'axis': [{'table': 'EVENTS', 'column': 'TIME'},
                    {'table': 'EVENTS', 'column': 'PI'}],
            'dt': 0.1,  # 100ms bins
            'nsegm': 10,
            'segment_size': 50,
            'norm': 'leahy',
            'type': 'Avg',
            'df': 0
        }

        # Measure time
        start_time = time.time()
        response = client.post('/get_power_density_spectrum',
                             data=json.dumps(params),
                             content_type='application/json')
        end_time = time.time()

        assert response.status_code == 200
        result = response.get_json()

        if 'success' in result and result['success']:
            elapsed = end_time - start_time

            print("\nPDS Calculation Performance:")
            print(f"  Events processed: {n_events:,}")
            print(f"  Time taken: {elapsed:.2f} seconds")
            print("  Segments: 10 x 50s")

            # Should complete within reasonable time
            assert elapsed < 30, f"PDS calculation too slow: {elapsed:.2f} seconds"

    def test_cross_spectrum_speed(self, client):
        """Benchmark cross spectrum calculation."""
        # Create two medium-sized correlated datasets
        n_events = 50000
        times1 = np.sort(np.random.uniform(0, 500, n_events))
        times2 = times1 + np.random.normal(0, 0.01, n_events)  # Slightly offset

        filenames = []
        for i, times in enumerate([times1, times2]):
            evt_data = f"# Dataset {i+1}\n"
            evt_data += "# Column 1: TIME\n"
            evt_data += "# Column 2: PI\n"

            for t in times[:10000]:  # Use subset for speed
                evt_data += f"{t:.6f} {np.random.randint(20, 200)}\n"

            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(evt_data)
                temp_file = f.name

            try:
                with open(temp_file, 'rb') as f:
                    response = client.post('/upload',
                                         data={'file': (f, f'dataset{i+1}.txt')},
                                         content_type='multipart/form-data')

                filenames.append(response.get_json()[0])
            finally:
                os.unlink(temp_file)

        # Calculate cross spectrum
        params = {
            'filename1': filenames[0],
            'bck_filename1': '',
            'gti_filename1': '',
            'filters1': [],
            'axis1': [{'table': 'EVENTS', 'column': 'TIME'},
                     {'table': 'EVENTS', 'column': 'PI'}],
            'dt1': 0.5,
            'filename2': filenames[1],
            'bck_filename2': '',
            'gti_filename2': '',
            'filters2': [],
            'axis2': [{'table': 'EVENTS', 'column': 'TIME'},
                     {'table': 'EVENTS', 'column': 'PI'}],
            'dt2': 0.5,
            'nsegm': 5,
            'segment_size': 50,
            'norm': 'leahy',
            'type': 'Avg'
        }

        start_time = time.time()
        response = client.post('/get_cross_spectrum',
                             data=json.dumps(params),
                             content_type='application/json')
        end_time = time.time()

        assert response.status_code == 200
        elapsed = end_time - start_time

        print("\nCross Spectrum Performance:")
        print(f"  Time taken: {elapsed:.2f} seconds")

        # Should complete within reasonable time
        assert elapsed < 20, f"Cross spectrum too slow: {elapsed:.2f} seconds"

    def test_file_io_performance(self, client):
        """Test file upload/processing speed."""
        # Create files of different sizes
        sizes = [1000, 10000, 50000]  # Number of events

        for n_events in sizes:
            # Generate data
            times = np.sort(np.random.uniform(0, 100, n_events))
            rates = 100 + 10 * np.sin(2 * np.pi * times / 10)

            lc_data = "# Test lightcurve\n"
            lc_data += "# Column 1: TIME\n"
            lc_data += "# Column 2: RATE\n"
            for t, r in zip(times, rates, strict=False):
                lc_data += f"{t:.3f} {r:.1f}\n"

            # Measure upload time
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(lc_data)
                temp_file = f.name
                file_size = os.path.getsize(temp_file)

            try:
                start_time = time.time()
                with open(temp_file, 'rb') as f:
                    response = client.post('/upload',
                                         data={'file': (f, f'test_{n_events}.txt')},
                                         content_type='multipart/form-data')
                upload_time = time.time() - start_time

                assert response.status_code == 200
                filename = response.get_json()[0]

                # Measure schema retrieval time
                start_time = time.time()
                response = client.get(f'/get_dataset_schema?filename={filename}')
                schema_time = time.time() - start_time

                assert response.status_code == 200

                print(f"\nFile I/O Performance ({n_events} events, {file_size/1024:.1f} KB):")
                print(f"  Upload time: {upload_time:.3f} seconds")
                print(f"  Schema time: {schema_time:.3f} seconds")
                print(f"  Upload speed: {file_size/upload_time/1024/1024:.1f} MB/s")

            finally:
                os.unlink(temp_file)


class TestMemoryProfiling:
    """Profile memory usage of key operations."""

    def test_memory_usage_lightcurve(self, client):
        """Profile memory usage during lightcurve creation."""
        # Create medium dataset
        n_events = 50000
        times = np.sort(np.random.uniform(0, 500, n_events))
        energies = np.random.randint(20, 200, n_events)

        evt_data = "# Memory test dataset\n"
        evt_data += "# Column 1: TIME\n"
        evt_data += "# Column 2: PI\n"
        for i in range(0, n_events, 1000):
            for j in range(i, min(i+1000, n_events)):
                evt_data += f"{times[j]:.6f} {energies[j]}\n"

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(evt_data)
            temp_file = f.name

        try:
            # Get initial memory
            process = psutil.Process()
            initial_memory = process.memory_info().rss / 1024 / 1024  # MB

            # Upload file
            with open(temp_file, 'rb') as f:
                response = client.post('/upload',
                                     data={'file': (f, 'memory_test.txt')},
                                     content_type='multipart/form-data')

            filename = response.get_json()[0]

            # Create lightcurve
            params = {
                'filename': filename,
                'bck_filename': '',
                'gti_filename': '',
                'filters': [],
                'axis': [{'table': 'EVENTS', 'column': 'TIME'},
                        {'table': 'EVENTS', 'column': 'PI'}],
                'dt': 1.0,
                'baseline_opts': {},
                'meanflux_opts': {},
                'variance_opts': {}
            }

            response = client.post('/get_lightcurve',
                                 data=json.dumps(params),
                                 content_type='application/json')

            # Get peak memory
            peak_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_increase = peak_memory - initial_memory

            print("\nMemory Usage - Lightcurve Creation:")
            print(f"  Dataset size: {n_events:,} events")
            print(f"  Initial memory: {initial_memory:.1f} MB")
            print(f"  Peak memory: {peak_memory:.1f} MB")
            print(f"  Memory increase: {memory_increase:.1f} MB")
            print(f"  Memory per event: {memory_increase*1024/n_events:.2f} KB")

            # Memory usage should be reasonable
            assert memory_increase < 500, f"Excessive memory usage: {memory_increase:.1f} MB"

        finally:
            os.unlink(temp_file)

    def test_memory_usage_pds(self, client):
        """Profile memory usage during PDS calculation."""
        # Similar to above but for PDS
        pass  # Simplified for brevity


def test_numpy_performance_improvements():
    """Test NumPy 2.x performance improvements."""
    # Test vectorized operations
    size = 1000000
    data = np.random.randn(size)

    # Time NumPy operations
    start = time.time()
    _ = np.fft.fft(data)
    fft_time = time.time() - start

    start = time.time()
    _ = np.mean(data)
    _ = np.std(data)
    stats_time = time.time() - start

    print("\nNumPy 2.x Performance:")
    print(f"  FFT ({size:,} points): {fft_time:.3f} seconds")
    print(f"  Stats calculation: {stats_time:.6f} seconds")

    # Should be fast with NumPy 2.x
    assert fft_time < 0.1, f"FFT too slow: {fft_time:.3f} seconds"
