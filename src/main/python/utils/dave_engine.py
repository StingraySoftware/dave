import utils.dave_reader as DaveReader
import utils.dataset_helper as DsHelper
import utils.filters_helper as FltHelper
import utils.plotter as Plotter
import numpy as np
import copy
import utils.dave_logger as logging
import utils.dataset_cache as DsCache
import model.dataset as DataSet
from stingray import Powerspectrum, AveragedPowerspectrum
from stingray import Crossspectrum, AveragedCrossspectrum
from stingray.gti import cross_two_gtis
from stingray.utils import baseline_als
from astropy.modeling.models import Gaussian1D, Lorentz1D
from astropy.modeling.powerlaws import PowerLaw1D, BrokenPowerLaw1D
import sys

BIG_NUMBER = 9999999999999


# get_dataset_schema: Returns the schema of a dataset of given file
# the plot inside with a given file destination
#
# @param: destination: file destination
#
def get_dataset_schema(destination):
    dataset = DaveReader.get_file_dataset(destination)
    if dataset:
        return dataset.get_schema()
    else:
        return None


# append_file_to_dataset: Appends Fits data to a dataset
#
# @param: destination: file destination or dataset cache key
# @param: next_destination: file destination of file to append
#
def append_file_to_dataset(destination, next_destination):
    dataset = DaveReader.get_file_dataset(destination)
    if DsHelper.is_events_dataset(dataset):
        next_dataset = DaveReader.get_file_dataset(next_destination)
        if DsHelper.is_events_dataset(next_dataset):
            # Looks what dataset is earliest
            ds_start_time = DsHelper.get_events_dataset_start(dataset)
            next_ds_start_time = DsHelper.get_events_dataset_start(next_dataset)

            if next_ds_start_time < ds_start_time:
                #Swap datasets
                tmp_ds = dataset
                dataset = next_dataset
                next_dataset = tmp_ds

            #Join and cache joined dataset
            dataset.tables["EVENTS"] = dataset.tables["EVENTS"].join(next_dataset.tables["EVENTS"])
            dataset.tables["GTI"] = DsHelper.join_gti_tables(dataset.tables["GTI"], next_dataset.tables["GTI"])

            DsCache.remove(destination)  # Removes previous cached dataset for prev key
            new_cache_key = DsCache.get_key(destination + "|" + next_destination)
            DsCache.add(new_cache_key, dataset)  # Adds new cached dataset for new key
            return new_cache_key

    return ""


# apply_rmf_file_to_dataset: Appends Fits data to a dataset
#
# @param: destination: file destination or dataset cache key
# @param: rmf_destination: file destination of file to apply
#
def apply_rmf_file_to_dataset(destination, rmf_destination):
    try:
        dataset = DaveReader.get_file_dataset(destination)
        if DsHelper.is_events_dataset(dataset):
            rmf_dataset = DaveReader.get_file_dataset(rmf_destination)
            if DsHelper.is_rmf_dataset(rmf_dataset):
                # Applies rmf data to dataset
                events_table = dataset.tables["EVENTS"]
                rmf_table = rmf_dataset.tables["EBOUNDS"]

                if "PHA" not in events_table.columns:
                    logging.warn('apply_rmf_file_to_dataset: PHA column not found!')
                    return False

                pha_data = events_table.columns["PHA"].values

                e_avg_data = dict((channel, (min + max)/2) for channel, min, max in zip(rmf_table.columns["CHANNEL"].values,
                                                                                    rmf_table.columns["E_MIN"].values,
                                                                                    rmf_table.columns["E_MAX"].values))
                e_values = []
                for i in range(len(pha_data)):
                    if pha_data[i] in e_avg_data:
                        e_values.append(e_avg_data[pha_data[i]])
                    else:
                        e_values.append(0)

                events_table.add_columns(["E"])
                events_table.columns["E"].add_values(e_values)

                DsCache.remove_with_prefix("FILTERED") # Removes all filtered datasets from cache
                DsCache.add(destination, dataset) # Stores dataset on cache
                return len(events_table.columns["E"].values) == len(pha_data)
    except:
        logging.error(getException('apply_rmf_file_to_dataset'))
    return False


# get_plot_data: Returns the data for a plot
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "txt_table", column = "Time", from=0, to=10 }, ... ]
# @param: styles: dictionary with the plot style info
#           { type = "2d", labels=["Time", "Rate Count"]}
# @param: axis: array with the column names to use in ploting
#           [{ table = "txt_table", column = "Time" },
#            { table = "txt_table", column = "Rate" } ... ]
#
def get_plot_data(src_destination, bck_destination, gti_destination, filters, styles, axis):

    try:
        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        # Config checking
        if "type" not in styles:
            logging.warn("No plot type specified on styles")
            return None

        if "labels" not in styles:
            logging.warn("No plot labels specified on styles")
            return None

        if len(styles["labels"]) < 2:
            logging.warn("Wrong number of labels specified on styles")
            return None

        if len(axis) < 2:
            logging.warn("Wrong number of axis")
            return None

        # Plot type mode
        if styles["type"] == "2d":
            return Plotter.get_plotdiv_xy(filtered_ds, axis)

        elif styles["type"] == "3d":

            if len(styles["labels"]) < 3:
                logging.warn("Wrong number of labels specified on styles")
                return None

            if len(axis) < 3:
                logging.warn("Wrong number of axis")
                return None

            return Plotter.get_plotdiv_xyz(filtered_ds, axis)

        elif styles["type"] == "scatter":
            return Plotter.get_plotdiv_scatter(filtered_ds, axis)

        logging.warn("Wrong plot type specified on styles")

    except:
        logging.error(getException('get_plot_data'))

    return None


