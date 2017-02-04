import json
import utils.dave_logger as logging
import urllib

import utils.session_helper as SessionHelper
import utils.file_utils as FileUtils
import utils.dave_engine as DaveEngine
from utils.np_encoder import NPEncoder


# UPLOADS THE FILE AND STORES IT ON SESSION
def upload(file, target):
    if not file.filename:
        return common_error("No sent file")

    destination = FileUtils.save_file(file, target)

    if not destination:
        return common_error("Error uploading file...")

    if not FileUtils.is_valid_file(destination):
        return common_error("File extension is not supported...")

    logging.info("Uploaded filename: %s" % destination)
    SessionHelper.add_uploaded_file_to_session(file.filename)

    return json.dumps(dict(filename=file.filename))


def get_dataset_schema(filename, target):
    if not filename:
        return common_error(error="No filename setted")

    if not SessionHelper.is_file_uploaded(filename):
        return common_error("Filename not uploaded")

    destination = FileUtils.get_destination(target, filename)
    if not FileUtils.is_valid_file(destination):
        return common_error("Invalid file")

    schema = DaveEngine.get_dataset_schema(destination)
    return json.dumps(schema, cls=NPEncoder)


def common_error(error):
    return json.dumps(dict(error=error))


def get_plot_data(filename, target, filters, styles, axis):
    if not filename:
        return "No filename setted"

    if not SessionHelper.is_file_uploaded(filename):
        return "Filename not uploaded"

    destination = FileUtils.get_destination(target, filename)
    if not FileUtils.is_valid_file(destination):
        return "Invalid file"

    logging.debug("get_plot_data: %s" % filename)
    logging.debug("get_plot_data: filters %s" % filters)
    logging.debug("get_plot_data: styles %s" % styles)
    logging.debug("get_plot_data: axis %s" % axis)

    data = DaveEngine.get_plot_data(destination, filters, styles, axis)

    logging.debug("get_plot_data: json.dumps...")

    jsonData = json.dumps(data, cls=NPEncoder)

    logging.debug("get_plot_data: Finish!")

    return jsonData


def get_ligthcurve(src_filename, bck_filename, target, filters, axis, dt):
    if not src_filename:
        return "No filename setted"

    if not SessionHelper.is_file_uploaded(src_filename):
        return "Source Filename not uploaded"

    src_destination = FileUtils.get_destination(target, src_filename)
    if not FileUtils.is_valid_file(src_destination):
        return "Invalid source file"

    bck_destination = ""
    if bck_filename:
        if not SessionHelper.is_file_uploaded(bck_filename):
            return "Backgrund Filename not uploaded"

        bck_destination = FileUtils.get_destination(target, bck_filename)
        if not FileUtils.is_valid_file(bck_destination):
            return "Invalid backgrund file"

    logging.debug("get_ligthcurve src: %s" % src_filename)
    logging.debug("get_ligthcurve bck: %s" % bck_filename)
    logging.debug("get_ligthcurve: filters %s" % filters)
    logging.debug("get_ligthcurve: axis %s" % axis)
    logging.debug("get_ligthcurve: dt %f" % dt)

    data = DaveEngine.get_ligthcurve(src_destination, bck_destination, filters, axis, dt)

    logging.debug("get_ligthcurve: Finish!")

    return json.dumps(data, cls=NPEncoder)
