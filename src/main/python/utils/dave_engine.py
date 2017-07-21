import utils.dave_reader as DaveReader
import utils.dataset_helper as DsHelper
import utils.filters_helper as FltHelper
import utils.model_helper as ModelHelper
import utils.exception_helper as ExHelper
import utils.plotter as Plotter
import math
import numpy as np
import utils.dave_logger as logging
import utils.dataset_cache as DsCache
import model.dataset as DataSet
from stingray.events import EventList
from stingray import Powerspectrum, AveragedPowerspectrum
from stingray import Crossspectrum, AveragedCrossspectrum
from stingray import Covariancespectrum, AveragedCovariancespectrum
from stingray.varenergyspectrum import LagEnergySpectrum
from stingray.gti import cross_two_gtis
from stingray.utils import baseline_als
from stingray.modeling import fit_powerspectrum
from stingray.simulator import simulator
import sys

BIG_NUMBER = 9999999999999
PRECISSION = 4


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
                if len(events_table.columns["E"].values) == len(pha_data):
                    return list(e_avg_data.values())
    except:
        logging.error(ExHelper.getException('apply_rmf_file_to_dataset'))

    return []


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
        logging.error(ExHelper.getException('get_plot_data'))

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
        logging.error(ExHelper.getException('get_histogram'))

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
        error_values = lc.countrate_err

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
        logging.error(ExHelper.getException('get_lightcurve'))

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
        logging.error(ExHelper.getException('get_joined_lightcurves'))

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
                result = push_to_results_array_with_errors([], src_lc.countrate, src_lc.countrate_err)
            else:
                count_rate, count_rate_error = get_divided_values_and_error (lightcurves[2].countrate, lightcurves[3].countrate,
                                                                            lightcurves[2].countrate_err, lightcurves[3].countrate_err)
                result = push_to_results_array_with_errors([], count_rate, count_rate_error)

            count_rate, count_rate_error = get_divided_values_and_error (lightcurves[0].countrate, lightcurves[1].countrate,
                                                                        lightcurves[0].countrate_err, lightcurves[1].countrate_err)
            result = push_to_results_array_with_errors(result, count_rate, count_rate_error)

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
        logging.error(ExHelper.getException('get_divided_lightcurves_from_colors'))

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

            count_rate, count_rate_error = get_divided_values_and_error (count_rate_0, count_rate_1,
                                                                        count_rate_error_0, count_rate_error_1)

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
        logging.error(ExHelper.getException('get_divided_lightcurve_ds'))

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
    power_err = []
    duration = []
    warnmsg = []

    try:
        pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type)
        if pds:
            freq = pds.freq
            power = pds.power
            power_err = pds.power_err

            duration = [lc.tseg]
            warnmsg = [""]
            if gti is not None and len(gti) == 0 and DsHelper.hasGTIGaps(lc.time):
                warnmsg = ["GTI gaps found on LC"]

            pds = None  # Dispose memory
            lc = None  # Dispose memory
            gti = None  # Dispose memory

    except:
        logging.error(ExHelper.getException('get_power_density_spectrum'))
        warnmsg = [ExHelper.getWarnMsg()]

    # Preapares the result
    logging.debug("Result power density spectrum .... " + str(len(freq)))
    result = push_to_results_array([], freq)
    result = push_to_results_array_with_errors(result, power, power_err)
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
        logging.error(ExHelper.getException('get_dynamical_spectrum'))
        warnmsg = [ExHelper.getWarnMsg()]

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
    power_err = []
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
            power_err = xs.power_err
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
        logging.error(ExHelper.getException('get_cross_spectrum'))
        warnmsg = [ExHelper.getWarnMsg()]

    # Preapares the result
    logging.debug("Result cross spectrum .... " + str(len(freq)))
    result = push_to_results_array([], freq)
    result = push_to_results_array_with_errors(result, power, power_err)
    result = push_to_results_array(result, time_lag_array)
    result = push_to_results_array(result, coherence_array)
    result = push_to_results_array(result, duration)
    result = push_to_results_array(result, warnmsg)
    return result


