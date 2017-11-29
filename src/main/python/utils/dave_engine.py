import utils.dave_reader as DaveReader
import utils.dataset_helper as DsHelper
import utils.filters_helper as FltHelper
import utils.model_helper as ModelHelper
import utils.exception_helper as ExHelper
import utils.plotter as Plotter
import math
import numpy as np
import scipy as sp
import utils.dave_logger as logging
import utils.dataset_cache as DsCache
import model.dataset as DataSet
from stingray.events import EventList
from stingray.lightcurve import Lightcurve
from stingray import Powerspectrum, AveragedPowerspectrum, DynamicalPowerspectrum
from stingray import Crossspectrum, AveragedCrossspectrum
from stingray import Covariancespectrum, AveragedCovariancespectrum
from stingray.varenergyspectrum import LagEnergySpectrum
from stingray.gti import cross_two_gtis
from stingray.utils import excess_variance
from stingray.modeling import PSDLogLikelihood, PSDPosterior, PSDParEst
from stingray.simulator import simulator
from stingray.pulse.search import z_n_search, epoch_folding_search, phaseogram, search_best_peaks
from stingray.pulse.pulsar import z2_n_detection_level
from astropy.stats import LombScargle, poisson_conf_interval
from config import CONFIG
import sys


# get_dataset_schema: Returns the schema of a dataset of given file
#
# @param: destination: file destination
#
def get_dataset_schema(destination):
    dataset, cache_key = DaveReader.get_file_dataset(destination)
    if dataset:
        return dataset.get_schema()
    else:
        logging.debug("get_dataset_schema -> Null dataset for file: " + destination)
        return None


# get_dataset_header: Returns the header info of a dataset of given file
#
# @param: destination: file destination
#
def get_dataset_header(destination):
    dataset, cache_key = DaveReader.get_file_dataset(destination)
    if dataset:
        return dataset.get_header()
    else:
        logging.debug("get_dataset_header -> Null dataset for file: " + destination)
        return None


# append_file_to_dataset: Appends Fits data to a dataset
#
# @param: destination: file destination or dataset cache key
# @param: next_destination: file destination of file to append
#
def append_file_to_dataset(destination, next_destination):
    dataset, cache_key = DaveReader.get_file_dataset(destination)
    if dataset:

        # Tries to get TSTART from dataset to set the ofset to next_dataset
        ds_start_time = DsHelper.get_dataset_start_time(dataset)

        next_dataset, next_cache_key = DaveReader.get_file_dataset(next_destination, ds_start_time)
        if next_dataset:

            if DsHelper.are_datasets_of_same_type(dataset, next_dataset):

                if DsHelper.is_lightcurve_dataset(dataset):
                    if DsHelper.get_binsize_from_lightcurve_ds(dataset) == 0 \
                       or DsHelper.get_binsize_from_lightcurve_ds(dataset) != DsHelper.get_binsize_from_lightcurve_ds(next_dataset):
                       logging.error('append_file_to_dataset: Bin Sizes are not readables or not equal!')
                       return ""

                # Looks what dataset is earliest
                next_ds_start_time = DsHelper.get_dataset_start_time(next_dataset)

                if next_ds_start_time < ds_start_time:
                    #Change event times and swap datasets
                    time_offset = ds_start_time - next_ds_start_time
                    DsHelper.add_time_offset_to_dataset(dataset, time_offset)
                    DsHelper.add_time_offset_to_dataset(next_dataset, time_offset)
                    tmp_ds = dataset
                    dataset = next_dataset
                    next_dataset = tmp_ds

                #Join and cache joined dataset
                new_dataset = dataset.clone()
                new_hdutable = DsHelper.get_hdutable_from_dataset(new_dataset)
                next_hdutable = DsHelper.get_hdutable_from_dataset(next_dataset)
                new_dataset.tables[new_hdutable.id] = new_hdutable.join(next_hdutable)
                new_dataset.tables["GTI"] = DsHelper.join_gti_tables(new_dataset.tables["GTI"], next_dataset.tables["GTI"])

                # DsCache.remove(destination)  # Removes previous cached dataset for prev key
                new_cache_key = DsCache.get_key(destination + "|" + next_destination)
                DsCache.add(new_cache_key, new_dataset)  # Adds new cached dataset for new key
                return new_cache_key

            else:
                logging.error('append_file_to_dataset: Datasets are not of same type!')

        else:
            logging.error('append_file_to_dataset: Cant read next dataset from: ' + str(next_destination))

    else:
        logging.error('append_file_to_dataset: Cant read dataset from: ' + str(destination))

    return ""


