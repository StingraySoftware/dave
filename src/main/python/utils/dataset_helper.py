import numpy as np

from stingray.events import EventList
from stingray.gti import join_gtis
from model.table import Table
import bisect
import utils.dave_logger as logging


# Returns an Stingray EventList from a given dataset
def get_eventlist_from_dataset(dataset, axis):

    # Extract axis values
    time_data = np.array(dataset.tables[axis[0]["table"]].columns["TIME"].values)
    pi_data = np.array(dataset.tables[axis[1]["table"]].columns[axis[1]["column"]].values)

    # Extract GTIs
    gti = get_stingray_gti_from_gti_table (dataset.tables["GTI"])

    # Returns the EventList
    if len(gti) > 0:
        return EventList(time_data, gti=gti, pi=pi_data)
    else:
        return EventList(time_data, pi=pi_data)


def get_empty_gti_table():
    table = Table("GTI")
    table.add_columns(["START", "STOP"])
    return table


def get_gti_table(from_val, to_val):
    table = get_empty_gti_table()
    table.columns["START"].add_value(from_val)
    table.columns["STOP"].add_value(to_val)
    return table


# Finds the idx of the nearest value on the array, array must be sorted
def find_idx_nearest_val(array, value):

    # idx = np.searchsorted(array, value, side="left")
    idx = bisect.bisect_left(array, value) #  Looks like bisec is faster with structured data than searchsorted

    if idx >= len(array):
        idx_nearest = len(array) - 1
    elif idx == 0:
        idx_nearest = 0
    else:
        if abs(value - array[idx - 1]) < abs(value - array[idx]):
            idx_nearest = idx - 1
        else:
            idx_nearest = idx
    return idx_nearest


def is_events_dataset(dataset):
    if dataset:
        if "EVENTS" in dataset.tables:
            if "TIME" in dataset.tables["EVENTS"].columns:
                if "GTI" in dataset.tables:
                    return True
    return False


def get_events_dataset_start(dataset):
    if len(dataset.tables["EVENTS"].columns["TIME"].values) > 0:
        return dataset.tables["EVENTS"].columns["TIME"].values[0]
    return 0


def get_stingray_gti_from_gti_table (gti_table):
    return np.array([[a, b]
                         for a, b in zip(gti_table.columns["START"].values,
                                         gti_table.columns["STOP"].values)],
                        dtype=np.longdouble)


def get_gti_table_from_stingray_gti (gti):
    gti_table = get_empty_gti_table()
    gti_table.columns["START"].add_values(gti[:, 0])
    gti_table.columns["STOP"].add_values(gti[:, 1])
    return gti_table

def join_gti_tables(gti_table_0, gti_table_1):
    if not gti_table_0:
        logging.warn("join_gti_tables: gti_table_0 is None, returned gti_table_1")
        return gti_table_1

    if not gti_table_1:
        logging.warn("join_gti_tables: gti_table_1 is None, returned gti_table_0")
        return gti_table_0

    gti_0 = get_stingray_gti_from_gti_table (gti_table_0)
    gti_1 = get_stingray_gti_from_gti_table (gti_table_1)
    joined_gti = join_gtis(gti_0, gti_1)

    return get_gti_table_from_stingray_gti(joined_gti)
