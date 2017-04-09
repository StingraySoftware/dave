import numpy as np

from stingray.events import EventList
from stingray import Lightcurve
from stingray.gti import join_gtis, gti_len
from model.table import Table
import bisect
import utils.dave_logger as logging


# Returns an Stingray EventList from a given events dataset
def get_eventlist_from_evt_dataset(dataset):

    if not is_events_dataset(dataset):
        logging.warn("get_eventlist_from_evt_dataset: dataset is not a events dataset instance")
        return None

    # Extract axis values
    time_data = np.array(dataset.tables["EVENTS"].columns["TIME"].values)
    pi_data = np.array(dataset.tables["EVENTS"].columns["PHA"].values)

    # Extract GTIs
    gti = get_stingray_gti_from_gti_table (dataset.tables["GTI"])

    # Returns the EventList
    if len(gti) > 0:
        return EventList(time_data, gti=gti, pi=pi_data)
    else:
        return EventList(time_data, pi=pi_data)


# Returns an Stingray Lightcurve from a given lightcurve dataset
def get_lightcurve_from_lc_dataset(dataset, gti=None):

    if not is_lightcurve_dataset(dataset):
        logging.warn("get_eventlist_from_evt_dataset: dataset is not a events dataset instance")
        return None

    # Extract axis values
    time_data = np.array(dataset.tables["RATE"].columns["TIME"].values)
    counts = np.array(dataset.tables["RATE"].columns["RATE"].values)

    # Extract GTIs
    if not gti:
        gti = get_stingray_gti_from_gti_table (dataset.tables["GTI"])

    # Returns the EventList
    if len(gti) > 0:
        return Lightcurve(time_data, counts, input_counts=True, gti=gti)
    else:
        return Lightcurve(time_data, counts, input_counts=True)


def get_empty_gti_table():
    table = Table("GTI")
    table.add_columns(["START", "STOP", "START_EVENT_IDX", "END_EVENT_IDX"])
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
    return is_hdu_dataset(dataset, "EVENTS")


def is_lightcurve_dataset(dataset):
    return is_hdu_dataset(dataset, "RATE")


def is_hdu_dataset(dataset, hduname):
    if dataset:
        if hduname in dataset.tables:
            if "TIME" in dataset.tables[hduname].columns:
                if "GTI" in dataset.tables:
                    return True
    return False


def is_rmf_dataset(dataset):
    if dataset:
        if "EBOUNDS" in dataset.tables:
            if "CHANNEL" in dataset.tables["EBOUNDS"].columns:
                return True

    return False


def is_arf_dataset(dataset):
    if dataset:
        if "SPECRESP" in dataset.tables:
            if "SPECRESP" in dataset.tables["SPECRESP"].columns:
                return True

    return False


def is_gti_dataset(dataset):
    if dataset:
        if "GTI" in dataset.tables:
            if "START" in dataset.tables["GTI"].columns:
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


def get_exposure_time (gti_table):
    return gti_len(get_stingray_gti_from_gti_table(gti_table))


#Returns True if there is a GAP in the time_vals values
def hasGTIGaps(time_vals):

    trigger_ratio = 100;  # The ratio of elapsed time versus prev elapsed for triggering a gap

    if len(time_vals > 1):
        prev_val = time_vals[0]
        elapsed_avg = 0
        for val in time_vals:
            elapsed = val - prev_val
            prev_val = val

            if elapsed_avg > 0:
                ratio = elapsed / elapsed_avg
                if ratio > trigger_ratio:
                    return True

                # Calulates the ne elapsed_avg with the latest 5 vals
                elapsed_avg += (elapsed - elapsed_avg) * 0.2

            else:
                elapsed_avg = elapsed

    return False


# Returns a list of columns excluding passed columnName
def get_additional_column_names(columns, column):
    additional_columns = []
    for column_name in columns:
        if column_name != column:
            additional_columns.extend([column_name])
    return additional_columns


