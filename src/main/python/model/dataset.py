from model.table import Table
import utils.dataset_helper as DsHelper
import utils.dave_logger as logging
import time

class DataSet:
    id = ""
    tables = dict()

    def __init__(self, id):
        self.id = id
        self.tables = dict()

    def add_table(self, table_id, column_names):
        self.tables[table_id] = Table(table_id)
        self.tables[table_id].add_columns(column_names)

    def get_schema(self):
        schema = dict()
        for table_id in self.tables:
            schema[table_id] = self.tables[table_id].get_schema()
        return schema

    def clone(self):
        dataset = DataSet(self.id)

        for table_id in self.tables:
            table = self.tables[table_id].clone()
            dataset.tables[table_id] = table

        return dataset

    def apply_filters(self, filters):

        if not filters or not len(filters):
            return self

        filtered_dataset = self.clone()

        for filter in filters:
            table_id = filter["table"]
            if table_id in filtered_dataset.tables:
                if table_id == "EVENTS" and filter["column"] == "TIME":
                    filtered_dataset = self.apply_time_filter(filter)
                else:
                    filtered_dataset.tables[table_id] = filtered_dataset.tables[table_id].apply_filter(filter)
            else:
                logging.error("dataset.apply_filters wrong table_id: %s" % table_id)

        return filtered_dataset

    def join (self, dataset):
        joined_dataset = self.clone()

        for table_id in joined_dataset.tables:
            if table_id in dataset.tables:
                table = joined_dataset.tables[table_id].join(dataset.tables[table_id])
                joined_dataset.tables[table_id] = table

        return joined_dataset

    def apply_time_filter(self, filter, hduname='EVENTS', column='TIME'):

        if "GTI" not in self.tables:
            logging.warn("dataset.apply_time_filter: Dataset GTIs missed")
            return self

        if len(self.tables["GTI"].columns["START"].values) == 0:
            logging.warn("dataset.apply_time_filter: Dataset no valid GTIs")
            return self

        columns_values = dict()
        for column_name in self.tables[hduname].columns:
            if column_name != column:
                columns_values[column_name] = self.tables[hduname].columns[column_name].values

        ev_list = self.tables[hduname].columns[column].values
        gti_start = self.tables["GTI"].columns["START"].values
        gti_end = self.tables["GTI"].columns["STOP"].values

        dataset = get_dataset_applying_gtis(self.id, columns_values, ev_list, gti_start, gti_end, filter["from"], filter["to"], hduname, column)

        return dataset


# STATIC MEHTODS

# Returns a new empty dataset with the specified table_id and columns
def get_empty_dataset(ds_id):
    return DataSet(ds_id)


# Returns a new empty dataset with the specified table_id and columns
def get_dataset(ds_id, table_id, columns):
    dataset = get_empty_dataset(ds_id)
    dataset.add_table(table_id, columns)
    return dataset


# Returns a new empty dataset with EVENTS and GTIs tables
def get_events_type_dataset(dsId, columns, hduname="EVENTS"):
    dataset = DataSet(dsId)

    # Fills Hdu table
    dataset.add_table(hduname, columns)

    gti_columns = ["START", "STOP", "START_EVENT_IDX", "END_EVENT_IDX"]
    dataset.add_table("GTI", gti_columns)

    return dataset


# Returns a new empty dataset with EVENTS and GTIs tables
def get_dataset_applying_gtis(dsId, ds_columns, ev_list, gti_start, gti_end, filter_start=None, filter_end=None, hduname="EVENTS", column='TIME'):

    # Prepares additional_columns
    columns = [column]
    additional_columns = []

    for column_name in ds_columns:
        columns.extend([column_name])
        if column_name != column:
            additional_columns.extend([column_name])

    # Creates the dataset
    dataset = get_events_type_dataset(dsId, columns, hduname)

    start_event_idx = 0
    end_event_idx = 0
    hdu_table = dataset.tables[hduname]
    gti_table = dataset.tables["GTI"]

    must_filter = not ((filter_start is None) or (filter_end is None))

    for gti_index in range(len(gti_start)):

        is_valid_gti = True
        if must_filter:
            is_valid_gti = (gti_start[gti_index] >= filter_start) and (gti_end[gti_index] <= filter_end)

        if is_valid_gti:

            start_event_idx = DsHelper.find_idx_nearest_val(ev_list, gti_start[gti_index])
            end_event_idx = DsHelper.find_idx_nearest_val(ev_list, gti_end[gti_index])

            if end_event_idx > start_event_idx:
                # The GTI has ended, so lets insert it on dataset

                gti_table.columns["START"].add_value(gti_start[gti_index])
                gti_table.columns["STOP"].add_value(gti_end[gti_index])
                gti_table.columns["START_EVENT_IDX"].add_value(start_event_idx)
                gti_table.columns["END_EVENT_IDX"].add_value(end_event_idx)

                # Insert values at range on dataset
                hdu_table.columns[column].add_values(ev_list[start_event_idx:end_event_idx:1])
                for i in range(len(additional_columns)):
                    hdu_table.columns[additional_columns[i]].add_values(ds_columns[additional_columns[i]][start_event_idx:end_event_idx:1])

            else:
                logging.warn("Wrong indexes for %s" % gti_index)

    return dataset
