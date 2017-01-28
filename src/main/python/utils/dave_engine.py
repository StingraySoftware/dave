import utils.dave_reader as DaveReader
import utils.dataset_helper as DsHelper
import utils.plotter as Plotter
import numpy as np
import logging

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
    logging.debug("get_filtered_dataset...")
    dataset = DaveReader.get_file_dataset(destination)

    if not dataset:
        return None

    logging.debug("get_dataset_gti_as_filters")
    gti_filters = DsHelper.get_dataset_gti_as_filters(dataset, filters)

    logging.debug("apply_gti_filters_to_dataset")
    filtered_ds = DsHelper.apply_gti_filters_to_dataset(dataset, gti_filters)

    logging.debug("apply_filters")
    filtered_ds = filtered_ds.apply_filters(filters)

    logging.debug("get_filtered_dataset end!")
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


# get_ligthcurve: Returns the data for the Lightcurve
#
# @param: destination: file destination
# @param: filters: array with the filters to apply
#         [{ table = "fits_table", column = "Time", from=0, to=10 }, ... ]
# @param: axis: array with the column names to use in ploting
#           [{ table = "fits_table", column = "TIME" },
#            { table = "fits_table", column = "PI" } ]
# @param: dt: The time resolution of the events.
#
def get_ligthcurve(destination, filters, axis, dt):

    filtered_ds = get_filtered_dataset(destination, filters)
    if not filtered_ds:
        return None

    if len(axis) != 2:
        return "Wrong number of axis"

    # Creates lightcurves by gti and joins in one
    print ("Create lightcurve ....")
    eventlist = DsHelper.get_eventlist_from_dataset(filtered_ds, axis)
    lc = eventlist.to_lc(dt)
    list_of_lcs = lc.split_by_gti()
    lc = list_of_lcs[0]

    print ("Join lightcurves ....")
    if len(list_of_lcs) > 1:
        for i in range(1, len(list_of_lcs)):
            lc = lc.join(list_of_lcs[i])

    # The same done with stingray, but needs to setup start and end of lc for data filtering
    # from stingray import Lightcurve
    # from stingray.io import load_events_and_gtis
    # from stingray.io import order_list_of_arrays
    # pi_column = axis[1]["column"]
    # fits_data = load_events_and_gtis(destination, additional_columns=[pi_column])
    # eventlist = EventList(fits_data.ev_list, pi=fits_data.additional_data[pi_column])
    # lc = eventlist.to_lc(dt, tstart=None, tseg=None)

    # Preapares the result
    print ("Result lightcurves ....")
    result = []
    column_time = dict()
    column_time["values"] = lc.time
    result = np.append(result, [column_time])

    column_pi = dict()
    column_pi["values"] = lc.counts
    result = np.append(result, [column_pi])

    return result
