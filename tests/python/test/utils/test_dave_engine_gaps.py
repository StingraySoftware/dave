"""Tests for utils.dave_engine validation, error handling and helpers.

These pin down the engine's input validation and defensive branches by
calling it directly (below the HTTP layer), plus the small numeric helper
functions with exact expected values.
"""

import os

import numpy as np
import pytest
import scipy.stats

import utils.dataset_cache as DsCache
import utils.dave_engine as DaveEngine
import utils.dave_reader as DaveReader
from config import CONFIG
from test.fixture import DATA_RESOURCES, TEST_RESOURCES

EVENTS_AXIS = [
    {"table": "EVENTS", "column": "TIME"},
    {"table": "EVENTS", "column": "PHA"},
]
NO_BASELINE = {"niter": 0, "lam": 1000, "p": 0.01}
MISSING = os.path.join(TEST_RESOURCES, "does_not_exist.evt")


def _resource(name):
    return os.path.join(TEST_RESOURCES, name)


def _data(name):
    return os.path.join(DATA_RESOURCES, name)


@pytest.fixture(autouse=True)
def clean_cache():
    DsCache.clear()
    yield
    DsCache.clear()


# ---------- schema / header ----------


def test_schema_and_header_return_none_for_unreadable_file():
    """Files the reader cannot load produce no schema and no header."""
    assert DaveEngine.get_dataset_schema(MISSING) is None
    assert DaveEngine.get_dataset_header(MISSING) is None


# ---------- append_file_to_dataset ----------


def test_append_rejects_datasets_of_different_types():
    """An events file cannot be appended to a lightcurve file."""
    assert (
        DaveEngine.append_file_to_dataset(_resource("test.evt"), _resource("Test_Input_2.lc"))
        == ""
    )


def test_append_rejects_lightcurves_with_different_bin_sizes():
    """Lightcurves with different TIMEDEL (1 s vs 100 s) cannot be joined."""
    assert (
        DaveEngine.append_file_to_dataset(
            _resource("Test_Input_2.lc"), _resource("PN_source_lightcurve_raw.lc")
        )
        == ""
    )


def test_append_rejects_unreadable_files():
    """Either side failing to load aborts the append with an empty key."""
    assert DaveEngine.append_file_to_dataset(MISSING, _resource("test.evt")) == ""
    assert DaveEngine.append_file_to_dataset(_resource("test.evt"), MISSING) == ""


def test_append_swaps_datasets_when_next_starts_earlier(tmp_path):
    """If the appended file starts earlier, both are shifted onto a common
    timeline and joined in chronological order."""
    from astropy.io import fits

    # Clone test.evt shifted 2000 s earlier so it becomes the earlier file.
    earlier = str(tmp_path / "earlier.evt")
    with fits.open(_resource("test.evt")) as hdulist:
        hdulist["EVENTS"].data["TIME"][:] -= 2000.0
        hdulist["GTI"].data["START"][:] -= 2000.0
        hdulist["GTI"].data["STOP"][:] -= 2000.0
        hdulist.writeto(earlier)

    original_count = len(
        DaveReader.get_file_dataset(_resource("test.evt"))[0]
        .tables["EVENTS"]
        .columns["TIME"]
        .values
    )

    cache_key = DaveEngine.append_file_to_dataset(_resource("test.evt"), earlier)
    assert cache_key != ""
    joined = DsCache.get(cache_key)
    times = joined.tables["EVENTS"].columns["TIME"].values
    assert len(times) == 2 * original_count


# ---------- apply_rmf_file_to_dataset ----------


def test_apply_rmf_reports_false_for_missing_column(rmf_file):
    """Applying the RMF over a column the dataset lacks fails."""
    assert (
        DaveEngine.apply_rmf_file_to_dataset(_resource("test.evt"), rmf_file, "NOPE") is False
    )


