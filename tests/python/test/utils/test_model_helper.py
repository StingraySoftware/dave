"""Tests for utils.model_helper.

model_helper translates DAVE GUI model specifications into astropy models,
builds priors for Bayesian fits, and provides the Gaussian/Lorentzian
fitting helpers used by the bootstrap and white-noise estimators.
"""

import numpy as np
import pytest
import scipy.stats
from astropy.modeling.models import Const1D, Gaussian1D, Lorentz1D
from astropy.modeling.powerlaws import BrokenPowerLaw1D, PowerLaw1D

import utils.model_helper as ModelHelper

# ---------- get_astropy_model ----------


@pytest.mark.parametrize(
    ("dave_model", "expected_cls", "expected_params"),
    [
        ({"type": "Const", "amplitude": 2.0}, Const1D, {"amplitude": 2.0}),
        (
            {"type": "Gaussian", "amplitude": 3.0, "mean": 1.0, "stddev": 0.5},
            Gaussian1D,
            {"amplitude": 3.0, "mean": 1.0, "stddev": 0.5},
        ),
        (
            {"type": "Lorentz", "amplitude": 4.0, "x_0": 2.0, "fwhm": 0.3},
            Lorentz1D,
            {"amplitude": 4.0, "x_0": 2.0, "fwhm": 0.3},
        ),
        (
            {"type": "PowerLaw", "amplitude": 5.0, "x_0": 1.0, "alpha": 2.0},
            PowerLaw1D,
            {"amplitude": 5.0, "x_0": 1.0, "alpha": 2.0},
        ),
        (
            {
                "type": "BrokenPowerLaw",
                "amplitude": 6.0,
                "x_break": 1.5,
                "alpha_1": 1.0,
                "alpha_2": 2.0,
            },
            BrokenPowerLaw1D,
            {"amplitude": 6.0, "x_break": 1.5, "alpha_1": 1.0, "alpha_2": 2.0},
        ),
    ],
)
def test_get_astropy_model_maps_every_supported_type(dave_model, expected_cls, expected_params):
    """Each DAVE model type maps to its astropy class with the given params."""
    model = ModelHelper.get_astropy_model(dave_model)
    assert isinstance(model, expected_cls)
    for name, value in expected_params.items():
        assert getattr(model, name).value == value


def test_get_astropy_model_returns_none_for_unknown_type():
    """An unrecognized model type produces no model at all."""
    assert ModelHelper.get_astropy_model({"type": "Sine", "amplitude": 1.0}) is None


def test_fixed_parameters_are_marked_fixed_on_the_astropy_model():
    """Params listed in 'fixed' must be frozen for the fit."""
    model = ModelHelper.get_astropy_model(
        {"type": "Gaussian", "amplitude": 3.0, "mean": 1.0, "stddev": 0.5, "fixed": ["mean"]}
    )
    assert model.mean.fixed is True
    assert model.amplitude.fixed is False


# ---------- starting params / compound models ----------


def test_get_starting_params_excludes_fixed_parameters():
    """Fixed params are not part of the optimizer's starting vector."""
    model = {"type": "Gaussian", "amplitude": 3.0, "mean": 1.0, "stddev": 0.5, "fixed": ["mean"]}
    params = ModelHelper.get_starting_params_from_model(model, ["amplitude", "mean", "stddev"])
    assert params == [3.0, 0.5]


def test_get_starting_params_without_fixed_returns_all():
    """Without a 'fixed' list every requested param is included, in order."""
    model = {"type": "Gaussian", "amplitude": 3.0, "mean": 1.0, "stddev": 0.5}
    params = ModelHelper.get_starting_params_from_model(model, ["amplitude", "mean", "stddev"])
    assert params == [3.0, 1.0, 0.5]


def test_get_astropy_model_from_dave_models_builds_compound_sum():
    """Multiple specs combine into a summed model with concatenated params."""
    fit_model, starting_pars = ModelHelper.get_astropy_model_from_dave_models(
        [
            {"type": "Const", "amplitude": 2.0},
            {"type": "Lorentz", "amplitude": 4.0, "x_0": 2.0, "fwhm": 0.3},
        ]
    )
    assert fit_model.n_submodels == 2
    assert starting_pars == [2.0, 4.0, 2.0, 0.3]
    # The compound model evaluates as the sum of its parts.
    assert fit_model(2.0) == pytest.approx(Const1D(2.0)(2.0) + Lorentz1D(4.0, 2.0, 0.3)(2.0))