# Returns a dictionary with the values of the table columns values
def get_columns_as_dict(columns, column):
    ds_columns = dict()
    for column_name in columns:
        if column_name != column:
            ds_columns[column_name] = columns[column_name].values
    return ds_columns


# Returns a new dataset filtered by a GTI_Dataset
def get_dataset_applying_gti_dataset(src_dataset, gti_dataset, hduname="EVENTS", column='TIME'):

    if not is_events_dataset(src_dataset):
        logging.warn("get_dataset_applying_gti_dataset: src_dataset is not a events dataset instance")
        return None

    if not is_gti_dataset(gti_dataset):
        logging.warn("get_dataset_applying_gti_dataset: gti_dataset is not a gti dataset instance")
        return None

    # Creates the new dataset
    dataset = src_dataset.clone(False)
    additional_columns = get_additional_column_names(dataset.tables[hduname].columns, column)
    hdu_table = src_dataset.tables[hduname]

    st_gtis = get_stingray_gti_from_gti_table(gti_dataset.tables["GTI"])
    ev_list = hdu_table.columns[column].values
    ds_columns = get_columns_as_dict (src_dataset.tables[hduname].columns, column)

    # Gets start time of observation
    events_start_time = 0
    if "TSTART" in hdu_table.header:
        events_start_time = float(hdu_table.header["TSTART"])

    gti_start = st_gtis[:, 0] - events_start_time
    gti_end = st_gtis[:, 1] - events_start_time

    update_dataset_filtering_by_gti (dataset.tables[hduname], dataset.tables["GTI"],
                                ev_list, ds_columns, gti_start, gti_end, additional_columns, column)
    return dataset


# Returns a Dataset filtered by Gtis
def update_dataset_filtering_by_gti(hdu_table, gti_table, ev_list, ds_columns, gti_start, gti_end,
                                    additional_columns, column='TIME',
                                    filter_start=None, filter_end=None, must_filter=False):
    start_event_idx = 0
    end_event_idx = 0

    for gti_index in range(len(gti_start)):

        start = gti_start[gti_index]
        end = gti_end[gti_index]

        is_valid_gti = True
        if must_filter:
            is_valid_gti = ((filter_start <= start) and (filter_end >= end))
            if not is_valid_gti:
                if (filter_start < end) and (filter_end > end):
                    start = filter_start
                    is_valid_gti = True
                elif (filter_start < start) and (filter_end > start):
                    end = filter_end
                    is_valid_gti = True
                elif (filter_start >= start) and (filter_end <= end):
                    start = filter_start
                    end = filter_end
                    is_valid_gti = True

        if is_valid_gti:
            start_event_idx = find_idx_nearest_val(ev_list, start)
            if (ev_list[start_event_idx] < start and start_event_idx < len(ev_list) - 1):
                start_event_idx = start_event_idx + 1

            end_event_idx = find_idx_nearest_val(ev_list, end)
            if (ev_list[end_event_idx] > end and end_event_idx > 0):
                end_event_idx = end_event_idx - 1

            if end_event_idx >= start_event_idx:
                # The GTI has ended, so lets insert it on dataset

                gti_table.columns["START"].add_value(start)
                gti_table.columns["STOP"].add_value(end)
                gti_table.columns["START_EVENT_IDX"].add_value(start_event_idx)
                gti_table.columns["END_EVENT_IDX"].add_value(end_event_idx)

                # Insert values at range on dataset
                hdu_table.columns[column].add_values(ev_list[start_event_idx:end_event_idx])
                for i in range(len(additional_columns)):
                    ad_column=additional_columns[i]
                    values=ds_columns[ad_column][start_event_idx:end_event_idx]
                    hdu_table.columns[ad_column].add_values(values)

            else:
                logging.info("No data point in GTI # %s: GTI (from, to)=(%f, %f); event list (from, to)=(%d, %d)" % (gti_index, start, end, start_event_idx, end_event_idx))


def get_histogram (array):
    histogram = dict()
    values = []
    for val in array:
        if not val in histogram:
            histogram[val] = 0
            values.append(val)
        histogram[val] += 1
    return histogram, np.sort(values)