# get_covariance_spectrum:
# Returns the energy values and its correlated covariance and covariance errors
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "EVENTS", column = "Time", from=0, to=10 }, ... ]
# @param: dt: The time resolution of the events.
# @param: ref_band_interest : A tuple with minimum and maximum values of the range in the band
#                      of interest in reference channel.
# @param: energy_range: A tuple with minimum and maximum values of the
#         range of energy, send [-1, -1] for use all energies
# @param: n_bands: The number of bands to split the refence band
# @param: std: The standard deviation
#
def get_covariance_spectrum(src_destination, bck_destination, gti_destination, filters, dt, ref_band_interest, energy_range, n_bands, std):

    energy_arr = []
    covariance_arr =[]
    covariance_err_arr = []

    try:

        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        if DsHelper.is_events_dataset(filtered_ds):
            events_table = filtered_ds.tables["EVENTS"]

            if "E" in events_table.columns:

                event_list = np.column_stack((events_table.columns["TIME"].values,
                                             events_table.columns["E"].values))

                band_width = energy_range[1] - energy_range[0]
                band_step = band_width / n_bands
                from_val = energy_range[0]
                band_interest = []
                for i in range(n_bands):
                    band_interest.extend([[energy_range[0] + (i * band_step), energy_range[0] + ((i + 1) * band_step)]])

                if std < 0:
                    std = None

                # Calculates the Covariance Spectrum
                cs = Covariancespectrum(event_list, dt, band_interest=band_interest, ref_band_interest=ref_band_interest, std=std)

                sorted_idx = np.argsort(cs.covar[:,0])
                sorted_covar = cs.covar[sorted_idx]  # Sort covariance values by energy
                sorted_covar_err = cs.covar_error[sorted_idx]  # Sort covariance values by energy
                energy_arr = sorted_covar[:,0]
                covariance_arr = np.nan_to_num(sorted_covar[:,1])
                covariance_err_arr = np.nan_to_num(sorted_covar_err[:,1])

            else:
                logging.warn('get_covariance_spectrum: E column not found!')
        else:
            logging.warn('get_covariance_spectrum: Wrong dataset type!')

    except:
        logging.error(ExHelper.getException('get_covariance_spectrum'))

    # Preapares the result
    result = push_to_results_array([], energy_arr)
    result = push_to_results_array_with_errors(result, covariance_arr, covariance_err_arr)
    return result


# get_phase_lag_spectrum:
# Returns the energy values and its correlated phase lag and lag errors
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
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency, send [-1, -1] for use all frequencies
# @param: energy_range: A tuple with minimum and maximum values of the
#         range of energy, send [-1, -1] for use all energies
# @param: n_bands: The number of bands to split the refence band
#
def get_phase_lag_spectrum(src_destination, bck_destination, gti_destination,
                            filters, axis, dt, nsegm, segm_size, norm, pds_type,
                            freq_range, energy_range, n_bands):

    energy_arr = []
    lag_arr =[]
    lag_err_arr = []
    duration = []
    warnmsg = []
    freq_min_max = [-1, -1]

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

        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        if DsHelper.is_events_dataset(filtered_ds):
            events_table = filtered_ds.tables["EVENTS"]
            min_time = events_table.columns["TIME"].values[0]
            max_time = events_table.columns["TIME"].values[len(events_table.columns["TIME"].values) - 1]
            duration = [(max_time - min_time)]

            if "E" in events_table.columns:

                pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                               filters, axis, dt, nsegm, segm_size, norm, pds_type)
                if pds:

                    #Preapares the eventlist with energies and gtis
                    event_list = EventList()
                    event_list.time = np.array(events_table.columns["TIME"].values)
                    event_list.ncounts = len(event_list.time)
                    event_list.gti = gti
                    event_list.energy = np.array(events_table.columns["E"].values)

                    # Calculates the energy range
                    if energy_range[0] < 0:
                        min_energy = min(event_list.energy)
                    else:
                        min_energy = energy_range[0]

                    if energy_range[1] >= min_energy:
                        max_energy = energy_range[1]
                    else:
                        max_energy = max(event_list.energy)

                    # Calculates the frequency range
                    if freq_range[0] < 0:
                        freq_low = min(pds.freq)
                    else:
                        freq_low = freq_range[0]
                    freq_min_max[0] = freq_low

                    if freq_range[1] < 0:
                        freq_high = max(pds.freq)
                    else:
                        freq_high = freq_range[1]
                    freq_min_max[1] = max([freq_min_max[1], freq_high])

                    # Sets the energy ranges
                    energy_spec = (min_energy, max_energy, n_bands, "lin")
                    ref_band = [min_energy, max_energy]

                    # Calculates the Phase Lag Spectrum
                    les = LagEnergySpectrum(event_list, freq_min_max,
                                            energy_spec, ref_band,
                                            bin_time=dt,
                                            segment_size=segm_size)

                    energy_arr = np.array([(ei[0] + ei[1])/2 for ei in les.energy_intervals])
                    lag_arr = les.spectrum
                    lag_err_arr = les.spectrum_error

                else:
                    logging.warn("get_phase_lag_spectrum: can't create power density spectrum.")
                    warnmsg = ['Cant create PDS']
            else:
                logging.warn('get_phase_lag_spectrum: E column not found!')
                warnmsg = ['E column not found']
        else:
            logging.warn('get_phase_lag_spectrum: Wrong dataset type!')
            warnmsg = ['Wrong dataset type']

    except:
        logging.error(ExHelper.getException('get_phase_lag_spectrum'))
        warnmsg = [ExHelper.getWarnMsg()]

    # Preapares the result
    result = push_to_results_array([], energy_arr)
    result = push_to_results_array_with_errors(result, lag_arr, lag_err_arr)
    result = push_to_results_array(result, duration)
    result = push_to_results_array(result, warnmsg)
    result = push_to_results_array(result, freq_min_max)
    return result