def test_apply_rmf_maps_unknown_channels_to_zero_energy(tmp_path):
    """Channels missing from the RMF map to energy 0, and re-applying an RMF
    clears the previous E column instead of appending to it."""
    from astropy.io import fits

    # An RMF covering only channels 0..99: most PHA values fall outside.
    small_rmf = str(tmp_path / "small.rmf")
    channels = np.arange(0, 100, dtype=np.int32)
    ebounds = fits.BinTableHDU.from_columns(
        fits.ColDefs(
            [
                fits.Column(name="CHANNEL", format="J", array=channels),
                fits.Column(name="E_MIN", format="E", array=1.6 + 0.04 * channels),
                fits.Column(name="E_MAX", format="E", array=1.64 + 0.04 * channels),
            ]
        ),
        name="EBOUNDS",
    )
    fits.HDUList([fits.PrimaryHDU(), ebounds]).writeto(small_rmf)

    destination = _resource("test.evt")
    energies = DaveEngine.apply_rmf_file_to_dataset(destination, small_rmf, "PHA")
    assert len(energies) == 100

    dataset, _ = DaveReader.get_file_dataset(destination)
    e_values = np.array(dataset.tables["EVENTS"].columns["E"].values)
    n_events = len(dataset.tables["EVENTS"].columns["TIME"].values)
    assert len(e_values) == n_events
    assert np.any(e_values == 0)  # PHA > 99 mapped to 0

    # Re-apply: the E column is cleared first, so the length stays n_events.
    DaveEngine.apply_rmf_file_to_dataset(destination, small_rmf, "PHA")
    dataset, _ = DaveReader.get_file_dataset(destination)
    assert len(dataset.tables["EVENTS"].columns["E"].values) == n_events


# ---------- get_plot_data ----------


def test_get_plot_data_validates_styles_and_axis():
    """Missing plot type, short axis and unknown types are all refused."""
    destination = _resource("test.evt")
    assert "error" in DaveEngine.get_plot_data(destination, "", "", [], {}, EVENTS_AXIS)
    assert "error" in DaveEngine.get_plot_data(
        destination, "", "", [], {"type": "2d"}, EVENTS_AXIS[:1]
    )
    assert "error" in DaveEngine.get_plot_data(
        destination, "", "", [], {"type": "hologram"}, EVENTS_AXIS
    )


def test_get_plot_data_3d_and_scatter_modes():
    """3d and scatter modes add their synthetic channels on real data."""
    destination = _resource("test.evt")
    data_3d = DaveEngine.get_plot_data(destination, "", "", [], {"type": "3d"}, EVENTS_AXIS)
    assert len(data_3d) == 5  # TIME, PHA, GTI start/stop, color channel
    data_scatter = DaveEngine.get_plot_data(
        destination, "", "", [], {"type": "scatter"}, EVENTS_AXIS
    )
    assert len(data_scatter) == 5


def test_get_plot_data_with_unreadable_file_reports_error():
    """A dataset that cannot be read surfaces as a common error."""
    assert "error" in DaveEngine.get_plot_data(MISSING, "", "", [], {"type": "2d"}, EVENTS_AXIS)


# ---------- get_lightcurve error branches ----------


def test_get_lightcurve_reports_unreadable_source():
    """No dataset means no lightcurve and an error payload."""
    result = DaveEngine.get_lightcurve(
        MISSING, "", "", [], EVENTS_AXIS, 16.0, NO_BASELINE, NO_BASELINE, None
    )
    assert result["error"] == "Can't create lightcurve or is empty"


def test_get_lightcurve_warns_when_bin_size_is_overridden():
    """Asking for dt=16 on a 1 s-binned lightcurve keeps the file's binning
    and reports the override."""
    result = DaveEngine.get_lightcurve(
        _resource("Test_Input_2.lc"), "", "", [], EVENTS_AXIS, 16.0, NO_BASELINE, NO_BASELINE, None
    )
    assert result[22]["values"][0].startswith("@WARN@Overriden Bin Size")


def test_get_lightcurve_rejects_too_narrow_time_selection():
    """A time filter leaving fewer than two events cannot form a lightcurve."""
    filters = [{"table": "EVENTS", "column": "TIME", "from": 0.0, "to": 0.1}]
    result = DaveEngine.get_lightcurve(
        _resource("test.evt"), "", "", filters, EVENTS_AXIS, 16.0, NO_BASELINE, NO_BASELINE, None
    )
    assert result["error"] == "Can't create lightcurve or is empty"


def test_get_lightcurve_rejects_duration_below_two_bins():
    """The selection must span at least two bin sizes."""
    filters = [{"table": "EVENTS", "column": "TIME", "from": 0.0, "to": 40.0}]
    result = DaveEngine.get_lightcurve(
        _resource("test.evt"), "", "", filters, EVENTS_AXIS, 30.0, NO_BASELINE, NO_BASELINE, None
    )
    assert result["error"] == "Can't create lightcurve or is empty"


def test_get_lightcurve_malformed_options_surface_as_error():
    """Baseline options missing required keys produce an error payload."""
    result = DaveEngine.get_lightcurve(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, {}, NO_BASELINE, None
    )
    assert "error" in result


