import os

import numpy as np
from astropy.io import fits
from hendrics.io import load_data, load_lcurve
from hendrics.lcurve import lcurve_from_fits
from stingray.gti import get_gti_from_hdu
from stingray.io import load_events_and_gtis

import model.dataset as DataSet
import utils.dataset_cache as DsCache
import utils.dave_logger as logging
import utils.exception_helper as ExHelper
from config import CONFIG

# Handle libmagic import gracefully - must be after other imports
MAGIC_AVAILABLE = False
try:
    # On Windows CI, python-magic often causes access violations during import
    # Skip magic import in CI environments to prevent hanging
    if os.environ.get('CI') or os.environ.get('GITHUB_ACTIONS'):
        if os.name == 'nt':  # Windows
            raise ImportError("Skipping python-magic on Windows CI to prevent access violations")

    import magic
    MAGIC_AVAILABLE = True
except ImportError as e:
    MAGIC_AVAILABLE = False
    logging.warn("python-magic not available, falling back to mimetypes: " + str(e))

print("dave_reader loaded")


def get_file_type_from_extension(destination):
    """Fallback method to determine file type from extension when libmagic is not available."""
    ext = os.path.splitext(destination)[1].lower()

    # Map extensions to file type strings that match the original magic output
    extension_map = {
        ".txt": "ASCII text",
        ".dat": "ASCII text",
        ".lc": "ASCII text",
        ".evt": "FITS",
        ".fits": "FITS",
        ".fit": "FITS",
        ".gz": "gzip compressed",
    }

    if ext in extension_map:
        return extension_map[ext]

    # For files without extension or unknown extensions, try to detect
    if ext == "" or ext not in extension_map:
        try:
            # Try to open as FITS first
            with fits.open(destination, memmap=True):
                return "FITS"
        except (OSError, ValueError):
            try:
                # Try to read as text
                with open(destination, encoding="utf-8") as f:
                    f.read(1024)
                return "ASCII text"
            except (OSError, UnicodeDecodeError):
                return "data"

    return "data"


def get_cache_key_for_destination(destination, time_offset):
    if os.path.isfile(destination):
        # If destination is a valid file, so is not a cache key
        return DsCache.get_key(destination + "|" + str(time_offset), True)
    else:
        return destination  # If destination is a cache key


def get_hdu_string_from_hdulist(hdu_string, hdulist):
    supported_hdus = hdu_string.split(",")
    for hdu in hdulist:
        if hdu.name in supported_hdus:
            return hdu.name
    return ""