# get_rms_spectrum:
# Returns the energy values and its correlated rms and rms errors
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
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency, send [-1, -1] for use all frequencies
# @param: energy_range: A tuple with minimum and maximum values of the
#         range of energy, send [-1, -1] for use all energies
# @param: n_bands: The number of bands to split the refence band
#
def get_rms_spectrum(src_destination, bck_destination, gti_destination,
                    filters, axis, dt, nsegm, segm_size, norm, pds_type, freq_range, energy_range, n_bands):
    energy_arr = []
    rms_arr =[]
    rms_err_arr = []
    duration = []
    warnmsg = []
    freq_min_max = [-1, -1]

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

        # Prepares GTI if passed
        base_gti = load_gti_from_destination (gti_destination)

        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        if DsHelper.is_events_dataset(filtered_ds):
            events_table = filtered_ds.tables["EVENTS"]
            min_time = events_table.columns["TIME"].values[0]
            max_time = events_table.columns["TIME"].values[len(events_table.columns["TIME"].values) - 1]
            duration = [(max_time - min_time)]

            if "E" in events_table.columns:

                event_list = np.column_stack((events_table.columns["TIME"].values,
                                             events_table.columns["E"].values))

                if energy_range[0] < 0:
                    min_energy = min(event_list[:,1])
                else:
                    min_energy = energy_range[0]

                if energy_range[1] >= min_energy:
                    energy_range = energy_range[1] - min_energy
                else:
                    energy_range = max(event_list[:,1]) - min_energy

                energy_step = energy_range / n_bands

                for i in range(n_bands):

                    energy_low = min_energy + (i * energy_step)
                    energy_high = energy_low + energy_step
                    energy_arr.extend([(energy_low + energy_high) / 2])
                    rms, rms_err = 0, 0

                    try:
                        filtered_event_list = event_list[ (energy_high>event_list[:,1]) & (event_list[:,1]>energy_low) ]
                        if (len(filtered_event_list) > 0):

                            evt_list = EventList(filtered_event_list[:,0], pi=filtered_event_list[:,1])
                            if evt_list and evt_list.ncounts > 0:

                                lc = evt_list.to_lc(dt)
                                if lc:

                                    gti = base_gti
                                    if not gti:
                                        gti = lc.gti

                                    if segm_size > lc.tseg:
                                        segm_size = lc.tseg
                                        logging.warn("get_rms_spectrum: range: " + str(energy_low) + " to " + str(energy_high) + ", segmsize bigger than lc.duration, lc.duration applied instead.")

                                    pds = None
                                    if pds_type == 'Sng':
                                        pds = Powerspectrum(lc, norm=norm, gti=gti)
                                    else:
                                        pds = AveragedPowerspectrum(lc=lc, segment_size=segm_size, norm=norm, gti=gti)

                                    if pds:

                                        if freq_range[0] < 0:
                                            freq_low = min(pds.freq)
                                        else:
                                            freq_low = freq_range[0]

                                        if freq_min_max[0] >= 0:
                                            freq_min_max[0] = min([freq_min_max[0], freq_low])
                                        else:
                                            freq_min_max[0] = freq_low

                                        if freq_range[1] < 0:
                                            freq_high = max(pds.freq)
                                        else:
                                            freq_high = freq_range[1]
                                        freq_min_max[1] = max([freq_min_max[1], freq_high])

                                        rms, rms_err = pds.compute_rms(freq_low, freq_high)

                                    else:
                                        logging.warn("get_rms_spectrum: can't create power density spectrum. Energy range: " + str(energy_low) + " to " + str(energy_high))
                                else:
                                    logging.warn("get_rms_spectrum: can't create lightcurve. Energy range: " + str(energy_low) + " to " + str(energy_high))
                            else:
                                logging.warn("get_rms_spectrum: can't create eventlist or counts are 0. Energy range: " + str(energy_low) + " to " + str(energy_high) + ", counts: " + str(len(filtered_event_list)))
                        else:
                            logging.warn("get_rms_spectrum: range: " + str(energy_low) + " to " + str(energy_high) + " has no events")
                    except:
                        logging.warn(ExHelper.getException('get_rms_spectrum: Energy range: ' + str(energy_low) + ' to ' + str(energy_high)))

                    rms_arr.extend([rms])
                    rms_err_arr.extend([rms_err])

            else:
                logging.warn('get_rms_spectrum: E column not found!')
                warnmsg = ['E column not found']
        else:
            logging.warn('get_rms_spectrum: Wrong dataset type!')
            warnmsg = ['Wrong dataset type']

    except:
        logging.error(ExHelper.getException('get_rms_spectrum'))
        warnmsg = [ExHelper.getWarnMsg()]

    # Preapares the result
    result = push_to_results_array([], energy_arr)
    result = push_to_results_array_with_errors(result, rms_arr, rms_err_arr)
    result = push_to_results_array(result, duration)
    result = push_to_results_array(result, warnmsg)
    result = push_to_results_array(result, freq_min_max)
    return result


