from maltpynt.lcurve import lcurve_from_fits as mp_lcurve_from_fits
from maltpynt.io import load_data


def lcurve_from_fits(fits_file, **kwargs):
    """
    Load a lightcurve from a fits file and return dict.
    .. note ::
        FITS light curve handling is still under testing.
        Absolute times might be incorrect depending on the light curve format.

    Parameters
    ----------
    fits_file : str
        File name of the input light curve in FITS format

    Returns
    -------
    dict :
        Returned dict with the light curve parammeters

    Other Parameters
    ----------------
    kwargs : keyword arguments
        Additional arguments to be passed to `maltpynt.lcurve.lcurve_from_fits`
    """

    outfile = mp_lcurve_from_fits(fits_file, **kwargs)[0]

    out = load_data(outfile)
    return out

