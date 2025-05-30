from random import randint

import numpy as np
import utils.dataset_helper as DsHelper
import utils.dave_logger as logging
import utils.filters_helper as FltHelper
from config import CONFIG

from model.table import Table


class DataSet:
    id: str = ""
    tables: dict[str, Table] = dict()

    def __init__(self, id: str) -> None:
        self.id = id + str(randint(0, 99999))
        self.tables = dict()

    def add_table(self, table_id: str, column_names: list[str]) -> None:
        self.tables[table_id] = Table(table_id)
        self.tables[table_id].add_columns(column_names)

    def get_schema(self) -> dict[str, dict]:
        schema = dict()
        for table_id in self.tables:
            schema[table_id] = self.tables[table_id].get_schema()
        return schema

    def get_header(self) -> dict[str, dict]:
        header = dict()
        for table_id in self.tables:
            header[table_id] = self.tables[table_id].get_header()
        return header

    def clone(self, with_values: bool = True) -> "DataSet":
        dataset = DataSet(self.id)

        for table_id in self.tables:
            table = self.tables[table_id].clone(with_values)
            dataset.tables[table_id] = table

        return dataset

    def apply_filters(self, filters: list[dict]) -> "DataSet":
        if not filters or not len(filters):
            return self

        filtered_dataset = self.clone()

        time_filter = FltHelper.get_time_filter(
            filters
        )  # Firts filter by time for reducing arrays length
        if time_filter:
            filtered_dataset = self.apply_time_filter(time_filter, time_filter["table"])

        for filter in filters:
            table_id = filter["table"]
            if (
                table_id not in ["EVENTS", "RATE"] or filter["column"] != CONFIG.TIME_COLUMN
            ):  # Exclude time filter
                if table_id in filtered_dataset.tables:
                    filtered_dataset.tables[table_id] = filtered_dataset.tables[
                        table_id
                    ].apply_filter(filter)
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

    def apply_time_filter(
        self, filter: dict, hduname: str = "EVENTS", column: str = CONFIG.TIME_COLUMN
    ) -> "DataSet":
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
                columns_error_values[column_name] = (
                    self.tables[hduname].columns[column_name].error_values
                )

        ev_list = self.tables[hduname].columns[column].values
        ev_list_err = self.tables[hduname].columns[column].error_values
        gti_start = self.tables["GTI"].columns["START"].values
        gti_end = self.tables["GTI"].columns["STOP"].values

        dataset = get_dataset_applying_gtis(
            self.id,
            self.tables[hduname].header,
            self.tables[hduname].header_comments,
            columns_values,
            columns_error_values,
            ev_list,
            ev_list_err,
            gti_start,
            gti_end,
            filter["from"],
            filter["to"],
            hduname,
            column,
        )

        return dataset


# STATIC MEHTODS


# Returns a new empty dataset with the specified table_id and columns
def get_empty_dataset(ds_id: str) -> DataSet:
    return DataSet(ds_id)


# Returns a new empty dataset with the specified table_id and columns
def get_dataset(ds_id: str, table_id: str, columns: list[str]) -> DataSet:
    dataset = get_empty_dataset(ds_id)
    dataset.add_table(table_id, columns)
    return dataset


# Returns a new empty dataset with EVENTS and GTIs tables
def get_hdu_type_dataset(dsId: str, columns: list[str], hduname: str = "EVENTS") -> DataSet:
    dataset = DataSet(dsId)

    # Fills Hdu table
    dataset.add_table(hduname, columns)
    dataset.tables["GTI"] = DsHelper.get_empty_gti_table()

    return dataset


# Returns a new dataset with EVENTS and GTIs tables
def get_dataset_applying_gtis(
    dsId: str,
    header: dict,
    header_comments: dict,
    ds_columns: dict[str, np.ndarray],
    ds_columns_errors: dict[str, np.ndarray],
    ev_list: np.ndarray,
    ev_list_err: np.ndarray,
    gti_start: np.ndarray,
    gti_end: np.ndarray,
    filter_start: float | None = None,
    filter_end: float | None = None,
    hduname: str = "EVENTS",
    column: str = CONFIG.TIME_COLUMN,
) -> DataSet:
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

    DsHelper.update_dataset_filtering_by_gti(
        dataset.tables[hduname],
        dataset.tables["GTI"],
        ev_list,
        ev_list_err,
        ds_columns,
        ds_columns_errors,
        gti_start,
        gti_end,
        additional_columns,
        column,
        filter_start,
        filter_end,
        must_filter,
    )

    return dataset