# get_plot_data_from_models:
# Returns the plot Y data for each model of an array of models with a given X_axis values
# and the sum of all Y data of models from the given x range
#
# @param: models: array of models, dave_model definition
# @param: x_values: array of float, the x range
#
def get_plot_data_from_models(models, x_values):

    models_arr = []

    try:

        sum_values = []

        for i in range(len(models)):

            model_obj = ModelHelper.get_astropy_model(models[i])
            if model_obj:
                val_array = []
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
        logging.error(ExHelper.getException('get_plot_data_from_models'))

    return models_arr


# get_fit_powerspectrum_result: Returns the PDS of a given dataset
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
# @param: models: array of models
#
def get_fit_powerspectrum_result(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type, models):
    results = []

    try:
        pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type)
        if pds:

            fit_model, starting_pars = ModelHelper.get_astropy_model_from_dave_models(models)
            if fit_model:
                parest, res = fit_powerspectrum(pds, fit_model, starting_pars, max_post=False, priors=None,
                          fitmethod="L-BFGS-B")

                fixed = [fit_model.fixed[n] for n in fit_model.param_names]
                parnames = [n for n, f in zip(fit_model.param_names, fixed) \
                            if f is False]

                params = []
                for i, (x, y, p) in enumerate(zip(res.p_opt, res.err, parnames)):
                    param = dict()
                    param["index"] = i
                    param["name"] = p
                    param["opt"] = x
                    param["err"] = y
                    params.append(param)

                results = push_to_results_array(results, params)

                stats = dict()
                try:
                    stats["deviance"] = res.deviance
                    stats["aic"] = res.aic
                    stats["bic"] = res.bic
                except AttributeError:
                    stats["deviance"] = "ERROR"

                try:
                    stats["merit"] = res.merit
                    stats["dof"] = res.dof  # Degrees of freedom
                    stats["dof_ratio"] = res.merit/res.dof
                    stats["sobs"] = res.sobs
                    stats["sexp"] = res.sobs
                    stats["ssd"] = res.ssd
                except AttributeError:
                    stats["merit"] = "ERROR"

                results = push_to_results_array(results, stats)

                pds = None  # Dispose memory
                lc = None  # Dispose memory
                gti = None  # Dispose memory

            else:
                logging.warn("get_fit_powerspectrum_result: can't create summed model from dave_models.")
        else:
            logging.warn("get_fit_powerspectrum_result: can't create power density spectrum.")

    except:
        logging.error(ExHelper.getException('get_fit_powerspectrum_result'))

    return results


