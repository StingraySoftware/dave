
import os
import utils.dave_logger as logging
import magic

import model.dataset as DataSet
import numpy as np
from astropy.io import fits
from stingray.io import load_events_and_gtis
from stingray.gti import _get_gti_from_extension
import utils.dataset_cache as DsCache


def get_file_dataset(destination):

    if not destination:
        return None

    if DsCache.contains(destination):
        logging.debug("Returned cached dataset")
        return DsCache.get(destination)

    filename = os.path.splitext(destination)[0]
    file_extension = magic.from_file(destination)
    logging.debug("File extension: %s" % file_extension)

    if file_extension.find("ASCII") == 0:

        table_id = "txt_table"
        header_names = ["Time", "Rate", "color1", "color2"]
        dataset = get_txt_dataset(destination, table_id, header_names)

        table = dataset.tables[table_id]
        table.add_columns(["Amplitude"])
        numValues = len(table.columns["Time"].values)
        random_values = np.random.uniform(-1, 1, size=numValues)
        table.columns["Amplitude"].values = random_values

        DsCache.add(destination, dataset)
        return dataset

    elif file_extension.find("FITS") == 0:

        # ds_id = "fits_table"
        # table_ids = ["Primary", "EVENTS", "GTI"]
        # dataset = get_fits_dataset(destination, ds_id, table_ids)
        # return dataset

        dataset = get_fits_dataset_with_stingray(destination, dsId='FITS',
                                           hduname='EVENTS', column='TIME',
                                           gtistring='GTI,STDGTI,STDGTI04')

        if dataset:
            DsCache.add(destination, dataset)

        return dataset

    else:
        return None


def get_txt_dataset(destination, table_id, header_names):

    data = np.loadtxt(destination)
    dataset = DataSet.get_dataset(table_id, table_id, header_names)

    # Column1, Column1Err, Column2, Column2Err .. header order expected
    for i in range(len(header_names)):
        header_name = header_names[i]
        column = dataset.tables[table_id].columns[header_name]
        column.values = data[0:len(data), i * 2]
        column.error_values = data[0:len(data), (i * 2) + 1]

    logging.debug("Read txt file successfully: %s" % destination)

    return dataset


# Returns a dataset by reading a Fits file, returns all tables
def get_fits_dataset(destination, dsId, table_ids):
    hdulist = fits.open(destination)
    dataset = DataSet.get_empty_dataset(dsId)

    for t in range(len(hdulist)):

        if isinstance(hdulist[t], fits.hdu.table.BinTableHDU):
            table_id = table_ids[t]
            header_names = hdulist[t].columns.names
            tbdata = hdulist[t].data
            dataset.add_table(table_id, header_names)

            for i in range(len(header_names)):
                header_name = header_names[i]
                dataset.tables[table_id].columns[header_name].values.append(tbdata.field(i))

        else:
            logging.warn("No valid data on: %s" % t)
            logging.warn("Type of Data: %s" % type(hdulist[t]))

    hdulist.close()

    logging.debug("Read fits file successfully: %s" % destination)

    return dataset


# Returns the column's names of a given table of Fits file
def get_fits_table_column_names(hdulist, table_id):

    if table_id in hdulist:
        if isinstance(hdulist[table_id], fits.hdu.table.BinTableHDU):
            return hdulist[table_id].columns.names

    return None


# Returns a dataset containin HDU table and GTI table
# with the Fits data using Stingray library
def get_fits_dataset_with_stingray(destination, dsId='FITS',
                                   hduname='EVENTS', column='TIME',
                                   gtistring='GTI,STDGTI'):

    # Opening Fits
    hdulist = fits.open(destination)

    if hduname not in hdulist:
        # If not EVENTS extension found, consider the Fits as GTI Fits
        st_gtis = _get_gti_from_extension(hdulist, gtistring)
        return DataSet.get_gti_dataset_from_stingray_gti(st_gtis)

    # Gets columns from fits hdu table
    logging.debug("Reading Fits columns")
    columns = get_fits_table_column_names(hdulist, hduname)

    # Gets FITS header properties
    header = dict()
    header_comments = dict()
    for header_column in hdulist[hduname].header:
        header[header_column] = str(hdulist[hduname].header[header_column])
        header_comments[header_column] = str(hdulist[hduname].header.comments[header_column])

    # Gets start time of observation
    events_start_time = 0
    if "TSTART" in header:
        events_start_time = hdulist[hduname].header["TSTART"]

    # Closes the FITS file, further file data reads will be done via Stingray
    hdulist.close()

    # Prepares additional_columns
    additional_columns = []
    for i in range(len(columns)):
        if columns[i] != column:
            additional_columns.append(columns[i])

    # Reads fits data
    logging.debug("Reading Fits columns's data")
    fits_data = load_events_and_gtis(destination, additional_columns=additional_columns,
                                    gtistring=gtistring,
                                    hduname=hduname, column=column)

    gti_start = fits_data.gti_list[:, 0] - events_start_time
    gti_end = fits_data.gti_list[:, 1] - events_start_time

    logging.debug("Read fits... gti_start: " + str(len(gti_start)) + ", gti_end: " + str(len(gti_end)))

    event_values = fits_data.ev_list - events_start_time

    dataset = DataSet.get_dataset_applying_gtis(dsId, header, header_comments, fits_data.additional_data, event_values,
                                                gti_start, gti_end, None, None, hduname, column)

    logging.debug("Read fits with stingray file successfully: %s" % destination)

    return dataset