# get_histogram: Returns data for the histogram of passed axis
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "PHA" }]
#
def get_histogram(src_destination, bck_destination, gti_destination, filters, axis):

    axis_values = []
    counts = []

    try:
        if len(axis) != 1:
            logging.warn("Wrong number of axis")
            return None

        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        if DsHelper.is_events_dataset(filtered_ds):
            # Counts channel hits
            if not check_axis_in_dataset(filtered_ds, axis):
                logging.warn('get_histogram: Wrong axis for this dataset')
                return None
            axis_data = filtered_ds.tables[axis[0]["table"]].columns[axis[0]["column"]].values
            counted_data, axis_values = DsHelper.get_histogram(axis_data)
            counts = np.array([counted_data[axis_value] for axis_value in axis_values])

        else:
            logging.warn("Wrong dataset type")
            return None

        filtered_ds = None  # Dispose memory

    except:
        logging.error(getException('get_histogram'))

    # Preapares the result
    result = push_to_results_array([], axis_values)
    result = push_to_results_array(result, counts)
    return result


# get_lightcurve: Returns the data for the Lightcurve
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "TIME" },
#            { table = "EVENTS", column = "PHA" } ]
# @param: dt: The time resolution of the events.
# @param: baseline_opts: Object with the baseline parameters.
#
def get_lightcurve(src_destination, bck_destination, gti_destination, filters, axis, dt, baseline_opts):

    time_vals = []
    count_rate = []
    error_values = []
    gti_start_values = []
    gti_stop_values = []
    baseline = []

    try:
        if len(axis) != 2:
            logging.warn("Wrong number of axis")
            return None

        # Creates the lightcurve
        lc = get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt)
        if not lc:
            logging.warn("Can't create lightcurve")
            return None

        # Sets lc values
        time_vals = lc.time
        count_rate = lc.countrate
        error_values = []  # TODO: Implement error values on Stingray -> lc.countrate_err

        # Sets gtis ranges
        gti_start_values = lc.gti[:, 0]
        gti_stop_values = lc.gti[:, 1]

        # Gets the baseline values
        if baseline_opts["niter"] > 0:
            logging.debug("Preparing lightcurve baseline");
            lam = baseline_opts["lam"]  # 1000
            p = baseline_opts["p"]  # 0.01
            niter = baseline_opts["niter"]  # 10
            baseline = lc.baseline(lam, p, niter) / dt  # Baseline from count, divide by dt to get countrate

        lc = None  # Dispose memory

    except:
        logging.error(getException('get_lightcurve'))

    # Preapares the result
    logging.debug("Result lightcurve .... " + str(len(time_vals)))
    result = push_to_results_array([], time_vals)
    result = push_to_results_array(result, count_rate)
    result = push_to_results_array(result, error_values)
    result = push_to_results_array(result, gti_start_values)
    result = push_to_results_array(result, gti_stop_values)
    result = push_to_results_array(result, baseline)
    return result


# get_joined_lightcurves: Returns the joined data of LC0 and LC1
#
# @param: lc0_destination: lightcurve 0 file destination
# @param: lc1_destination: lightcurve 1 file destination
# @param: filters: array with the filters to apply
#         [{ table = "RATE", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "RATE", column = "TIME" },
#            { table = "RATE", column = "PHA" } ]
# @param: dt: The time resolution of the events.
#
def get_joined_lightcurves(lc0_destination, lc1_destination, filters, axis, dt):

    try:

        if len(axis) != 2:
            logging.warn("Wrong number of axis")
            return None

        filters = FltHelper.get_filters_clean_color_filters(filters)
        filters = FltHelper.apply_bin_size_to_filters(filters, dt)

        lc0_ds = get_filtered_dataset(lc0_destination, filters)
        if not DsHelper.is_lightcurve_dataset(lc0_ds):
            logging.warn("Wrong dataset type for lc0")
            return None

        lc1_ds = get_filtered_dataset(lc1_destination, filters)
        if not DsHelper.is_lightcurve_dataset(lc1_ds):
            logging.warn("Wrong dataset type for lc1")
            return None

        #  Problaby here we can use a stronger checking
        if len(lc0_ds.tables["RATE"].columns["TIME"].values) == len(lc1_ds.tables["RATE"].columns["TIME"].values):

            # Preapares the result
            logging.debug("Result joined lightcurves ....")
            result = push_to_results_array([], lc0_ds.tables["RATE"].columns["RATE"].values)
            result = push_to_results_array(result, lc1_ds.tables["RATE"].columns["RATE"].values)
            return result

        else:
            logging.warn("Lightcurves have different durations.")
            return None

    except:
        logging.error(getException('get_joined_lightcurves'))

    return None


