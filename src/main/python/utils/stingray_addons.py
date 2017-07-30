import numpy as np
from stingray.io import high_precision_keyword_read
import os
import utils.dave_logger as logging


def lcurve_from_fits(fits_file, gtistring='GTI',
                     timecolumn='TIME', ratecolumn=None, ratehdu=1,
                     fracexp_limit=0.9):
    """
    Load a lightcurve from a fits file and returns dict.
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
    gtistring : str
        Name of the GTI extension in the FITS file
    timecolumn : str
        Name of the column containing times in the FITS file
    ratecolumn : str
        Name of the column containing rates in the FITS file
    ratehdu : str or int
        Name or index of the FITS extension containing the light curve
    fracexp_limit : float
        Minimum exposure fraction allowed
    """
    logging.warn(
        """WARNING! FITS light curve handling is still under testing.
        Absolute times might be incorrect.""")
    # TODO:
    # treat consistently TDB, UTC, TAI, etc. This requires some documentation
    # reading. For now, we assume TDB
    from astropy.io import fits as pf
    from astropy.time import Time
    import numpy as np

    lchdulist = pf.open(fits_file)
    lctable = lchdulist[ratehdu].data

    # Units of header keywords
    tunit = lchdulist[ratehdu].header['TIMEUNIT']

    try:
        mjdref = high_precision_keyword_read(lchdulist[ratehdu].header,
                                             'MJDREF')
        mjdref = Time(mjdref, scale='tdb', format='mjd')
    except:
        mjdref = None

    try:
        instr = lchdulist[ratehdu].header['INSTRUME']
    except:
        instr = 'EXTERN'

    # ----------------------------------------------------------------
    # Trying to comply with all different formats of fits light curves.
    # It's a madness...
    try:
        tstart = high_precision_keyword_read(lchdulist[ratehdu].header,
                                             'TSTART')
        tstop = high_precision_keyword_read(lchdulist[ratehdu].header,
                                            'TSTOP')
    except:
        raise(Exception('TSTART and TSTOP need to be specified'))

    # For nulccorr lcs this whould work
    try:
        timezero = high_precision_keyword_read(lchdulist[ratehdu].header,
                                               'TIMEZERO')
        if not timezero:
            timezero = 0
        # Sometimes timezero is "from tstart", sometimes it's an absolute time.
        # This tries to detect which case is this, and always consider it
        # referred to tstart
    except:
        timezero = 0

    # for lcurve light curves this should instead work
    if tunit == 'd':
        # TODO:
        # Check this. For now, I assume TD (JD - 2440000.5).
        # This is likely wrong
        timezero = Time(2440000.5 + timezero, scale='tdb', format='jd')
        tstart = Time(2440000.5 + tstart, scale='tdb', format='jd')
        tstop = Time(2440000.5 + tstop, scale='tdb', format='jd')
        # if None, use NuSTAR defaulf MJDREF
        mjdref = _assign_value_if_none(
            mjdref, Time(np.longdouble('55197.00076601852'), scale='tdb',
                         format='mjd'))

        timezero = (timezero - mjdref).to('s').value
        tstart = (tstart - mjdref).to('s').value
        tstop = (tstop - mjdref).to('s').value

    if timezero > tstart:
        timezero -= tstart

    time = np.array(lctable.field(timecolumn), dtype=np.longdouble)
    if time[-1] < tstart:
        time += timezero + tstart
    else:
        time += timezero

    try:
        dt = high_precision_keyword_read(lchdulist[ratehdu].header,
                                         'TIMEDEL')
        if tunit == 'd':
            dt *= 86400
    except:
        logging.warn('Assuming that TIMEDEL is the difference between the'
                      ' first two times of the light curve')
        dt = time[1] - time[0]

    # ----------------------------------------------------------------
    ratecolumn = _assign_value_if_none(
        ratecolumn,
        _look_for_array_in_array(['RATE', 'RATE1', 'COUNTS'], lctable.names))

    rate = np.array(lctable.field(ratecolumn), dtype=np.float)

    try:
        rate_e = np.array(lctable.field('ERROR'), dtype=np.longdouble)
    except:
        rate_e = np.zeros_like(rate)

    if 'RATE' in ratecolumn:
        rate *= dt
        rate_e *= dt

    try:
        fracexp = np.array(lctable.field('FRACEXP'), dtype=np.longdouble)
    except:
        fracexp = np.ones_like(rate)

    good_intervals = np.logical_and(fracexp >= fracexp_limit, fracexp <= 1)
    good_intervals = (rate == rate) * (fracexp >= fracexp_limit) * \
        (fracexp <= 1)

    rate[good_intervals] /= fracexp[good_intervals]
    rate_e[good_intervals] /= fracexp[good_intervals]

    rate[np.logical_not(good_intervals)] = 0

    try:
        gtitable = lchdulist[gtistring].data
        gti_list = np.column_stack((gtitable.field('START'),
                                    gtitable.field('STOP')))
    except:
        gti_list = create_gti_from_condition(time, good_intervals)

    lchdulist.close()

    out = {}
    out['lc'] = rate
    out['elc'] = rate_e
    out['time'] = time
    out['dt'] = dt
    out['GTI'] = gti_list
    out['Tstart'] = tstart
    out['Tstop'] = tstop
    out['Instr'] = instr

    out['MJDref'] = mjdref.value

    out['total_ctrate'] = calc_countrate(time, rate, gtis=gti_list,
                                         bintime=dt)
    out['source_ctrate'] = calc_countrate(time, rate, gtis=gti_list,
                                          bintime=dt)

    return out


def _assign_value_if_none(value, default):
    if value is None:
        return default
    else:
        return value


def _look_for_array_in_array(array1, array2):
    for a1 in array1:
        if a1 in array2:
            return a1


