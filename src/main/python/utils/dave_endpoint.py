import json
import utils.dave_logger as logging
import urllib

import utils.session_helper as SessionHelper
import utils.file_utils as FileUtils
import utils.dave_engine as DaveEngine
from utils.np_encoder import NPEncoder
import utils.dataset_cache as DsCache


# UPLOADS THE FILE AND STORES IT ON SESSION
def upload(files, target):

    if len(files) == 0:
        return common_error("No sent files")

    filenames = []

    for file in files:

        destination = FileUtils.save_file(file, target)

        if not destination:
            return common_error("Error uploading file...")

        if not FileUtils.is_valid_file(destination):
            return common_error("File extension is not supported...")

        logging.info("Uploaded filename: %s" % destination)
        SessionHelper.add_uploaded_file_to_session(file.filename)
        filenames.append(file.filename)

    return json.dumps(filenames)

#Returns filename destination or a valid cache key, None if invalid
def get_destination(filename, target):
    if not filename:
        logging.error("No filename or cache key setted for filename %s" % filename)
        return None

    if not SessionHelper.is_file_uploaded(filename):
        if not DsCache.contains(filename):
            logging.error("Filename not uploaded or not found in cache for filename %s" % filename)
            return None

    destination = FileUtils.get_destination(target, filename)
    if not FileUtils.is_valid_file(destination):
        if not DsCache.contains(filename):
            logging.error("Invalid file or not found in cache filename %s" % filename)
            return None
        else:
            destination = filename  # Filename represents only a joined dataset key, not real file

    return destination


def get_dataset_schema(filename, target):
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key")

    schema = DaveEngine.get_dataset_schema(destination)
    return json.dumps(schema, cls=NPEncoder)


# append_file_to_dataset: Appends Fits data to a dataset
#
# @param: filename: filename or dataset cache key
# @param: nextfile: file to append
#
def append_file_to_dataset(filename, nextfile, target):
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key")

    if not nextfile:
        return common_error(error="No nextfile setted")

    if not SessionHelper.is_file_uploaded(nextfile):
        return common_error("Nextfile not uploaded")

    next_destination = FileUtils.get_destination(target, nextfile)
    if not FileUtils.is_valid_file(next_destination):
        return common_error("Invalid next file")

    new_filename = DaveEngine.append_file_to_dataset(destination, next_destination)

    return json.dumps(new_filename)


def common_error(error):
    return json.dumps(dict(error=error))


def get_plot_data(filename, target, filters, styles, axis):
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key")

    logging.debug("get_plot_data: %s" % filename)
    logging.debug("get_plot_data: filters %s" % filters)
    logging.debug("get_plot_data: styles %s" % styles)
    logging.debug("get_plot_data: axis %s" % axis)

    data = DaveEngine.get_plot_data(destination, filters, styles, axis)

    logging.debug("get_plot_data: json.dumps...")

    jsonData = json.dumps(data, cls=NPEncoder)

    logging.debug("get_plot_data: Finish!")

    return jsonData


