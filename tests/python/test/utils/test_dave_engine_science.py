"""Tests for utils.dave_engine's heavier science paths, driven with the
real sample event files: averaged cross spectra, energy-resolved RMS with
automatic white-noise estimation, Bayesian PSD fitting with MCMC sampling,
pulse searches in both modes, phaseograms with binary corrections,
Lomb-Scargle auto ranges and BACKSCAL-scaled background subtraction.
"""

import os
import shutil

import numpy as np
import pytest
from astropy.io import fits

import utils.dataset_cache as DsCache
import utils.dave_engine as DaveEngine
from test.fixture import DATA_RESOURCES, TEST_RESOURCES

EVENTS_AXIS = [
    {"table": "EVENTS", "column": "TIME"},
    {"table": "EVENTS", "column": "PHA"},
]
RATE_AXIS = [
    {"table": "RATE", "column": "TIME"},
    {"table": "RATE", "column": "RATE"},
]


def _resource(name):
    return os.path.join(TEST_RESOURCES, name)


def _data(name):
    return os.path.join(DATA_RESOURCES, name)


@pytest.fixture(autouse=True)
def clean_cache():
    DsCache.clear()
    yield
    DsCache.clear()


@pytest.fixture
def calibrated_events(tmp_path, rmf_file):
    """A private copy of monol_testA.evt with the synthetic RMF applied, so
    its cached dataset carries the E column without affecting other tests."""
    destination = str(tmp_path / "monol_calibrated.evt")
    shutil.copy(_data("monol_testA.evt"), destination)
    energies = DaveEngine.apply_rmf_file_to_dataset(destination, rmf_file, "PI")
    assert len(energies) == 1024
    return destination


# ---------- averaged cross spectrum ----------


def test_averaged_cross_spectrum_returns_lag_and_coherence_errors():
    """The Avg variant reports per-frequency error bars for both the time
    lags and the coherence (the Sng variant cannot)."""
    destination = _data("monol_testA.evt")
    result = DaveEngine.get_cross_spectrum(
        destination,
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        destination,
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        4,
        256.0,
        "leahy",
        "Avg",
    )
    frequencies = result[0]["values"]
    assert len(frequencies) > 0
    time_lags, time_lag_errors = result[2]["values"]
    assert len(time_lags) == len(frequencies)
    assert len(time_lag_errors) == len(frequencies)
    coherence, coherence_errors = result[3]["values"]
    # The averaged coherence estimator is noise-corrected, so identical
    # Poisson inputs scatter around 1 rather than sitting exactly on it.
    assert len(coherence) == len(frequencies)
    assert np.isfinite(coherence).all()
    assert np.all(np.asarray(coherence) > 0)
    assert len(coherence_errors) == len(frequencies)


# ---------- RMS spectra ----------


def test_rms_spectrum_with_automatic_white_noise_and_rebinning(calibrated_events):
    """white_noise < -100 triggers the Lorentz+Const auto estimation (a
    Leahy white-noise level near 2) and df > 0 rebins each band's PDS.

    Stingray's fits jitter their start point from numpy's global RNG, so
    the seed is pinned.
    """
    np.random.seed(0)  # noqa: NPY002 -- stingray uses the legacy global RNG internally
    result = DaveEngine.get_rms_spectrum(
        calibrated_events,
        "",
        "",
        [],
        EVENTS_AXIS,
        1.0,
        1,
        256.0,
        "leahy",
        "Avg",
        0.01,
        [-1, -1],
        [-1, -1],
        2,
        -200.0,
    )
    assert len(result[0]["values"]) == 2  # one energy centre per band
    assert len(result[1]["values"]) == 2
    auto_offset = result[5]["values"]
    assert auto_offset == pytest.approx(2.0, abs=1.0)


def test_rms_spectrum_clamps_oversized_segment(calibrated_events):
    """A segment size longer than the observation is clamped to it."""
    result = DaveEngine.get_rms_spectrum(
        calibrated_events,
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        1,
        5000.0,
        "frac",
        "Avg",
        0,
        [0.005, 0.03],
        [2.0, 20.0],
        2,
        0.0,
    )
    assert len(result[0]["values"]) == 2
    assert list(result[4]["values"]) == [0.005, 0.03]