def get_file_dataset(destination, time_offset=0):
    dataset = None
    cache_key = ""

    try:
        if destination:
            cache_key = get_cache_key_for_destination(destination, time_offset)
            if DsCache.contains(cache_key):
                logging.debug(
                    "get_file_dataset: returned cached dataset, cache_key: " + str(cache_key)
                )
                return DsCache.get(cache_key), cache_key

            logging.debug("get_file_dataset: reading destination: " + str(destination))
            file_extension_from_file = os.path.splitext(destination)[1]

            if MAGIC_AVAILABLE:
                try:
                    file_extension = magic.from_file(destination)
                    logging.debug(f"File extension from magic: {file_extension}")
                except Exception as e:
                    # Handle Windows access violations and other magic runtime errors
                    logging.warn(f"python-magic runtime error, falling back to extension check: {e}")
                    file_extension = get_file_type_from_extension(destination)
                    logging.debug(f"File extension from fallback: {file_extension}")
            else:
                # Fallback to extension-based detection
                file_extension = get_file_type_from_extension(destination)
                logging.debug(f"File extension from fallback: {file_extension}")

            if file_extension.find("ASCII") == 0:
                table_id = "EVENTS"
                header_names = [CONFIG.TIME_COLUMN, "PHA", "Color1", "Color2"]
                dataset = get_txt_dataset(destination, table_id, header_names)

                table = dataset.tables[table_id]
                table.add_columns(["AMPLITUDE"])
                numValues = len(table.columns[CONFIG.TIME_COLUMN].values)
                rng = np.random.default_rng()
                random_values = rng.uniform(-1, 1, size=numValues)
                table.columns["AMPLITUDE"].values = random_values

            elif file_extension.find("FITS") == 0 or file_extension.find("gzip") > -1:
                # Opening Fits
                hdulist = fits.open(destination, memmap=True)

                if get_hdu_string_from_hdulist(CONFIG.EVENTS_STRING, hdulist) != "":
                    # If EVENTS extension found, consider the Fits as EVENTS Fits
                    dataset = get_events_fits_dataset_with_stingray(
                        destination,
                        hdulist,
                        dsId="FITS",
                        hduname=get_hdu_string_from_hdulist(CONFIG.EVENTS_STRING, hdulist),
                        column=CONFIG.TIME_COLUMN,
                        gtistring=CONFIG.GTI_STRING,
                        extra_colums=["PI", "PHA"],
                        time_offset=time_offset,
                    )

                elif "RATE" in hdulist:
                    # If RATE extension found, consider the Fits as LIGHTCURVE Fits
                    dataset = get_lightcurve_fits_dataset_with_stingray(
                        destination,
                        hdulist,
                        hduname="RATE",
                        column=CONFIG.TIME_COLUMN,
                        gtistring=CONFIG.GTI_STRING,
                        time_offset=time_offset,
                    )

                elif "EBOUNDS" in hdulist:
                    # If EBOUNDS extension found, consider the Fits as RMF Fits
                    dataset = get_fits_dataset(hdulist, "RMF", ["EBOUNDS"])

                elif get_hdu_string_from_hdulist(CONFIG.GTI_STRING, hdulist) != "":
                    # If not EVENTS or RATE extension found, check if is GTI Fits
                    dataset = get_gti_fits_dataset_with_stingray(
                        hdulist, gtistring=CONFIG.GTI_STRING, time_offset=time_offset
                    )

                else:
                    logging.warn(
                        "Unsupported FITS type! Any table found: "
                        + CONFIG.EVENTS_STRING
                        + ", RATE, EBOUNDS or "
                        + CONFIG.GTI_STRING
                    )

            elif file_extension == "data" and (file_extension_from_file in [".p", ".nc"]):
                # If file is pickle object, tries to parse it as dataset
                dataset = load_dataset_from_intermediate_file(destination)

            else:
                logging.warn(
                    "Unknown file extension: "
                    + str(file_extension)
                    + " , "
                    + str(file_extension_from_file)
                )

            if dataset:
                DsCache.add(cache_key, dataset)
                logging.debug(
                    "get_file_dataset, dataset added to cache, cache_key: " + str(cache_key)
                )

        else:
            logging.error("get_file_dataset: Destination is empty")

    except Exception:
        logging.error(ExHelper.getException("get_file_dataset"))

    return dataset, cache_key


def get_txt_dataset(destination, table_id, header_names):
    data = np.loadtxt(destination)
    dataset = DataSet.get_hdu_type_dataset(table_id, header_names, hduname="EVENTS")

    # Column1, Column1Err, Column2, Column2Err .. header order expected
    for i in range(len(header_names)):
        header_name = header_names[i]
        column = dataset.tables[table_id].columns[header_name]
        column.values = data[0 : len(data), i * 2]
        column.error_values = data[0 : len(data), (i * 2) + 1]

    logging.debug(f"Read txt file successfully: {destination}")

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
                    dataset.tables[table_id].columns[header_name].add_values(
                        np.nan_to_num(tbdata.field(i))
                    )
            else:
                logging.warn(f"Ignored table data: {hdulist[t].name}")
        else:
            logging.warn(f"No valid data on: {t}")
            logging.warn(f"Type of Data: {type(hdulist[t])}")

    hdulist.close()

    logging.debug(f"Read fits file successfully: {dsId}")

    return dataset


# Returns the column's names of a given table of Fits file
def get_fits_table_column_names(hdulist, table_id):
    if table_id in hdulist and isinstance(hdulist[table_id], fits.hdu.table.BinTableHDU):
        return hdulist[table_id].columns.names

    return None