# Returns a new dataset with GTIs table from Stingray Gti list
def get_gti_dataset_from_stingray_gti(st_gtis: list) -> DataSet:
    dataset = get_empty_dataset("GTI_DS")
    gti_table = DsHelper.get_gti_table_from_stingray_gti(st_gtis)
    dataset.tables["GTI"] = gti_table
    return dataset


# Returns a new dataset with LIGHTCURVE table from Stingray lcurve
def get_lightcurve_dataset_from_stingray_lcurve(
    lcurve, header, header_comments, hduname="RATE", column=CONFIG.TIME_COLUMN
):
    lc_columns = [column, hduname]

    dataset = get_hdu_type_dataset("LIGHTCURVE", lc_columns, hduname)

    hdu_table = dataset.tables[hduname]
    hdu_table.set_header_info(header, header_comments)
    hdu_table.columns[lc_columns[0]].add_values(lcurve["time"])
    hdu_table.columns[lc_columns[1]].add_values(lcurve["counts"], lcurve["counts_err"])

    dataset.tables["GTI"] = DsHelper.get_gti_table_from_stingray_gti(lcurve["gti"])

    return dataset


def get_lightcurve_dataset_from_stingray_Lightcurve(
    lcurve, header=None, header_comments=None, hduname="RATE", column=CONFIG.TIME_COLUMN
):
    from astropy.io.fits import Header

    dataset = get_hdu_type_dataset("LIGHTCURVE", [column, hduname], hduname)

    hdu_table = dataset.tables[hduname]
    if header is None:
        header = dict()
    if header_comments is None:
        header_comments = dict()

    if header is not None and not header:  # header is empty dict
        if hasattr(lcurve, "header") and lcurve.header is not None:
            if isinstance(lcurve.header, Header):
                fits_header = lcurve.header
            else:
                fits_header = Header.fromstring(lcurve.header)
            for header_column in fits_header:
                header[header_column] = str(fits_header[header_column])
                header_comments[header_column] = str(fits_header.comments[header_column])
        else:
            logging.warn("Light curve has no header")
    hdu_table.set_header_info(header, header_comments)
    hdu_table.columns[column].add_values(lcurve.time)
    hdu_table.columns[hduname].add_values(lcurve.counts, lcurve.counts_err)

    dataset.tables["GTI"] = DsHelper.get_gti_table_from_stingray_gti(lcurve.gti)

    return dataset


def get_eventlist_dataset_from_stingray_Eventlist(
    evlist, header=None, header_comments=None, hduname="EVENTS", column=CONFIG.TIME_COLUMN
):
    from astropy.io.fits import Header

    evt_columns = [column, "PI"]
    if hasattr(evlist, "energy"):
        evt_columns = [column, "PI", "E"]

    dataset = get_hdu_type_dataset("EVENTS", evt_columns, hduname)

    hdu_table = dataset.tables[hduname]
    if header is None:
        header = dict()
    if header_comments is None:
        header_comments = dict()

    if header is not None and not header:  # header is empty dict
        if hasattr(evlist, "header") and evlist.header is not None:
            if isinstance(evlist.header, Header):
                fits_header = evlist.header
            else:
                fits_header = Header.fromstring(evlist.header)
            for header_column in fits_header:
                header[header_column] = str(fits_header[header_column])
                header_comments[header_column] = str(fits_header.comments[header_column])
        else:
            logging.warn("Event list has no header")

    hdu_table.set_header_info(header, header_comments)
    hdu_table.columns[column].add_values(evlist.time)

    if hasattr(evlist, "energy"):
        if evlist.energy is not None and len(evlist.energy) == len(evlist.time):
            hdu_table.columns["E"].add_values(evlist.energy)
        else:
            logging.warn("Event list energies differs from event counts, setted all energies as 0")
            hdu_table.columns["E"].add_values(np.zeros_like(evlist.time))

    if hasattr(evlist, "pi") and evlist.pi is not None and len(evlist.pi) == len(evlist.time):
        hdu_table.columns["PI"].add_values(evlist.pi)
    else:
        logging.warn("Event list has no PI values, using np.zeros_like")
        hdu_table.columns["PI"].add_values(np.zeros_like(evlist.time))

    dataset.tables["GTI"] = DsHelper.get_gti_table_from_stingray_gti(evlist.gti)

    return dataset
