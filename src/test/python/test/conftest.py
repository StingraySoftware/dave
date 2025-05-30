"""
Pytest configuration for Flask integration tests.
Provides fixtures for Flask test client and test data.
"""

import logging
import os
import sys
import tempfile
from pathlib import Path

import pytest

# Add parent directory to path so we can import the Flask app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../main/python")))

# Monkey patch logging before importing server to prevent file creation issues
logging.basicConfig = lambda **kwargs: None

# Temporarily replace sys.argv to prevent server.py from parsing test arguments
original_argv = sys.argv
sys.argv = ["test", ".", ".", "5000", "0"]

import utils.dataset_cache as DsCache  # noqa: E402
from server import app  # noqa: E402

# Restore original argv
sys.argv = original_argv


@pytest.fixture
def client():
    """Create Flask test client with test configuration."""
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    # Create temporary upload directory
    with tempfile.TemporaryDirectory() as temp_dir:
        app.config["UPLOAD_FOLDER"] = temp_dir

        # Clear cache before each test
        DsCache.clear()

        with app.test_client() as client:
            yield client

        # Clean up after test
        DsCache.clear()


@pytest.fixture
def test_data_path():
    """Path to test resources directory."""
    return Path(__file__).parent.parent.parent / "resources" / "pytest"


@pytest.fixture
def sample_text_file(test_data_path):
    """Path to sample text lightcurve file."""
    return str(test_data_path / "Test_Input_1.txt")


@pytest.fixture
def sample_lc_file(test_data_path):
    """Path to sample .lc lightcurve file."""
    return str(test_data_path / "Test_Input_2.lc")


@pytest.fixture
def sample_evt_file(test_data_path):
    """Path to sample FITS event file."""
    return str(test_data_path / "test.evt")


@pytest.fixture
def sample_gti_evt_file(test_data_path):
    """Path to sample FITS event file with GTIs."""
    return str(test_data_path / "test_Gtis.evt")


@pytest.fixture
def uploaded_file_id(client, sample_text_file):
    """Upload a test file and return its filename."""
    with open(sample_text_file, "rb") as f:
        response = client.post(
            "/upload", data={"file": (f, "test_data.txt")}, content_type="multipart/form-data"
        )

    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list) and len(data) > 0
    return data[0]  # Return the filename


@pytest.fixture
def mock_session(monkeypatch):
    """Mock Flask session for testing."""
    session_data = {}

    def get_item(key, default=None):
        return session_data.get(key, default)

    def set_item(key, value):
        session_data[key] = value

    mock_session_obj = type(
        "MockSession",
        (),
        {
            "get": get_item,
            "__setitem__": set_item,
            "__getitem__": lambda self, key: session_data[key],
            "__contains__": lambda self, key: key in session_data,
        },
    )()

    monkeypatch.setattr("server.session", mock_session_obj)
    monkeypatch.setattr("utils.dave_endpoint.session", mock_session_obj)

    return mock_session_obj