# get_divided_lightcurves_from_colors: Returns the joined data of src_lc and ColorX / ColorY
# if len(color_filters) == 2, else if len(color_filters) == 4 returns the joined data
# of ColorZ / ColorS and ColorX / ColorY
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "TIME" },
#            { table = "EVENTS", column = "PHA" } ]
# @param: dt: The time resolution of the events.
#
def get_divided_lightcurves_from_colors(src_destination, bck_destination, gti_destination, filters, axis, dt):

    if len(axis) != 2:
        logging.warn("Wrong number of axis")
        return None

    try:
        filters = FltHelper.apply_bin_size_to_filters(filters, dt)

        color_keys = FltHelper.get_color_keys_from_filters(filters)

        if len(color_keys) != 2 and len(color_keys) != 4:
            logging.warn("Wrong number of color filters")
            return None

        gti_start_values = []
        gti_stop_values = []

        if len(color_keys) == 2:
            # Prepares SRC_LC
            clean_filters = FltHelper.get_filters_clean_color_filters(filters)
            filtered_ds = get_filtered_dataset(src_destination, clean_filters, gti_destination)

            #Sets gtis ranges
            gti_start_values = filtered_ds.tables["GTI"].columns["START"].values
            gti_stop_values = filtered_ds.tables["GTI"].columns["STOP"].values

            # Creates src lightcurve applying bck and gtis
            src_lc = get_lightcurve_from_events_dataset(filtered_ds, bck_destination, clean_filters, gti_destination, dt)
            if not src_lc:
                logging.warn("Cant create lc_src")
                return None

        # Prepares datasets from color filters
        filtered_datasets = split_dataset_with_color_filters(src_destination, filters, color_keys, gti_destination)

        # Creates lightcurves array applying bck and gtis from each color
        logging.debug("Create color lightcurves ....")
        lightcurves = get_lightcurves_from_events_datasets_array(filtered_datasets, color_keys, bck_destination, filters, gti_destination, dt)
        filtered_datasets = None  # Dispose memory

        if len(lightcurves) == len(color_keys):

            # Preapares the result
            logging.debug("Result divided lightcurves ....")
            if len(color_keys) == 2:
                result = push_to_results_array([], src_lc.countrate)
            else:
                result = push_divided_values_to_results_array([], lightcurves[2].countrate, lightcurves[3].countrate)

            result = push_divided_values_to_results_array(result, lightcurves[0].countrate, lightcurves[1].countrate)

            if len(color_keys) == 2:
                result = push_to_results_array(result, src_lc.time)
            else:
                result = push_to_results_array(result, lightcurves[0].time)

            result = push_to_results_array(result, gti_start_values)
            result = push_to_results_array(result, gti_stop_values)

            return result

        else:
            logging.warn("Cant create the colors filtered ligthcurves")

    except:
        logging.error(getException('get_divided_lightcurves_from_colors'))

    return None


# get_divided_lightcurve_ds: Returns a new dataset key for the LC0 divided by LC1
#
# @param: lc0_destination: lightcurve 0 file destination
# @param: lc1_destination: lightcurve 1 file destination
#
def get_divided_lightcurve_ds(lc0_destination, lc1_destination):

    try:

        lc0_ds = DaveReader.get_file_dataset(lc0_destination)
        if not DsHelper.is_lightcurve_dataset(lc0_ds):
            logging.warn("Wrong dataset type for lc0")
            return ""

        count_rate_0 = np.array(lc0_ds.tables["RATE"].columns["RATE"].values)
        count_rate_error_0 = np.array(lc0_ds.tables["RATE"].columns["RATE"].error_values)

        lc1_ds = DaveReader.get_file_dataset(lc1_destination)
        if not DsHelper.is_lightcurve_dataset(lc1_ds):
            logging.warn("Wrong dataset type for lc1")
            return ""

        count_rate_1 = np.array(lc1_ds.tables["RATE"].columns["RATE"].values)
        count_rate_error_1 = np.array(lc1_ds.tables["RATE"].columns["RATE"].error_values)

        if count_rate_0.shape == count_rate_1.shape:

            ret_lc_ds = lc0_ds.clone(True)

            with np.errstate(all='ignore'): # Ignore divisions by 0 and others
                count_rate = np.nan_to_num(count_rate_0 / count_rate_1)
                if count_rate_error_0.shape == count_rate_error_1.shape == count_rate_0.shape:
                    count_rate_error = np.nan_to_num((count_rate_error_0/count_rate_1) + ((count_rate_error_1 * count_rate_0)/(count_rate_1 * count_rate_1)))
                else:
                    logging.warn("count_rate_error_0.shape: " + str(count_rate_error_0.shape))
                    logging.warn("count_rate_error_1.shape: " + str(count_rate_error_1.shape))
                    logging.warn("count_rate_0.shape: " + str(count_rate_0.shape))
                    logging.warn("count_rate_1.shape: " + str(count_rate_1.shape))
                    count_rate_error = np.array([])
            count_rate[count_rate > BIG_NUMBER]=0
            count_rate_error[count_rate_error > BIG_NUMBER]=0

            ret_lc_ds.tables["RATE"].columns["RATE"].clear()
            ret_lc_ds.tables["RATE"].columns["RATE"].add_values(count_rate, count_rate_error)

            lc0_ds = None  # Dispose memory
            lc1_ds = None  # Dispose memory
            count_rate_1 = None  # Dispose memory
            count_rate_0 = None  # Dispose memory
            count_rate = None  # Dispose memory
            count_rate_error_1 = None  # Dispose memory
            count_rate_error_0 = None  # Dispose memory
            count_rate_error = None  # Dispose memory

            new_cache_key = DsCache.get_key(lc0_destination + "|" + lc1_destination + "|ligthcurve")
            DsCache.add(new_cache_key, ret_lc_ds)  # Adds new cached dataset for new key
            return new_cache_key

        else:
            logging.warn("Lightcurves have different shapes.")
            return None

    except:
        logging.error(getException('get_divided_lightcurve_ds'))

    return ""