# apply_rmf_file_to_dataset: Appends Fits data to a dataset
#
# @param: destination: file destination or dataset cache key
# @param: rmf_destination: file destination of file to apply
# @param: column: column to use for the conversion: PHA, or PI for NuSTAR
#
def apply_rmf_file_to_dataset(destination, rmf_destination, column):
    try:
        dataset, cache_key = DaveReader.get_file_dataset(destination)
        if DsHelper.is_events_dataset(dataset):
            rmf_dataset, rmf_cache_key = DaveReader.get_file_dataset(rmf_destination)
            if DsHelper.is_rmf_dataset(rmf_dataset):
                # Applies rmf data to dataset
                events_table = dataset.tables["EVENTS"]
                rmf_table = rmf_dataset.tables["EBOUNDS"]

                if column not in events_table.columns:
                    logging.warn('apply_rmf_file_to_dataset: ' + str(column) +  ' column not found!')
                    return False

                pha_data = events_table.columns[column].values

                e_avg_data = dict((channel, (min + max)/2) for channel, min, max in zip(rmf_table.columns["CHANNEL"].values,
                                                                                    rmf_table.columns["E_MIN"].values,
                                                                                    rmf_table.columns["E_MAX"].values))
                e_values = []
                for i in range(len(pha_data)):
                    if pha_data[i] in e_avg_data:
                        e_values.append(e_avg_data[pha_data[i]])
                    else:
                        e_values.append(0)

                if "E" not in events_table.columns:
                    events_table.add_columns(["E"])
                else:
                    events_table.columns["E"].clear()

                events_table.columns["E"].add_values(e_values)

                DsCache.remove_with_prefix("FILTERED") # Removes all filtered datasets from cache
                DsCache.remove_with_prefix("LC")
                DsCache.add(cache_key, dataset) # Stores dataset on cache
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
#           { type = "2d", ... }
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
            return common_error("No plot type specified on styles")

        if len(axis) < 2:
            return common_error("Wrong number of axis")

        # Plot type mode
        if styles["type"] == "2d":
            return Plotter.get_plotdiv_xy(filtered_ds, axis)

        elif styles["type"] == "3d":
            return Plotter.get_plotdiv_xyz(filtered_ds, axis)

        elif styles["type"] == "scatter":
            return Plotter.get_plotdiv_scatter(filtered_ds, axis)

        else:
            return common_error("Wrong plot type specified on styles")

    except:
        logging.error(ExHelper.getException('get_plot_data'))
        return common_error(ExHelper.getWarnMsg())

    return None


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
# @param: meanflux_opts: Object with the meanflux parameters.
# @param: variance_opts: Object with the excess variance parameters.
#
def get_lightcurve(src_destination, bck_destination, gti_destination,
                    filters, axis, dt, baseline_opts, meanflux_opts,
                    variance_opts):

    time_vals = []
    count_rate = []
    error_values = []
    gti_start_values = []
    gti_stop_values = []
    baseline = []
    meanflux = []
    chunk_times = []
    chunk_lengths = []
    mean = []
    mean_err = []
    excessvar = []
    excessvar_err = []
    excessvarmean = []
    excessvarmean_err = []
    fvar = []
    fvar_err = []
    fvarmean = []
    fvarmean_err = []
    chunk_mean_times = []
    chunk_mean_lengths = []
    confidences = []
    warnmsg = []

    try:
        if len(axis) != 2:
            return common_error("Wrong number of axis")

        # Creates the lightcurve
        lc = get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt)
        if not lc:
            return common_error("Can't create lightcurve or is empty")
        elif not math.isclose(dt, lc.dt, abs_tol=0.001):
            warnmsg = ["@WARN@Overriden Bin Size: " + str(lc.dt)]

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
            baseline = lc.baseline(lam, p, niter, offset_correction=False) / dt  # Baseline from count, divide by dt to get countrate

        # Gets the meanflux values
        if meanflux_opts["niter"] > 0:
            logging.debug("Preparing lightcurve meanflux");
            lam = meanflux_opts["lam"]  # 1000
            p = meanflux_opts["p"]  # 0.01
            niter = meanflux_opts["niter"]  # 10
            meanflux = lc.baseline(lam, p, niter, offset_correction=True) / dt  # Baseline from count, divide by dt to get countrate

        # Gets the Long-Term variability values
        if variance_opts and ("min_counts" in variance_opts) and (variance_opts["min_counts"] > 0):
            logging.debug("Preparing lightcurve excess variance");
            chunk_length = lc.estimate_chunk_length(variance_opts["min_counts"], variance_opts["min_bins"])

            start, stop, res = lc.analyze_lc_chunks(chunk_length, lightcurve_meancount)
            mean = nan_and_inf_to_num(res[0])
            mean_err = nan_and_inf_to_num(res[1])

            chunk_times = np.array([(s + e)/2 for s, e in zip(start, stop)])
            chunk_lengths = np.array([(e - s)/2 for s, e in zip(start, stop)]) # This will be plotted as an error bar on xAxis, soo only need the half of the values

            start, stop, res = lc.analyze_lc_chunks(chunk_length, lightcurve_excvar)
            excessvar = nan_and_inf_to_num(res[0])
            excessvar_err = nan_and_inf_to_num(res[1])

            mean_count = variance_opts["mean_count"]
            len_excessvar = len(excessvar)
            if mean_count > len_excessvar:
                logging.warn("mean_count fixed to " + str(len_excessvar));
                warnmsg = ["@WARN@Mean count fixed to " + str(len_excessvar)]
                mean_count = len_excessvar

            excessvarmean = get_means_from_array(excessvar, mean_count)
            excessvarmean_err = get_means_from_array(excessvar_err, mean_count)

            start, stop, res = lc.analyze_lc_chunks(chunk_length, lightcurve_fractional_rms)
            fvar = nan_and_inf_to_num(res[0])
            fvar_err = nan_and_inf_to_num(res[1])

            fvarmean = get_means_from_array(fvar, mean_count)
            fvarmean_err = get_means_from_array(fvar_err, mean_count)

            chunk_mean_times = get_means_from_array(chunk_times, mean_count)
            chunk_mean_lengths = np.array([l * mean_count for l in chunk_lengths])

            confidences += (mean_confidence_interval(excessvar, confidence=0.90))
            confidences += (mean_confidence_interval(excessvar, confidence=0.99))

            confidences += (mean_confidence_interval(fvar, confidence=0.90))
            confidences += (mean_confidence_interval(fvar, confidence=0.99))

        lc = None  # Dispose memory

    except:
        logging.error(ExHelper.getException('get_lightcurve'))
        return common_error(ExHelper.getWarnMsg())

    # Preapares the result
    logging.debug("Result lightcurve .... " + str(len(time_vals)))
    result = push_to_results_array([], time_vals) #0
    result = push_to_results_array(result, count_rate) #1
    result = push_to_results_array(result, error_values) #2
    result = push_to_results_array(result, gti_start_values) #3
    result = push_to_results_array(result, gti_stop_values) #4
    result = push_to_results_array(result, baseline) #5
    result = push_to_results_array(result, meanflux) #6
    result = push_to_results_array(result, chunk_times) #7
    result = push_to_results_array(result, chunk_lengths) #8
    result = push_to_results_array(result, mean) #9
    result = push_to_results_array(result, mean_err) #10
    result = push_to_results_array(result, excessvar) #11
    result = push_to_results_array(result, excessvar_err) #12
    result = push_to_results_array(result, excessvarmean) #13
    result = push_to_results_array(result, excessvarmean_err) #14
    result = push_to_results_array(result, fvar) #15
    result = push_to_results_array(result, fvar_err) #16
    result = push_to_results_array(result, fvarmean) #17
    result = push_to_results_array(result, fvarmean_err) #18
    result = push_to_results_array(result, chunk_mean_times) #19
    result = push_to_results_array(result, chunk_mean_lengths) #20
    result = push_to_results_array(result, confidences) #21
    result = push_to_results_array(result, warnmsg) #22

    return result


# get_joined_lightcurves: Returns the joined data of LC0 and LC1
#
# @param: lc0_destination: lightcurve 0 file destination
# @param: lc1_destination: lightcurve 1 file destination
# @param: bck0_destination: lightcurve 0 backgrund file destination
# @param: bck1_destination: lightcurve 1 backgrund file destination
# @param: filters: array with the filters to apply
#         [{ table = "RATE", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "RATE", column = "TIME" },
#            { table = "RATE", column = "PHA" } ]
# @param: dt: The time resolution of the events.
#
def get_joined_lightcurves(lc0_destination, lc1_destination, bck0_destination, bck1_destination, filters, axis, dt):

    try:

        if len(axis) != 2:
            return common_error("Wrong number of axis")

        lc0 = get_lightcurve_any_dataset(lc0_destination, bck0_destination, "", filters, dt)
        if not lc0:
            return common_error("Wrong dataset type for lc0")

        lc1 = get_lightcurve_any_dataset(lc1_destination, bck1_destination, "", filters, dt)
        if not lc1:
            return common_error("Wrong dataset type for lc1")

        if lc0.countrate.shape == lc1.countrate.shape:

            # Preapares the result
            logging.debug("Result joined lightcurves ....")
            result = push_to_results_array_with_errors([], lc0.countrate, lc0.countrate_err)
            result = push_to_results_array_with_errors(result, lc1.countrate, lc1.countrate_err)
            return result

        else:
            return common_warn("Lightcurves have different durations.")

    except:
        logging.error(ExHelper.getException('get_joined_lightcurves'))
        return common_error(ExHelper.getWarnMsg())

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
        return common_error("Wrong number of axis")

    try:
        filters = FltHelper.apply_bin_size_to_filters(filters, dt)

        color_keys = FltHelper.get_color_keys_from_filters(filters)

        if len(color_keys) != 2 and len(color_keys) != 4:
            return common_error("Wrong number of color filters")

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
                return common_error("Cant create source lc")

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
            return common_warn("Cant create the colors filtered ligthcurves")

    except:
        logging.error(ExHelper.getException('get_divided_lightcurves_from_colors'))
        return common_error(ExHelper.getWarnMsg())

    return None


