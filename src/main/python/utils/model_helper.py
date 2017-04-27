
from astropy.modeling.models import Gaussian1D, Lorentz1D
from astropy.modeling.powerlaws import PowerLaw1D, BrokenPowerLaw1D
from stingray.modeling import ParameterEstimation
from stingray.modeling import PSDLogLikelihood


# get_astropy_model:
# Returns an astropy.models object from a given Dave Model specification
#
# @param: model: Dave Model specification
#
def get_astropy_model(model):
    if model["type"] == "Gaussian":
         return Gaussian1D(model["amplitude"], model["mean"], model["stddev"])

    elif model["type"] == "Lorentz":
         return Lorentz1D(model["amplitude"], model["x_0"], model["fwhm"])

    elif model["type"] == "PowerLaw":
         return PowerLaw1D(model["amplitude"], model["x_0"], model["alpha"])

    elif model["type"] == "BrokenPowerLaw":
         return BrokenPowerLaw1D(model["amplitude"], model["x_break"], model["alpha_1"], model["alpha_2"])

    else:
         return None


# get_astropy_model:
# Returns a tuple with the astropy.models object from a given Dave Models specifications
# and the initial guesses array
#
# @param: model: array with the Dave Models specifications
#
def get_astropy_model_from_dave_models(models):
    fit_model = None
    starting_pars = []

    for i in range(len(models)):

        model = models[i]
        model_obj = get_astropy_model(model)
        if model_obj:

            if model["type"] == "Gaussian":
                 starting_pars.extend([model["amplitude"], model["mean"], model["stddev"]])
            elif model["type"] == "Lorentz":
                 starting_pars.extend([model["amplitude"], model["x_0"], model["fwhm"]])
            elif model["type"] == "PowerLaw":
                 starting_pars.extend([model["amplitude"], model["x_0"], model["alpha"]])
            elif model["type"] == "BrokenPowerLaw":
                 starting_pars.extend([model["amplitude"], model["x_break"], model["alpha_1"], model["alpha_2"]])

            if not fit_model:
                fit_model = model_obj
            else:
                fit_model += model_obj

    return fit_model, starting_pars


# fit_data_with_gaussian:
# Returns the optimized parammeters for a Gaussian that fits the given array data
#
# @param: x_values: array data whit the x values to fit with the Gaussian
# @param: y_values: array data whit the x values to fit with the Gaussian
# @param: amplitude: initial guess for amplitude parammeter of the Gaussian
# @param: mean: initial guess for mean parammeter of the Gaussian
# @param: stddev: initial guess for stddev parammeter of the Gaussian
#
def fit_data_with_gaussian(x_values, y_values, amplitude=1., mean=0, stddev=1.):
    g_init = Gaussian1D(amplitude, mean, stddev)
    lpost = PSDLogLikelihood(x_values, y_values, g_init)
    parest = ParameterEstimation()
    res = parest.fit(lpost, [amplitude, mean, stddev], neg=True)
    opt_amplitude = res.p_opt[0]
    opt_mean = res.p_opt[1]
    opt_stddev = res.p_opt[2]
    return opt_amplitude, opt_mean, opt_stddev