def test_rms_spectrum_reports_empty_bands(calibrated_events):
    """Energy bands with no events keep their centre but contribute rms 0."""
    result = DaveEngine.get_rms_spectrum(
        calibrated_events,
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        1,
        0,
        "frac",
        "Sng",
        0,
        [-1, -1],
        [50.0, 60.0],  # beyond the 42.5 keV maximum of the calibration
        2,
        0.0,
    )
    assert list(result[0]["values"]) == [52.5, 57.5]
    assert list(result[1]["values"]) == [0.0, 0.0]


def test_rms_spectrum_requires_events_with_energies():
    """Wrong dataset types and E-less datasets are reported in warnmsg."""
    result = DaveEngine.get_rms_spectrum(
        _resource("Test_Input_2.lc"), "", "", [], EVENTS_AXIS, 16.0, 1, 0, "frac", "Sng", 0,
        [-1, -1], [-1, -1], 2, 0.0,
    )
    assert result[3]["values"] == ["Wrong dataset type"]

    empty_filter = [{"table": "EVENTS", "column": "TIME", "from": -100.0, "to": -50.0}]
    result = DaveEngine.get_rms_spectrum(
        _data("monol_testA.evt"), "", "", empty_filter, EVENTS_AXIS, 16.0, 1, 0, "frac", "Sng", 0,
        [-1, -1], [-1, -1], 2, 0.0,
    )
    assert result[3]["values"] == ["No events data"]


def test_rms_vs_countrate_validation_and_auto_white_noise(calibrated_events):
    """Axis validation, wrong-type reporting and the auto white-noise path
    of the rms-vs-countrate analysis."""
    np.random.seed(0)  # noqa: NPY002 -- stingray uses the legacy global RNG internally
    assert "error" in DaveEngine.get_rms_vs_countrate(
        calibrated_events, "", "", [], EVENTS_AXIS[:1], 16.0, 2, 0, [-1, -1], [-1, -1], 0.0
    )

    result = DaveEngine.get_rms_vs_countrate(
        _resource("Test_Input_2.lc"), "", "", [], EVENTS_AXIS, 16.0, 2, 0, [-1, -1], [-1, -1], 0.0
    )
    assert result[3]["values"] == ["Wrong dataset type"]

    result = DaveEngine.get_rms_vs_countrate(
        calibrated_events, "", "", [], EVENTS_AXIS, 1.0, 2, 0, [-1, -1], [-1, -1], -200.0
    )
    countrates = result[0]["values"]
    assert len(countrates) > 0
    assert list(countrates) == sorted(countrates)


# ---------- phase lag spectrum ----------


def test_phase_lag_spectrum_with_auto_ranges(calibrated_events):
    """Energy and frequency ranges of [-1, -1] fall back to the data limits;
    the lag of a single (undelayed) event list is small."""
    result = DaveEngine.get_phase_lag_spectrum(
        calibrated_events,
        "",
        "",
        [],
        EVENTS_AXIS,
        1.0,
        1,
        256.0,
        "leahy",
        "Avg",
        0,
        [-1, -1],
        [-1, -1],
        2,
    )
    energies = result[0]["values"]
    assert len(energies) == 2
    lags = result[1]["values"]
    assert len(lags) == 2
    freq_min, freq_max = result[4]["values"]
    assert 0 < freq_min < freq_max <= 0.5  # bounded by Nyquist of dt=1


def test_phase_lag_spectrum_validation_matrix():
    """Axis, norm, type, dataset type and empty selections are validated."""
    destination = _data("monol_testA.evt")
    assert "error" in DaveEngine.get_phase_lag_spectrum(
        destination, "", "", [], EVENTS_AXIS[:1], 16.0, 1, 0, "leahy", "Avg", 0, [-1, -1], [-1, -1], 2
    )
    assert "error" in DaveEngine.get_phase_lag_spectrum(
        destination, "", "", [], EVENTS_AXIS, 16.0, 1, 0, "bogus", "Avg", 0, [-1, -1], [-1, -1], 2
    )
    assert "error" in DaveEngine.get_phase_lag_spectrum(
        destination, "", "", [], EVENTS_AXIS, 16.0, 1, 0, "leahy", "Bogus", 0, [-1, -1], [-1, -1], 2
    )

    result = DaveEngine.get_phase_lag_spectrum(
        _resource("Test_Input_2.lc"), "", "", [], EVENTS_AXIS, 16.0, 1, 0, "leahy", "Avg", 0,
        [-1, -1], [-1, -1], 2,
    )
    assert result[3]["values"] == ["Wrong dataset type"]

    empty_filter = [{"table": "EVENTS", "column": "TIME", "from": -100.0, "to": -50.0}]
    result = DaveEngine.get_phase_lag_spectrum(
        destination, "", "", empty_filter, EVENTS_AXIS, 16.0, 1, 0, "leahy", "Avg", 0,
        [-1, -1], [-1, -1], 2,
    )
    assert result[3]["values"] == ["No events data"]