# get_lightcurve_ds_from_events_ds: Creates a lightcurve dataset
# from an events dataset and stores it on DsCache, returns the cache key
#
# @param: destination: file destination or dataset cache key
# @param: axis: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "TIME" },
#            { table = "EVENTS", column = "PHA" } ]
# @param: dt: The time resolution of the events.
#
def get_lightcurve_ds_from_events_ds(destination, axis, dt):

    try:

        if len(axis) != 2:
            logging.warn("Wrong number of axis")
            return ""

        dataset = DaveReader.get_file_dataset(destination)
        lc = get_lightcurve_from_events_dataset(dataset, "", [], "", dt)

        if lc:
            #Changes lc format to stingray_addons format
            tmp_lc = {}
            tmp_lc['lc'] = lc.countrate
            tmp_lc['elc'] = []  # TODO: Get error from lightcurve -> lc.countrate_err
            tmp_lc['time'] = lc.time
            tmp_lc['GTI'] = lc.gti

            lc_dataset = DataSet.get_lightcurve_dataset_from_stingray_lcurve(tmp_lc, dataset.tables["EVENTS"].header, dataset.tables["EVENTS"].header_comments,
                                                                            "RATE", "TIME")
            dataset = None  # Dispose memory
            lc = None  # Dispose memory

            new_cache_key = DsCache.get_key(destination + "|ligthcurve")
            DsCache.add(new_cache_key, dataset)  # Adds new cached dataset for new key
            return new_cache_key

    except:
        logging.error(getException('get_lightcurve_ds_from_events_ds'))

    return ""


# get_power_density_spectrum: Returns the PDS of a given dataset
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "TIME" },
#            { table = "EVENTS", column = "PHA" } ]
# @param: dt: The time resolution of the events.
# @param: nsegm: The number of segments for splitting the lightcurve
# @param: segm_size: The segment length for split the lightcurve
# @param: norm: The normalization of the (real part of the) power spectrum.
# @param: pds_type: Type of PDS to use, single or averaged.
#
def get_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type):

    freq = []
    power = []
    duration = []
    warnmsg = []

    try:
        if len(axis) != 2:
            logging.warn("Wrong number of axis")
            return None

        if norm not in ['frac', 'abs', 'leahy', 'none']:
            logging.warn("Wrong normalization")
            return None

        if pds_type not in ['Sng', 'Avg']:
            logging.warn("Wrong power density spectrum type")
            return None

        if segm_size == 0:
            segm_size = None

        # Creates the lightcurve
        lc = get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt)
        if not lc:
            logging.warn("Can't create lightcurve")
            return None

        # Prepares GTI if passed
        gti = load_gti_from_destination (gti_destination)
        if not gti:
            logging.debug("External GTIs not loaded using defaults")
            gti = lc.gti

        # Creates the power density spectrum
        logging.debug("Create power density spectrum")

        if pds_type == 'Sng':
            pds = Powerspectrum(lc, norm=norm, gti=gti)
        else:
            pds = AveragedPowerspectrum(lc=lc, segment_size=segm_size, norm=norm, gti=gti)

        if pds:
            freq = pds.freq
            power = pds.power

            duration = [lc.tseg]
            warnmsg = [""]
            if gti is not None and len(gti) == 0 and DsHelper.hasGTIGaps(lc.time):
                warnmsg = ["GTI gaps found on LC"]

            pds = None  # Dispose memory

        lc = None  # Dispose memory

    except:
        logging.error(getException('get_power_density_spectrum'))
        warnmsg = [str(sys.exc_info()[1])]

    # Preapares the result
    logging.debug("Result power density spectrum .... " + str(len(freq)))
    result = push_to_results_array([], freq)
    result = push_to_results_array(result, power)
    result = push_to_results_array(result, duration)
    result = push_to_results_array(result, warnmsg)
    return result


