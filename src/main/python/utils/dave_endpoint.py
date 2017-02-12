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


def get_lightcurve(src_filename, bck_filename, target, filters, axis, dt):
    src_destination = get_destination(src_filename, target)
    if not src_destination:
        return common_error("Invalid file or cache key")

    bck_destination = ""
    if bck_filename:
        if not SessionHelper.is_file_uploaded(bck_filename):
            return "Backgrund Filename not uploaded"

        bck_destination = FileUtils.get_destination(target, bck_filename)
        if not FileUtils.is_valid_file(bck_destination):
            return "Invalid backgrund file"

    logging.debug("get_lightcurve src: %s" % src_filename)
    logging.debug("get_lightcurve bck: %s" % bck_filename)
    logging.debug("get_lightcurve: filters %s" % filters)
    logging.debug("get_lightcurve: axis %s" % axis)
    logging.debug("get_lightcurve: dt %f" % dt)

    data = DaveEngine.get_lightcurve(src_destination, bck_destination, filters, axis, dt)

    logging.debug("get_lightcurve: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_colors_lightcurve(src_filename, bck_filename, target, filters, axis, dt):
    src_destination = get_destination(src_filename, target)
    if not src_destination:
        return common_error("Invalid file or cache key")

    bck_destination = ""
    if bck_filename:
        if not SessionHelper.is_file_uploaded(bck_filename):
            return "Backgrund Filename not uploaded"

        bck_destination = FileUtils.get_destination(target, bck_filename)
        if not FileUtils.is_valid_file(bck_destination):
            return "Invalid backgrund file"

    logging.debug("get_colors_lightcurve src: %s" % src_filename)
    logging.debug("get_colors_lightcurve bck: %s" % bck_filename)
    logging.debug("get_colors_lightcurve: filters %s" % filters)
    logging.debug("get_colors_lightcurve: axis %s" % axis)
    logging.debug("get_colors_lightcurve: dt %f" % dt)

    data = DaveEngine.get_colors_lightcurve(src_destination, bck_destination, filters, axis, dt)

    logging.debug("get_colors_lightcurve: Finish!")

    return json.dumps(data, cls=NPEncoder)
