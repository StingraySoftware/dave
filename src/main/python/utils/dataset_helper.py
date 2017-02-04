import numpy as np

from stingray.events import EventList
from model.table import Table
import utils.dave_logger as logging
import bisect


# Returns an Stingray EventList from a given dataset
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