# get_divided_lightcurve_ds: Returns a new dataset key for the LC0 divided by LC1
#
# @param: lc0_destination: lightcurve 0 file destination
# @param: lc1_destination: lightcurve 1 file destination
# @param: lc0_bck_destination: lightcurve 0 background file destination
# @param: lc1_bck_destination: lightcurve 1 background file destination
#
def get_divided_lightcurve_ds(lc0_destination, lc1_destination, lc0_bck_destination, lc1_bck_destination):

    try:

        count_rate_0, count_rate_error_0 = get_countrate_from_lc_ds (lc0_destination, lc0_bck_destination, "lc0_ds", "lc0_bck")
        if count_rate_0 is None:
            return ""

        count_rate_1, count_rate_error_1 = get_countrate_from_lc_ds (lc1_destination, lc1_bck_destination, "lc1_ds", "lc1_bck")
        if count_rate_1 is None:
            return ""

        if count_rate_0.shape == count_rate_1.shape:

            lc_ds, lc_cache_key = DaveReader.get_file_dataset(lc0_destination)
            ret_lc_ds = lc_ds.clone(True)

            count_rate, count_rate_error = get_divided_values_and_error (count_rate_0, count_rate_1,
                                                                        count_rate_error_0, count_rate_error_1)

            ret_lc_ds.tables["RATE"].columns["RATE"].clear()
            ret_lc_ds.tables["RATE"].columns["RATE"].add_values(count_rate, count_rate_error)

            new_cache_key = DsCache.get_key(lc0_destination + "|" + lc1_destination + "|ligthcurve")
            DsCache.add(new_cache_key, ret_lc_ds)  # Adds new cached dataset for new key
            return new_cache_key

        else:
            logging.warn("Lightcurves have different shapes.")
            return ""

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
# @param: df: If not 0 is the frequency rebining value
#
def get_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type, df=0):

    freq = []
    power = []
    power_err = []
    duration = []
    warnmsg = []

    try:
        pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type, df)
        if pds:
            freq = pds.freq
            power = pds.power
            power_err = pds.power_err

            duration = [lc.tseg]
            warnmsg = [""]
            if gti is not None and len(gti) == 0 and DsHelper.hasGTIGaps(lc.time):
                warnmsg = ["@WARN@GTI gaps found on LC"]
            if not math.isclose(dt, lc.dt, abs_tol=0.001):
                warnmsg = ["@WARN@Overriden Bin Size: " + str(lc.dt)]

            pds = None  # Dispose memory
            lc = None  # Dispose memory
            gti = None  # Dispose memory

    except:
        logging.error(ExHelper.getException('get_power_density_spectrum'))
        help_msg = ""
        if len(freq) == 0 and pds_type != 'Sng':
            help_msg = " Try with PDSType: Single or a smaller segment length."
        warnmsg = [ExHelper.getWarnMsg() + help_msg]

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
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency
# @param: df: If not 0 is the frequency rebining value
#
def get_dynamical_spectrum(src_destination, bck_destination, gti_destination,
                            filters, axis, dt, nsegm, segm_size, norm, freq_range, df=0):

    freq = []
    power_all = []
    time = []
    duration = []
    warnmsg = []

    try:
        if len(axis) != 2:
            return common_error("Wrong number of axis")

        if norm not in ['frac', 'abs', 'leahy', 'none']:
            return common_error("Wrong normalization")

        if segm_size == 0:
            segm_size = None

        warnmsg = [""]

        # Creates the lightcurve
        lc = get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt)
        if not lc:
            return common_error("Can't create lightcurve or is empty")
        elif not math.isclose(dt, lc.dt, abs_tol=0.001):
            warnmsg = ["@WARN@Overriden Bin Size: " + str(lc.dt)]

        # Prepares GTI if passed
        gti = load_gti_from_destination (gti_destination)
        if not gti:
            logging.debug("External GTIs not loaded using defaults")
            gti = lc.gti

        # Check if there is only one GTI and tries to split it by segm_size
        if gti is not None and len(gti) == 1:
            logging.debug("Only one GTI found, splitting by segm_size")
            new_gtis = DsHelper.get_splited_gti(gti[0], segm_size)
            if new_gtis is not None:
                gti = new_gtis
                warnmsg = ["@WARN@GTIs obtained by splitting with segment length"]
            else:
                warnmsg = ["@WARN@The GTI is not splitable by segment length"]
                logging.warn("Can't create splitted gtis from segm_size")

        # Creates the power density spectrum
        logging.debug("Create dynamical spectrum")

        pds = DynamicalPowerspectrum(lc=lc, segment_size=segm_size, norm=norm, gti=gti)

        if pds:

            if df > 0:
                pds.rebin_frequency(df)

            filtered_indexes = np.where((pds.freq >= freq_range[0]) & (pds.freq <= freq_range[1]))[0]
            freq = pds.freq[filtered_indexes]
            time = pds.time
            logging.debug("freq: " + str(freq.shape))
            logging.debug("time: " + str(time.shape))
            logging.debug("dyn_ps: " + str(pds.dyn_ps.shape))
            for tmp_pds in np.transpose(pds.dyn_ps):
                power_all = push_to_results_array(power_all, tmp_pds[filtered_indexes])

            duration = [lc.tseg]

            if gti is not None and len(gti) == 0 and DsHelper.hasGTIGaps(lc.time):
                warnmsg = ["@WARN@GTI gaps found on LC"]

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
            return common_error("Wrong number of axis 1")

        if len(axis2) != 2:
            return common_error("Wrong number of axis 1")

        if norm not in ['frac', 'abs', 'leahy', 'none']:
            return common_error("Wrong normalization")

        if xds_type not in ['Sng', 'Avg']:
            return common_error("Wrong cross spectrum type")

        if segm_size == 0:
            segm_size = None

        # Creates the lightcurve 1
        lc1 = get_lightcurve_any_dataset(src_destination1, bck_destination1, gti_destination1, filters1, dt1)
        if not lc1:
            return common_error("Cant create lightcurve 1")

        # Prepares GTI1 if passed
        gti1 = load_gti_from_destination (gti_destination1)
        if not gti1:
            logging.debug("External GTIs 1 not loaded using defaults")
            gti1 = lc1.gti

        # Creates the lightcurve 2
        lc2 = get_lightcurve_any_dataset(src_destination2, bck_destination2, gti_destination2, filters2, dt2)
        if not lc2:
            return common_error("Cant create lightcurve 2")

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
            if xds_type == 'Sng':
                time_lag, time_lag_err = xs.time_lag(), np.array([])
                coherence, coherence_err = xs.coherence(), np.array([])
            else:
                time_lag, time_lag_err = xs.time_lag()
                coherence, coherence_err = xs.coherence()

            # Replace posible out of range values
            time_lag = nan_and_inf_to_num(time_lag)
            time_lag[time_lag > CONFIG.BIG_NUMBER]=0
            time_lag_err = nan_and_inf_to_num(time_lag_err)
            time_lag_err[time_lag_err > CONFIG.BIG_NUMBER]=0
            time_lag_array = [ time_lag, time_lag_err ]

            coherence = nan_and_inf_to_num(coherence)
            coherence[coherence > CONFIG.BIG_NUMBER]=0
            coherence_err = nan_and_inf_to_num(coherence_err)
            coherence_err[coherence_err > CONFIG.BIG_NUMBER]=0
            coherence_array = [ coherence, coherence_err ]

            # Set duration and warnmsg
            duration = [lc1.tseg, lc2.tseg]
            warnmsg = []
            if gti1 is not None and len(gti1) == 0 and DsHelper.hasGTIGaps(lc1.time):
                warnmsg.append("@WARN@GTI gaps found on LC 1")
            if gti2 is not None and len(gti2) == 0 and DsHelper.hasGTIGaps(lc2.time):
                warnmsg.append("@WARN@GTI gaps found on LC 2")

            xs = None  # Dispose memory

        lc1 = None  # Dispose memory
        lc2 = None  # Dispose memory

    except:
        logging.error(ExHelper.getException('get_cross_spectrum'))
        help_msg = ""
        if len(freq) == 0 and xds_type != 'Sng':
            help_msg = " Try with PDSType: Single a smaller segment length."
        warnmsg = [ExHelper.getWarnMsg() + help_msg]

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
            time_vals = events_table.columns[CONFIG.TIME_COLUMN].values

            if len(time_vals) > 0:
                if "E" in events_table.columns:

                    if (time_vals[len(time_vals) - 1] - time_vals[0]) >= dt:

                        event_list = np.column_stack((time_vals, events_table.columns["E"].values))

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
                        covariance_arr = nan_and_inf_to_num(sorted_covar[:,1])
                        covariance_err_arr = nan_and_inf_to_num(sorted_covar_err[:,1])

                    else:
                        logging.warn('get_covariance_spectrum: Lc duration must be greater than bin size!')
                        return common_error("LC duration must be greater than bin size")
                else:
                    logging.warn('get_covariance_spectrum: E column not found!')
                    return common_error("E column not found")
            else:
                logging.warn('get_covariance_spectrum: No events data!')
                return common_error('No events data')
        else:
            logging.warn('get_covariance_spectrum: Wrong dataset type!')
            return common_error("Wrong dataset type")

    except:
        logging.error(ExHelper.getException('get_covariance_spectrum'))
        return common_error(ExHelper.getWarnMsg())

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
# @param: df: If not 0 is the frequency rebining value
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency, send [-1, -1] for use all frequencies
# @param: energy_range: A tuple with minimum and maximum values of the
#         range of energy, send [-1, -1] for use all energies
# @param: n_bands: The number of bands to split the refence band
#
def get_phase_lag_spectrum(src_destination, bck_destination, gti_destination,
                            filters, axis, dt, nsegm, segm_size, norm, pds_type, df,
                            freq_range, energy_range, n_bands):

    energy_arr = []
    lag_arr =[]
    lag_err_arr = []
    duration = []
    warnmsg = []
    freq_min_max = [-1, -1]

    try:

        if len(axis) != 2:
            return common_error("Wrong number of axis")

        if norm not in ['frac', 'abs', 'leahy', 'none']:
            return common_error("Wrong normalization")

        if pds_type not in ['Sng', 'Avg']:
            return common_error("Wrong power density spectrum type")

        if segm_size == 0:
            segm_size = None

        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        if DsHelper.is_events_dataset(filtered_ds):
            events_table = filtered_ds.tables["EVENTS"]
            if len(events_table.columns[CONFIG.TIME_COLUMN].values) > 0:
                min_time = events_table.columns[CONFIG.TIME_COLUMN].values[0]
                max_time = events_table.columns[CONFIG.TIME_COLUMN].values[len(events_table.columns[CONFIG.TIME_COLUMN].values) - 1]
                duration = [(max_time - min_time)]

                if "E" in events_table.columns:

                    pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                                   filters, axis, dt, nsegm, segm_size, norm, pds_type, df)
                    if pds:

                        if not math.isclose(dt, lc.dt, abs_tol=0.001):
                            warnmsg = ["@WARN@Overriden Bin Size: " + str(lc.dt)]

                        #Preapares the eventlist with energies and gtis
                        event_list = EventList()
                        event_list.time = np.array(events_table.columns[CONFIG.TIME_COLUMN].values)
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
                logging.warn('get_phase_lag_spectrum: No events data!')
                warnmsg = ['No events data']
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
# @param: df: If not 0 is the frequency rebining value
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency, send [-1, -1] for use all frequencies
# @param: energy_range: A tuple with minimum and maximum values of the
#         range of energy, send [-1, -1] for use all energies
# @param: n_bands: The number of bands to split the refence band
# @param: x_type: Defines de values for x_axis data, "energy" by default or "countrate"
#
def get_rms_spectrum(src_destination, bck_destination, gti_destination,
                    filters, axis, dt, nsegm, segm_size, norm, pds_type, df,
                    freq_range, energy_range, n_bands, x_type):
    xaxis_arr = []
    rms_arr =[]
    rms_err_arr = []
    duration = []
    warnmsg = []
    freq_min_max = [-1, -1]

    try:

        if len(axis) != 2:
            return common_error("Wrong number of axis")

        if norm not in ['frac', 'abs', 'leahy', 'none']:
            return common_error("Wrong normalization")

        if pds_type not in ['Sng', 'Avg']:
            return common_error("Wrong power density spectrum type")

        if segm_size == 0:
            segm_size = None

        if x_type not in ['energy', 'countrate']:
            x_type = "energy"

        # Prepares GTI if passed
        base_gti = load_gti_from_destination (gti_destination)

        filters = FltHelper.get_filters_clean_color_filters(filters)

        filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)

        if DsHelper.is_events_dataset(filtered_ds):
            events_table = filtered_ds.tables["EVENTS"]
            if len(events_table.columns[CONFIG.TIME_COLUMN].values) > 0:
                min_time = events_table.columns[CONFIG.TIME_COLUMN].values[0]
                max_time = events_table.columns[CONFIG.TIME_COLUMN].values[len(events_table.columns[CONFIG.TIME_COLUMN].values) - 1]
                duration = [(max_time - min_time)]

                if "E" in events_table.columns:

                    event_list = np.column_stack((events_table.columns[CONFIG.TIME_COLUMN].values,
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

                        if x_type == "energy":
                            xaxis_arr.extend([(energy_low + energy_high) / 2])

                        rms, rms_err = 0, 0

                        try:
                            filtered_event_list = event_list[ (energy_high>event_list[:,1]) & (event_list[:,1]>energy_low) ]
                            if (len(filtered_event_list) > 0):

                                evt_list = EventList(filtered_event_list[:,0], pi=filtered_event_list[:,1])
                                if evt_list and evt_list.ncounts > 1:

                                    if (evt_list.time[evt_list.ncounts - 1] - evt_list.time[0]) >= dt:

                                        lc = evt_list.to_lc(dt)
                                        if lc:

                                            if x_type == "countrate":
                                                xaxis_arr.extend([lc.meanrate])

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

                                                if df > 0:
                                                    pds = pds.rebin(df=df)

                                                #pds = rebin_spectrum_if_necessary(pds)

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
                                        logging.warn("get_rms_spectrum: can't create lightcurve. Not enougth duration. Energy range: " + str(energy_low) + " to " + str(energy_high))
                                else:
                                    logging.warn("get_rms_spectrum: can't create eventlist or counts are 0. Energy range: " + str(energy_low) + " to " + str(energy_high) + ", counts: " + str(len(filtered_event_list)))
                            else:
                                logging.warn("get_rms_spectrum: range: " + str(energy_low) + " to " + str(energy_high) + " has no events")
                        except:
                            logging.warn(ExHelper.getException('get_rms_spectrum: Energy range: ' + str(energy_low) + ' to ' + str(energy_high)))

                        rms_arr.extend([rms])
                        rms_err_arr.extend([rms_err])

                    # If x_type is countrate we need to sort values
                    if x_type == "countrate":
                        sorted_idx = np.argsort(xaxis_arr)
                        xaxis_arr = np.array(xaxis_arr)[sorted_idx]
                        rms_arr = np.array(rms_arr)[sorted_idx]
                        rms_err_arr = np.array(rms_err_arr)[sorted_idx]
                        
                else:
                    logging.warn('get_rms_spectrum: E column not found!')
                    warnmsg = ['E column not found']
            else:
                logging.warn('get_rms_spectrum: No events data!')
                warnmsg = ['No events data']
        else:
            logging.warn('get_rms_spectrum: Wrong dataset type!')
            warnmsg = ['Wrong dataset type']

    except:
        logging.error(ExHelper.getException('get_rms_spectrum'))
        warnmsg = [ExHelper.getWarnMsg()]

    # Preapares the result
    result = push_to_results_array([], xaxis_arr)
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
                    models_arr = push_to_results_array(models_arr, nan_and_inf_to_num(val_array))
                    if len (sum_values) == 0:
                        sum_values = val_array
                    else:
                        sum_values = np.sum([sum_values, val_array], axis=0)

        models_arr = push_to_results_array(models_arr, sum_values)

    except:
        logging.error(ExHelper.getException('get_plot_data_from_models'))
        return common_error(ExHelper.getWarnMsg())

    return models_arr


# get_fit_powerspectrum_result:
# Returns the results of fitting a PDS with an astropy model. If priors are
# sent the a Bayesian parameter estimation is calculated, else a Maximum Likelihood Fitting
# is used as default.
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
# @param: df: If not 0 is the frequency rebining value
# @param: models: array of models, dave_model definition with the starting parameters
# @param: priors: array of priors, dave_priors defined for each model parameters
# @param: sampling_params: dict with the parameter values for do the MCMC sampling
#
def get_fit_powerspectrum_result(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type, df,
                                models, priors=None, sampling_params=None):
    results = []

    try:
        pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type, df)
        lc = None  # Dispose memory
        gti = None  # Dispose memory

        if pds:
            results = fit_power_density_spectrum(pds, models, priors=priors, sampling_params=sampling_params)
            pds = None  # Dispose memory
        else:
            logging.warn("get_fit_powerspectrum_result: can't create power density spectrum.")

    except:
        logging.error(ExHelper.getException('get_fit_powerspectrum_result'))
        return common_error(ExHelper.getWarnMsg())

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
# @param: df: If not 0 is the frequency rebining value
# @param: models: array of models, dave_model definition with the optimal parameters
# @param: n_iter: Number of bootstrap iterations
# @param: mean: Mean value of the simulated light curve
# @param: red_noise: The red noise value
# @param: seed: The random state seed for simulator
#
def get_bootstrap_results(src_destination, bck_destination, gti_destination,
                            filters, axis, dt, nsegm, segm_size, norm, pds_type, df,
                            models, n_iter, mean, red_noise, seed):

    results = []

    try:
        # Gets de power density espectrum from given params
        pds, lc, gti = create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type, df)
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

                        if sim_pds:

                            if df > 0:
                                pds = pds.rebin(df=df)

                            #sim_pds = rebin_spectrum_if_necessary(sim_pds)

                            parest, res = fit_powerspectrum(sim_pds, fit_model, starting_pars,
                                            max_post=False, priors=None, fitmethod="L-BFGS-B")

                            models_params.append(res.p_opt)
                            powers.append(sim_pds.power)

                        else:
                            logging.warn(ExHelper.getException('get_bootstrap_results: cant create powerspectrum for i: ' + str(i)))
                    except:
                        logging.error(ExHelper.getException('get_bootstrap_results for i: ' + str(i)))

                models_params = np.array(models_params)
                powers = np.array(powers)

                fixed = [fit_model.fixed[n] for n in fit_model.param_names]
                parnames = [n for n, f in zip(fit_model.param_names, fixed) \
                            if f is False]

                if len(models_params) > 0 and len(powers) == len(models_params):

                    # Histogram all the recorded model parameters
                    param_errors = []
                    for i in range(models_params.shape[1]):
                        param_values = models_params[:, i]
                        counts, values = DsHelper.get_histogram(param_values, 0.1)

                        # Fit the histogram with a Gaussian an get the optimized parameters
                        x = np.array(list(counts.keys()))
                        y = np.array(list(counts.values()))
                        amplitude, mean, stddev = ModelHelper.fit_data_with_gaussian(x, y)
                        param = dict()
                        param["index"] = i
                        param["name"] = parnames[i]
                        param["err"] = nan_and_inf_to_num([stddev])
                        param_errors.extend([param])

                    results = push_to_results_array(results, param_errors)

                    # Histogram all the recorded power values
                    power_means = []
                    power_errors = []
                    for i in range(powers.shape[1]):
                        power_values = powers[:, i]
                        counts, values = DsHelper.get_histogram(power_values, 0.1)

                        # Fit the histogram with a Gaussian an get the optimized parameters
                        x = np.array(list(counts.keys()))
                        y = np.array(list(counts.values()))
                        amplitude, mean, stddev = ModelHelper.fit_data_with_gaussian(x, y)
                        power_means.extend(nan_and_inf_to_num([mean]))
                        power_errors.extend(nan_and_inf_to_num([stddev]))

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
        return common_error(ExHelper.getWarnMsg())

    return results