def test_get_lightcurve_clamps_oversized_mean_count():
    """A variance mean_count larger than the chunk count is clamped and
    reported as a warning."""
    result = DaveEngine.get_lightcurve(
        _resource("test.evt"),
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        NO_BASELINE,
        NO_BASELINE,
        {"min_counts": 10, "min_bins": 2, "mean_count": 500},
    )
    assert result[22]["values"][0].startswith("@WARN@Mean count fixed to")


def test_get_lightcurve_applies_rate_filter_to_countrate():
    """A RATE filter keeps only bins whose count rate is inside the range."""
    unfiltered = DaveEngine.get_lightcurve(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, NO_BASELINE, NO_BASELINE, None
    )
    rates = np.array(unfiltered[1]["values"])
    threshold = float(np.median(rates))

    filters = [{"table": "EVENTS", "column": "RATE", "from": threshold, "to": 10000.0}]
    result = DaveEngine.get_lightcurve(
        _resource("test.evt"), "", "", filters, EVENTS_AXIS, 16.0, NO_BASELINE, NO_BASELINE, None
    )
    filtered_rates = np.array(result[1]["values"])
    assert 0 < len(filtered_rates) < len(rates)
    assert filtered_rates.min() >= threshold


def test_get_lightcurve_from_lc_dataset_with_background():
    """The lightcurve branch subtracts a background lightcurve file; using
    the same file as its own background zeroes the count rate."""
    result = DaveEngine.get_lightcurve(
        _resource("Test_Input_2.lc"),
        _resource("Test_Input_2.lc"),
        "",
        [],
        EVENTS_AXIS,
        1.0,
        NO_BASELINE,
        NO_BASELINE,
        None,
    )
    assert all(value == 0 for value in result[1]["values"])


def test_get_lightcurve_with_unreadable_background_keeps_source():
    """An unloadable background is logged and the source lightcurve kept."""
    result = DaveEngine.get_lightcurve(
        _resource("test.evt"), MISSING, "", [], EVENTS_AXIS, 16.0, NO_BASELINE, NO_BASELINE, None
    )
    assert len(result[0]["values"]) == 64
    assert sum(result[1]["values"]) > 0


def test_get_lightcurve_is_cached_between_calls():
    """The second identical request is served from the lightcurve cache."""
    args = (_resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, NO_BASELINE, NO_BASELINE, None)
    first = DaveEngine.get_lightcurve(*args)
    cached_count = DsCache.count()
    second = DaveEngine.get_lightcurve(*args)
    assert DsCache.count() == cached_count
    assert list(first[1]["values"]) == list(second[1]["values"])


# ---------- joined / divided lightcurves ----------


def test_get_joined_lightcurves_validates_axis_and_sources():
    """Axis count and both sources are validated."""
    assert "error" in DaveEngine.get_joined_lightcurves(
        _resource("test.evt"), _resource("test.evt"), "", "", [], EVENTS_AXIS[:1], 16.0
    )
    assert "error" in DaveEngine.get_joined_lightcurves(
        MISSING, _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0
    )
    assert "error" in DaveEngine.get_joined_lightcurves(
        _resource("test.evt"), MISSING, "", "", [], EVENTS_AXIS, 16.0
    )


def test_get_joined_lightcurves_warns_on_different_durations():
    """Lightcurves of different lengths cannot be joined pointwise."""
    result = DaveEngine.get_joined_lightcurves(
        _resource("Test_Input_2.lc"),
        _resource("PN_source_lightcurve_raw.lc"),
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
    )
    assert result["error"].startswith("@WARN@")


def test_get_divided_lightcurve_ds_rejects_non_lightcurve_inputs():
    """Events files are not valid inputs for the lightcurve division."""
    assert DaveEngine.get_divided_lightcurve_ds(_resource("test.evt"), _resource("test.evt"), "", "") == ""


def test_get_divided_lightcurve_ds_rejects_shape_mismatch():
    """Lightcurves with different lengths cannot be divided."""
    assert (
        DaveEngine.get_divided_lightcurve_ds(
            _resource("Test_Input_2.lc"), _resource("PN_source_lightcurve_raw.lc"), "", ""
        )
        == ""
    )