# ---------- fitting ----------


def test_bayesian_fit_with_mcmc_sampling():
    """A uniform prior plus sampling parameters requests posterior MCMC
    sampling. Stingray delegates the sampling to the optional emcee package:
    with emcee installed the result gains a sample-statistics block, without
    it the whole fit degrades to an empty result (the ImportError is caught
    by the engine's defensive handler). Both worlds are asserted so the test
    is honest on every CI platform.
    """
    import importlib.util

    np.random.seed(42)  # noqa: NPY002 -- emcee/stingray use the legacy global RNG
    results = DaveEngine.get_fit_powerspectrum_result(
        _resource("test.evt"),
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        1,
        0,
        "leahy",
        "Sng",
        0,
        [{"type": "Const", "amplitude": 2.0}],
        priors=[{"amplitude": {"type": "uniform", "min": 0.1, "max": 10.0}}],
        sampling_params={"nwalkers": 8, "niter": 30, "burnin": 20, "threads": 1, "nsamples": 100},
    )
    if importlib.util.find_spec("emcee") is None:
        assert results == []
    else:
        params = results[0]["values"]
        assert params[0]["name"] == "amplitude"
        assert params[0]["opt"] == pytest.approx(2.0, abs=1.0)
        sample_stats = results[2]["values"]
        assert 0.0 <= sample_stats["acceptance"] <= 1.0


def test_bayesian_fit_without_sampling_skips_the_sample_block():
    """Priors without sampling parameters run the MAP fit only: the result
    holds parameters and statistics but no sample summary."""
    np.random.seed(42)  # noqa: NPY002 -- stingray jitters fits via the global RNG
    results = DaveEngine.get_fit_powerspectrum_result(
        _resource("test.evt"),
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        1,
        0,
        "leahy",
        "Sng",
        0,
        [{"type": "Const", "amplitude": 2.0}],
        priors=[{"amplitude": {"type": "uniform", "min": 0.1, "max": 10.0}}],
    )
    assert len(results) == 2  # params + stats, no sample stats


def test_fit_with_unusable_priors_falls_back_to_maximum_likelihood():
    """Priors that produce no usable distributions are dropped with a warn
    and the fit proceeds as maximum likelihood."""
    np.random.seed(42)  # noqa: NPY002 -- stingray jitters fits via the global RNG
    results = DaveEngine.get_fit_powerspectrum_result(
        _resource("test.evt"),
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        1,
        0,
        "leahy",
        "Sng",
        0,
        [{"type": "Const", "amplitude": 2.0}],
        priors=[{"amplitude": {"type": "unknown-dist"}}],
    )
    params = results[0]["values"]
    assert params[0]["opt"] == pytest.approx(2.0, abs=1.0)


def test_fit_powerspectrum_with_unreadable_file_returns_no_results():
    """Without a PDS there is nothing to fit."""
    results = DaveEngine.get_fit_powerspectrum_result(
        os.path.join(TEST_RESOURCES, "nope.evt"),
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        1,
        0,
        "leahy",
        "Sng",
        0,
        [{"type": "Const", "amplitude": 2.0}],
    )
    assert results == []


def test_get_plot_data_from_models_reports_malformed_model():
    """A model spec missing its parameters surfaces as a common error."""
    assert "error" in DaveEngine.get_plot_data_from_models([{"type": "Const"}], [0.0, 1.0])


# ---------- bootstrap ----------


def test_bootstrap_runs_simulator_but_yields_no_parameters():
    """The bootstrap loop simulates spectra, but the fitting step is not
    implemented in the engine, so no parameter distributions are produced.
    mean<=0 falls back to the lightcurve mean rate and seed<0 to a random
    simulator state."""
    results = DaveEngine.get_bootstrap_results(
        _resource("test.evt"),
        "",
        "",
        [],
        EVENTS_AXIS,
        16.0,
        1,
        256.0,
        "leahy",
        "Sng",
        0,
        [{"type": "Const", "amplitude": 2.0}],
        1,
        -1.0,
        1,
        -1,
    )
    assert results == []