# Returns a dataset containin HDU("EVENTS") table and GTI table
# with the Fits data using Stingray library
def get_events_fits_dataset_with_stingray(
    destination,
    hdulist,
    dsId="FITS",
    hduname="EVENTS",
    column=CONFIG.TIME_COLUMN,
    gtistring=CONFIG.GTI_STRING,
    extra_colums=None,
    time_offset=0,
):
    if extra_colums is None:
        extra_colums = []
    # Gets columns from fits hdu table
    logging.debug("Reading Events Fits columns")
    columns = get_fits_table_column_names(hdulist, hduname)

    header, header_comments = get_header(hdulist, hduname)

    # Closes the FITS file, further file data reads will be done via Stingray
    hdulist.close()

    # Prepares additional_columns
    additional_columns = []
    for i in range(len(columns)):
        if columns[i] != column and (len(extra_colums) == 0 or columns[i] in extra_colums):
            additional_columns.append(columns[i])

    # Reads fits data
    logging.debug("Reading Events Fits columns's data")
    try:
        fits_data = load_events_and_gtis(
            destination,
            additional_columns=additional_columns,
            gtistring=gtistring,
            hduname=hduname,
            column=column,
        )
    except (KeyError, AttributeError) as e:
        if "TELESCOP" in str(e) or "'NoneType' object has no attribute 'lower'" in str(e):
            # Modern Stingray requires TELESCOP/INSTRUME keywords, add dummy ones if missing
            logging.warn("TELESCOP/INSTRUME keyword missing, adding dummy values")
            temp_hdulist = fits.open(destination)
            if "TELESCOP" not in temp_hdulist[0].header:
                temp_hdulist[0].header["TELESCOP"] = "UNKNOWN"
            if "INSTRUME" not in temp_hdulist[0].header:
                temp_hdulist[0].header["INSTRUME"] = "UNKNOWN"
            # Save to temp file
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=".fits", delete=False) as tmp:
                temp_filename = tmp.name
                temp_hdulist.writeto(temp_filename, overwrite=True)
            temp_hdulist.close()
            # Try again with modified file
            try:
                fits_data = load_events_and_gtis(
                    temp_filename,
                    additional_columns=additional_columns,
                    gtistring=gtistring,
                    hduname=hduname,
                    column=column,
                )
            finally:
                import os

                os.unlink(temp_filename)
        else:
            raise

    fits_data, events_start_time = substract_tstart_from_events(fits_data, time_offset)

    # Gets PI column data from eventlist if requiered and PHA not in additional_data
    if (
        "PI" in additional_columns
        and "PI" not in fits_data.additional_data
        and "PHA" not in fits_data.additional_data
        and hasattr(fits_data, "pi_list")
        and fits_data.pi_list is not None
    ):
        fits_data.additional_data["PI"] = fits_data.pi_list

    dataset = DataSet.get_dataset_applying_gtis(
        dsId,
        header,
        header_comments,
        fits_data.additional_data,
        [],
        fits_data.ev_list if hasattr(fits_data, "ev_list") else [],
        [],
        (
            fits_data.gti_list[:, 0]
            if hasattr(fits_data, "gti_list") and fits_data.gti_list.size > 0
            else []
        ),
        (
            fits_data.gti_list[:, 1]
            if hasattr(fits_data, "gti_list") and fits_data.gti_list.size > 0
            else []
        ),
        None,
        None,
        "EVENTS",
        column,
    )

    # Stores the events_start_time in time column extra
    dataset.tables["EVENTS"].columns[column].set_extra("TSTART", events_start_time)

    logging.debug(
        "Read Events fits with stingray file successfully: "
        + str(destination)
        + ", tstart: "
        + str(events_start_time)
    )

    return dataset


# Returns a dataset containing GTI table using Stingray library
def get_gti_fits_dataset_with_stingray(hdulist, gtistring=CONFIG.GTI_STRING, time_offset=0):
    st_gtis = get_gti_from_hdu(hdulist, gtistring)
    if time_offset != 0:
        st_gtis[:, 0] = st_gtis[:, 0] - time_offset
        st_gtis[:, 1] = st_gtis[:, 1] - time_offset
    return DataSet.get_gti_dataset_from_stingray_gti(st_gtis)


