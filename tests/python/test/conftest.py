"""
Test configuration for DAVE Python tests.

This module configures the test environment for headless CI execution.
"""

import matplotlib

# Set matplotlib to use Agg backend for headless environments (CI)
matplotlib.use("Agg")

import os
import sys

import numpy as np
import pytest
from astropy.io import fits
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

@pytest.fixture(scope="session")
def rmf_file(tmp_path_factory):
    """Synthetic RMF (EBOUNDS-only FITS) mapping channels to energies.

    No real RMF ships with the repo, so we synthesize a NuSTAR-like linear
    calibration, E(channel) = 1.6 + 0.04 * channel keV, over channels 0..1023
    which covers the PI/PHA range (1..1022) of the sample event files.
    """
    path = tmp_path_factory.mktemp("rmf") / "synthetic_ebounds.rmf"
    channels = np.arange(0, 1024, dtype=np.int32)
    e_min = 1.6 + 0.04 * channels
    e_max = e_min + 0.04
    ebounds = fits.BinTableHDU.from_columns(
        fits.ColDefs(
            [
                fits.Column(name="CHANNEL", format="J", array=channels),
                fits.Column(name="E_MIN", format="E", unit="keV", array=e_min),
                fits.Column(name="E_MAX", format="E", unit="keV", array=e_max),
            ]
        ),
        name="EBOUNDS",
    )
    fits.HDUList([fits.PrimaryHDU(), ebounds]).writeto(str(path))
    return str(path)


def _write_gti_fits(path, start, stop):
    gti_hdu = fits.BinTableHDU.from_columns(
        fits.ColDefs(
            [
                fits.Column(name="START", format="D", array=np.array(start, dtype=float)),
                fits.Column(name="STOP", format="D", array=np.array(stop, dtype=float)),
            ]
        ),
        name="GTI",
    )
    fits.HDUList([fits.PrimaryHDU(), gti_hdu]).writeto(str(path))
    return str(path)


@pytest.fixture(scope="session")
def gti_file_relative(tmp_path_factory):
    """GTI-only FITS with TSTART-subtracted (relative) times [100, 500].

    Matches the sample event files after dave_reader subtracts TSTART, which
    is what the engine's load_gti_from_destination path expects.
    """
    path = tmp_path_factory.mktemp("gti") / "relative_gtis.fits"
    return _write_gti_fits(path, [100.0], [500.0])


@pytest.fixture(scope="session")
def gti_file_absolute(tmp_path_factory):
    """GTI-only FITS with absolute mission times inside monol_testA.evt's span.

    Used for get_dataset_applying_gti_dataset, which subtracts the events
    table's TSTART (80000000) itself.
    """
    path = tmp_path_factory.mktemp("gti") / "absolute_gtis.fits"
    return _write_gti_fits(path, [80000100.0], [80000600.0])
