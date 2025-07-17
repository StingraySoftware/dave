"""
Test configuration for DAVE Python tests.

This module configures the test environment for headless CI execution.
"""

import matplotlib
# Set matplotlib to use Agg backend for headless environments (CI)
matplotlib.use('Agg')

import pytest
import sys
import os

# Add the main Python source directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'src', 'main', 'python'))