def test_get_divided_lightcurve_ds_subtracts_backgrounds():
    """Backgrounds are subtracted before dividing: with each curve acting as
    its own background the numerator and denominator are both zero, and the
    0/0 bins divide to 0."""
    cache_key = DaveEngine.get_divided_lightcurve_ds(
        _resource("Test_Input_2.lc"),
        _resource("Test_Input_2.lc"),
        _resource("Test_Input_2.lc"),
        _resource("Test_Input_2.lc"),
    )
    assert cache_key != ""
    ratio_ds = DsCache.get(cache_key)
    values = np.array(ratio_ds.tables["RATE"].columns["RATE"].values)
    assert np.all(values == 0)


def test_get_divided_lightcurve_ds_warns_on_background_shape_mismatch():
    """A background of a different shape is ignored with a warning, and the
    division of the curve by itself still yields 1."""
    cache_key = DaveEngine.get_divided_lightcurve_ds(
        _resource("Test_Input_2.lc"),
        _resource("Test_Input_2.lc"),
        _resource("PN_source_lightcurve_raw.lc"),
        "",
    )
    assert cache_key != ""


def test_get_divided_lightcurves_from_colors_with_four_colors():
    """Four color filters produce two ratio curves (Z/S and X/Y)."""
    def color(column, low, high):
        return {
            "table": "EVENTS",
            "column": column,
            "from": low,
            "to": high,
            "source": "ColorSelector",
            "replaceColumn": "PHA",
        }

    filters = [
        color("Color1", 3000, 4000),
        color("Color2", 3000, 4000),
        color("Color3", 3000, 4000),
        color("Color4", 3000, 4000),
    ]
    result = DaveEngine.get_divided_lightcurves_from_colors(
        _resource("Test_Input_1.txt"), "", "", filters, EVENTS_AXIS, 1.0
    )
    assert len(result) == 5
    # Identical selections: both ratio curves are exactly 1.
    assert all(value == 1.0 for value in result[0]["values"])
    assert all(value == 1.0 for value in result[1]["values"])


def test_get_divided_lightcurves_from_colors_validates_axis():
    """The color division needs exactly two axes."""
    assert "error" in DaveEngine.get_divided_lightcurves_from_colors(
        _resource("Test_Input_1.txt"), "", "", [], EVENTS_AXIS[:1], 1.0
    )


def test_get_divided_lightcurves_from_colors_warns_when_selection_is_empty():
    """Color ranges that select no events cannot form the ratio curves."""
    def color(column):
        return {
            "table": "EVENTS",
            "column": column,
            "from": 0,
            "to": 1,
            "source": "ColorSelector",
            "replaceColumn": "PHA",
        }

    result = DaveEngine.get_divided_lightcurves_from_colors(
        _resource("Test_Input_1.txt"), "", "", [color("Color1"), color("Color2")], EVENTS_AXIS, 1.0
    )
    assert result["error"].startswith("@WARN@")


# ---------- spectra validation ----------


def test_pds_validation_and_avg_without_segment_size():
    """Bad axis/type are refused; an Avg PDS without a segment size fails
    with a hint towards the Single type."""
    destination = _resource("test.evt")
    result = DaveEngine.get_power_density_spectrum(
        destination, "", "", [], EVENTS_AXIS[:1], 16.0, 1, 0, "leahy", "Sng"
    )
    assert len(result[0]["values"]) == 0

    result = DaveEngine.get_power_density_spectrum(
        destination, "", "", [], EVENTS_AXIS, 16.0, 1, 0, "leahy", "Bogus"
    )
    assert len(result[0]["values"]) == 0

    result = DaveEngine.get_power_density_spectrum(
        destination, "", "", [], EVENTS_AXIS, 16.0, 2, 0, "leahy", "Avg"
    )
    assert len(result[0]["values"]) == 0
    assert "Single" in result[3]["values"][0]


def test_pds_rebins_frequencies_when_df_requested():
    """A df > 0 rebins the spectrum onto a coarser frequency grid."""
    fine = DaveEngine.get_power_density_spectrum(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, 1, 0, "leahy", "Sng", 0
    )
    coarse = DaveEngine.get_power_density_spectrum(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, 1, 0, "leahy", "Sng", 0.01
    )
    assert 0 < len(coarse[0]["values"]) < len(fine[0]["values"])


def test_dynamical_spectrum_validation_errors():
    """Axis count and normalization are validated before any computation."""
    assert "error" in DaveEngine.get_dynamical_spectrum(
        _resource("test.evt"), "", "", [], EVENTS_AXIS[:1], 16.0, 8, 128.0, "leahy", [0, 1]
    )
    assert "error" in DaveEngine.get_dynamical_spectrum(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, 8, 128.0, "bogus", [0, 1]
    )
    assert "error" in DaveEngine.get_dynamical_spectrum(
        MISSING, "", "", [], EVENTS_AXIS, 16.0, 8, 128.0, "leahy", [0, 1]
    )


