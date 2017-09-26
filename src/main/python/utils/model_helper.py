import utils.dave_logger as logging
from astropy.modeling.models import Gaussian1D, Lorentz1D
from astropy.modeling.powerlaws import PowerLaw1D, BrokenPowerLaw1D
from stingray.modeling import ParameterEstimation, PSDLogLikelihood
import scipy.stats



# get_astropy_model:
# Returns an astropy.models object from a given Dave Model specification
#
# @param: model: Dave Model specification
#
def get_astropy_model(model):
    astropy_model = None

    if model["type"] == "Gaussian":
         astropy_model = Gaussian1D(model["amplitude"], model["mean"], model["stddev"])

    elif model["type"] == "Lorentz":
         astropy_model = Lorentz1D(model["amplitude"], model["x_0"], model["fwhm"])

    elif model["type"] == "PowerLaw":
         astropy_model = PowerLaw1D(model["amplitude"], model["x_0"], model["alpha"])

    elif model["type"] == "BrokenPowerLaw":
         astropy_model = BrokenPowerLaw1D(model["amplitude"], model["x_break"], model["alpha_1"], model["alpha_2"])

    if astropy_model:
         astropy_model = fix_parammeters_to_astropy_model(astropy_model, model)

    return astropy_model


# fix_parammeters_to_astropy_model:
# Returns an astropy.models object with the fixed parammeters set on dave model
#
# @param: astropy_model: The astropy model
# @param: model: Dave Model specification
#
def fix_parammeters_to_astropy_model(astropy_model, model):
    if "fixed" in model:
        for param in model["fixed"]:
            getattr(astropy_model, param).fixed = True
    return astropy_model


# get_starting_params_from_model:
# Returns an list of starting params (without the fixed params on dave model)<- Commented
#
# @param: model: Dave Model specification
# @param: params: list of starting params
#
def get_starting_params_from_model(model, params):
    starting_pars = []
    for param in params:
        if "fixed" in model:
            if param not in model["fixed"]:
                starting_pars.extend([model[param]]);
        else:
            starting_pars.extend([model[param]]);
    return starting_pars


# get_astropy_model_from_dave_models:
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
                 starting_pars.extend(get_starting_params_from_model(model, ["amplitude", "mean", "stddev"]))
            elif model["type"] == "Lorentz":
                 starting_pars.extend(get_starting_params_from_model(model, ["amplitude", "x_0", "fwhm"]))
            elif model["type"] == "PowerLaw":
                 starting_pars.extend(get_starting_params_from_model(model, ["amplitude", "x_0", "alpha"]))
            elif model["type"] == "BrokenPowerLaw":
                 starting_pars.extend(get_starting_params_from_model(model, ["amplitude", "x_break", "alpha_1", "alpha_2"]))

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


# get_astropy_priors
# Returns a dictionary with the priors. A dict of form {"parameter name": function}
# A dictionary with the definitions for the prior probabilities.
#
# @param: dave_priors: array of priors, dave_priors defined for each model parammeters
#
def get_astropy_priors(dave_priors):
    priors = {}

    num_models = len(dave_priors)
    for i in range(num_models):
        model_params = dave_priors[i]

        for paramName in model_params.keys():

            if num_models > 1:
                prior_key = str(paramName) + "_" + str(i)
            else:
                prior_key = str(paramName)
                
            model_param = model_params[paramName]

            if "type" in model_param:
                if model_param["type"] == "uniform":
                    if ("min" in model_param) and ("max" in model_param):
                        priors[prior_key] = lambda value, min=float(model_param["min"]), max=float(model_param["max"]): ((min <= value) & (value <= max))
                    else:
                        logging.warn("get_astropy_priors: Wrong uniform prior parammeters, prior_key: " + prior_key)

                elif model_param["type"] == "normal":
                    if ("mean" in model_param) and ("sigma" in model_param):
                        priors[prior_key] = lambda value, mean=float(model_param["mean"]), sigma=float(model_param["sigma"]): scipy.stats.norm(mean, sigma).pdf(value)
                    else:
                        logging.warn("get_astropy_priors: Wrong normal prior parammeters, prior_key: " + prior_key)

                elif model_param["type"] == "lognormal":
                    if ("mean" in model_param) and ("sigma" in model_param):
                        priors[prior_key] = lambda value, mean=float(model_param["mean"]), sigma=float(model_param["sigma"]): scipy.stats.lognorm(mean, sigma).pdf(value)
                    else:
                        logging.warn("get_astropy_priors: Wrong lognormal prior parammeters, prior_key: " + prior_key)

                else:
                    logging.warn("get_astropy_priors: Unknown prior 'type', prior_key: " + prior_key + ", type: " + model_param["type"])
            else:
                logging.warn("get_astropy_priors: can't find 'type' key on dave_priors, prior_key: " + prior_key)

    return priors
