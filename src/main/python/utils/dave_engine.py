import utils.dave_reader as DaveReader
import utils.dataset_helper as DsHelper
import utils.filters_helper as FltHelper
import utils.plotter as Plotter
import numpy as np
import utils.dave_logger as logging
import utils.dataset_cache as DsCache


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


def get_filtered_dataset(destination, filters, gti_destination=""):
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

    return dataset.apply_filters(filters)


def get_color_filtered_dataset(destination, filters, color_column_name, column_name, gti_destination=""):
    color_filters = FltHelper.get_filters_from_color_filters(filters, color_column_name, column_name)
    filtered_ds = get_filtered_dataset(destination, color_filters, gti_destination)
    return filtered_ds

# get_plot_data: Returns the data for a plot
#
# @param: destination: file destination
# @param: filters: array with the filters to apply
#         [{ table = "txt_table", column = "Time", from=0, to=10 }, ... ]
# @param: styles: dictionary with the plot style info
#           { type = "2d", labels=["Time", "Rate Count"]}
# @param: axis: array with the column names to use in ploting
#           [{ table = "txt_table", column = "Time" },
#            { table = "txt_table", column = "Rate" } ... ]
#
def get_plot_data(destination, filters, styles, axis):

    filtered_ds = get_filtered_dataset(destination, filters)

    # Config checking
    if "type" not in styles:
        return "No plot type specified on styles"

    if "labels" not in styles:
        return "No plot labels specified on styles"

    if len(styles["labels"]) < 2:
        return "Wrong number of labels specified on styles"

    if len(axis) < 2:
        return "Wrong number of axis"

    # Plot type mode
    if styles["type"] == "2d":
        return Plotter.get_plotdiv_xy(filtered_ds, axis)

    elif styles["type"] == "3d":

        if len(styles["labels"]) < 3:
            return "Wrong number of labels specified on styles"

        if len(axis) < 3:
            return "Wrong number of axis"

        return Plotter.get_plotdiv_xyz(filtered_ds, axis)

    elif styles["type"] == "scatter":
        return Plotter.get_plotdiv_scatter(filtered_ds, axis)

    else:
        return "Wrong plot type specified on styles"


# get_lightcurve: Returns the data for the Lightcurve
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "fits_table", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "fits_table", column = "TIME" },
#            { table = "fits_table", column = "PI" } ]
# @param: dt: The time resolution of the events.
#
def get_lightcurve(src_destination, bck_destination, gti_destination, filters, axis, dt):

    filters = FltHelper.get_filters_clean_color_filters(filters)
    filters = FltHelper.apply_bin_size_to_filters(filters, dt)

    filtered_ds = get_filtered_dataset(src_destination, filters, gti_destination)
    if not DsHelper.is_events_dataset(filtered_ds):
        logging.warn("Wrong dataset type")
        return None

    if len(axis) != 2:
        logging.warn("Wrong number of axis")
        return None

    # Creates lightcurves by gti and joins in one
    logging.debug("Create lightcurve ....Event count: " + str(len(filtered_ds.tables["EVENTS"].columns["TIME"].values)))

    eventlist = DsHelper.get_eventlist_from_dataset(filtered_ds, axis)
    if not eventlist:
        logging.warn("Cant create eventlist from dataset")
        return None

    filtered_ds = None  # Dispose memory

    time_vals = []
    count_rate = []

    if len(eventlist.time) > 0:
        lc = eventlist.to_lc(dt)

        time_vals = lc.time

        # Source lightcurve count rate
        count_rate = lc.countrate

        lc = None  # Dispose memory

        # Applies backgrund data to lightcurves if necessary
        if bck_destination:

            filtered_bck_ds = get_filtered_dataset(bck_destination, filters, gti_destination)
            if not DsHelper.is_events_dataset(filtered_bck_ds):

                logging.debug("Create background lightcurve ....")
                bck_eventlist = DsHelper.get_eventlist_from_dataset(filtered_bck_ds, axis)
                if bck_eventlist and len(bck_eventlist.time) > 0:
                    bck_lc = bck_eventlist.to_lc(dt)

                    if count_rate.shape == bck_lc.countrate.shape:
                        count_rate = count_rate - bck_lc.countrate
                    else:
                        logging.warn("Background counts differs from Source counts, omiting Bck data.")

                    bck_lc = None

                else:
                    logging.warn("Wrong lightcurve counts for background data...")

                bck_eventlist = None  # Dispose memory
                filtered_bck_ds = None

            else:
                logging.warn("Background dataset is None!, omiting Bck data.")

    eventlist = None  # Dispose memory

    # Preapares the result
    logging.debug("Result lightcurves ....")
    result = []
    column_time = dict()
    column_time["values"] = time_vals
    result.append(column_time)

    column_pi = dict()
    column_pi["values"] = count_rate
    result.append(column_pi)

    return result