def get_lightcurve(src_filename, bck_filename, gti_filename, target, filters, axis, dt):
    src_destination = get_destination(src_filename, target)
    if not src_destination:
        return common_error("Invalid file or cache key for source data")

    bck_destination = ""
    if bck_filename:
        bck_destination = get_destination(bck_filename, target)
        if not bck_destination:
            return common_error("Invalid file or cache key for backgrund data")

    gti_destination = ""
    if gti_filename:
        gti_destination = get_destination(gti_filename, target)
        if not gti_destination:
            return common_error("Invalid file or cache key for gti data")

    logging.debug("get_lightcurve src: %s" % src_filename)
    logging.debug("get_lightcurve bck: %s" % bck_filename)
    logging.debug("get_lightcurve gti: %s" % gti_filename)
    logging.debug("get_lightcurve: filters %s" % filters)
    logging.debug("get_lightcurve: axis %s" % axis)
    logging.debug("get_lightcurve: dt %f" % dt)

    data = DaveEngine.get_lightcurve(src_destination, bck_destination, gti_destination, filters, axis, dt)

    logging.debug("get_lightcurve: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_colors_lightcurve(src_filename, bck_filename, gti_filename, target, filters, axis, dt):
    src_destination = get_destination(src_filename, target)
    if not src_destination:
        return common_error("Invalid file or cache key for source data")

    bck_destination = ""
    if bck_filename:
        bck_destination = get_destination(bck_filename, target)
        if not bck_destination:
            return common_error("Invalid file or cache key for backgrund data")

    gti_destination = ""
    if gti_filename:
        gti_destination = get_destination(gti_filename, target)
        if not gti_destination:
            return common_error("Invalid file or cache key for gti data")

    logging.debug("get_colors_lightcurve src: %s" % src_filename)
    logging.debug("get_colors_lightcurve bck: %s" % bck_filename)
    logging.debug("get_colors_lightcurve gti: %s" % gti_filename)
    logging.debug("get_colors_lightcurve: filters %s" % filters)
    logging.debug("get_colors_lightcurve: axis %s" % axis)
    logging.debug("get_colors_lightcurve: dt %f" % dt)

    data = DaveEngine.get_colors_lightcurve(src_destination, bck_destination, gti_destination, filters, axis, dt)

    logging.debug("get_colors_lightcurve: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_joined_lightcurves(lc0_filename, lc1_filename, target, filters, axis, dt):
    lc0_destination = get_destination(lc0_filename, target)
    if not lc0_destination:
        return common_error("Invalid file or cache key for lc0 data")

    lc1_destination = get_destination(lc1_filename, target)
    if not lc1_destination:
        return common_error("Invalid file or cache key for lc1 data")

    logging.debug("get_joined_lightcurves lc0: %s" % lc0_filename)
    logging.debug("get_joined_lightcurves lc1: %s" % lc1_filename)
    logging.debug("get_joined_lightcurves: filters %s" % filters)
    logging.debug("get_joined_lightcurves: axis %s" % axis)
    logging.debug("get_joined_lightcurves: dt %f" % dt)

    data = DaveEngine.get_joined_lightcurves(lc0_destination, lc1_destination, filters, axis, dt)

    logging.debug("get_joined_lightcurves: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_joined_lightcurves_from_colors(src_filename, bck_filename, gti_filename, target, filters, axis, dt):
    src_destination = get_destination(src_filename, target)
    if not src_destination:
        return common_error("Invalid file or cache key for source data")

    bck_destination = ""
    if bck_filename:
        bck_destination = get_destination(bck_filename, target)
        if not bck_destination:
            return common_error("Invalid file or cache key for backgrund data")

    gti_destination = ""
    if gti_filename:
        gti_destination = get_destination(gti_filename, target)
        if not gti_destination:
            return common_error("Invalid file or cache key for gti data")

    logging.debug("get_joined_lightcurves_from_colors src: %s" % src_filename)
    logging.debug("get_joined_lightcurves_from_colors bck: %s" % bck_filename)
    logging.debug("get_joined_lightcurves_from_colors gti: %s" % gti_filename)
    logging.debug("get_joined_lightcurves_from_colors: filters %s" % filters)
    logging.debug("get_joined_lightcurves_from_colors: axis %s" % axis)
    logging.debug("get_joined_lightcurves_from_colors: dt %f" % dt)

    data = DaveEngine.get_joined_lightcurves_from_colors(src_destination, bck_destination, gti_destination, filters, axis, dt)

    logging.debug("get_joined_lightcurves_from_colors: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_divided_lightcurve_ds(lc0_filename, lc1_filename, target):
    lc0_destination = get_destination(lc0_filename, target)
    if not lc0_destination:
        return common_error("Invalid file or cache key for lc0 data")

    lc1_destination = get_destination(lc1_filename, target)
    if not lc1_destination:
        return common_error("Invalid file or cache key for lc1 data")

    logging.debug("get_divided_lightcurve_ds lc0: %s" % lc0_filename)
    logging.debug("get_divided_lightcurve_ds lc1: %s" % lc1_filename)

    cache_key = DaveEngine.get_divided_lightcurve_ds(lc0_destination, lc1_destination)

    logging.debug("get_divided_lightcurve_ds: Finish! cache_key ->  %s" % cache_key)

    return json.dumps(cache_key, cls=NPEncoder)


def get_lightcurve_ds_from_events_ds(filename, target, axis, dt):
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key")

    logging.debug("get_lightcurve_ds_from_events_ds filename: %s" % filename)
    logging.debug("get_lightcurve_ds_from_events_ds: axis %s" % axis)
    logging.debug("get_lightcurve_ds_from_events_ds: dt %f" % dt)

    cache_key = DaveEngine.get_lightcurve_ds_from_events_ds(destination, axis, dt)

    logging.debug("get_lightcurve_ds_from_events_ds: Finish! cache_key ->  %s" % cache_key)

    return json.dumps(cache_key, cls=NPEncoder)
