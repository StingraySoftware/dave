import numpy as np

from stingray.events import EventList
import utils.filters_helper as FltHelper
from model.table import Table
import logging
import bisect


# Return dataset GTI table as array of filters over EVENTS table and TIME column
def get_dataset_gti_as_filters(dataset, additional_filters=[]):

    logging.debug("DsHelper.get_time_filter...")
    time_filter = FltHelper.get_time_filter(additional_filters)

    filters = []

    if "GTI" in dataset.tables:
        logging.debug("DsHelper.CalculateGTIs...")
        gtistart = dataset.tables["GTI"].columns["START"].values
        gtistop = dataset.tables["GTI"].columns["STOP"].values
        gti_list = np.array([[a, b]
                             for a, b in zip(gtistart,
                                             gtistop)],
                            dtype=np.longdouble)

        for gti in gti_list:
            gti_from = gti[0]
            gti_to = gti[1]

            # If time_filter defined we must remove outbounded GTIs
            if time_filter:
                if time_filter["from"] > gti_from and time_filter["from"] < gti_to:
                    gti_from = time_filter["from"]

                if time_filter["to"] > gti_from and time_filter["to"] < gti_to:
                    gti_to = time_filter["to"]

                if gti_from < gti[1] and gti_to > gti[0] and (gti_from != gti[0] or gti_to != gti[1]):
                    filter = FltHelper.createTimeFilter(gti_from, gti_to)
                    filters = np.append(filters, filter)

                elif time_filter["from"] <= gti[0] and time_filter["to"] >= gti[1]:
                    filter = FltHelper.createTimeFilter(gti[0], gti[1])
                    filters = np.append(filters, filter)
            else:
                filter = FltHelper.createTimeFilter(gti_from, gti_to)
                filters = np.append(filters, filter)

    logging.debug("DsHelper.get_dataset_gti_as_filters end...")
    return filters


# Checks if a dataset contains a EVENTS table and GTI table
def can_apply_gti_filters_to_dataset (dataset):
    return dataset and "EVENTS" in dataset.tables and "GTI" in dataset.tables


# Apply an array of filters over a dataset and joins every filtered_dataset results in one dataset
def apply_gti_filters_to_dataset(dataset, gti_filters):

    if can_apply_gti_filters_to_dataset(dataset) and len(gti_filters) > 0:

        # One dataset with the gti per each filter
        gti_datasets = []

        num_gtis = len(gti_filters)
        i_gti = 0
        logging.debug("apply_gti_filters_to_dataset: Nº GTIs:  %s" % len(gti_filters))
        for filter in gti_filters:
            logging.debug("apply_gti_filters_to_dataset: GTI:  %s" % i_gti)
            gti_dataset = dataset.apply_filters([filter])
            gti_dataset.tables["GTI"] = get_gti_table(filter["from"], filter["to"])
            gti_datasets = np.append(gti_datasets, gti_dataset)
            i_gti = i_gti + 1

        # Join every rows in EVENTS table from filtered datasets
        result_ds = gti_datasets[0]
        i_gti = 0
        logging.debug("apply_gti_filters_to_dataset: JOIN:  %s" % len(gti_filters))
        if len(gti_datasets) > 1:
            for i in range(1, len(gti_datasets)):
                logging.debug("apply_gti_filters_to_dataset: JOIN:  %s" % i_gti)
                i_gti = i_gti + 1
                if len(gti_datasets[i].tables["EVENTS"].columns["TIME"].values) > 0:
                    result_ds.tables["EVENTS"] = result_ds.tables["EVENTS"].join(gti_datasets[i].tables["EVENTS"])
                    result_ds.tables["GTI"] = result_ds.tables["GTI"].join(gti_datasets[i].tables["GTI"])

        return result_ds

    else:
        return dataset


# Returns an Stingray EventList from a given dataset
def get_eventlist_from_dataset(dataset, axis):

    # Extract axis values
    time_data = np.array(dataset.tables[axis[0]["table"]].columns["TIME"].values)
    pi_data = np.array(dataset.tables[axis[1]["table"]].columns[axis[1]["column"]].values)

    # Extract GTIs
    gtistart = dataset.tables["GTI"].columns["START"].values
    gtistop = dataset.tables["GTI"].columns["STOP"].values
    gti_list = np.array([[a, b]
                         for a, b in zip(gtistart,
                                         gtistop)],
                        dtype=np.longdouble)

    # Returns the EventList
    return EventList(time_data, gti=gti_list, pi=pi_data)


def get_empty_gti_table():
    table = Table ("GTI")
    table.add_columns (["START", "STOP"])
    return table


def get_gti_table(from_val, to_val):
    table = get_empty_gti_table()
    table.columns["START"].add_value(from_val)
    table.columns["STOP"].add_value(to_val)
    return table


# Finds the idx of the nearest value on the array, array must be sorted
def find_idx_nearest_val(array, value):

    #idx = np.searchsorted(array, value, side="left")
    idx = bisect.bisect_left(array, value) # Looks like bisec is faster with structured data than searchsorted

    if idx >= len(array):
        idx_nearest = len(array)-1
    elif idx == 0:
        idx_nearest = 0
    else:
        if abs(value - array[idx-1]) < abs(value - array[idx]):
            idx_nearest = idx-1
        else:
            idx_nearest = idx
    return idx_nearest