# get_colors_lightcurve: Returns the data for the Lightcurve
#
# @param: src_destination: source file destination
# @param: bck_destination: background file destination, is optional
# @param: gti_destination: gti file destination, is optional
# @param: filters: array with the filters to apply
#         [{ table = "fits_table", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "fits_table", column = "TIME" },
#            { table = "fits_table", column = "PI" } ]
# @param: dt: The time resolution of the events.
#
def get_colors_lightcurve(src_destination, bck_destination, gti_destination, filters, axis, dt):

    filters = FltHelper.apply_bin_size_to_filters(filters, dt)

    count_column_name = "PI"
    color_keys = ["Color_A", "Color_B", "Color_C", "Color_D"]
    filtered_datasets = []

    for color_key in color_keys:
        filtered_ds = get_color_filtered_dataset(src_destination, filters, color_key, count_column_name, gti_destination)
        if not DsHelper.is_events_dataset(filtered_ds):
            logging.warn("Can't create filtered_ds for " + str(color_key))
            return None
        filtered_datasets.append(filtered_ds)

    if len(axis) != 2:
        logging.warn("Wrong number of axis")
        return None

    # Creates lightcurves by gti and joins in one
    logging.debug("Create color lightcurve ....")

    # Creates valid axis for lightcurve, not HCR or SCR
    color_axis = [dict() for i in range(2)]
    color_axis[0]["table"] = "EVENTS"
    color_axis[0]["column"] = "TIME"
    color_axis[1]["table"] = "EVENTS"
    color_axis[1]["column"] = "PI"

    time_vals = []
    countrates = []

    for color_idx in range(len(color_keys)):
        eventlist = DsHelper.get_eventlist_from_dataset(filtered_datasets[color_idx], color_axis)

        if not eventlist or len(eventlist.time) == 0:
            logging.warn("Wrong lightcurve counts for eventlist -> " + str(color_keys[color_idx]))
            return None

        lc = eventlist.to_lc(dt)
        if not len(time_vals):
            time_vals = lc.time
        countrates.append(lc.countrate)

    filtered_datasets = None  # Dispose memory

    # Applies backgrund data to lightcurves if necessary
    if bck_destination:
        filtered_bck_ds = get_filtered_dataset(bck_destination, filters, gti_destination)
        if not DsHelper.is_events_dataset(filtered_bck_ds):

            logging.debug("Create background color lightcurve ...")
            bck_eventlist = DsHelper.get_eventlist_from_dataset(filtered_bck_ds, color_axis)

            if bck_eventlist and len(bck_eventlist.time) > 0:
                bck_lc = bck_eventlist.to_lc(dt)

                for color_idx in range(len(color_keys)):
                    if countrates[color_idx].shape == bck_lc.countrate.shape:
                        countrates[color_idx] = countrates[color_idx] - bck_lc.countrate
                    else:
                        logging.warn("Background counts differs from " + str(color_keys[color_idx]) + ", omiting Bck data.")

                bck_lc = None  # Dispose memory

            else:
                logging.warn("Wrong lightcurve counts for background data...")

            filtered_bck_ds = None  # Dispose memory
            bck_eventlist = None

        else:
            logging.warn("Background dataset is None!, omiting Bck data.")

    # Preapares the result
    logging.debug("Result color lightcurves ....")
    BIG_NUMBER = 9999999999999

    result = []

    column_time = dict()
    column_time["values"] = time_vals
    result.append(column_time)

    column_src = dict()
    with np.errstate(all='ignore'): # Ignore divisions by 0 and others
        src_values = np.nan_to_num(countrates[0] / countrates[1])
    src_values[src_values > BIG_NUMBER]=0
    column_src["values"] = src_values
    result.append(column_src)

    column_hdr = dict()
    with np.errstate(all='ignore'): # Ignore divisions by 0 and others
        hdr_values = np.nan_to_num(countrates[2] / countrates[3])
    hdr_values[hdr_values > BIG_NUMBER]=0
    column_hdr["values"] = hdr_values
    result.append(column_hdr)

    return result