# get_lomb_scargle_results:
# Returns LombScargle frequencies and powers from a given lightcurve
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
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency, send [-1, -1] for use all frequencies
# @param: nyquist_factor: Average Nyquist frequency factor
# @param: ls_norm: Periodogram normalization ["standard", "model", "log", "psd"]
# @param: samples_per_peak: Points across each significant periodogram peak
#
def get_lomb_scargle_results(src_destination, bck_destination, gti_destination,
                    filters, axis, dt, freq_range, nyquist_factor, ls_norm, samples_per_peak):
    frequency = []
    power = []
    power_err = []
    duration = []
    warnmsg = []

    try:

        if len(axis) != 2:
            return common_error("Wrong number of axis")

        warnmsg = [""]

        # Calculates the LombScargle values
        frequency, power, lc = get_lomb_scargle(src_destination, bck_destination, gti_destination,
                            filters, axis, dt, freq_range, nyquist_factor, ls_norm, samples_per_peak)
        if not lc:
            return common_error("Can't create lightcurve or is empty")
        elif not math.isclose(dt, lc.dt, abs_tol=0.001):
            warnmsg = ["@WARN@Overriden Bin Size: " + str(lc.dt)]

        duration = [lc.tseg]

        if lc.gti is not None and len(lc.gti) == 0 and DsHelper.hasGTIGaps(lc.time):
            warnmsg = ["@WARN@GTI gaps found on LC"]
        lc = None  # Dispose memory

    except:
        logging.error(ExHelper.getException('get_lomb_scargle_results'))
        warnmsg = [ExHelper.getWarnMsg()]

    # Preapares the result
    result = push_to_results_array([], frequency)
    result = push_to_results_array_with_errors(result, power, power_err)
    result = push_to_results_array(result, duration)
    result = push_to_results_array(result, warnmsg)
    return result