def calc_countrate(time, lc, gtis=None, bintime=None):
    """Calculate the count rate from a light curve.
    Parameters
    ----------
    time : array-like
    lc : array-like
    Returns
    -------
    countrate : float
        The mean count rate
    Other Parameters
    ----------------
    gtis : [[gti0_0, gti0_1], [gti1_0, gti1_1], ...]
    bintime : float
        The bin time of the light curve. If not specified, the minimum
        difference between time bins is used
    """
    bintime = _assign_value_if_none(bintime, np.min(np.diff(time)))
    if gtis is not None:
        if len(gtis) == 0 and len(time) > 1:
            gtis = create_gti_from_condition(time, time > 0)
        mask = create_gti_mask(time, gtis)
        lc = lc[mask]
    return np.mean(lc) / bintime


def create_gti_mask(time, gtis, safe_interval=0, min_length=0,
                    return_new_gtis=False, dt=None):
    """Create GTI mask.
    Assumes that no overlaps are present between GTIs
    Parameters
    ----------
    time : float array
    gtis : [[g0_0, g0_1], [g1_0, g1_1], ...], float array-like
    Returns
    -------
    mask : boolean array
    new_gtis : Nx2 array
    Other parameters
    ----------------
    safe_interval : float or [float, float]
        A safe interval to exclude at both ends (if single float) or the start
        and the end (if pair of values) of GTIs.
    min_length : float
    return_new_gtis : bool
    dt : float
    """
    import collections

    check_gtis(gtis)

    dt = _assign_value_if_none(dt,
                               np.zeros_like(time) + (time[1] - time[0]) / 2)

    mask = np.zeros(len(time), dtype=bool)

    if not isinstance(safe_interval, collections.Iterable):
        safe_interval = [safe_interval, safe_interval]

    newgtis = np.zeros_like(gtis)
    # Whose GTIs, including safe intervals, are longer than min_length
    newgtimask = np.zeros(len(newgtis), dtype=np.bool)

    for ig, gti in enumerate(gtis):
        limmin, limmax = gti
        limmin += safe_interval[0]
        limmax -= safe_interval[1]
        if limmax - limmin >= min_length:
            newgtis[ig][:] = [limmin, limmax]
            cond1 = time - dt >= limmin
            cond2 = time + dt <= limmax
            good = np.logical_and(cond1, cond2)
            mask[good] = True
            newgtimask[ig] = True

    res = mask
    if return_new_gtis:
        res = [res, newgtis[newgtimask]]
    return res


def check_gtis(gti):
    """Check if GTIs are well-behaved. No start>end, no overlaps.
    Raises
    ------
    AssertionError
        If GTIs are not well-behaved.
    """
    gti_start = gti[:, 0]
    gti_end = gti[:, 1]

    logging.debug('-- GTI: ' + repr(gti))
    # Check that GTIs are well-behaved
    assert np.all(gti_end >= gti_start), 'This GTI is incorrect'
    # Check that there are no overlaps in GTIs
    assert np.all(gti_start[1:] >= gti_end[:-1]), 'This GTI has overlaps'
    logging.debug('-- Correct')

    return


def create_gti_from_condition(time, condition,
                              safe_interval=0, dt=None):
    """Create a GTI list from a time array and a boolean mask ("condition").
    Parameters
    ----------
    time : array-like
        Array containing times
    condition : array-like
        An array of bools, of the same length of time.
        A possible condition can be, e.g., the result of lc > 0.
    Returns
    -------
    gtis : [[gti0_0, gti0_1], [gti1_0, gti1_1], ...]
        The newly created GTIs
    Other parameters
    ----------------
    safe_interval : float or [float, float]
        A safe interval to exclude at both ends (if single float) or the start
        and the end (if pair of values) of GTIs.
    dt : float
        The width (in sec) of each bin of the time array. Can be irregular.
    """
    import collections

    assert len(time) == len(condition), \
        'The length of the condition and time arrays must be the same.'
    idxs = contiguous_regions(condition)

    if not isinstance(safe_interval, collections.Iterable):
        safe_interval = [safe_interval, safe_interval]

    dt = _assign_value_if_none(dt,
                               np.zeros_like(time) + (time[1] - time[0]) / 2)

    gtis = []
    for idx in idxs:
        logging.debug(idx)
        startidx = idx[0]
        stopidx = idx[1]-1

        t0 = time[startidx] - dt[startidx] + safe_interval[0]
        t1 = time[stopidx] + dt[stopidx] - safe_interval[1]
        if t1 - t0 < 0:
            continue
        gtis.append([t0, t1])
    return np.array(gtis)


def contiguous_regions(condition):
    """Find contiguous True regions of the boolean array "condition".
    Return a 2D array where the first column is the start index of the region
    and the second column is the end index.
    Parameters
    ----------
    condition : boolean array
    Returns
    -------
    idx : [[i0_0, i0_1], [i1_0, i1_1], ...]
        A list of integer couples, with the start and end of each True blocks
        in the original array
    Notes
    -----
    From http://stackoverflow.com/questions/4494404/find-large-number-of-consecutive-values-fulfilling-condition-in-a-numpy-array
    """  # NOQA
    # Find the indicies of changes in "condition"
    diff = np.diff(condition)
    idx, = diff.nonzero()
    # We need to start things after the change in "condition". Therefore,
    # we'll shift the index by 1 to the right.
    idx += 1
    if condition[0]:
        # If the start of condition is True prepend a 0
        idx = np.r_[0, idx]
    if condition[-1]:
        # If the end of condition is True, append the length of the array
        idx = np.r_[idx, condition.size]
    # Reshape the result into two columns
    idx.shape = (-1, 2)
    return idx