# Returns a dataset containin LIGHTCURVE table and GTI table
# with the Fits data using Stingray library
def get_lightcurve_fits_dataset_with_stingray(
    destination,
    hdulist,
    hduname="RATE",
    column=CONFIG.TIME_COLUMN,
    gtistring=CONFIG.GTI_STRING,
    time_offset=0,
):
    supported_rate_columns = {"RATE", "RATE1", "COUNTS"}
    found_rate_columns = set(hdulist[hduname].data.names)
    intersection_columns = supported_rate_columns.intersection(found_rate_columns)

    # Check if HDUCLAS1 = LIGHTCURVE column exists
    logging.debug("Reading Lightcurve Fits columns")
    if "HDUCLAS1" not in hdulist[hduname].header:
        logging.warn("HDUCLAS1 not found in header: " + hduname)
        return None

    elif hdulist[hduname].header["HDUCLAS1"] != "LIGHTCURVE":
        logging.warn("HDUCLAS1 is not LIGHTCURVE")
        return None

    elif len(intersection_columns) == 0:
        logging.warn(
            "RATE, RATE1 or COUNTS columns not found in "
            + str(hduname)
            + " HDU, found columns: "
            + str(hdulist[hduname].data.names)
        )
        return None

    elif len(intersection_columns) > 1:
        logging.warn(
            "RATE, RATE1 or COUNTS ambiguous columns found in "
            + str(hduname)
            + " HDU, found columns: "
            + str(hdulist[hduname].data.names)
        )
        return None

    ratecolumn = list(intersection_columns)[0]
    if len(hdulist[hduname].data[ratecolumn].shape) != 1 or not isinstance(
        hdulist[hduname].data[ratecolumn][0], int | np.integer | float | np.floating
    ):
        logging.warn(
            "Wrong data type found for column: "
            + str(ratecolumn)
            + " in "
            + str(hduname)
            + " HDU, expected Integer or Float."
        )
        return None

    header, header_comments = get_header(hdulist, hduname)

    # Reads the lightcurve with HENDRICS
    outfile = lcurve_from_fits(
        destination,
        gtistring=get_hdu_string_from_hdulist(gtistring, hdulist),
        timecolumn=column,
        ratecolumn=ratecolumn,
        ratehdu=1,
        fracexp_limit=CONFIG.FRACEXP_LIMIT,
    )[0]

    lcurve, events_start_time = substract_tstart_from_lcurve(load_data(outfile), time_offset)

    dataset = DataSet.get_lightcurve_dataset_from_stingray_lcurve(
        lcurve, header, header_comments, hduname, column
    )

    # Stores the events_start_time in time column extra
    dataset.tables[hduname].columns[column].set_extra("TSTART", events_start_time)

    logging.debug(
        "Read Lightcurve fits with stingray file successfully: "
        + str(destination)
        + ", tstart: "
        + str(events_start_time)
        + ", rate: "
        + str(len(lcurve["counts"]))
    )

    return dataset


def substract_tstart_from_events(fits_data, time_offset=0):
    # Adds the lag of the first event to the start time of observation

    # Modern Stingray returns EventReadOutput with ev_list as numpy array
    t_start = fits_data.t_start if hasattr(fits_data, "t_start") else 0

    if time_offset == 0:
        events_start_time = t_start
    else:
        events_start_time = t_start - (t_start - time_offset)

    # Subtract start time from event times
    if hasattr(fits_data, "ev_list") and fits_data.ev_list is not None:
        fits_data.ev_list = fits_data.ev_list - events_start_time

    # Subtract start time from GTIs
    if hasattr(fits_data, "gti_list") and fits_data.gti_list is not None:
        fits_data.gti_list[:, 0] = fits_data.gti_list[:, 0] - events_start_time
        fits_data.gti_list[:, 1] = fits_data.gti_list[:, 1] - events_start_time

    return fits_data, t_start


def substract_tstart_from_lcurve(lcurve, time_offset=0):
    # Gets start time of observation and substract it from all time data,
    # sure this can be done on lcurve_from_fits, but I consider this is cleaner
    events_start_time = 0
    real_start_time = 0
    if "tstart" in lcurve:
        real_start_time = lcurve["tstart"]

        if time_offset == 0:
            events_start_time = real_start_time
        else:
            events_start_time = real_start_time - (real_start_time - time_offset)

        lcurve["time"] = lcurve["time"] - events_start_time
        lcurve["gti"][:, 0] = lcurve["gti"][:, 0] - events_start_time
        lcurve["gti"][:, 1] = lcurve["gti"][:, 1] - events_start_time
    else:
        logging.warn("TSTART not readed from lightcurve Fits")

    return lcurve, real_start_time