# get_dynamical_spectrum: Returns the Dynamical Spectrum of a given dataset
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "TIME" },
#            { table = "EVENTS", column = "PHA" } ]
# @param: dt: The time resolution of the events.
# @param: nsegm: The number of segments for splitting the lightcurve
# @param: segm_size: The segment length for split the lightcurve
# @param: norm: The normalization of the (real part of the) power spectrum.
# @param: pds_type: Type of PDS to use, single or averaged.
#
def get_dynamical_spectrum(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, nsegm, segm_size, norm):

    freq = []
    power_all = []
    time = []
    duration = []
    warnmsg = []

    try:
        if len(axis) != 2:
            logging.warn("Wrong number of axis")
            return None

        if norm not in ['frac', 'abs', 'leahy', 'none']:
            logging.warn("Wrong normalization")
            return None

        if segm_size == 0:
            segm_size = None

        # Creates the lightcurve
        lc = get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt)
        if not lc:
            logging.warn("Can't create lightcurve")
            return None

        # Prepares GTI if passed
        gti = load_gti_from_destination (gti_destination)
        if not gti:
            logging.debug("External GTIs not loaded using defaults")
            gti = lc.gti

        warnmsg = [""]

        # Check if there is only one GTI and tries to split it by segm_size
        if gti is not None and len(gti) == 1:
            logging.debug("Only one GTI found, splitting by segm_size")
            new_gtis = DsHelper.get_splited_gti(gti[0], segm_size)
            if new_gtis is not None:
                gti = new_gtis
                warnmsg = ["GTIs obtained by splitting with segment length"]
            else:
                warnmsg = ["The GTI is not splitable by segment length"]
                logging.warn("Can't create splitted gtis from segm_size")

        # Creates the power density spectrum
        logging.debug("Create dynamical spectrum")

        pds = AveragedPowerspectrum(lc=lc, segment_size=segm_size, norm=norm, gti=gti)

        if pds:
            freq = pds.freq

            pds_array, nphots_all = pds._make_segment_spectrum(lc, segm_size)
            for tmp_pds in pds_array:
                power_all = push_to_results_array(power_all, tmp_pds.power)

            time = gti[:, 0]
            duration = [lc.tseg]

            if gti is not None and len(gti) == 0 and DsHelper.hasGTIGaps(lc.time):
                warnmsg = ["GTI gaps found on LC"]

            pds = None  # Dispose memory

        lc = None  # Dispose memory

    except:
        logging.error(getException('get_dynamical_spectrum'))
        warnmsg = [str(sys.exc_info()[1])]

    # Preapares the result
    logging.debug("Result dynamical spectrum .... " + str(len(freq)))
    result = push_to_results_array([], freq)
    result = push_to_results_array(result, power_all)
    result = push_to_results_array(result, time)
    result = push_to_results_array(result, duration)
    result = push_to_results_array(result, warnmsg)
    return result