# get_bootstrap_results:
# Returns the data of applying bootstrap error analisys method to a given dave model
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
# @param: models: array of models, dave_model definition with the optimal parammeters
# @param: n_iter: Number of bootstrap iterations
# @param: mean: Mean value of the simulated light curve
# @param: red_noise: The red noise value
# @param: seed: The random state seed for simulator
#
def get_bootstrap_results(src_destination, bck_destination, gti_destination,
                            filters, axis, dt, nsegm, segm_size, norm, pds_type,
                            models, n_iter, mean, red_noise, seed):

    results = []

    try:
        # Gets de power density espectrum from given params
        pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type)
        if pds:

            # Creates the model from dave_model
            fit_model, starting_pars = ModelHelper.get_astropy_model_from_dave_models(models)
            if fit_model:

                # For n_iter: generate the PDS from the fit_model using the Stingray.Simulator
                #             then fit the simulated PDS and record the new model params and the PDS values

                rms, rms_err = pds.compute_rms(min(pds.freq), max(pds.freq))

                if mean <= 0:
                    mean = lc.meanrate
                logging.debug('get_bootstrap_results lc.meanrate: ' + str(lc.meanrate))

                if seed < 0:
                    seed = None

                # N = max([(len(lc.time) + 1), int(math.ceil(segm_size * nsegm))])
                # logging.debug('get_bootstrap_results len(lc.time): ' + str((len(lc.time) + 1)))
                # logging.debug('get_bootstrap_results segm_size * nsegm: ' + str(int(math.ceil(segm_size * nsegm))))
                bins_per_segm = int(math.ceil(segm_size / dt))
                N = int(math.ceil(bins_per_segm / 1024) * 1024)  # max([ bins_per_segm, 1024 ])
                #logging.debug('get_bootstrap_results bins_per_segm: ' + str(bins_per_segm))
                #logging.debug('get_bootstrap_results N: ' + str(N))

                models_params = []
                powers = []

                for i in range(n_iter):
                    try:
                        the_simulator = simulator.Simulator(N=N, dt=dt, mean=mean,
                                                             rms=rms, red_noise=red_noise, random_state=seed)

                        sim_lc = the_simulator.simulate(fit_model)

                        if pds_type == 'Sng':
                            sim_pds = Powerspectrum(sim_lc, norm=norm, gti=gti)
                        else:
                            sim_pds = AveragedPowerspectrum(lc=sim_lc, segment_size=segm_size, norm=norm, gti=gti)

                        parest, res = fit_powerspectrum(sim_pds, fit_model, starting_pars,
                                        max_post=False, priors=None, fitmethod="L-BFGS-B")

                        models_params.append(res.p_opt)
                        powers.append(sim_pds.power)

                    except:
                        logging.error(ExHelper.getException('get_bootstrap_results for i: ' + str(i)))

                models_params = np.array(models_params)
                powers = np.array(powers)

                fixed = [fit_model.fixed[n] for n in fit_model.param_names]
                parnames = [n for n, f in zip(fit_model.param_names, fixed) \
                            if f is False]

                if len(models_params) > 0 and len(powers) == len(models_params):

                    # Histogram all the recorded model parammeters
                    param_errors = []
                    for i in range(models_params.shape[1]):
                        param_values = models_params[:, i]
                        counts, values = DsHelper.get_histogram(param_values, 0.1)

                        # Fit the histogram with a Gaussian an get the optimized parammeters
                        x = np.array(list(counts.keys()))
                        y = np.array(list(counts.values()))
                        amplitude, mean, stddev = ModelHelper.fit_data_with_gaussian(x, y)
                        param = dict()
                        param["index"] = i
                        param["name"] = parnames[i]
                        param["err"] = np.nan_to_num([stddev])
                        param_errors.extend([param])

                    results = push_to_results_array(results, param_errors)

                    # Histogram all the recorded power values
                    power_means = []
                    power_errors = []
                    for i in range(powers.shape[1]):
                        power_values = powers[:, i]
                        counts, values = DsHelper.get_histogram(power_values, 0.1)

                        # Fit the histogram with a Gaussian an get the optimized parammeters
                        x = np.array(list(counts.keys()))
                        y = np.array(list(counts.values()))
                        amplitude, mean, stddev = ModelHelper.fit_data_with_gaussian(x, y)
                        power_means.extend(np.nan_to_num([mean]))
                        power_errors.extend(np.nan_to_num([stddev]))

                    results = push_to_results_array(results, power_means)
                    results = push_to_results_array(results, power_errors)

                else:
                    logging.warn("get_bootstrap_results: can't get model params or powers from the simulated data")
            else:
                logging.warn("get_bootstrap_results: can't create summed model from dave_models.")
        else:
            logging.warn("get_bootstrap_results: can't create power density spectrum.")

    except:
        logging.error(ExHelper.getException('get_bootstrap_results'))

    return results


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
    try:
        column["values"] = np.around(values, decimals=PRECISSION)
    except:
        column["values"] = values
    result.append(column)
    return result