# Gets FITS header properties
def get_header(hdulist, hduname):
    header = {}
    header_comments = {}
    for header_column in hdulist[hduname].header:
        header[header_column] = str(hdulist[hduname].header[header_column])
        header_comments[header_column] = str(hdulist[hduname].header.comments[header_column])

    return header, header_comments


def get_stingray_object(destination, time_offset=0):
    if not destination:
        return None

    if MAGIC_AVAILABLE:
        try:
            file_extension = magic.from_file(destination)
            logging.debug(f"File extension from magic: {file_extension}")
        except Exception as e:
            # Handle Windows access violations and other magic runtime errors
            logging.warn(f"python-magic runtime error, falling back to extension check: {e}")
            file_extension = get_file_type_from_extension(destination)
            logging.debug(f"File extension from fallback: {file_extension}")
    else:
        file_extension = get_file_type_from_extension(destination)
        logging.debug(f"File extension from fallback: {file_extension}")

    if file_extension.find("FITS") == 0:
        # Opening Fits
        hdulist = fits.open(destination, memmap=True)

        if "EVENTS" in hdulist:
            # If EVENTS extension found, consider the Fits as EVENTS Fits
            fits_data = load_events_and_gtis(
                destination,
                additional_columns=["PI", "PHA"],
                gtistring=CONFIG.GTI_STRING,
                hduname="EVENTS",
                column=CONFIG.TIME_COLUMN,
            )
            return substract_tstart_from_events(fits_data, time_offset)

        elif "RATE" in hdulist:
            # If RATE extension found, consider the Fits as LIGHTCURVE Fits
            # Reads the lightcurve with hendrics
            outfile = lcurve_from_fits(
                destination,
                gtistring=get_hdu_string_from_hdulist(CONFIG.GTI_STRING, hdulist),
                timecolumn=CONFIG.TIME_COLUMN,
                ratecolumn=None,
                ratehdu=1,
                fracexp_limit=CONFIG.FRACEXP_LIMIT,
            )[0]
            return substract_tstart_from_lcurve(load_lcurve(outfile), time_offset)

        else:
            logging.error("Unsupported FITS type!")

    else:
        logging.error(f"Unknown file extension: {file_extension}")
        return None


def save_to_intermediate_file(stingray_object, fname):
    """Save Stingray object to intermediate file."""
    from hendrics.io import save_events, save_lcurve, save_pds
    from stingray.crossspectrum import Crossspectrum
    from stingray.events import EventList
    from stingray.lightcurve import Lightcurve

    if isinstance(stingray_object, Lightcurve):
        save_lcurve(stingray_object, fname)
    elif isinstance(stingray_object, EventList):
        save_events(stingray_object, fname)
    # This also work for Powerspectrum and AveragedCrosspowerspectrum, clearly
    elif isinstance(stingray_object, Crossspectrum):
        save_pds(stingray_object, fname)
    else:
        logging.error(
            f"save_to_intermediate_file: Unknown object type: {type(stingray_object).__name__}"
        )
        return False

    return True


def load_dataset_from_intermediate_file(fname):
    """Save Stingray object to intermediate file."""

    import pickle

    from hendrics.io import get_file_type
    from stingray.crossspectrum import Crossspectrum
    from stingray.events import EventList
    from stingray.lightcurve import Lightcurve

    # This will return an EventList, a light curve, a Powerspectrum, ...
    # depending on the contents of the file
    try:
        ftype, contents = get_file_type(fname)
    except (AttributeError, ImportError):
        # Modern Stingray doesn't have _retrieve_pickle_object, use pickle directly
        with open(fname, "rb") as f:
            contents = pickle.load(f)

    if isinstance(contents, Lightcurve):
        return DataSet.get_lightcurve_dataset_from_stingray_Lightcurve(contents)

    elif isinstance(contents, EventList):
        return DataSet.get_eventlist_dataset_from_stingray_Eventlist(contents)

    # This also work for Powerspectrum and AveragedCrosspowerspectrum, clearly
    elif isinstance(contents, Crossspectrum):
        logging.error("Unsupported intermediate file type: Crossspectrum")

    else:
        logging.error(f"Unsupported intermediate file type: {type(contents).__name__}")

    return None