# get_cross_spectrum: Returns the XS of two given datasets
#
# @param: src_destination1: source file destination
# @param: bck_destination1: background file destination, is optional
# @param: gti_destination1: gti file destination, is optional
# @param: filters1: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: axis1: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "TIME" },
#            { table = "EVENTS", column = "PHA" } ]
# @param: dt1: The time resolution of the events.
# @param: src_destination2: source file destination
# @param: bck_destination2: background file destination, is optional
# @param: gti_destination2: gti file destination, is optional
# @param: filters2: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: axis2: array with the column names to use in ploting
#           [{ table = "EVENTS", column = "TIME" },
#            { table = "EVENTS", column = "PHA" } ]
# @param: dt2: The time resolution of the events.
# @param: nsegm: The number of segments for splitting the lightcurve
# @param: segm_size: The segment length for split the lightcurve
# @param: norm: The normalization of the (real part of the) cross spectrum.
# @param: xds_type: Type of XDS to use, single or averaged.
#
def get_cross_spectrum(src_destination1, bck_destination1, gti_destination1, filters1, axis1, dt1,
                       src_destination2, bck_destination2, gti_destination2, filters2, axis2, dt2,
                       nsegm, segm_size, norm, xds_type):

    freq = []
    power = []
    time_lag_array = []
    coherence_array = []
    duration = []
    warnmsg = []

    try:
        if len(axis1) != 2:
            logging.warn("Wrong number of axis 1")
            return None

        if len(axis2) != 2:
            logging.warn("Wrong number of axis 1")
            return None

        if norm not in ['frac', 'abs', 'leahy', 'none']:
            logging.warn("Wrong normalization")
            return None

        if xds_type not in ['Sng', 'Avg']:
            logging.warn("Wrong cross spectrum type")
            return None

        if segm_size == 0:
            segm_size = None

        # Creates the lightcurve 1
        lc1 = get_lightcurve_any_dataset(src_destination1, bck_destination1, gti_destination1, filters1, dt1)
        if not lc1:
            logging.warn("Cant create lightcurve 1")
            return None

        # Prepares GTI1 if passed
        gti1 = load_gti_from_destination (gti_destination1)
        if not gti1:
            logging.debug("External GTIs 1 not loaded using defaults")
            gti1 = lc1.gti

        # Creates the lightcurve 2
        lc2 = get_lightcurve_any_dataset(src_destination2, bck_destination2, gti_destination2, filters2, dt2)
        if not lc2:
            logging.warn("Cant create lightcurve 2")
            return None

        # Prepares GTI2 if passed
        gti2 = load_gti_from_destination (gti_destination2)
        if not gti2:
            logging.debug("External GTIs 2 not loaded using defaults")
            gti2 = lc2.gti

        # Join gtis in one gti
        gti = None
        gti1_valid = gti1 is not None and len(gti1) > 0
        gti2_valid = gti2 is not None and len(gti2) > 0
        if gti1_valid and gti2_valid:
            gti = cross_two_gtis(gti1, gti2)
            logging.debug("GTIS crossed")
        elif gti1_valid and not gti2_valid:
            gti = gti1
            logging.debug("GTI 1 applied")
        elif not gti1_valid and gti2_valid:
            gti = gti2
            logging.debug("GTI 2 applied")

        # Cross Spectra requires a single Good Time Interval
        #if gti is not None and gti.shape[0] != 1:
        #    logging.warn("Non-averaged Cross Spectra need "
        #                    "a single Good Time Interval: gti -> " + str(gti.shape))
        #    return None

        # Creates the cross spectrum
        logging.debug("Create cross spectrum")

        if xds_type == 'Sng':
            xs = Crossspectrum(lc1=lc1, lc2=lc2, norm=norm, gti=gti)
        else:
            xs = AveragedCrossspectrum(lc1=lc1, lc2=lc2, segment_size=segm_size, norm=norm, gti=gti)

        if xs:
            freq = xs.freq
            power = xs.power
            time_lag, time_lag_err = xs.time_lag()
            coherence, coherence_err = xs.coherence()

            # Replace posible out of range values
            time_lag = np.nan_to_num(time_lag)
            time_lag[time_lag > BIG_NUMBER]=0
            time_lag_err = np.nan_to_num(time_lag_err)
            time_lag_err[time_lag_err > BIG_NUMBER]=0
            time_lag_array = [ time_lag, time_lag_err ]

            coherence = np.nan_to_num(coherence)
            coherence[coherence > BIG_NUMBER]=0
            coherence_err = np.nan_to_num(coherence_err)
            coherence_err[coherence_err > BIG_NUMBER]=0
            coherence_array = [ coherence, coherence_err ]

            # Set duration and warnmsg
            duration = [lc1.tseg, lc2.tseg]
            warnmsg = []
            if gti1 is not None and len(gti1) == 0 and DsHelper.hasGTIGaps(lc1.time):
                warnmsg.append("GTI gaps found on LC 1")
            if gti2 is not None and len(gti2) == 0 and DsHelper.hasGTIGaps(lc2.time):
                warnmsg.append("GTI gaps found on LC 2")

            xs = None  # Dispose memory

        lc1 = None  # Dispose memory
        lc2 = None  # Dispose memory

    except:
        logging.error(getException('get_cross_spectrum'))
        warnmsg = [str(sys.exc_info()[1])]

    # Preapares the result
    logging.debug("Result cross spectrum .... " + str(len(freq)))
    result = push_to_results_array([], freq)
    result = push_to_results_array(result, power)
    result = push_to_results_array(result, time_lag_array)
    result = push_to_results_array(result, coherence_array)
    result = push_to_results_array(result, duration)
    result = push_to_results_array(result, warnmsg)
    return result


