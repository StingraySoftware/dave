
import os
import logging

import numpy as np
from astropy.io import fits

def get_file_schema(destination):

    if not destination:
        return []

    filename, file_extension = os.path.splitext(destination)

    if file_extension == ".txt":
        header_names = [ "Time", "Error_time", "Rate", "Error_rate", "color1", "Error_color1", "color2", "Error_color2" ]
        schema = get_txt_schema(destination, header_names);
        schema["Amplitude"] = np.random.uniform(-1, 1, size=len(schema["Time"]))
        return schema

    elif file_extension == ".lc":
        header_names = [ "Time", "Rate", "Error_rate", "Error_time" ]
        schema = get_lc_schema(destination, header_names);
        return schema

    else:
        return []


def get_txt_schema(destination, header_names):

    data = np.loadtxt(destination)

    schema = {}
    for i in range(len(header_names)):
        header_name = header_names[i]
        schema[header_name] = data[0:len(data),i]

    logging.debug("Read txt file successfully: %s" % destination)

    return schema


def get_lc_schema(destination, header_names):
    hdulist = fits.open(destination)
    tbdata = hdulist[1].data

    for i in range(len(header_names)):
        header_name = header_names[i]
        schema[header_name] = tbdata.field(i)

    logging.debug("Read lc file successfully: %s" % destination)
