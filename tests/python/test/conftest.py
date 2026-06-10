"""
Test configuration for DAVE Python tests.

This module configures the test environment for headless CI execution.
"""

import matplotlib

# Set matplotlib to use Agg backend for headless environments (CI)
matplotlib.use("Agg")

import os
import sys

from hypothesis import settings

# Many tests do real FITS/netCDF file I/O whose duration depends on the OS file
# cache and disk (USB/external drives, loaded CI runners), not on the code under
# test. A wall-clock deadline turns that variance into DeadlineExceeded/Flaky
# failures, so disable it; max_examples still comes from pyproject.toml.
settings.register_profile("dave", deadline=None)
settings.load_profile("dave")

# Add the main Python source directory to the path
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "src", "main", "python")
)