# get_unfolded_spectrum:
# Returns a energy array with a linked energy_spectrum array and
# a unfolded_spectrum array
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: arf_destination: file destination of file to apply
#
def get_unfolded_spectrum(src_destination, bck_destination, gti_destination, filters, arf_destination):

    energy_arr = []
    energy_spectrum_arr =[]
    unfolded_spectrum_arr = []

    try:

        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        if DsHelper.is_events_dataset(filtered_ds):
            arf_dataset = DaveReader.get_file_dataset(arf_destination)
            if DsHelper.is_arf_dataset(arf_dataset):
                # Applies arf data to dataset
                events_table = filtered_ds.tables["EVENTS"]

                if "E" not in events_table.columns:
                    logging.warn('get_unfolded_spectrum: E column not found!')
                    return False

                e_histogram, e_values = DsHelper.get_histogram(events_table.columns["E"].values)

                arf_table = arf_dataset.tables["SPECRESP"]
                arf_effective_area_array = arf_table.columns["SPECRESP"].values;
                arf_e_avg_array = [((min + max)/2) for min, max in zip(arf_table.columns["ENERG_LO"].values,
                                                                       arf_table.columns["ENERG_HI"].values)]

                exposure_time = DsHelper.get_exposure_time(filtered_ds.tables["GTI"])

                for i in range(len(e_values)):
                    energy = e_values[i]
                    counts = e_histogram[energy]
                    idx = DsHelper.find_idx_nearest_val(arf_e_avg_array, energy)
                    energy_arr.append(energy)
                    norm_count = (counts / energy) / exposure_time
                    energy_spectrum_arr.append(norm_count)
                    unfolded_spectrum_arr.append(norm_count / arf_effective_area_array[idx])

    except:
        logging.error(getException('get_unfolded_spectrum'))

    # Preapares the result
    result = push_to_results_array([], energy_arr)
    result = push_to_results_array(result, energy_spectrum_arr)
    result = push_to_results_array(result, unfolded_spectrum_arr)
    return result


# get_plot_data_from_models:
# Returns the plot Y data for an array of models with a given X_axis values
#
# @param: models: array of models
# @param: x_values: array of float
#
def get_plot_data_from_models(models, x_values):

    models_arr = []

    try:

        sum_values = []

        for i in range(len(models)):
            model = models[i]
            val_array = []
            model_obj = None

            if model["type"] == "Gaussian":
                 model_obj = Gaussian1D(model["amplitude"], model["mean"], model["stddev"])

            elif model["type"] == "Lorentz":
                 model_obj = Lorentz1D(model["amplitude"], model["x_0"], model["fwhm"])

            elif model["type"] == "PowerLaw":
                 model_obj = PowerLaw1D(model["amplitude"], model["x_0"], model["alpha"])

            elif model["type"] == "BrokenPowerLaw":
                 model_obj = BrokenPowerLaw1D(model["amplitude"], model["x_break"], model["alpha_1"], model["alpha_2"])

            if model_obj:
                for i in range(len(x_values)):
                     val_array.append(model_obj(x_values[i]))

                if len(val_array) > 0:
                    models_arr = push_to_results_array(models_arr, val_array)
                    if len (sum_values) == 0:
                        sum_values = val_array
                    else:
                        sum_values = np.sum([sum_values, val_array], axis=0)

        models_arr = push_to_results_array(models_arr, sum_values)

    except:
        logging.error(getException('get_plot_data_from_models'))

    return models_arr


# ----- HELPER FUNCTIONS.. NOT EXPOSED  -------------

def get_filtered_dataset(destination, filters, gti_destination=""):

    # Try to get filtered dataset from cache
    cache_key = "FILTERED_" + DsCache.get_key(destination + gti_destination + str(filters), True)
    if DsCache.contains(cache_key):
        logging.debug("Returned cached filtered dataset, cache_key: " + cache_key + ", count: " + str(DsCache.count()))
        return DsCache.get(cache_key)

    dataset = DaveReader.get_file_dataset(destination)
    if not dataset:
        logging.warn("get_filtered_dataset: destination specified but not loadable.")
        return None

    if gti_destination:
        gti_dataset = DaveReader.get_file_dataset(gti_destination)
        if gti_dataset:
            dataset = DsHelper.get_dataset_applying_gti_dataset(dataset, gti_dataset)
            if not dataset:
                logging.warn("get_filtered_dataset: dataset is none after applying gti_dataset.")
                return None
        else:
            logging.warn("get_filtered_dataset: Gti_destination specified but not loadable.")

    filtered_ds = dataset.apply_filters(filters)
    if filtered_ds:
        logging.debug("Add filtered_ds to cache, cache_key: " + cache_key + ", count: " + str(DsCache.count()))
        DsCache.add(cache_key, filtered_ds)

    return filtered_ds


def get_color_filtered_dataset(destination, filters, color_column_name, gti_destination=""):
    color_filters = FltHelper.get_filters_from_color_filters(filters, color_column_name)
    filtered_ds = get_filtered_dataset(destination, color_filters, gti_destination)
    return filtered_ds


def split_dataset_with_color_filters(src_destination, filters, color_keys, gti_destination):
    filtered_datasets = []
    for color_key in color_keys:
        filtered_ds = get_color_filtered_dataset(src_destination, filters, color_key, gti_destination)
        if not DsHelper.is_events_dataset(filtered_ds):
            logging.warn("Can't create filtered_ds for " + str(color_key))
            return None
        filtered_datasets.append(filtered_ds)
    return filtered_datasets


def push_to_results_array (result, values):
    column = dict()
    column["values"] = values
    result.append(column)
    return result


def push_divided_values_to_results_array (result, values0, values1):
    divided_values = []
    with np.errstate(all='ignore'): # Ignore divisions by 0 and others
        divided_values = np.nan_to_num(values0 / values1)
    divided_values[divided_values > BIG_NUMBER]=0
    return push_to_results_array(result, divided_values)