# get_fit_lomb_scargle_result:
# Returns the results of fitting a LombScargle with an astropy model. If priors are
# sent the a Bayesian parameter estimation is calculated, else a Maximum Likelihood Fitting
# is used as default.
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
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency, send [-1, -1] for use all frequencies
# @param: nyquist_factor: Average Nyquist frequency factor
# @param: ls_norm: Periodogram normalization ["standard", "model", "log", "psd"]
# @param: samples_per_peak: Points across each significant periodogram peak
# @param: models: array of models, dave_model definition with the starting parameters
# @param: priors: array of priors, dave_priors defined for each model parameters
# @param: sampling_params: dict with the parameter values for do the MCMC sampling
#
def get_fit_lomb_scargle_result(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, freq_range, nyquist_factor, ls_norm, samples_per_peak,
                                models, priors=None, sampling_params=None):
    results = []

    try:
        # Calculates the LombScargle values
        frequency, power, lc = get_lomb_scargle(src_destination, bck_destination, gti_destination,
                            filters, axis, dt, freq_range, nyquist_factor, ls_norm, samples_per_peak)
        if not lc:
            return common_error("Can't create lightcurve or is empty")

        pds = Powerspectrum()
        pds.freq = frequency
        pds.power = power

        if pds:
            results = fit_power_density_spectrum(pds, models, priors=priors, sampling_params=sampling_params)
            pds = None  # Dispose memory
        else:
            logging.warn("get_fit_lomb_scargle_result: can't create power spectrum.")

    except:
        logging.error(ExHelper.getException('get_fit_lomb_scargle_result'))
        return common_error(ExHelper.getWarnMsg())

    return results


