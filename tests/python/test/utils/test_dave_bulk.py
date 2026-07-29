"""Tests for utils.dave_bulk.

dave_bulk drives HENDRICS batch analysis: converting inputs to .nc
intermediate files and running light-curve jobs per plot configuration.
The happy path through the Flask endpoint is covered in
test_dave_endpoint.py; these tests pin down the direct API and its error
handling.
"""

import os

import pytest
from hendrics.io import HEN_FILE_EXTENSION

import utils.dave_bulk as DaveBulk
from test.fixture import DATA_RESOURCES, TEST_RESOURCES


@pytest.fixture(scope="module")
def events_intermediate(tmp_path_factory):
    """A HENDRICS intermediate file built once from the sample events."""
    target = str(tmp_path_factory.mktemp("bulk-intermediate"))
    filename = DaveBulk.get_intermediate_file(
        os.path.join(DATA_RESOURCES, "monol_testA.evt"), target
    )
    assert filename is not None
    return filename


def test_get_intermediate_file_converts_events_to_nc(events_intermediate):
    """An events FITS input produces a .nc file on disk."""
    assert events_intermediate.endswith(HEN_FILE_EXTENSION)
    assert os.path.isfile(events_intermediate)


def test_get_intermediate_file_converts_lightcurve_to_nc(tmp_path):
    """A lightcurve FITS input also produces a .nc file."""
    filename = DaveBulk.get_intermediate_file(
        os.path.join(TEST_RESOURCES, "Test_Input_2.lc"), str(tmp_path)
    )
    assert filename is not None
    assert filename.endswith(HEN_FILE_EXTENSION)
    assert os.path.isfile(filename)


def test_get_intermediate_file_returns_none_for_unsupported_input(tmp_path):
    """Inputs the reader cannot turn into a stingray object yield None."""
    assert (
        DaveBulk.get_intermediate_file(
            os.path.join(TEST_RESOURCES, "Test_Input_1.txt"), str(tmp_path)
        )
        is None
    )


def test_bulk_analisys_runs_lcplot_config(events_intermediate, tmp_path):
    """An LcPlot config runs HENDRICS lcurve and reports produced files."""
    outdir = str(tmp_path / "bulk_out")
    results = DaveBulk.bulk_analisys(
        [events_intermediate],
        [
            {
                "id": "lc_plot",
                "class": "LcPlot",
                "dt": 16.0,
                "filters": [{"table": "EVENTS", "column": "TIME", "from": 0.0, "to": 1024.0}],
            }
        ],
        outdir,
    )
    assert results["outdir"] == outdir
    assert len(results["plot_configs"]) == 1
    entry = results["plot_configs"][0]
    assert entry["plotId"] == "lc_plot"
    assert len(entry["filenames"]) > 0


def test_bulk_analisys_skips_unsupported_plot_classes(events_intermediate, tmp_path):
    """PDSPlot is not implemented and unknown classes are skipped without
    producing results."""
    results = DaveBulk.bulk_analisys(
        [events_intermediate],
        [
            {"id": "pds", "class": "PDSPlot", "dt": 16.0, "filters": [], "norm": "leahy"},
            {"id": "other", "class": "MysteryPlot", "dt": 16.0, "filters": []},
            {"id": "classless", "dt": 16.0, "filters": []},
        ],
        str(tmp_path / "bulk_out"),
    )
    assert results["plot_configs"] == []


def test_bulk_analisys_returns_none_on_malformed_config(events_intermediate, tmp_path):
    """A config missing required keys aborts the run with None."""
    results = DaveBulk.bulk_analisys(
        [events_intermediate],
        [{"id": "broken", "class": "LcPlot"}],  # no dt/filters
        str(tmp_path / "bulk_out"),
    )
    assert results is None


def test_add_filter_to_args_appends_interval_for_matching_column():
    """A matching filter contributes its argument triplet; a missing one
    leaves the args untouched."""
    filters = [{"table": "EVENTS", "column": "PI", "from": 5, "to": 15}]
    args = DaveBulk.add_filter_to_args([], filters, "PI", "--pi-interval")
    assert args == ["--pi-interval", "5", "15"]
    assert DaveBulk.add_filter_to_args([], filters, "E", "--e-interval") == []


def test_push_plotconfig_results_lists_outdir_files(tmp_path):
    """The result entry records the plot id and the files in its outdir."""
    (tmp_path / "a.txt").write_text("x")
    (tmp_path / "b.txt").write_text("y")
    collected = []
    DaveBulk.push_plotconfig_results(collected, "plot-9", str(tmp_path))
    assert collected[0]["plotId"] == "plot-9"
    assert sorted(collected[0]["filenames"]) == ["a.txt", "b.txt"]