def get_color_axis_for_ds():
    color_axis = [dict() for i in range(2)]
    color_axis[0]["table"] = "EVENTS"
    color_axis[0]["column"] = "TIME"
    color_axis[1]["table"] = "EVENTS"
    color_axis[1]["column"] = "PHA"
    return color_axis


def check_axis_in_dataset (dataset, axis):
    for i in range(len(axis)):
        if axis[i]["table"] not in dataset.tables:
            logging.warn('check_axis_in_dataset: ' + axis[i]["table"] + ' table not found!')
            return False

        if axis[i]["column"] not in dataset.tables[axis[i]["table"]].columns:
            logging.warn('check_axis_in_dataset: ' + axis[i]["column"] + ' column not found!')
            return False
    return True


# exclude_axis: Returns first found axis from axis list
# where column differs from filter_axis.column
def exclude_axis(axis, filter_axis):
    for i in range(len(axis)):
        if axis[i]["column"] != filter_axis["column"]:
            return axis[i]
    return None


def get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt):
    filters = FltHelper.get_filters_clean_color_filters(filters)
    filters = FltHelper.apply_bin_size_to_filters(filters, dt)

    filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)
    if not DsHelper.is_events_dataset(filtered_ds) \
        and not DsHelper.is_lightcurve_dataset(filtered_ds):
        logging.warn("Wrong dataset type")
        return None

    if DsHelper.is_events_dataset(filtered_ds):
        # Creates lightcurves by gti and joins in one
        logging.debug("Create lightcurve from evt dataset... Event count: " + str(len(filtered_ds.tables["EVENTS"].columns["TIME"].values)))
        return get_lightcurve_from_events_dataset(filtered_ds, bck_destination, filters, gti_destination, dt)

    elif DsHelper.is_lightcurve_dataset(filtered_ds):
        #If dataset is LIGHTCURVE type
        logging.debug("Create lightcurve from lc dataset")
        gti = load_gti_from_destination (gti_destination)
        return DsHelper.get_lightcurve_from_lc_dataset(filtered_ds, gti=gti)

    return None


def get_lightcurve_from_events_dataset(filtered_ds, bck_destination, filters, gti_destination, dt):
    eventlist = DsHelper.get_eventlist_from_evt_dataset(filtered_ds)
    if not eventlist or len(eventlist.time) == 0:
        logging.warn("Wrong lightcurve counts for eventlist from ds.id -> " + str(filtered_ds.id))
        return None

    filtered_ds = None  # Dispose memory
    lc = eventlist.to_lc(dt)
    if bck_destination:
        lc = apply_background_to_lc(lc, bck_destination, filters, axis, gti_destination, dt)
    eventlist = None  # Dispose memory
    return lc


def get_lightcurves_from_events_datasets_array (datasets_array, color_keys, bck_destination, filters, gti_destination, dt):
    lightcurves = []
    for color_idx in range(len(color_keys)):
        color_filters = FltHelper.get_filters_from_color_filters(filters, color_keys[color_idx])
        lc = get_lightcurve_from_events_dataset(datasets_array[color_idx], bck_destination, color_filters, gti_destination, dt)
        if lc:
            lightcurves.append(lc)
    return lightcurves


def apply_background_to_lc(lc, bck_destination, filters, gti_destination, dt):
    filtered_bck_ds = get_filtered_dataset(bck_destination, filters, gti_destination)
    if DsHelper.is_events_dataset(filtered_bck_ds):

        logging.debug("Create background lightcurve ....")
        bck_eventlist = DsHelper.get_eventlist_from_evt_dataset(filtered_bck_ds)
        if bck_eventlist and len(bck_eventlist.time) > 0:
            bck_lc = bck_eventlist.to_lc(dt)

            if lc.countrate.shape == bck_lc.countrate.shape:
                lc.countrate -= bck_lc.countrate
            else:
                logging.warn("Background counts differs from lc counts, omiting Bck data.")

            bck_lc = None

        else:
            logging.warn("Wrong lightcurve counts for background data...")

        bck_eventlist = None  # Dispose memory
        filtered_bck_ds = None

    else:
        logging.warn("Background dataset is None!, omiting Bck data.")

    return lc


def load_gti_from_destination (gti_destination):
    gti = None
    if gti_destination:
        gti_dataset = DaveReader.get_file_dataset(gti_destination)
        if gti_dataset:
            gti = DsHelper.get_stingray_gti_from_gti_table (gti_dataset.tables["GTI"])
            logging.debug("Load GTI success")
    return gti

def getException(method_name):
    exc_type, exc_obj, tb = sys.exc_info()
    f = tb.tb_frame
    lineno = tb.tb_lineno
    filename = f.f_code.co_filename
    return 'EXCEPTION {} IN ({}, LINE {}): {}'.format(method_name, filename, lineno, exc_obj)