def test_dynamical_spectrum_warns_when_gti_not_splittable():
    """A segment length larger than half the single GTI cannot split it."""
    result = DaveEngine.get_dynamical_spectrum(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, 1, 800.0, "leahy", [-1, 1]
    )
    assert result[4]["values"] == ["@WARN@The GTI is not splitable by segment length"]


def test_cross_spectrum_validation_errors():
    """Axis, normalization and unreadable sources are all refused."""
    destination = _resource("test.evt")
    args_tail = (1, 0, "leahy", "Sng")
    assert "error" in DaveEngine.get_cross_spectrum(
        destination, "", "", [], EVENTS_AXIS[:1], 16.0, destination, "", "", [], EVENTS_AXIS, 16.0, *args_tail
    )
    assert "error" in DaveEngine.get_cross_spectrum(
        destination, "", "", [], EVENTS_AXIS, 16.0, destination, "", "", [], EVENTS_AXIS[:1], 16.0, *args_tail
    )
    assert "error" in DaveEngine.get_cross_spectrum(
        destination, "", "", [], EVENTS_AXIS, 16.0, destination, "", "", [], EVENTS_AXIS, 16.0, 1, 0, "bogus", "Sng"
    )
    assert "error" in DaveEngine.get_cross_spectrum(
        MISSING, "", "", [], EVENTS_AXIS, 16.0, destination, "", "", [], EVENTS_AXIS, 16.0, *args_tail
    )
    assert "error" in DaveEngine.get_cross_spectrum(
        destination, "", "", [], EVENTS_AXIS, 16.0, MISSING, "", "", [], EVENTS_AXIS, 16.0, *args_tail
    )


def test_covariance_spectrum_error_matrix(rmf_file):
    """Oversized bin size, empty selections and wrong dataset types are all
    reported as errors."""
    # E column present, but the observation is shorter than the bin size.
    destination = _data("monol_testA.evt")
    DaveEngine.apply_rmf_file_to_dataset(destination, rmf_file, "PI")
    result = DaveEngine.get_covariance_spectrum(
        destination, "", "", [], 2000.0, [2, 40], [2, 10], 2, -1
    )
    assert result["error"] == "LC duration must be greater than bin size"

    # A time filter selecting nothing leaves no events at all.
    empty_filter = [{"table": "EVENTS", "column": "TIME", "from": -100.0, "to": -50.0}]
    result = DaveEngine.get_covariance_spectrum(
        destination, "", "", empty_filter, 16.0, [2, 40], [2, 10], 2, -1
    )
    assert result["error"] == "No events data"

    # A lightcurve dataset is not an events dataset.
    result = DaveEngine.get_covariance_spectrum(
        _resource("Test_Input_2.lc"), "", "", [], 16.0, [2, 40], [2, 10], 2, -1
    )
    assert result["error"] == "Wrong dataset type"


# ---------- helper functions ----------


def test_nan_and_inf_to_num_scalars_and_arrays():
    """NaN maps to 0, infinities and huge values clamp to +/-BIG_NUMBER."""
    big = CONFIG.BIG_NUMBER
    assert DaveEngine.nan_and_inf_to_num(np.nan) == 0
    assert DaveEngine.nan_and_inf_to_num(big * 10) == big
    assert DaveEngine.nan_and_inf_to_num(-big * 10) == -big
    assert DaveEngine.nan_and_inf_to_num(1.25) == 1.25

    array = np.array([1.0, np.nan, np.inf, -np.inf])
    cleaned = DaveEngine.nan_and_inf_to_num(array)
    assert cleaned.tolist() == [1.0, 0.0, big, -big]


def test_get_divided_values_and_error_handles_zero_division():
    """Division by zero yields 0 instead of infinities, and the propagated
    error follows the quotient rule."""
    values, errors = DaveEngine.get_divided_values_and_error(
        np.array([4.0, 2.0]), np.array([2.0, 0.0]), np.array([0.4, 0.1]), np.array([0.2, 0.1])
    )
    assert values.tolist() == [2.0, 0.0]
    # err = e0/v1 + e1*v0/v1^2 = 0.4/2 + 0.2*4/4 = 0.4
    assert values[0] == 2.0
    assert errors[0] == pytest.approx(0.4)


def test_get_means_from_array_averages_fixed_size_groups():
    """The array is split into groups of the requested size and averaged."""
    means = DaveEngine.get_means_from_array(np.array([1.0, 3.0, 5.0, 7.0]), 2)
    assert means.tolist() == [2.0, 6.0]


