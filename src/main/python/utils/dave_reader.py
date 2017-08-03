
import os
import utils.dave_logger as logging
import magic

import model.dataset as DataSet
import numpy as np
from astropy.io import fits
from maltpynt.io import load_events_and_gtis
from stingray.gti import _get_gti_from_extension
from utils.stingray_addons import lcurve_from_fits
import utils.dataset_cache as DsCache

gtistring='GTI,STDGTI,STDGTI04'

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

        table_id = "EVENTS"
        header_names = ["TIME", "PHA", "Color1", "Color2"]
        dataset = get_txt_dataset(destination, table_id, header_names)

        table = dataset.tables[table_id]
        table.add_columns(["AMPLITUDE"])
        numValues = len(table.columns["TIME"].values)
        random_values = np.random.uniform(-1, 1, size=numValues)
        table.columns["AMPLITUDE"].values = random_values

        DsCache.add(destination, dataset)
        return dataset

    elif file_extension.find("FITS") == 0:

        # ds_id = "fits_table"
        # table_ids = ["Primary", "EVENTS", "GTI"]
        # dataset = get_fits_dataset(destination, ds_id, table_ids)
        # return dataset

        # Opening Fits
        hdulist = fits.open(destination, memmap=True)
        dataset = None
        
        if 'EVENTS' in hdulist:
            # If EVENTS extension found, consider the Fits as EVENTS Fits
            dataset = get_events_fits_dataset_with_stingray(destination, hdulist, dsId='FITS',
                                               hduname='EVENTS', column='TIME',
                                               gtistring=gtistring, extra_colums=['PI', "PHA"])

        elif 'RATE' in hdulist:
            # If RATE extension found, consider the Fits as LIGHTCURVE Fits
            dataset = get_lightcurve_fits_dataset_with_stingray(destination, hdulist, hduname='RATE',
                                                        column='TIME', gtistring=gtistring)

        elif 'EBOUNDS' in hdulist:
            # If EBOUNDS extension found, consider the Fits as RMF Fits
            dataset = get_fits_dataset(hdulist, "RMF", ["EBOUNDS"])

        elif len(set(gtistring.split(",")).intersection(set(hdulist))):
            # If not EVENTS or RATE extension found, check if is GTI Fits
            dataset = get_gti_fits_dataset_with_stingray(hdulist,gtistring=gtistring)

        if dataset:
            DsCache.add(destination, dataset)

        return dataset

    else:
        return None


def get_txt_dataset(destination, table_id, header_names):

    data = np.loadtxt(destination)
    dataset = DataSet.get_hdu_type_dataset(table_id, header_names, hduname="EVENTS")

    # Column1, Column1Err, Column2, Column2Err .. header order expected
    for i in range(len(header_names)):
        header_name = header_names[i]
        column = dataset.tables[table_id].columns[header_name]
        column.values = data[0:len(data), i * 2]
        column.error_values = data[0:len(data), (i * 2) + 1]

    logging.debug("Read txt file successfully: %s" % destination)

    return dataset


# Returns a dataset by reading a Fits file, returns all tables
def get_fits_dataset(hdulist, dsId, table_ids):
    dataset = DataSet.get_empty_dataset(dsId)

    for t in range(len(hdulist)):
        if isinstance(hdulist[t], fits.hdu.table.BinTableHDU):
            if hdulist[t].name in table_ids:
                table_id = hdulist[t].name

                header_names = hdulist[t].columns.names
                tbdata = hdulist[t].data
                dataset.add_table(table_id, header_names)

                header, header_comments = get_header(hdulist, table_id)
                dataset.tables[table_id].set_header_info(header, header_comments)

                for i in range(len(header_names)):
                    header_name = header_names[i]
                    dataset.tables[table_id].columns[header_name].add_values(np.nan_to_num(tbdata.field(i)))
            else:
                logging.warn("Ignored table data: %s" % hdulist[t].name)
        else:
            logging.warn("No valid data on: %s" % t)
            logging.warn("Type of Data: %s" % type(hdulist[t]))

    hdulist.close()

    logging.debug("Read fits file successfully: %s" % dsId)

    return dataset


# Returns the column's names of a given table of Fits file
def get_fits_table_column_names(hdulist, table_id):

    if table_id in hdulist:
        if isinstance(hdulist[table_id], fits.hdu.table.BinTableHDU):
            return hdulist[table_id].columns.names

    return None