# get_pulse_search: Returns z_n_search or epoch_folding results of a given events dataset
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
# @param: freq_range: A tuple with minimum and maximum values of the
#         range of frequency
# @param: mode: Pulse search merhod ["epoch_folding", "z_n_search"].
# @param: oversampling: Pulse peak oversampling.
# @param: nharm: Number of harmonics.
# @param: nbin: Number of bins of the folded profiles.
# @param: segment_size: Length of the segments to be averaged in the periodogram.
#
def get_pulse_search(src_destination, bck_destination, gti_destination, filters, axis,
                   dt, freq_range, mode="z_n_search", oversampling=15, nharm=4, nbin=128, segment_size=5000):
    freq = []
    zstat = []
    cand_freqs_z = []
    cand_stat_z = []

    try:

        if len(axis) != 2:
            return common_error("Wrong number of axis")

        if mode not in ['epoch_folding', 'z_n_search']:
            logging.warn("Wrong mode, using default: z_n_search")
            mode = "z_n_search"

        filters = FltHelper.get_filters_clean_color_filters(filters)
        filters = FltHelper.apply_bin_size_to_filters(filters, dt)

        ds = get_filtered_dataset(src_destination, filters, gti_destination)
        if not ds:
            return common_error("Cant read dataset!")

        # Gets time data
        time_data = np.array(ds.tables[axis[0]["table"]].columns[axis[0]["column"]].values)

        tseg = np.median(np.diff(time_data))
        logging.debug("tseg: " + str(tseg))

        # We will search for pulsations over a range
        # of frequencies around the known pulsation period.

        # Calculates frequencies from min frequency, and frequency step
        df_min = 1/(max(time_data) - min(time_data))
        df = df_min / oversampling
        frequencies = np.arange(freq_range[0], freq_range[1], df)

        weights=1
        if DsHelper.is_lightcurve_dataset(ds):
            weights = np.array(ds.tables["RATE"].columns["RATE"].values)

        if mode == "z_n_search":
            freq, zstat = z_n_search(time_data, frequencies, nbin=nbin, \
                                    nharm=nharm, segment_size=segment_size, weights=weights)
        else:
            freq, zstat = epoch_folding_search(time_data, frequencies, nbin=nbin, \
                                    segment_size=segment_size, weights=weights)

        z_detlev = z2_n_detection_level(n=1, epsilon=0.001, ntrial=len(freq))
        cand_freqs_z, cand_stat_z = search_best_peaks(freq, zstat, z_detlev)

    except:
        logging.error(ExHelper.getException('get_pulse_search'))
        return common_error(ExHelper.getWarnMsg())

    # Preapares the result
    result = push_to_results_array([], freq)
    result = push_to_results_array(result, zstat)
    result = push_to_results_array(result, cand_freqs_z)
    result = push_to_results_array(result, cand_stat_z)
    return result


# get_phaseogram: Returns phaseogram of a given events dataset
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
# @param: f: Pulse frequency.
# @param: nph: Number of phase bins.
# @param: nt: Number of time bins.
#
def get_phaseogram(src_destination, bck_destination, gti_destination, filters, axis,
                   dt, f, nph, nt, fdot=0, fddot=0, binary_parameters=None):
    phaseogr = []
    phases = []
    times = []
    mean_phases = []
    profile = []
    error_dist = []

    try:

        if len(axis) != 2:
            return common_error("Wrong number of axis")

        filters = FltHelper.get_filters_clean_color_filters(filters)
        filters = FltHelper.apply_bin_size_to_filters(filters, dt)

        ds = get_filtered_dataset(src_destination, filters, gti_destination)
        if not ds:
            return common_error("Cant read dataset!")

        weights=None
        if DsHelper.is_lightcurve_dataset(ds):
            weights = np.array(ds.tables["RATE"].columns["RATE"].values)

        # Prepares the phaseogram parameters
        time_data = np.array(ds.tables[axis[0]["table"]].columns[axis[0]["column"]].values)

        pepoch = None
        if len(ds.tables["GTI"].columns["START"].values) > 0:
            pepoch = ds.tables["GTI"].columns["START"].values[0]

        delay_times = 0
        orbital_period = time_data[-1] - time_data[0]
        asini = 0
        t0 = pepoch
        prev_t0 = 0
        if not binary_parameters is None:
            if binary_parameters[0] > 0:
                orbital_period=binary_parameters[0]
            if binary_parameters[1] > 0:
                asini=binary_parameters[1]
            if binary_parameters[2] > 0:
                t0=binary_parameters[2]
            delay_times = asini * np.sin(2 * np.pi * (time_data - t0) / orbital_period)

        corrected_times = time_data - delay_times

        # Calculate the phaseogram plot data
        phaseogr, phases, times, additional_info = phaseogram(corrected_times, f, nph=nph, nt=nt,
                                                                fdot=fdot, fddot=fddot, plot=False,
                                                                pepoch=pepoch, weights=weights)
        phaseogr = np.transpose(phaseogr)

        # Calculates the profile plot data
        mean_phases = (phases[:-1] + phases[1:]) / 2
        profile = np.sum(phaseogr, axis=1)
        mean_profile = np.mean(profile)
        if np.all(mean_phases < 1.5):
            mean_phases = np.concatenate((mean_phases, mean_phases + 1))
            profile = np.concatenate((profile, profile))
        err_low, err_high = poisson_conf_interval(mean_profile, interval='frequentist-confidence', sigma=1)
        error_dist = [err_low, err_high]


    except:
        logging.error(ExHelper.getException('get_phaseogram'))
        return common_error(ExHelper.getWarnMsg())

    # Preapares the result
    result = push_to_results_array([], phaseogr)
    result = push_to_results_array(result, phases)
    result = push_to_results_array(result, times)
    result = push_to_results_array(result, mean_phases)
    result = push_to_results_array(result, profile)
    result = push_to_results_array(result, error_dist)
    return result


# ----- HELPER FUNCTIONS.. NOT EXPOSED  -------------

def get_filtered_dataset(destination, filters, gti_destination=""):

    # Try to get filtered dataset from cache
    cache_key = "FILTERED_" + DsCache.get_key(destination + gti_destination + str(filters), True)
    if DsCache.contains(cache_key):
        logging.debug("Returned cached filtered dataset, cache_key: " + cache_key + ", count: " + str(DsCache.count()))
        return DsCache.get(cache_key)

    dataset, ds_cache_key = DaveReader.get_file_dataset(destination)
    if not dataset:
        logging.warn("get_filtered_dataset: destination specified but not loadable.")
        return None

    if gti_destination:
        gti_dataset, gti_cache_key = DaveReader.get_file_dataset(gti_destination)
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
        column["values"] = np.around(values, decimals=CONFIG.PRECISION)
    except:
        column["values"] = values
    result.append(column)
    return result


def push_to_results_array_with_errors (result, values, errors):
    column = dict()
    column["values"] = np.around(nan_and_inf_to_num(values), decimals=CONFIG.PRECISION)
    column["error_values"] = np.around(nan_and_inf_to_num(errors), decimals=CONFIG.PRECISION)
    result.append(column)
    return result


def nan_and_inf_to_num (obj):
    if isinstance(obj, int) \
        or isinstance(obj, np.integer) \
        or isinstance(obj, float) \
        or isinstance(obj, np.floating):
        if obj > CONFIG.BIG_NUMBER:
            return CONFIG.BIG_NUMBER
        if obj < -CONFIG.BIG_NUMBER:
            return -CONFIG.BIG_NUMBER
        if np.isnan(obj):
            return 0

    elif isinstance(obj, np.ndarray):
        # Checks if any element is NaN of Inf and replaces it for BIG_NUMBER or 0
        # This is the fastest way to check it:
        # https://stackoverflow.com/questions/6736590/fast-check-for-nan-in-numpy
        if not np.isfinite(np.dot(obj, obj)):
            obj[np.isposinf(obj)] = CONFIG.BIG_NUMBER
            obj[np.isneginf(obj)] = -CONFIG.BIG_NUMBER
            obj[np.isnan(obj)] = 0

    return obj


