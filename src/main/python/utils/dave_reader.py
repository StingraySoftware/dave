
import os
import logging

from model.dataset import DataSet
import numpy as np
from astropy.io import fits


def get_file_dataset(destination):

    if not destination:
        return None

    filename, file_extension = os.path.splitext(destination)

    if file_extension == ".txt":

        table_id = "txt_table"
        header_names = ["Time", "Rate", "color1", "color2"]
        dataset = get_txt_dataset(destination, table_id, header_names)

        table = dataset.tables[table_id]
        table.add_columns(["Amplitude"])
        numValues = len(table.columns["Time"].values)
        random_values = np.random.uniform(-1, 1, size=numValues)
        table.columns["Amplitude"].values = random_values

        return dataset

    elif file_extension == ".lc":

        table_id = "lc_table"
        dataset = get_fits_dataset(destination, table_id)

        return dataset

    else:
        return None


def get_txt_dataset(destination, table_id, header_names):

    data = np.loadtxt(destination)

    dataset = DataSet(table_id)
    dataset.add_table(table_id, header_names)

    for i in range(len(header_names)):
        header_name = header_names[i]
        column = dataset.tables[table_id].columns[header_name]
        column.values = data[0:len(data), i * 2]
        column.error_values = data[0:len(data), (i * 2) + 1]

    logging.debug("Read txt file successfully: %s" % destination)

    return dataset


def get_fits_dataset(destination, table_id):
    hdulist = fits.open(destination)
    tbdata = hdulist[1].data

    header_names = hdulist[1].columns.names
    dataset = DataSet(table_id)
    dataset.add_table(table_id, header_names)

    for i in range(len(header_names)):
        header_name = header_names[i]
        dataset.tables[table_id].columns[header_name].values = tbdata.field(i)

    logging.debug("Read lc file successfully: %s" % destination)

    return dataset