def test_bootstrap_without_models_or_data_yields_no_results():
    """Missing models or an unreadable source both end with no results."""
    assert (
        DaveEngine.get_bootstrap_results(
            _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, 1, 256.0, "leahy", "Sng", 0,
            [], 1, 1.0, 1, 1,
        )
        == []
    )
    assert (
        DaveEngine.get_bootstrap_results(
            os.path.join(TEST_RESOURCES, "nope.evt"), "", "", [], EVENTS_AXIS, 16.0, 1, 256.0,
            "leahy", "Sng", 0, [{"type": "Const", "amplitude": 2.0}], 1, 1.0, 1, 1,
        )
        == []
    )


# ---------- Lomb-Scargle ----------


def test_lomb_scargle_auto_frequency_range():
    """freq_range [-1, -1] derives the window from the lightcurve: minimum
    0.6/T_obs and maximum 0.6/dt."""
    result = DaveEngine.get_lomb_scargle_results(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, [-1, -1], 1, "standard", 2
    )
    frequencies = np.array(result[0]["values"])
    assert len(frequencies) > 0
    assert frequencies.min() >= 0.6 / 1024.0 - 1e-9
    assert frequencies.max() <= 0.6 / 16.0 + 1e-9
    assert result[2]["values"] == [1024.0]


def test_lomb_scargle_validation_errors():
    """Axis count and unreadable sources are refused."""
    assert "error" in DaveEngine.get_lomb_scargle_results(
        _resource("test.evt"), "", "", [], EVENTS_AXIS[:1], 16.0, [-1, -1], 1, "standard", 2
    )
    result = DaveEngine.get_lomb_scargle_results(
        os.path.join(TEST_RESOURCES, "nope.evt"), "", "", [], EVENTS_AXIS, 16.0, [-1, -1], 1,
        "standard", 2,
    )
    assert "error" in result


def test_lomb_scargle_warns_on_overridden_bin_size():
    """A dt that conflicts with a binned lightcurve file is reported."""
    result = DaveEngine.get_lomb_scargle_results(
        _resource("Test_Input_2.lc"), "", "", [], EVENTS_AXIS, 16.0, [0.001, 0.03], 1, "standard", 2
    )
    assert result[3]["values"][0].startswith("@WARN@Overriden Bin Size")


def test_fit_lomb_scargle_rejects_unreadable_source():
    """Without a lightcurve there is no periodogram to fit."""
    result = DaveEngine.get_fit_lomb_scargle_result(
        os.path.join(TEST_RESOURCES, "nope.evt"), "", "", [], EVENTS_AXIS, 16.0, [0.001, 0.03],
        1, "standard", 2, [{"type": "Const", "amplitude": 1.0}],
    )
    assert result["error"] == "Can't create lightcurve or is empty"


# ---------- pulse search / phaseogram ----------


def test_pulse_search_epoch_folding_mode():
    """The epoch-folding mode scans the same frequency grid as z_n."""
    result = DaveEngine.get_pulse_search(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, [0.1, 0.2],
        "epoch_folding", 5, 1, 16, 5000,
    )
    frequencies = np.array(result[0]["values"])
    assert len(frequencies) > 0
    assert frequencies.min() >= 0.1 and frequencies.max() <= 0.2
    assert len(result[1]["values"]) == len(frequencies)


def test_pulse_search_falls_back_to_z_n_for_unknown_mode():
    """An unknown mode is replaced by z_n_search instead of failing."""
    result = DaveEngine.get_pulse_search(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, [0.1, 0.12], "bogus", 5, 1, 16, 5000
    )
    assert len(result[0]["values"]) > 0


def test_pulse_search_weights_lightcurve_datasets():
    """For binned lightcurves the RATE values weight the search."""
    result = DaveEngine.get_pulse_search(
        _resource("Test_Input_2.lc"), "", "", [], RATE_AXIS, 1.0, [0.001, 0.0012],
        "z_n_search", 2, 1, 16, 20000,
    )
    assert len(result[0]["values"]) > 0