def get_color_axis_for_ds():
    color_axis = [dict() for i in range(2)]
    color_axis[0]["table"] = "EVENTS"
    color_axis[0]["column"] = CONFIG.TIME_COLUMN
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

    if DsHelper.is_events_dataset(filtered_ds):
        # Creates lightcurves by gti and joins in one
        logging.debug("Create lightcurve from evt dataset")
        return get_lightcurve_from_events_dataset(filtered_ds, bck_destination, filters, gti_destination, dt)

    elif DsHelper.is_lightcurve_dataset(filtered_ds):
        #If dataset is LIGHTCURVE type
        logging.debug("Create lightcurve from lc dataset")
        gti = load_gti_from_destination (gti_destination)
        lc = DsHelper.get_lightcurve_from_lc_dataset(filtered_ds, gti=gti)

        #Applies background data if setted
        if bck_destination:

            #Gets the backscale keyword value
            src_backscale = None
            if "BACKSCAL" in filtered_ds.tables["RATE"].header:
                src_backscale = int(filtered_ds.tables["RATE"].header["BACKSCAL"])

            #Applies background data
            lc = apply_background_to_lc(lc, bck_destination, filters, gti_destination, dt, src_backscale)

        return lc

    else:
        logging.warn("Wrong dataset type")
        return None


def get_lightcurve_from_events_dataset(filtered_ds, bck_destination, filters, gti_destination, dt):

    # Try to get the lightcurve from cache
    cache_key = "LC_" + DsCache.get_key(filtered_ds.id + bck_destination + gti_destination + str(filters) + str(dt), True)
    if DsCache.contains(cache_key):
        logging.debug("Returned cached lightcurve, cache_key: " + cache_key + ", count: " + str(DsCache.count()))
        return DsCache.get(cache_key)

    eventlist = DsHelper.get_eventlist_from_evt_dataset(filtered_ds)
    if not eventlist or eventlist.ncounts < 2 or len(eventlist.time) < 2:
        logging.warn("Wrong lightcurve counts for eventlist from ds.id -> " + str(filtered_ds.id))
        return None

    if (eventlist.time[eventlist.ncounts - 1] - eventlist.time[0]) < dt * 2:
        logging.warn("Lightcurve duration must be greater than two bin sizes, for ds.id -> " + str(filtered_ds.id))
        return None

    while True:
        # Checks if lc has counts or retries with smaller bin size.
        lc = eventlist.to_lc(dt)
        if (lc is None) or (not np.isnan(lc.meanrate) and lc.n > 1):
            break
        else:
            dt = dt / 2.0
            logging.warn("Lightcurve has no counts, bin size: " + str(lc.dt) + ", retrying with binsize: " + str(dt))

    if bck_destination:

        #Gets the backscale keyword value
        src_backscale = None
        if "BACKSCAL" in filtered_ds.tables["EVENTS"].header:
            src_backscale = int(filtered_ds.tables["EVENTS"].header["BACKSCAL"])

        #Applies background data
        lc = apply_background_to_lc(lc, bck_destination, filters, gti_destination, lc.dt, src_backscale)

    eventlist = None  # Dispose memory
    filtered_ds = None  # Dispose memory

    # Applies rate filter to lightcurve countrate if filter has been sent
    rate_filter = FltHelper.get_rate_filter(filters)
    if rate_filter:
        logging.debug("Filtering lightcurve with countrates: from: " + str(rate_filter["from"]) + ", to: " + str(rate_filter["to"]))
        filtered_indexes = np.where((lc.countrate >= rate_filter["from"]) & (lc.countrate <= rate_filter["to"]))[0]
        lc = DsHelper.get_lightcurve(lc.time[filtered_indexes],
                            lc.counts[filtered_indexes],
                            lc.counts_err[filtered_indexes],
                            lc.gti)

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


def apply_background_to_lc(lc, bck_destination, filters, gti_destination, dt, src_backscale=None):

    if lc:
        logging.debug("Create background lightcurve ....")
        bck_lc = get_lightcurve_any_dataset(bck_destination, "", gti_destination, filters, dt)
        if bck_lc:

            #Calculates the backscale_ratio
            backscale_ratio = 1;
            if src_backscale is not None:

                bck_ds, bck_cache_key = DaveReader.get_file_dataset(bck_destination)
                if bck_ds:

                    #Gets the backscale keyword value
                    table = DsHelper.get_hdutable_from_dataset(bck_ds)
                    if table:
                        if "BACKSCAL" in table.header:
                            backscale_ratio = src_backscale / int(table.header["BACKSCAL"])
                    bck_ds = None
                    table = None

            if backscale_ratio != 1:
                # Applies the backscale_ratio to background lightcurve
                logging.debug("Applying backscale_ratio: " + str(backscale_ratio))
                bck_lc.counts *= backscale_ratio
                bck_lc.counts_err *= backscale_ratio
                bck_lc = Lightcurve(bck_lc.time, bck_lc.counts,
                                    err=bck_lc.counts_err, gti=bck_lc.gti,
                                    mjdref=bck_lc.mjdref)

            #Substracts background lightcurve from source lightcurve
            lc = lc - bck_lc
            bck_lc = None

        else:
            logging.warn("Wrong lightcurve for background data...")

    else:
        logging.warn("Wrong source lightcurve.")

    return lc


def create_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type, df=0):

    if len(axis) != 2:
        logging.warn("Wrong number of axis")
        return None, None, None

    if norm not in ['frac', 'abs', 'leahy', 'none']:
        logging.warn("Wrong normalization")
        return None, None, None

    if pds_type not in ['Sng', 'Avg']:
        logging.warn("Wrong power density spectrum type")
        return None, None, None

    if segm_size == 0:
        segm_size = None

    # Creates the lightcurve
    lc = get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt)
    if not lc:
        logging.warn("Can't create lightcurve or is empty")
        return None, None, None

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
        if df > 0:
            pds = pds.rebin(df=df)
        #pds = rebin_spectrum_if_necessary(pds)
    else:
        logging.warn("Can't create power spectrum")

    return pds, lc, gti