def push_to_results_array_with_errors (result, values, errors):
    column = dict()
    column["values"] = np.around(values, decimals=PRECISSION)
    column["error_values"] = np.around(errors, decimals=PRECISSION)
    result.append(column)
    return result


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

    # Try to get the lightcurve from cache
    cache_key = "LC_" + DsCache.get_key(filtered_ds.id + bck_destination + gti_destination + str(filters) + str(dt), True)
    if DsCache.contains(cache_key):
        logging.debug("Returned cached lightcurve, cache_key: " + cache_key + ", count: " + str(DsCache.count()))
        return DsCache.get(cache_key)

    eventlist = DsHelper.get_eventlist_from_evt_dataset(filtered_ds)
    if not eventlist or len(eventlist.time) == 0:
        logging.warn("Wrong lightcurve counts for eventlist from ds.id -> " + str(filtered_ds.id))
        return None

    filtered_ds = None  # Dispose memory
    lc = eventlist.to_lc(dt)
    if bck_destination:
        lc = apply_background_to_lc(lc, bck_destination, filters, gti_destination, dt)
    eventlist = None  # Dispose memory

    DsCache.add(cache_key, lc)

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
            lc = lc - bck_lc
            bck_lc = None

        else:
            logging.warn("Wrong lightcurve counts for background data...")

        bck_eventlist = None  # Dispose memory
        filtered_bck_ds = None

    else:
        logging.warn("Background dataset is None!, omiting Bck data.")

    return lc


def create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type):

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
        return Powerspectrum(lc, norm=norm, gti=gti), lc, gti
    else:
        return AveragedPowerspectrum(lc=lc, segment_size=segm_size, norm=norm, gti=gti), lc, gti


def load_gti_from_destination (gti_destination):

    # Try to get the gtis from cache
    cache_key = "GTI_" + DsCache.get_key(gti_destination, True)
    if DsCache.contains(cache_key):
        logging.debug("Returned cached gtis, cache_key: " + cache_key + ", count: " + str(DsCache.count()))
        return DsCache.get(cache_key)

    gti = None
    if gti_destination:
        gti_dataset = DaveReader.get_file_dataset(gti_destination)
        if gti_dataset:
            gti = DsHelper.get_stingray_gti_from_gti_table (gti_dataset.tables["GTI"])
            DsCache.add(cache_key, gti)
            logging.debug("Load GTI success")

    return gti

def get_divided_values_and_error (values_0, values_1, error_0, error_1):
    divided_error = np.array([])
    with np.errstate(all='ignore'): # Ignore divisions by 0 and others
        divided_values = np.nan_to_num(values_0 / values_1)
        if error_0.shape == error_1.shape == values_0.shape:
            divided_error = np.nan_to_num((error_0/values_1) + ((error_1 * values_0)/(values_1 * values_1)))
    divided_values[divided_values > BIG_NUMBER]=0
    divided_error[divided_error > BIG_NUMBER]=0
    return divided_values, divided_error
