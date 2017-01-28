
import os
import logging
import magic

from model.dataset import DataSet
import numpy as np
from astropy.io import fits
from stingray.io import load_events_and_gtis

cached_datasets = dict()

def get_file_dataset(destination):

    if not destination:
        return None

    if destination in cached_datasets:
        logging.debug("Returned cached dataset")
        return cached_datasets[destination]

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

        cached_datasets[destination] = dataset
        return dataset

    elif file_extension.find("FITS") == 0:

        # ds_id = "fits_table"
        # table_ids = ["Primary", "EVENTS", "GTI"]
        # dataset = get_fits_dataset(destination, ds_id, table_ids)
        # return dataset

        dataset = get_fits_dataset_with_stingray(destination, dsId='FITS',
                                           hduname='EVENTS', column='TIME',
                                           gtistring='GTI,STDGTI,STDGTI04')

        cached_datasets[destination] = dataset
        return dataset

    else:
        return None


def get_txt_dataset(destination, table_id, header_names):

    data = np.loadtxt(destination)

    dataset = DataSet(table_id)
    dataset.add_table(table_id, header_names)

    # Column1, Column1Err, Column2, Column2Err .. header order expected
    for i in range(len(header_names)):
        header_name = header_names[i]
        column = dataset.tables[table_id].columns[header_name]
        column.values = data[0:len(data), i * 2]
        column.error_values = data[0:len(data), (i * 2) + 1]

    logging.debug("Read txt file successfully: %s" % destination)

    return dataset


# Returns a dataset by reading a Fits file, returns all tables, NOT USED!!
def get_fits_dataset(destination, dsId, table_ids):
    hdulist = fits.open(destination)
    dataset = DataSet(dsId)

    for t in range(len(hdulist)):

        if isinstance(hdulist[t], fits.hdu.table.BinTableHDU):
            table_id = table_ids[t]
            header_names = hdulist[t].columns.names
            tbdata = hdulist[t].data
            dataset.add_table(table_id, header_names)

            for i in range(len(header_names)):
                header_name = header_names[i]
                dataset.tables[table_id].columns[header_name].values = np.append([], tbdata.field(i))

        else:
            logging.debug("No valid data on: %s" % t)
            logging.debug("Type of Data: %s" % type(hdulist[t]))

    hdulist.close()

    logging.debug("Read fits file successfully: %s" % destination)

    return dataset


# Returns the column's names of a given table of Fits file
def get_fits_table_column_names(destination, table_id):
    hdulist = fits.open(destination)

    if hdulist[table_id]:
        if isinstance(hdulist[table_id], fits.hdu.table.BinTableHDU):
            return hdulist[table_id].columns.names

    return None


# Returns a dataset containin HDU table and GTI table with the Fits data using Stingray library
def get_fits_dataset_with_stingray(destination, dsId='FITS',
                                   hduname='EVENTS', column='TIME',
                                   gtistring='GTI,STDGTI'):

    # Gets columns from fits hdu table
    logging.debug("Reading Fits columns")
    columns = get_fits_table_column_names (destination, hduname)
    columns = ["TIME", "PI"]

    # Prepares additional_columns
    additional_columns = []
    for i in range(len(columns)):
        if columns[i] != column:
            additional_columns = np.append(additional_columns, columns[i])



    # Reads fits data
    logging.debug("Reading Fits columns's data")
    fits_data = load_events_and_gtis(destination, additional_columns=additional_columns,
                                    gtistring=gtistring,
                                    hduname=hduname, column=column)

    # Creates the dataset
    dataset = DataSet(dsId)

    #Fills Hdu table
    logging.debug("Fills Hdu table")
    dataset.add_table(hduname, columns)
    dataset.tables[hduname].columns[column].add_values(fits_data.ev_list)
    for i in range(len(additional_columns)):
        column = additional_columns[i]
        dataset.tables[hduname].columns[column].add_values(fits_data.additional_data[column])

    #Fills Gtis table
    logging.debug("Fills Gtis table")
    gti_columns = ["START", "STOP"]
    gti_start = fits_data.gti_list[:, 0]
    gti_end = fits_data.gti_list[:, 1]
    dataset.add_table("GTI", gti_columns)
    dataset.tables["GTI"].columns[gti_columns[0]].add_values(gti_start)
    dataset.tables["GTI"].columns[gti_columns[1]].add_values(gti_end)

    logging.debug("Read fits with stingray file successfully: %s" % destination)

    return dataset
