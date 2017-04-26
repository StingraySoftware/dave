
from astropy.modeling.models import Gaussian1D, Lorentz1D
from astropy.modeling.powerlaws import PowerLaw1D, BrokenPowerLaw1D

# get_astropy_model:
# Returns and astropy.models object from a given Dave Model specification
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
