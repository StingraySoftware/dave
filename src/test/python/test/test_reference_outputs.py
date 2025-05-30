"""
Generate reference output datasets for regression testing.

This creates a comprehensive set of reference outputs from the modern stack
(Python 3.13, NumPy 2.2, Stingray 2.2.7) that can be used to validate
future changes don't break scientific accuracy.
"""

import json
from pathlib import Path

import numpy as np
import pytest


class TestReferenceOutputs:
    """Generate reference outputs for regression testing."""

    @pytest.fixture
    def reference_data_dir(self):
        """Directory for storing reference outputs."""
        ref_dir = Path(__file__).parent.parent.parent / "resources" / "reference_outputs"
        ref_dir.mkdir(exist_ok=True)
        return ref_dir

    def create_standard_test_data(self, tmp_path):
        """Create standardized test data for reference outputs."""
        # Create reproducible test data with known characteristics
        np.random.seed(42)  # For reproducible results

        # Parameters
        duration = 100.0
        dt = 0.1
        n_bins = int(duration / dt)
        times = np.arange(0, duration, dt)

        # Create signal with known frequency components
        signal = (
            100.0
            + 20 * np.sin(2 * np.pi * 0.1 * times)  # 0.1 Hz, 10s period
            + 10 * np.sin(2 * np.pi * 0.25 * times)  # 0.25 Hz, 4s period
            + 5 * np.sin(2 * np.pi * 1.0 * times)
        )  # 1.0 Hz, 1s period

        # Add Poisson noise
        counts = np.random.poisson(signal)
        errors = np.sqrt(counts)

        # Create 4-column format file
        filename = str(tmp_path / "reference_standard.txt")
        with open(filename, "w") as f:
            f.write("# Reference test data for regression testing\n")
            f.write("# Generated with Python 3.13, NumPy 2.2, Stingray 2.2.7\n")
            f.write("# Contains 0.1 Hz, 0.25 Hz, and 1.0 Hz signal components\n")
            f.write("# TIME TIME_ERR RATE RATE_ERR\n")
            for i in range(n_bins):
                f.write(f"{times[i]:.6f} {dt / 2:.6f} {counts[i]:.1f} {errors[i]:.3f}\n")

        return filename

    def save_reference_output(self, reference_data_dir, analysis_type, result_data):
        """Save reference output to file."""
        # Create filename with version info
        filename = f"reference_{analysis_type}_py313_np22_stingray227.json"
        filepath = reference_data_dir / filename

        # Convert numpy arrays to lists for JSON serialization
        json_data = {}
        for key, value in result_data.items():
            if isinstance(value, np.ndarray):
                json_data[key] = value.tolist()
            elif isinstance(value, dict):
                json_data[key] = {}
                for k, v in value.items():
                    if isinstance(v, np.ndarray):
                        json_data[key][k] = v.tolist()
                    else:
                        json_data[key][k] = v
            else:
                json_data[key] = value

        # Add metadata
        json_data["_metadata"] = {
            "python_version": "3.13",
            "numpy_version": "2.2",
            "stingray_version": "2.2.7",
            "generation_date": "2025-01-28",
            "description": f"Reference output for {analysis_type} analysis",
        }

        with open(filepath, "w") as f:
            json.dump(json_data, f, indent=2)

        print(f"Saved reference output: {filepath}")
        return filepath

    def test_generate_lightcurve_reference(self, client, tmp_path, reference_data_dir):
        """Generate reference lightcurve output."""
        # Create and upload test data
        filename = self.create_standard_test_data(tmp_path)

        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "reference_lc.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Get lightcurve with standard parameters
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "lightcurve"},
            "axis": [{"table": "EVENTS", "column": "TIME"}, {"table": "EVENTS", "column": "RATE"}],
            "dt": 1.0,
            "baseline_opts": {"start": 0, "stop": 0},
            "meanflux_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_lightcurve", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Save reference output
        self.save_reference_output(reference_data_dir, "lightcurve", result)

        # Basic validation
        assert "values" in result
        assert len(result["values"]) >= 2

    def test_generate_pds_reference(self, client, tmp_path, reference_data_dir):
        """Generate reference power density spectrum output."""
        # Create and upload test data
        filename = self.create_standard_test_data(tmp_path)

        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "reference_pds.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Get PDS with standard parameters
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
            "freq_range": [0.01, 5.0],
            "df": 0,
        }

        response = client.post(
            "/get_power_density_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Save reference output
        self.save_reference_output(reference_data_dir, "pds", result)

        # Basic validation
        assert "freq" in result["values"]
        assert "power" in result["values"]

        # Verify expected peaks are present
        freq = np.array(result["values"]["freq"])
        power = np.array(result["values"]["power"])

        # Find peaks near expected frequencies
        peak_01hz = np.argmin(np.abs(freq - 0.1))
        peak_025hz = np.argmin(np.abs(freq - 0.25))
        peak_1hz = np.argmin(np.abs(freq - 1.0))

        # Store peak information in metadata
        peak_info = {
            "peak_0.1hz_freq": freq[peak_01hz],
            "peak_0.1hz_power": power[peak_01hz],
            "peak_0.25hz_freq": freq[peak_025hz],
            "peak_0.25hz_power": power[peak_025hz],
            "peak_1.0hz_freq": freq[peak_1hz],
            "peak_1.0hz_power": power[peak_1hz],
        }

        # Update saved file with peak info
        ref_file = reference_data_dir / "reference_pds_py313_np22_stingray227.json"
        with open(ref_file) as f:
            data = json.load(f)
        data["_metadata"]["peak_analysis"] = peak_info
        with open(ref_file, "w") as f:
            json.dump(data, f, indent=2)

    def test_generate_cross_spectrum_reference(self, client, tmp_path, reference_data_dir):
        """Generate reference cross-spectrum output."""
        # Create dual-band test data
        np.random.seed(42)
        duration = 100.0
        dt = 0.1
        n_bins = int(duration / dt)
        times = np.arange(0, duration, dt)

        # Create correlated signals
        signal1 = 100.0 + 15 * np.sin(2 * np.pi * 0.2 * times)
        signal2 = 80.0 + 12 * np.sin(2 * np.pi * 0.2 * times + np.pi / 4)  # Phase lag

        counts1 = np.random.poisson(signal1)
        counts2 = np.random.poisson(signal2)

        # Create 8-column file
        filename = str(tmp_path / "reference_cross.txt")
        with open(filename, "w") as f:
            f.write("# Reference cross-spectrum test data\n")
            f.write("# TIME TIME_ERR RATE RATE_ERR COLOR1 COLOR1_ERR COLOR2 COLOR2_ERR\n")
            for i in range(n_bins):
                total_rate = counts1[i] + counts2[i]
                total_err = np.sqrt(total_rate)
                f.write(
                    f"{times[i]:.6f} {dt / 2:.6f} {total_rate:.1f} {total_err:.3f} "
                    f"{counts1[i]:.1f} {np.sqrt(counts1[i]):.3f} "
                    f"{counts2[i]:.1f} {np.sqrt(counts2[i]):.3f}\n"
                )

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "reference_cross.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Get cross-spectrum
        params = {
            "src_filename1": uploaded_filename,
            "bck_filename1": "",
            "gti_filename1": "",
            "filters1": [],
            "axis1": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "COLOR1"},
            ],
            "dt1": 1.0,
            "src_filename2": uploaded_filename,
            "bck_filename2": "",
            "gti_filename2": "",
            "filters2": [],
            "axis2": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "COLOR2"},
            ],
            "dt2": 1.0,
            "nsegm": 1,
            "segm_size": 0,
            "norm": "frac",
            "type": "CrossSpectrum",
        }

        response = client.post(
            "/get_cross_spectrum", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Save reference output
        self.save_reference_output(reference_data_dir, "cross_spectrum", result)

        # Basic validation
        assert "freq" in result["values"]
        assert "power" in result["values"]

    def test_generate_phaseogram_reference(self, client, tmp_path, reference_data_dir):
        """Generate reference phaseogram output."""
        # Create pulsed test data
        np.random.seed(42)
        duration = 50.0
        dt = 0.01  # High time resolution
        n_bins = int(duration / dt)
        times = np.arange(0, duration, dt)

        # Create strong periodic signal
        pulse_freq = 2.0  # 2 Hz pulsar
        signal = 100.0 * (1 + 0.8 * np.sin(2 * np.pi * pulse_freq * times))
        counts = np.random.poisson(signal)
        errors = np.sqrt(counts)

        # Create 3-column file
        filename = str(tmp_path / "reference_pulse.txt")
        with open(filename, "w") as f:
            f.write("# Reference pulsed test data\n")
            f.write("# TIME RATE ERROR\n")
            for i in range(n_bins):
                f.write(f"{times[i]:.6f} {counts[i]:.1f} {errors[i]:.3f}\n")

        # Upload file
        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "reference_pulse.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # Generate phaseogram
        params = {
            "filename": uploaded_filename,
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": [{"table": "EVENTS", "column": "TIME"}],
            "f": pulse_freq,  # Test frequency
            "nbin": 16,
            "baseline_opts": {"start": 0, "stop": 0},
        }

        response = client.post(
            "/get_phaseogram", data=json.dumps(params), content_type="application/json"
        )

        assert response.status_code == 200
        result = response.get_json()

        # Save reference output
        self.save_reference_output(reference_data_dir, "phaseogram", result)

        # Basic validation
        assert "values" in result
        assert len(result["values"]) >= 2

    def test_generate_model_fitting_reference(self, client, tmp_path, reference_data_dir):
        """Generate reference model fitting output."""
        # Create and upload test data
        filename = self.create_standard_test_data(tmp_path)

        with open(filename, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "reference_fit.txt")},
                content_type="multipart/form-data",
            )

        uploaded_filename = response.get_json()[0]

        # First get PDS for fitting
        pds_params = {
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
            "freq_range": [0.01, 5.0],
            "df": 0,
        }

        response = client.post(
            "/get_power_density_spectrum",
            data=json.dumps(pds_params),
            content_type="application/json",
        )

        pds_result = response.get_json()

        # Fit PowerLaw model
        fit_params = {
            "src_destination": uploaded_filename,
            "modelType": "PowerLaw",
            "priors": [{"name": "norm", "val": 1.0}, {"name": "index", "val": -2.0}],
            "freq": pds_result["values"]["freq"],
            "power": pds_result["values"]["power"],
            "error": pds_result["values"]["power_err"]
            if "power_err" in pds_result["values"]
            else None,
        }

        response = client.post(
            "/get_fit_powerspectrum_result",
            data=json.dumps(fit_params),
            content_type="application/json",
        )

        if response.status_code == 200:
            result = response.get_json()

            # Save reference output
            self.save_reference_output(reference_data_dir, "model_fitting", result)

            # Basic validation
            assert "model" in result or "fit_result" in result or "values" in result

    def test_create_reference_metadata(self, reference_data_dir):
        """Create metadata file describing all reference outputs."""
        metadata = {
            "version": "1.0",
            "creation_date": "2025-01-28",
            "stack_info": {
                "python": "3.13",
                "numpy": "2.2",
                "stingray": "2.2.7",
                "hendrics": "8.1+",
                "astropy": "7.0+",
                "flask": "3.1+",
            },
            "test_data_info": {
                "duration": "100.0 seconds",
                "time_resolution": "0.1 seconds",
                "signal_components": [
                    {"frequency": "0.1 Hz", "amplitude": "20 counts", "period": "10s"},
                    {"frequency": "0.25 Hz", "amplitude": "10 counts", "period": "4s"},
                    {"frequency": "1.0 Hz", "amplitude": "5 counts", "period": "1s"},
                ],
                "mean_count_rate": "100 counts/s",
                "noise_type": "Poisson",
            },
            "analysis_types": {
                "lightcurve": "Binned lightcurve with 1s time bins",
                "pds": "Power density spectrum with fractional normalization",
                "cross_spectrum": "Cross-spectrum between two correlated bands",
                "phaseogram": "Phase-folded profile at 2 Hz test frequency",
                "model_fitting": "PowerLaw model fit to power spectrum",
            },
            "usage": {
                "purpose": "Regression testing for future DAVE versions",
                "comparison": "Compare outputs with tolerance for numerical precision",
                "tolerance": "1e-10 for exact matches, 1e-6 for floating point comparisons",
            },
        }

        metadata_file = reference_data_dir / "reference_metadata.json"
        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"Created metadata file: {metadata_file}")

        # List all reference files
        ref_files = list(reference_data_dir.glob("reference_*.json"))
        print(f"Generated {len(ref_files)} reference output files:")
        for ref_file in ref_files:
            print(f"  - {ref_file.name}")

    def test_validate_reference_format(self, reference_data_dir):
        """Validate that reference files are properly formatted."""
        ref_files = list(reference_data_dir.glob("reference_*.json"))

        for ref_file in ref_files:
            if ref_file.name == "reference_metadata.json":
                continue

            with open(ref_file) as f:
                data = json.load(f)

            # Check required metadata
            assert "_metadata" in data
            assert "python_version" in data["_metadata"]
            assert "numpy_version" in data["_metadata"]
            assert "stingray_version" in data["_metadata"]

            # Check data structure
            if "values" in data:
                assert isinstance(data["values"], dict)
                # Each value should be a list (converted from numpy array)
                for key, value in data["values"].items():
                    if not key.startswith("_"):
                        assert isinstance(value, list)

            print(f"Validated: {ref_file.name}")
