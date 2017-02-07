import utils.dave_reader as DaveReader
import utils.dataset_helper as DsHelper
import utils.filters_helper as FltHelper
import utils.plotter as Plotter
import numpy as np
import utils.dave_logger as logging


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


def get_filtered_dataset(destination, filters):
    dataset = DaveReader.get_file_dataset(destination)
    if not dataset:
        return None
    return dataset.apply_filters(filters)


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
# @param: filters: array with the filters to apply
#         [{ table = "fits_table", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "fits_table", column = "TIME" },
#            { table = "fits_table", column = "PI" } ]
# @param: dt: The time resolution of the events.
#
def get_lightcurve(src_destination, bck_destination, filters, axis, dt):

    filters = FltHelper.apply_bin_size_to_filters(filters, dt)

    filtered_ds = get_filtered_dataset(src_destination, filters)
    if not filtered_ds:
        return None

    if len(axis) != 2:
        return "Wrong number of axis"

    # Creates lightcurves by gti and joins in one
    logging.debug("Create lightcurve ....")
    eventlist = DsHelper.get_eventlist_from_dataset(filtered_ds, axis)

    time_vals = []
    count_rate = []

    if len(eventlist.time) > 0:
        lc = eventlist.to_lc(dt)

        time_vals = lc.time

        # Source lightcurve count rate
        count_rate = lc.countrate

        # Applies backgrund data to lightcurves if necessary
        if bck_destination:
            filtered_bck_ds = get_filtered_dataset(bck_destination, filters)
            if not filtered_bck_ds:
                return None

            logging.debug("Create background lightcurve ....")
            bck_eventlist = DsHelper.get_eventlist_from_dataset(filtered_bck_ds, axis)
            bck_lc = bck_eventlist.to_lc(dt)

            count_rate = count_rate - bck_lc.countrate

    # Preapares the result
    logging.debug("Result lightcurves ....")
    result = []
    column_time = dict()
    column_time["values"] = time_vals
    result = np.append(result, [column_time])

    column_pi = dict()
    column_pi["values"] = count_rate
    result = np.append(result, [column_pi])

    return result
