#!/usr/bin/env python3
"""
Create reference outputs from existing working test data.

This script generates reference outputs using the existing test resources
to establish a baseline for regression testing.
"""

import json
import shutil
import sys
from pathlib import Path

import numpy as np

# Add the main Python source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "main" / "python"))

# Import Flask app
import utils.dataset_cache as DsCache
from server import app


def setup_test_environment():
    """Set up test environment."""
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    # Create temporary upload directory
    upload_dir = Path(__file__).parent.parent / "temp_uploads"
    upload_dir.mkdir(exist_ok=True)
    app.config["UPLOAD_FOLDER"] = str(upload_dir)

    # Clear cache
    DsCache.clear()

    return app.test_client(), upload_dir


def save_reference_output(output_dir, analysis_type, data, description=""):
    """Save reference output to JSON file."""
    # Convert numpy arrays to lists
    json_data = {}

    def convert_to_json_serializable(obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {k: convert_to_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_to_json_serializable(item) for item in obj]
        elif isinstance(obj, np.number):
            return float(obj)
        else:
            return obj

    json_data = convert_to_json_serializable(data)

    # Add metadata
    json_data["_metadata"] = {
        "python_version": "3.13",
        "numpy_version": "2.2",
        "stingray_version": "2.2.7",
        "creation_date": "2025-01-28",
        "analysis_type": analysis_type,
        "description": description,
    }

    # Save file
    filename = f"reference_{analysis_type}_py313_np22_stingray227.json"
    filepath = output_dir / filename

    with open(filepath, "w") as f:
        json.dump(json_data, f, indent=2)

    print(f"Saved reference output: {filename}")
    return filepath


def create_reference_outputs():
    """Create reference outputs from existing test data."""
    # Set up environment
    client, upload_dir = setup_test_environment()

    # Create output directory
    output_dir = Path(__file__).parent.parent / "resources" / "reference_outputs"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Path to existing test data
    test_data_path = Path(__file__).parent.parent / "resources" / "pytest"

    print("Creating reference outputs from existing test data...")

    # 1. Upload existing test file
    test_file = test_data_path / "Test_Input_1.txt"
    if test_file.exists():
        print(f"Using test file: {test_file}")

        # Upload the file
        with open(test_file, "rb") as f:
            response = client.post(
                "/upload",
                data={"file": (f, "Test_Input_1.txt")},
                content_type="multipart/form-data",
            )

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]
            print(f"Uploaded file: {uploaded_filename}")

            # Get dataset schema
            response = client.get(f"/get_dataset_schema?filename={uploaded_filename}")
            if response.status_code == 200:
                schema = response.get_json()
                save_reference_output(
                    output_dir, "dataset_schema", schema, "Dataset schema from Test_Input_1.txt"
                )

            # Try 2D plot (this was working in our tests)
            plot_params = {
                "filename": uploaded_filename,
                "bck_filename": "",
                "gti_filename": "",
                "filters": [],
                "styles": {"type": "2d"},
                "axis": [
                    {"table": "EVENTS", "column": "TIME"},
                    {"table": "EVENTS", "column": "RATE"},
                ],
            }

            response = client.post(
                "/get_plot_data", data=json.dumps(plot_params), content_type="application/json"
            )

            if response.status_code == 200:
                plot_result = response.get_json()
                save_reference_output(
                    output_dir, "2d_plot", plot_result, "2D plot data from Test_Input_1.txt"
                )

    # 2. Try with EVT file if available
    evt_file = test_data_path / "test.evt"
    if evt_file.exists():
        print(f"Using EVT file: {evt_file}")

        with open(evt_file, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "test.evt")}, content_type="multipart/form-data"
            )

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]

            # Get schema for EVT file
            response = client.get(f"/get_dataset_schema?filename={uploaded_filename}")
            if response.status_code == 200:
                schema = response.get_json()
                save_reference_output(
                    output_dir, "evt_schema", schema, "Dataset schema from FITS event file"
                )

    # 3. Try with LC file if available
    lc_file = test_data_path / "Test_Input_2.lc"
    if lc_file.exists():
        print(f"Using LC file: {lc_file}")

        with open(lc_file, "rb") as f:
            response = client.post(
                "/upload", data={"file": (f, "Test_Input_2.lc")}, content_type="multipart/form-data"
            )

        if response.status_code == 200:
            uploaded_filename = response.get_json()[0]

            # Get schema for LC file
            response = client.get(f"/get_dataset_schema?filename={uploaded_filename}")
            if response.status_code == 200:
                schema = response.get_json()
                save_reference_output(
                    output_dir, "lc_schema", schema, "Dataset schema from lightcurve file"
                )

    # 4. Create metadata file
    metadata = {
        "version": "1.0",
        "creation_date": "2025-01-28",
        "description": "Reference outputs for DAVE regression testing",
        "stack_info": {
            "python": "3.13",
            "numpy": "2.2",
            "stingray": "2.2.7",
            "hendrics": "8.1+",
            "astropy": "7.0+",
            "flask": "3.1+",
        },
        "test_files": {
            "Test_Input_1.txt": "Basic text lightcurve file",
            "test.evt": "FITS event list file",
            "Test_Input_2.lc": "Lightcurve file",
        },
        "reference_outputs": {
            "dataset_schema": "Schema information for uploaded datasets",
            "2d_plot": "Basic 2D plot data output",
            "evt_schema": "Schema for FITS event files",
            "lc_schema": "Schema for lightcurve files",
        },
        "usage": "Compare future outputs with these references to detect regressions",
    }

    metadata_file = output_dir / "reference_metadata.json"
    with open(metadata_file, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Created metadata file: {metadata_file}")

    # List all created files
    ref_files = list(output_dir.glob("reference_*.json"))
    print(f"\nGenerated {len(ref_files)} reference files:")
    for ref_file in ref_files:
        file_size = ref_file.stat().st_size
        print(f"  - {ref_file.name} ({file_size} bytes)")

    # Clean up
    if upload_dir.exists():
        shutil.rmtree(upload_dir)

    DsCache.clear()
    print("\nReference output generation complete!")


if __name__ == "__main__":
    create_reference_outputs()