# Returns a dataset containin HDU table and GTI table
# with the Fits data using Stingray library
def get_events_fits_dataset_with_stingray(destination, hdulist, dsId='FITS',
                                   hduname='EVENTS', column='TIME',
                                   gtistring='GTI,STDGTI', extra_colums=[]):

    # Gets columns from fits hdu table
    logging.debug("Reading Events Fits columns")
    columns = get_fits_table_column_names(hdulist, hduname)

    header, header_comments = get_header(hdulist, hduname)

    # Closes the FITS file, further file data reads will be done via Stingray
    hdulist.close()

    # Prepares additional_columns
    additional_columns = []
    for i in range(len(columns)):
        if columns[i] != column:
            if len(extra_colums) == 0 or columns[i] in extra_colums:
                additional_columns.append(columns[i])

    # Reads fits data
    logging.debug("Reading Events Fits columns's data")
    fits_data = load_events_and_gtis(destination,
                                     additional_columns=additional_columns,
                                     gtistring=gtistring,
                                     hduname=hduname, column=column)

    logging.warn(repr(fits_data.additional_data))
    # Adds the lag of the first event to the start time of observation
    events_start_time = fits_data.t_start
    event_list = fits_data.ev_list

    gti_start = event_list.gti[:, 0] - events_start_time
    gti_end = event_list.gti[:, 1] - events_start_time

    logging.debug("Read Events fits... gti_start: " + str(len(gti_start)) + ", gti_end: " + str(len(gti_end)))


    event_values = event_list.time - events_start_time

    dataset = DataSet.get_dataset_applying_gtis(dsId, header, header_comments,
                                                fits_data.additional_data, [],
                                                event_values, [],
                                                gti_start, gti_end, None, None, hduname, column)

    logging.debug("Read Events fits with stingray file successfully: %s" % destination)

    return dataset


# Returns a dataset containing GTI table using Stingray library
def get_gti_fits_dataset_with_stingray(hdulist, gtistring='GTI,STDGTI'):
    st_gtis = _get_gti_from_extension(hdulist, gtistring)
    return DataSet.get_gti_dataset_from_stingray_gti(st_gtis)


# Returns a dataset containin LIGHTCURVE table and GTI table
# with the Fits data using Stingray library
def get_lightcurve_fits_dataset_with_stingray(destination, hdulist, hduname='RATE',
                                            column='TIME', gtistring='GTI,STDGTI'):

    #Check if HDUCLAS1 = LIGHTCURVE column exists
    logging.debug("Reading Lightcurve Fits columns")
    if "HDUCLAS1" not in hdulist[hduname].header:
        logging.warn("HDUCLAS1 not found in header: " + hduname)
        return None

    if hdulist[hduname].header["HDUCLAS1"] != "LIGHTCURVE":
        logging.warn("HDUCLAS1 is not LIGHTCURVE")
        return None

    header, header_comments = get_header(hdulist, hduname)

    lcurve = lcurve_from_fits(destination, gtistring=gtistring,
                             timecolumn=column, ratecolumn=None, ratehdu=1,
                             fracexp_limit=0.9)

    # Gets start time of observation and substract it from all time data,
    # sure this can be done on lcurve_from_fits, but I consider this is cleaner
    if "Tstart" in lcurve:
        events_start_time = lcurve["Tstart"]
        lcurve["time"] = lcurve["time"] - events_start_time
        lcurve["time"][0] = 0  # This is because double substraction could return small negative values for 0
        lcurve["GTI"] = lcurve["GTI"] - events_start_time
    else:
        logging.warn("TSTART not readed from lightcurve Fits")

    dataset = DataSet.get_lightcurve_dataset_from_stingray_lcurve(lcurve, header, header_comments,
                                                                    hduname, column)

    logging.debug("Read Lightcurve fits with stingray file successfully: %s" % destination)

    return dataset


# Gets FITS header properties
def get_header(hdulist, hduname):
    header = dict()
    header_comments = dict()
    for header_column in hdulist[hduname].header:
        header[header_column] = str(hdulist[hduname].header[header_column])
        header_comments[header_column] = str(hdulist[hduname].header.comments[header_column])

    return header, header_comments


def save_to_intermediate_file(stingray_object, fname):
    """Save Stingray object to intermediate file."""
    from stingray.lightcurve import Lightcurve
    from stingray.events import EventList
    from stingray.crossspectrum import Crossspectrum
    from maltpynt.io import save_lcurve, save_events, save_pds
    if isinstance(stingray_object, Lightcurve):
        save_lcurve(stingray_object, fname)
    elif isinstance(stingray_object, EventList):
        save_events(stingray_object, fname)
    elif isinstance(stingray_object, Crossspectrum):
        save_pds(stingray_object, fname)


def load_from_intermediate_file(fname):
    """Save Stingray object to intermediate file."""
    from stingray.lightcurve import Lightcurve
    from stingray.events import EventList
    from stingray.crossspectrum import Crossspectrum
    from maltpynt.io import get_file_type

    ftype, contents = get_file_type(fname)
    return contents
