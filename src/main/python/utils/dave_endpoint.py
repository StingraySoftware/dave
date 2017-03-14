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
            destination = filename # Filename represents only a joined dataset key, not a real file

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


def get_power_density_spectrum(src_filename, bck_filename, gti_filename, target, filters, axis, dt, nsegm, segm_size, norm):
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

    logging.debug("get_power_density_spectrum src: %s" % src_filename)
    logging.debug("get_power_density_spectrum bck: %s" % bck_filename)
    logging.debug("get_power_density_spectrum gti: %s" % gti_filename)
    logging.debug("get_power_density_spectrum: filters %s" % filters)
    logging.debug("get_power_density_spectrum: axis %s" % axis)
    logging.debug("get_power_density_spectrum: dt %f" % dt)
    logging.debug("get_power_density_spectrum: nsegm %f" % nsegm)
    logging.debug("get_power_density_spectrum: segm_size %f" % segm_size)
    logging.debug("get_power_density_spectrum: norm %s" % norm)

    data = DaveEngine.get_power_density_spectrum(src_destination, bck_destination, gti_destination, filters, axis, dt, nsegm, segm_size, norm)

    logging.debug("get_power_density_spectrum: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_cross_spectrum(src_filename1, bck_filename1, gti_filename1, filters1, axis1, dt1,
                       src_filename2, bck_filename2, gti_filename2, filters2, axis2, dt2,
                       target, nsegm, segm_size, norm):

   src_destination1 = get_destination(src_filename1, target)
   if not src_destination1:
       return common_error("Invalid file or cache key for source data 1")

   bck_destination1 = ""
   if bck_filename1:
       bck_destination1 = get_destination(bck_filename1, target)
       if not bck_destination1:
           return common_error("Invalid file or cache key for backgrund data 1")

   gti_destination1 = ""
   if gti_filename1:
       gti_destination1 = get_destination(gti_filename1, target)
       if not gti_destination1:
           return common_error("Invalid file or cache key for gti data 1")

   src_destination2 = get_destination(src_filename2, target)
   if not src_destination2:
       return common_error("Invalid file or cache key for source data 2")

   bck_destination2 = ""
   if bck_filename2:
       bck_destination2 = get_destination(bck_filename2, target)
       if not bck_destination2:
           return common_error("Invalid file or cache key for backgrund data 2")

   gti_destination2 = ""
   if gti_filename2:
       gti_destination2 = get_destination(gti_filename2, target)
       if not gti_destination2:
           return common_error("Invalid file or cache key for gti data 2")

   logging.debug("get_cross_spectrum src 1: %s" % src_filename1)
   logging.debug("get_cross_spectrum bck 1: %s" % bck_filename1)
   logging.debug("get_cross_spectrum gti 1: %s" % gti_filename1)
   logging.debug("get_cross_spectrum: filters 1 %s" % filters1)
   logging.debug("get_cross_spectrum: axis 1 %s" % axis1)
   logging.debug("get_cross_spectrum: dt 1 %f" % dt1)
   logging.debug("get_cross_spectrum src 2: %s" % src_filename2)
   logging.debug("get_cross_spectrum bck 2: %s" % bck_filename2)
   logging.debug("get_cross_spectrum gti 2: %s" % gti_filename2)
   logging.debug("get_cross_spectrum: filters 2 %s" % filters2)
   logging.debug("get_cross_spectrum: axis 2 %s" % axis2)
   logging.debug("get_cross_spectrum: dt 2 %f" % dt2)
   logging.debug("get_cross_spectrum: nsegm %f" % nsegm)
   logging.debug("get_cross_spectrum: segm_size %f" % segm_size)
   logging.debug("get_cross_spectrum: norm %s" % norm)

   data = DaveEngine.get_cross_spectrum(src_destination1, bck_destination1, gti_destination1, filters1, axis1, dt1,
                                        src_destination2, bck_destination2, gti_destination2, filters2, axis2, dt2,
                                        nsegm, segm_size, norm)

   logging.debug("get_cross_spectrum: Finish!")

   return json.dumps(data, cls=NPEncoder)