def test_pulse_search_validation_errors():
    """Axis count and unreadable datasets are refused."""
    assert "error" in DaveEngine.get_pulse_search(
        _resource("test.evt"), "", "", [], EVENTS_AXIS[:1], 16.0, [0.1, 0.2], "z_n_search", 5, 1, 16, 5000
    )
    assert "error" in DaveEngine.get_pulse_search(
        os.path.join(TEST_RESOURCES, "nope.evt"), "", "", [], EVENTS_AXIS, 16.0, [0.1, 0.2],
        "z_n_search", 5, 1, 16, 5000,
    )


def test_phaseogram_with_binary_parameters_applies_orbital_delay():
    """Binary parameters (orbital period, a sin i, T0) delay-correct the
    event times before folding; the result keeps the standard layout."""
    result = DaveEngine.get_phaseogram(
        _resource("test.evt"), "", "", [], EVENTS_AXIS, 16.0, 0.15, 8, 4, 0.0, 0.0,
        [500.0, 0.5, 100.0],
    )
    assert len(result[1]["values"]) == 17
    assert len(result[3]["values"]) == 16
    assert len(result[4]["values"]) == 16


def test_phaseogram_weights_lightcurve_datasets():
    """Binned lightcurves fold their RATE values instead of raw events."""
    result = DaveEngine.get_phaseogram(
        _resource("Test_Input_2.lc"), "", "", [], RATE_AXIS, 1.0, 0.001, 8, 4, 0.0, 0.0, None
    )
    assert len(result[3]["values"]) == 16
    assert sum(result[4]["values"]) > 0


def test_phaseogram_validation_errors():
    """Axis count and unreadable datasets are refused."""
    assert "error" in DaveEngine.get_phaseogram(
        _resource("test.evt"), "", "", [], EVENTS_AXIS[:1], 16.0, 0.15, 8, 4, 0.0, 0.0, None
    )
    assert "error" in DaveEngine.get_phaseogram(
        os.path.join(TEST_RESOURCES, "nope.evt"), "", "", [], EVENTS_AXIS, 16.0, 0.15, 8, 4,
        0.0, 0.0, None,
    )


def test_covariance_spectrum_with_malformed_reference_band(calibrated_events):
    """A reference band the covariance computation cannot digest surfaces
    as a common error instead of a crash."""
    result = DaveEngine.get_covariance_spectrum(
        calibrated_events, "", "", [], 16.0, "bogus", [2.0, 10.0], 2, -1
    )
    assert "error" in result


def test_phase_lag_spectrum_with_malformed_freq_range(calibrated_events):
    """A None freq_range fails after the PDS is built and lands in warnmsg."""
    result = DaveEngine.get_phase_lag_spectrum(
        calibrated_events, "", "", [], EVENTS_AXIS, 1.0, 1, 256.0, "leahy", "Avg", 0,
        None, [-1, -1], 2,
    )
    assert result[3]["values"][0] != ""


# ---------- BACKSCAL-scaled backgrounds ----------


def test_background_subtraction_applies_backscale_ratio(tmp_path):
    """When source and background carry BACKSCAL keywords, the background is
    scaled by their ratio before subtraction. With identical data and a
    src/bck backscale ratio of 2, the net count rate equals -1x the raw one
    (src - 2*src = -src)."""
    source = str(tmp_path / "src_backscal.lc")
    background = str(tmp_path / "bck_backscal.lc")
    for path, backscal in ((source, 2), (background, 1)):
        with fits.open(_resource("Test_Input_2.lc")) as hdulist:
            hdulist["RATE"].header["BACKSCAL"] = backscal
            hdulist.writeto(path)

    plain = DaveEngine.get_lightcurve(
        source, "", "", [], EVENTS_AXIS, 1.0,
        {"niter": 0, "lam": 1000, "p": 0.01}, {"niter": 0, "lam": 1000, "p": 0.01}, None,
    )
    subtracted = DaveEngine.get_lightcurve(
        source, background, "", [], EVENTS_AXIS, 1.0,
        {"niter": 0, "lam": 1000, "p": 0.01}, {"niter": 0, "lam": 1000, "p": 0.01}, None,
    )
    # The stingray subtraction trims a few GTI-edge bins; compare the bins
    # both light curves share, matched by their time stamps.
    raw_by_time = dict(zip(plain[0]["values"], plain[1]["values"], strict=True))
    net_times = subtracted[0]["values"]
    net = np.array(subtracted[1]["values"])
    raw = np.array([raw_by_time[time] for time in net_times])
    assert len(net) > 10000
    assert net == pytest.approx(-raw, rel=1e-6)
