import numpy as np

from stingray.events import EventList
import utils.filters_helper as FltHelper
from model.table import Table


# Return dataset GTI table as array of filters over EVENTS table and TIME column
def get_dataset_gti_as_filters(dataset, additional_filters=[]):

    time_filter = FltHelper.get_time_filter(additional_filters)

    filters = []

    if "GTI" in dataset.tables:
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

    return filters


# Checks if a dataset contains a EVENTS table and GTI table
def can_apply_gti_filters_to_dataset (dataset):
    return dataset and "EVENTS" in dataset.tables and "GTI" in dataset.tables


# Apply an array of filters over a dataset and joins every filtered_dataset results in one dataset
def apply_gti_filters_to_dataset(dataset, gti_filters):

    if can_apply_gti_filters_to_dataset(dataset) and len(gti_filters) > 0:

        # One dataset with the gti per each filter
        gti_datasets = []
        for filter in gti_filters:
            gti_dataset = dataset.apply_filters([filter])
            gti_dataset.tables["GTI"] = get_empty_gti_table()
            gti_dataset.tables["GTI"].columns["START"].add_value(filter["from"])
            gti_dataset.tables["GTI"].columns["STOP"].add_value(filter["to"])
            gti_datasets = np.append(gti_datasets, gti_dataset)

        # Join every rows in EVENTS table from filtered datasets
        result_ds = gti_datasets[0]
        if len(gti_datasets) > 1:
            for i in range(1, len(gti_datasets)):
                if len(gti_datasets[i].tables["EVENTS"].columns["TIME"].values) > 0:
                    result_ds.tables["EVENTS"] = result_ds.tables["EVENTS"].join(gti_datasets[i].tables["EVENTS"])
                    result_ds.tables["GTI"] = result_ds.tables["GTI"].join(gti_datasets[i].tables["GTI"])

        return result_ds

    else:
        return dataset


# Returns an Stingray EventList from a given dataset
def get_eventlist_from_dataset(dataset, axis):

    # Extract axis values
    time_data = np.append([], dataset.tables[axis[0]["table"]].columns["TIME"].values)
    pi_data = np.append([], dataset.tables[axis[1]["table"]].columns[axis[1]["column"]].values)

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
