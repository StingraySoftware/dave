from flask import session

import json
import logging
import urllib

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

    logging.debug("Uploaded filename: %s" % destination)
    session['uploaded_filename']=file.filename

    return json.dumps(dict(filename=file.filename))


def get_dataset_schema(filename, target):
    if not filename:
        return common_error(error="No filename setted")

    if not session['uploaded_filename'] or session['uploaded_filename'] != filename:
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

    if not session['uploaded_filename'] or session['uploaded_filename'] != filename:
        return "Filename not uploaded"

    destination = FileUtils.get_destination(target, filename)
    if not FileUtils.is_valid_file(destination):
        return "Invalid file"

    logging.debug("get_plot_data: %s" % filename)
    logging.debug("get_plot_data: filters %s" % filters)
    logging.debug("get_plot_data: styles %s" % styles)
    logging.debug("get_plot_data: axis %s" % axis)

    data = DaveEngine.get_plot_data(destination, filters, styles, axis)
    return json.dumps(data, cls=NPEncoder)


def get_ligthcurve(filename, target, filters, axis, dt):
    if not filename:
        return "No filename setted"

    if not session['uploaded_filename'] or session['uploaded_filename'] != filename:
        return "Filename not uploaded"

    destination = FileUtils.get_destination(target, filename)
    if not FileUtils.is_valid_file(destination):
        return "Invalid file"

    logging.debug("get_ligthcurve: %s" % filename)
    logging.debug("get_ligthcurve: filters %s" % filters)
    logging.debug("get_ligthcurve: axis %s" % axis)
    logging.debug("get_ligthcurve: dt %f" % dt)

    data = DaveEngine.get_ligthcurve(destination, filters, axis, dt)
    return json.dumps(data, cls=NPEncoder)
