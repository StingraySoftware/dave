from model.table import Table
import utils.dataset_helper as DsHelper
import utils.filters_helper as FltHelper
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

    def get_header(self):
        header = dict()
        for table_id in self.tables:
            header[table_id] = self.tables[table_id].get_header()
        return header

    def clone(self, with_values=True):
        dataset = DataSet(self.id)

        for table_id in self.tables:
            table = self.tables[table_id].clone(with_values)
            dataset.tables[table_id] = table

        return dataset

    def apply_filters(self, filters):

        if not filters or not len(filters):
            return self

        filtered_dataset = self.clone()

        time_filter = FltHelper.get_time_filter(filters)  # Firts filter by time for reducing arrays length
        if time_filter:
            filtered_dataset = self.apply_time_filter(time_filter, time_filter["table"])

        for filter in filters:
            table_id = filter["table"]
            if table_id not in ["EVENTS", "RATE"] or filter["column"] != "TIME":  # Exclude time filter
                if table_id in filtered_dataset.tables:
                    filtered_dataset.tables[table_id] = filtered_dataset.tables[table_id].apply_filter(filter)
                else:
                    logging.error("dataset.apply_filters wrong table_id: %s" % table_id)

        return filtered_dataset

    def join(self, dataset):
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
        columns_error_values = dict()
        for column_name in self.tables[hduname].columns:
            if column_name != column:
                columns_values[column_name] = self.tables[hduname].columns[column_name].values
                columns_error_values[column_name] = self.tables[hduname].columns[column_name].error_values

        ev_list = self.tables[hduname].columns[column].values
        ev_list_err = self.tables[hduname].columns[column].error_values
        gti_start = self.tables["GTI"].columns["START"].values
        gti_end = self.tables["GTI"].columns["STOP"].values

        dataset = get_dataset_applying_gtis(self.id, self.tables[hduname].header, self.tables[hduname].header_comments,
                                            columns_values, columns_error_values, ev_list, ev_list_err,
                                            gti_start, gti_end,
                                            filter["from"], filter["to"],
                                            hduname, column)

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
def get_hdu_type_dataset(dsId, columns, hduname="EVENTS"):
    dataset = DataSet(dsId)

    # Fills Hdu table
    dataset.add_table(hduname, columns)
    dataset.tables["GTI"] = DsHelper.get_empty_gti_table()

    return dataset


# Returns a new dataset with EVENTS and GTIs tables
def get_dataset_applying_gtis(dsId, header, header_comments, ds_columns, ds_columns_errors, ev_list, ev_list_err,
                            gti_start, gti_end, filter_start=None, filter_end=None,
                            hduname="EVENTS", column='TIME'):

    # Prepares additional_columns
    columns = [column]
    for column_name in ds_columns:
        columns.extend([column_name])

    additional_columns = DsHelper.get_additional_column_names(ds_columns, column)

    # Creates the dataset
    dataset = get_hdu_type_dataset(dsId, columns, hduname)

    # Sets table header info
    dataset.tables[hduname].set_header_info(header, header_comments)

    # Prepare data with the GTIs Intervals
    must_filter = not ((filter_start is None) or (filter_end is None))

    DsHelper.update_dataset_filtering_by_gti(dataset.tables[hduname], dataset.tables["GTI"],
                                    ev_list, ev_list_err, ds_columns, ds_columns_errors,
                                    gti_start, gti_end, additional_columns, column,
                                    filter_start, filter_end, must_filter)

    return dataset


# Returns a new dataset with GTIs table from Stingray Gti list
def get_gti_dataset_from_stingray_gti(st_gtis):
    dataset = get_empty_dataset("GTI_DS")
    gti_table = DsHelper.get_gti_table_from_stingray_gti(st_gtis)
    dataset.tables["GTI"] = gti_table
    return dataset


# Returns a new dataset with LIGHTCURVE table from Stingray lcurve
def get_lightcurve_dataset_from_stingray_lcurve(lcurve, header, header_comments,
                                                hduname='RATE', column='TIME'):
    lc_columns = [column, hduname]

    dataset = get_hdu_type_dataset("LIGHTCURVE", lc_columns, hduname)

    hdu_table = dataset.tables[hduname]
    hdu_table.set_header_info(header, header_comments)
    hdu_table.columns[lc_columns[0]].add_values(lcurve["time"])
    hdu_table.columns[lc_columns[1]].add_values(lcurve["counts"],
                                                lcurve["counts_err"])

    dataset.tables["GTI"] = \
        DsHelper.get_gti_table_from_stingray_gti(lcurve["gti"])

    return dataset

def get_lightcurve_dataset_from_stingray_Lightcurve(lcurve, header=None,
                                                    header_comments=None,
                                                    hduname='RATE',
                                                    column='TIME'):
    from astropy.io.fits import Header
    lc_columns = [column, hduname]

    dataset = get_hdu_type_dataset("LIGHTCURVE", lc_columns, hduname)

    hdu_table = dataset.tables[hduname]
    if header is None:
        if not hasattr(lcurve, 'header'):
            logging.warn("Light curve has no header")
            lcurve.header = Header()

        header = Header.fromstring(lcurve.header)
        header = dict()
        for header_column in header:
            header[header_column] = str(header[header_column])
            header_comments[header_column] = \
                str(header.comments[header_column])
    hdu_table.set_header_info(header, header_comments)
    hdu_table.columns[lc_columns[0]].add_values(lcurve.time)
    hdu_table.columns[lc_columns[1]].add_values(lcurve.counts,
                                                lcurve.counts_err)

    dataset.tables["GTI"] = \
        DsHelper.get_gti_table_from_stingray_gti(lcurve.gti)

    return dataset
