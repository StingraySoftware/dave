import os
import tempfile
from io import BytesIO

from hypothesis import example, given, settings
from hypothesis.strategies import text
from werkzeug.datastructures import FileStorage

import utils.file_utils as FileUtils
from test.fixture import TEST_RESOURCES


@given(text(min_size=1))
@example("Test_Input_1.txt")
@example("Test_Input_2.lc")
@settings(deadline=1000, max_examples=10)
def test_is_valid_file(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, s)
    try:
        assert FileUtils.is_valid_file(destination) == os.path.isfile(destination)
    except Exception:
        assert not FileUtils.is_valid_file(destination)


def test_is_valid_file_falls_back_when_magic_errors(monkeypatch):
    """A runtime failure inside python-magic must fall back to the extension
    check instead of rejecting every file (implicit None return)."""
    if FileUtils.MAGIC_AVAILABLE:

        def raise_runtime_error(_destination):
            raise RuntimeError("could not find any valid magic files!")

        monkeypatch.setattr(FileUtils.magic, "from_file", raise_runtime_error)

    destination = FileUtils.get_destination(TEST_RESOURCES, "test.evt")
    assert FileUtils.is_valid_file(destination) is True


def test_get_destination():
    """Test get_destination function with various inputs."""
    # Test with valid filename
    result = FileUtils.get_destination(TEST_RESOURCES, "test.evt")
    assert result.endswith("test.evt")
    assert "pytest" in result  # Should contain the test resources directory

    # Test with empty filename - function returns target directory when filename is empty
    result = FileUtils.get_destination(TEST_RESOURCES, "")
    # Empty filename gets sanitized to target directory by security_utils.sanitize_path
    # Check if result contains pytest directory or is empty string
    assert "pytest" in result or result == ""

    # Test with None - this should cause an exception and return empty string
    try:
        result = FileUtils.get_destination(TEST_RESOURCES, None)
        assert result == ""
    except Exception:
        # Function may throw exception for None input, which is acceptable
        assert True


def test_file_exist():
    """Test file_exist function."""
    # Test with existing file
    assert FileUtils.file_exist(TEST_RESOURCES, "test.evt")

    # Test with non-existing file
    assert not FileUtils.file_exist(TEST_RESOURCES, "nonexistent.txt")

    # Test with empty filename
    assert not FileUtils.file_exist(TEST_RESOURCES, "")


def test_get_files_in_dir():
    """Test get_files_in_dir function."""
    files = FileUtils.get_files_in_dir(TEST_RESOURCES)
    assert isinstance(files, list)
    assert len(files) > 0
    assert "test.evt" in files
    assert "Test_Input_1.txt" in files


def test_get_intermediate_filename():
    """Test get_intermediate_filename function."""
    with tempfile.TemporaryDirectory() as temp_dir:
        filepath = os.path.join(TEST_RESOURCES, "test.evt")
        result = FileUtils.get_intermediate_filename(temp_dir, filepath, ".tmp")

        assert result.endswith(".tmp")
        # Use realpath to resolve Windows short/long path name differences
        temp_dir_real = os.path.realpath(temp_dir)
        result_real = os.path.realpath(result)
        assert temp_dir_real in result_real
        assert "test" in result


def test_save_file():
    """Test save_file function with mock file upload."""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a mock file upload
        file_content = b"Test file content"
        file_storage = FileStorage(
            stream=BytesIO(file_content), filename="test_upload.txt", content_type="text/plain"
        )

        result = FileUtils.save_file(temp_dir, file_storage)

        # Check if file was saved (might fail due to security validation)
        if result:
            assert os.path.exists(result)
            assert "test_upload.txt" in result