def fit_power_density_spectrum(pds, models, priors=None, sampling_params=None):
    results = []

    try:
        fit_model, starting_pars = ModelHelper.get_astropy_model_from_dave_models(models)
        if fit_model:

            # Default fit parameters
            max_post=False
            fitmethod="L-BFGS-B"
            as_priors=None

            if priors is not None:
                # Creates the priors from dave_priors
                as_priors = ModelHelper.get_astropy_priors(priors)
                if len(as_priors.keys()) > 0:
                    # If there are priors then is a Bayesian Parameters Estimation
                    max_post=True
                    fitmethod="BFGS"

                else:
                    as_priors=None
                    logging.warn("fit_power_density_spectrum: can't create priors from dave_priors.")

            if as_priors:
                # Creates a Posterior object with the priors
                lpost = PSDPosterior(pds.freq, pds.power, fit_model, priors=as_priors, m=pds.m)
            else:
                # Creates the Maximum Likelihood object for fitting
                lpost = PSDLogLikelihood(pds.freq, pds.power, fit_model, m=pds.m)

            # Creates the PSD Parameters Estimation object and runs the fitting
            parest = PSDParEst(pds, fitmethod=fitmethod, max_post=max_post)
            res = parest.fit(lpost, starting_pars, neg=True)

            sample = None
            if as_priors and sampling_params is not None:
                # If is a Bayesian Par. Est. and has sampling parameters
                # then sample the posterior distribution defined in `lpost` using MCMC
                sample = parest.sample(lpost, res.p_opt, cov=res.cov,
                                         nwalkers=sampling_params["nwalkers"],
                                         niter=sampling_params["niter"],
                                         burnin=sampling_params["burnin"],
                                         threads=sampling_params["threads"],
                                         print_results=False, plot=False)

            # Prepares the results to be returned to GUI
            fixed = [fit_model.fixed[n] for n in fit_model.param_names]
            parnames = [n for n, f in zip(fit_model.param_names, fixed) \
                        if f is False]

            # Add to results the estimated parameters
            params = []
            for i, (x, y, p) in enumerate(zip(res.p_opt, res.err, parnames)):
                param = dict()
                param["index"] = i
                param["name"] = p
                param["opt"] = nan_and_inf_to_num(x)
                param["err"] = nan_and_inf_to_num(y)
                params.append(param)

            results = push_to_results_array(results, params)

            # Add to results the estimation statistics
            stats = dict()
            try:
                stats["deviance"] = nan_and_inf_to_num(res.deviance)
                stats["aic"] = nan_and_inf_to_num(res.aic)
                stats["bic"] = nan_and_inf_to_num(res.bic)
            except AttributeError:
                stats["deviance"] = "ERROR"

            try:
                stats["merit"] = nan_and_inf_to_num(res.merit)
                stats["dof"] = nan_and_inf_to_num(res.dof)  # Degrees of freedom
                stats["dof_ratio"] = nan_and_inf_to_num(res.merit/res.dof)
                stats["sobs"] = nan_and_inf_to_num(res.sobs)
                stats["sexp"] = nan_and_inf_to_num(res.sexp)
                stats["ssd"] = nan_and_inf_to_num(res.ssd)
            except AttributeError:
                stats["merit"] = "ERROR"

            results = push_to_results_array(results, stats)

            # If there is sampling data add it to results
            if sample:
                sample_stats = dict()
                try:
                    sample_stats["acceptance"] = sample.acceptance
                    sample_stats["rhat"] = sample.rhat
                    sample_stats["mean"] = sample.mean
                    sample_stats["std"] = sample.std
                    sample_stats["ci"] = sample.ci

                    try:
                        #Acor is not always present
                        sample_stats["acor"] = sample.acor
                    except AttributeError:
                        sample_stats["acor"] = "ERROR"

                    #Creates an IMG Html tag from plot
                    try:
                        fig = sample.plot_results(nsamples=sampling_params["nsamples"])
                        sample_stats["img"] = Plotter.convert_fig_to_html(fig)
                    except:
                        sample_stats["img"] = "ERROR"
                        logging.error(ExHelper.getException('fit_power_density_spectrum: Cant create image from plot.'))

                except AttributeError:
                    sample_stats["acceptance"] = "ERROR"
                    logging.error(ExHelper.getException('fit_power_density_spectrum: Cant add sample data.'))

                results = push_to_results_array(results, sample_stats)
    except:
        logging.error(ExHelper.getException('fit_power_density_spectrum'))

    return results


def get_lomb_scargle(src_destination, bck_destination, gti_destination,
                    filters, axis, dt, freq_range, nyquist_factor, ls_norm, samples_per_peak):
    # Creates the lightcurve
    lc = get_lightcurve_any_dataset(src_destination, bck_destination, gti_destination, filters, dt)
    if not lc:
        return None, None, None

    # If freq_range is not set, calculates max and min freq
    if freq_range[0] < 0:
        freq_range[0] = 0.6 / lc.tseg
    if freq_range[1] < 0:
        freq_range[1] = 0.6 / lc.dt

    # Calculates the LombScargle values
    frequency, power = LombScargle(lc.time, lc.counts).autopower(minimum_frequency=freq_range[0],
                                                                 maximum_frequency=freq_range[1],
                                                                 nyquist_factor=nyquist_factor,
                                                                 normalization=ls_norm,
                                                                 samples_per_peak=samples_per_peak)
    return frequency, nan_and_inf_to_num(power), lc


# Reduces the pds data to Max_plot_points for improve pds performance
def rebin_spectrum_if_necessary (pds):
    freq_size = len(pds.freq)
    if freq_size > CONFIG.MAX_PLOT_POINTS:
        df = (max(pds.freq) - min(pds.freq)) / CONFIG.MAX_PLOT_POINTS
        logging.warn("Spectrum rebined to " + str(CONFIG.MAX_PLOT_POINTS) + " points, from " + str(freq_size) + " points, with df: " + str(df))
        pds = pds.rebin(df=df)
    return pds


def get_countrate_from_lc_ds (lc_destination, bck_destination, lc_name, bck_name):

    lc_ds, lc_cache_key = DaveReader.get_file_dataset(lc_destination)
    if not DsHelper.is_lightcurve_dataset(lc_ds):
        logging.warn("Wrong dataset type for " + lc_name)
        return None, None

    count_rate = np.array(lc_ds.tables["RATE"].columns["RATE"].values)
    count_rate_error = np.array(lc_ds.tables["RATE"].columns["RATE"].error_values)

    if bck_destination:
        bck_ds, bck_cache_key = DaveReader.get_file_dataset(bck_destination)
        if not DsHelper.is_lightcurve_dataset(bck_ds):
            logging.warn("Wrong dataset type for " + bck_name)
        else:
            count_rate_bck = np.array(bck_ds.tables["RATE"].columns["RATE"].values)
            count_rate_error_bck = np.array(bck_ds.tables["RATE"].columns["RATE"].error_values)
            if count_rate.shape == count_rate_bck.shape:
                count_rate -= count_rate_bck
                count_rate_error -= count_rate_error_bck
            else:
                logging.warn("Lightcurves " + lc_name + " and " + bck_name + " have different shapes.")

    return count_rate, count_rate_error


def load_gti_from_destination (gti_destination):

    # Try to get the gtis from cache
    cache_key = "GTI_" + DsCache.get_key(gti_destination, True)
    if DsCache.contains(cache_key):
        logging.debug("Returned cached gtis, cache_key: " + cache_key + ", count: " + str(DsCache.count()))
        return DsCache.get(cache_key)

    gti = None
    if gti_destination:
        gti_dataset, gti_cache_key = DaveReader.get_file_dataset(gti_destination)
        if gti_dataset:
            gti = DsHelper.get_stingray_gti_from_gti_table (gti_dataset.tables["GTI"])
            DsCache.add(cache_key, gti)
            logging.debug("Load GTI success")

    return gti


def get_divided_values_and_error (values_0, values_1, error_0, error_1):
    divided_error = np.array([])
    with np.errstate(all='ignore'): # Ignore divisions by 0 and others
        divided_values = nan_and_inf_to_num(values_0 / values_1)
        if error_0.shape == error_1.shape == values_0.shape:
            divided_error = nan_and_inf_to_num((error_0/values_1) + ((error_1 * values_0)/(values_1 * values_1)))
    divided_values[divided_values >= CONFIG.BIG_NUMBER]=0
    divided_values[divided_values <= -CONFIG.BIG_NUMBER]=0
    divided_error[divided_error >= CONFIG.BIG_NUMBER]=0
    divided_error[divided_error <= -CONFIG.BIG_NUMBER]=0
    return divided_values, divided_error


def common_error(error):
    logging.error(error)
    return dict(error=error)

def common_warn(warn):
    logging.warn(warn)
    return dict(error="@WARN@" + warn)

# ----- Long-Term variability FUNCTIONS.. NOT EXPOSED  -------------

def lightcurve_meancount(lc):
    return lc.meancounts, np.std(lc.counts)

def lightcurve_excvar(lc):
    return excess_variance(lc, normalization='none')

def lightcurve_fractional_rms(lc):
    return excess_variance(lc, normalization='fvar')

def get_means_from_array(array, elements_per_mean):
    split = np.array_split(array, math.floor(len(array) / elements_per_mean))
    return np.array([np.mean(arr) for arr in split])

def mean_confidence_interval(data, confidence=0.95):
    a = 1.0*np.array(data)
    n = len(a)
    m, se = np.mean(a), sp.stats.sem(a)
    h = se * sp.stats.t._ppf((1+confidence)/2., n-1)
    return m, m-h, m+h