def test_mean_confidence_interval_matches_t_distribution():
    """The half-width is the t-quantile times the standard error."""
    data = [1.0, 2.0, 3.0, 4.0, 5.0]
    mean, low, high = DaveEngine.mean_confidence_interval(data, confidence=0.95)
    sem = scipy.stats.sem(np.array(data))
    half = sem * scipy.stats.t.ppf(0.975, len(data) - 1)
    assert mean == pytest.approx(3.0)
    assert low == pytest.approx(3.0 - half)
    assert high == pytest.approx(3.0 + half)


def test_exclude_axis_returns_first_differing_column():
    """The first axis whose column differs from the filter axis is chosen."""
    axis = [
        {"table": "EVENTS", "column": "TIME"},
        {"table": "EVENTS", "column": "PHA"},
    ]
    assert DaveEngine.exclude_axis(axis, {"column": "TIME"}) == axis[1]
    assert DaveEngine.exclude_axis(axis, {"column": "RATE"}) == axis[0]
    assert DaveEngine.exclude_axis([axis[0]], {"column": "TIME"}) is None


def test_check_axis_in_dataset_flags_missing_tables_and_columns():
    """Unknown tables or columns fail the axis check."""
    dataset, _ = DaveReader.get_file_dataset(_resource("test.evt"))
    good = [{"table": "EVENTS", "column": "TIME"}]
    assert DaveEngine.check_axis_in_dataset(dataset, good) is True
    assert DaveEngine.check_axis_in_dataset(dataset, [{"table": "NOPE", "column": "TIME"}]) is False
    assert (
        DaveEngine.check_axis_in_dataset(dataset, [{"table": "EVENTS", "column": "NOPE"}]) is False
    )


def test_get_color_axis_for_ds_is_time_vs_pha():
    """The synthetic color axis pairs EVENTS TIME with EVENTS PHA."""
    axis = DaveEngine.get_color_axis_for_ds()
    assert axis[0] == {"table": "EVENTS", "column": CONFIG.TIME_COLUMN}
    assert axis[1] == {"table": "EVENTS", "column": "PHA"}


def test_rebin_spectrum_if_necessary_reduces_oversized_spectra(monkeypatch):
    """Spectra with more points than MAX_PLOT_POINTS are rebinned down."""
    from stingray import Powerspectrum

    events, _ = DaveReader.get_file_dataset(_resource("test.evt"))
    import utils.dataset_helper as DsHelper

    lc = DsHelper.get_eventlist_from_evt_dataset(events).to_lc(1.0)
    pds = Powerspectrum(lc, norm="leahy")
    monkeypatch.setattr(CONFIG, "MAX_PLOT_POINTS", 32)
    rebinned = DaveEngine.rebin_spectrum_if_necessary(pds)
    assert len(rebinned.freq) < len(pds.freq)


def test_get_filtered_dataset_reports_unloadable_inputs():
    """A bad destination or an unloadable GTI file is handled gracefully."""
    assert DaveEngine.get_filtered_dataset(MISSING, []) is None
    dataset = DaveEngine.get_filtered_dataset(_resource("test.evt"), [], MISSING)
    assert dataset is not None  # bad GTI file is logged and ignored


def test_get_filtered_dataset_applies_gti_dataset_file(gti_file_absolute):
    """A GTI file restricts the dataset to the (TSTART-shifted) window."""
    dataset = DaveEngine.get_filtered_dataset(
        _data("monol_testA.evt"), [], gti_file_absolute
    )
    times = np.array(dataset.tables["EVENTS"].columns["TIME"].values)
    assert len(times) > 0
    assert times.min() >= 100.0
    assert times.max() <= 600.0


def test_load_gti_from_destination_reads_and_caches(gti_file_relative):
    """The GTI array is read from FITS once and cached for the next call."""
    first = DaveEngine.load_gti_from_destination(gti_file_relative)
    assert first.tolist() == [[100.0, 500.0]]
    second = DaveEngine.load_gti_from_destination(gti_file_relative)
    assert second.tolist() == first.tolist()
    assert DaveEngine.load_gti_from_destination("") is None


def test_common_error_and_warn_payloads():
    """common_error wraps the message; common_warn adds the @WARN@ marker."""
    assert DaveEngine.common_error("boom") == {"error": "boom"}
    assert DaveEngine.common_warn("careful") == {"error": "@WARN@careful"}