def test_get_astropy_model_from_dave_models_covers_all_types_and_skips_unknown():
    """All five types contribute their params; unknown specs are skipped."""
    fit_model, starting_pars = ModelHelper.get_astropy_model_from_dave_models(
        [
            {"type": "Gaussian", "amplitude": 3.0, "mean": 1.0, "stddev": 0.5},
            {"type": "PowerLaw", "amplitude": 5.0, "x_0": 1.0, "alpha": 2.0},
            {
                "type": "BrokenPowerLaw",
                "amplitude": 6.0,
                "x_break": 1.5,
                "alpha_1": 1.0,
                "alpha_2": 2.0,
            },
            {"type": "Unknown", "amplitude": 9.0},
        ]
    )
    assert fit_model.n_submodels == 3
    assert starting_pars == [3.0, 1.0, 0.5, 5.0, 1.0, 2.0, 6.0, 1.5, 1.0, 2.0]


def test_get_astropy_model_from_dave_models_empty_input():
    """No specs at all produce no model and no starting params."""
    fit_model, starting_pars = ModelHelper.get_astropy_model_from_dave_models([])
    assert fit_model is None
    assert starting_pars == []


# ---------- priors ----------


def test_uniform_prior_evaluates_inside_and_outside_range():
    """A uniform prior is truthy inside [min, max] and falsy outside."""
    priors = ModelHelper.get_astropy_priors([{"amplitude": {"type": "uniform", "min": 0, "max": 5}}])
    assert set(priors) == {"amplitude"}
    assert bool(priors["amplitude"](3.0)) is True
    assert bool(priors["amplitude"](6.0)) is False


def test_normal_prior_matches_scipy_pdf():
    """A normal prior evaluates to the scipy norm pdf with the given params."""
    priors = ModelHelper.get_astropy_priors(
        [{"mean": {"type": "normal", "mean": 1.0, "sigma": 2.0}}]
    )
    assert priors["mean"](0.5) == pytest.approx(scipy.stats.norm(1.0, 2.0).pdf(0.5))


def test_lognormal_prior_matches_scipy_pdf():
    """A lognormal prior evaluates to the scipy lognorm pdf as coded."""
    priors = ModelHelper.get_astropy_priors(
        [{"stddev": {"type": "lognormal", "mean": 0.5, "sigma": 0.0}}]
    )
    assert priors["stddev"](1.5) == pytest.approx(scipy.stats.lognorm(0.5, 0.0).pdf(1.5))


def test_priors_for_multiple_models_get_indexed_keys():
    """With several model specs the prior keys are suffixed _0, _1, ..."""
    priors = ModelHelper.get_astropy_priors(
        [
            {"amplitude": {"type": "uniform", "min": 0, "max": 5}},
            {"amplitude": {"type": "uniform", "min": 1, "max": 2}},
        ]
    )
    assert set(priors) == {"amplitude_0", "amplitude_1"}


def test_malformed_priors_produce_no_entries():
    """Missing bounds/params, unknown types and missing 'type' are all skipped."""
    priors = ModelHelper.get_astropy_priors(
        [
            {
                "a": {"type": "uniform", "min": 0},  # missing max
                "b": {"type": "normal", "mean": 1.0},  # missing sigma
                "c": {"type": "lognormal", "sigma": 1.0},  # missing mean
                "d": {"type": "cauchy"},  # unknown type
                "e": {"min": 0, "max": 1},  # no type key
            }
        ]
    )
    assert priors == {}


# ---------- fitting helpers ----------


def test_fit_data_with_gaussian_moves_towards_true_peak():
    """Fitting a clean Gaussian curve recovers the peak location.

    PSDLogLikelihood models y as exponentially-distributed periodogram powers,
    so parameter recovery is approximate; we assert the optimizer converged
    near the true mean (2.0) starting from an offset guess.
    """
    x_values = np.linspace(0.5, 4.0, 60)
    y_values = Gaussian1D(6.0, 2.0, 0.5)(x_values) + 0.1
    amplitude, mean, stddev = ModelHelper.fit_data_with_gaussian(
        x_values, y_values, amplitude=5.0, mean=1.5, stddev=0.8
    )
    assert np.isfinite([amplitude, mean, stddev]).all()
    assert mean == pytest.approx(2.0, abs=0.5)


def test_fit_data_with_lorentz_and_const_recovers_white_noise_level():
    """On pure Poisson (Leahy) noise the constant term is the white-noise level.

    Provenance: Leahy-normalized powers of Poisson noise follow an exponential
    distribution with mean 2, which is exactly what get_white_noise_offset
    relies on; the fitted constant must land near 2.
    """
    rng = np.random.default_rng(42)
    x_values = np.linspace(0.05, 10.0, 400)
    y_values = rng.exponential(2.0, size=x_values.size)
    amplitude, x_0, fwhm, const = ModelHelper.fit_data_with_lorentz_and_const(x_values, y_values)
    assert np.isfinite([amplitude, x_0, fwhm, const]).all()
    assert const == pytest.approx(2.0, abs=0.7)
