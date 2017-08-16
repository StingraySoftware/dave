import json
import utils.dave_logger as logging
import urllib

import utils.session_helper as SessionHelper
import utils.file_utils as FileUtils
import utils.dave_engine as DaveEngine
import utils.dave_bulk as DaveBulk
from utils.np_encoder import NPEncoder
import utils.dataset_cache as DsCache
from config import CONFIG


# UPLOADS THE FILE AND STORES IT ON SESSION,
# only called if IS_LOCAL_SERVER=False configuration setted
def upload(files, target):

    if len(files) == 0:
        return common_error("No sent files")

    filenames = []

    for file in files:

        # Looks if same filename was previously uploaded
        if not FileUtils.file_exist(target, file.filename):
            destination = FileUtils.save_file(target, file)

            if not destination:
                return common_error("Error uploading file...")

            if not FileUtils.is_valid_file(destination):
                return common_error("File format is not supported...")

            logging.info("Uploaded filename: %s" % destination)
        else:
            destination = FileUtils.get_destination(target, file.filename)
            logging.info("Previously uploaded filename: %s" % destination)

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
            if not FileUtils.file_exist(target, filename):
                logging.error("Filename not uploaded or not found in cache for filename %s" % filename)
                return None
            else:
                logging.info("Filename readed from upload in previous session, filename %s" % filename)


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
        return common_error("Invalid file or cache key, filename: %s" % filename)

    schema = DaveEngine.get_dataset_schema(destination)
    return json.dumps(schema, cls=NPEncoder)


def get_dataset_header(filename, target):
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key, filename: %s" % filename)

    header = DaveEngine.get_dataset_header(destination)
    return json.dumps(header, cls=NPEncoder)



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
        if not FileUtils.file_exist(target, nextfile):
            logging.error("Filename not uploaded for nextfile %s" % nextfile)
            return common_error("Nextfile not uploaded")

    next_destination = FileUtils.get_destination(target, nextfile)
    if not FileUtils.is_valid_file(next_destination):
        return common_error("Invalid next file")

    logging.debug("append_file_to_dataset, destination: %s" % destination)
    logging.debug("append_file_to_dataset, next_destination: %s" % next_destination)

    new_filename = DaveEngine.append_file_to_dataset(destination, next_destination)

    logging.debug("append_file_to_dataset, cache_key: %s" % new_filename)

    return json.dumps(new_filename)


# apply_rmf_file_to_dataset: Applies and Rmf file to an events dataset
#                            Creates a new column E with Enery data on dataset
# @param: filename: filename or dataset cache key
# @param: rmf_filename: rmf file to apply
#
def apply_rmf_file_to_dataset(filename, rmf_filename, target):
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key")

    if not rmf_filename:
        return common_error(error="No rmf_filename setted")

    rmf_destination = FileUtils.get_destination(target, rmf_filename)
    if not FileUtils.is_valid_file(rmf_destination):
        return common_error("Invalid RMF file")

    result = DaveEngine.apply_rmf_file_to_dataset(destination, rmf_destination)
    return json.dumps(result)


def common_error(error):
    return json.dumps(dict(error=error))


def get_plot_data(src_filename, bck_filename, gti_filename, target, filters, styles, axis):
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

    logging.debug("get_plot_data src: %s" % src_filename)
    logging.debug("get_plot_data bck: %s" % bck_filename)
    logging.debug("get_plot_data gti: %s" % gti_filename)
    logging.debug("get_plot_data: filters %s" % filters)
    logging.debug("get_plot_data: styles %s" % styles)
    logging.debug("get_plot_data: axis %s" % axis)

    data = DaveEngine.get_plot_data(src_destination, bck_destination, gti_destination, filters, styles, axis)

    logging.debug("get_plot_data: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_lightcurve(src_filename, bck_filename, gti_filename, target, filters, axis, dt, baseline_opts):
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
    logging.debug("get_lightcurve: baseline_opts %s" % baseline_opts)

    data = DaveEngine.get_lightcurve(src_destination, bck_destination, gti_destination, filters, axis, dt, baseline_opts)

    logging.debug("get_lightcurve: Finish!")

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


def get_divided_lightcurves_from_colors(src_filename, bck_filename, gti_filename, target, filters, axis, dt):
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

    logging.debug("get_divided_lightcurves_from_colors src: %s" % src_filename)
    logging.debug("get_divided_lightcurves_from_colors bck: %s" % bck_filename)
    logging.debug("get_divided_lightcurves_from_colors gti: %s" % gti_filename)
    logging.debug("get_divided_lightcurves_from_colors: filters %s" % filters)
    logging.debug("get_divided_lightcurves_from_colors: axis %s" % axis)
    logging.debug("get_divided_lightcurves_from_colors: dt %f" % dt)

    data = DaveEngine.get_divided_lightcurves_from_colors(src_destination, bck_destination, gti_destination, filters, axis, dt)

    logging.debug("get_divided_lightcurves_from_colors: Finish!")

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


def get_power_density_spectrum(src_filename, bck_filename, gti_filename, target,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type):
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
    logging.debug("get_power_density_spectrum: type %s" % pds_type)

    data = DaveEngine.get_power_density_spectrum(src_destination, bck_destination, gti_destination,
                                                filters, axis, dt, nsegm, segm_size, norm, pds_type)

    logging.debug("get_power_density_spectrum: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_dynamical_spectrum(src_filename, bck_filename, gti_filename, target,
                                filters, axis, dt, nsegm, segm_size, norm):
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

    logging.debug("get_dynamical_spectrum src: %s" % src_filename)
    logging.debug("get_dynamical_spectrum bck: %s" % bck_filename)
    logging.debug("get_dynamical_spectrum gti: %s" % gti_filename)
    logging.debug("get_dynamical_spectrum: filters %s" % filters)
    logging.debug("get_dynamical_spectrum: axis %s" % axis)
    logging.debug("get_dynamical_spectrum: dt %f" % dt)
    logging.debug("get_dynamical_spectrum: nsegm %f" % nsegm)
    logging.debug("get_dynamical_spectrum: segm_size %f" % segm_size)
    logging.debug("get_dynamical_spectrum: norm %s" % norm)

    data = DaveEngine.get_dynamical_spectrum(src_destination, bck_destination, gti_destination,
                                                filters, axis, dt, nsegm, segm_size, norm)

    logging.debug("get_dynamical_spectrum: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_cross_spectrum(src_filename1, bck_filename1, gti_filename1, filters1, axis1, dt1,
                       src_filename2, bck_filename2, gti_filename2, filters2, axis2, dt2,
                       target, nsegm, segm_size, norm, xds_type):

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
   logging.debug("get_cross_spectrum: type %s" % xds_type)

   data = DaveEngine.get_cross_spectrum(src_destination1, bck_destination1, gti_destination1, filters1, axis1, dt1,
                                        src_destination2, bck_destination2, gti_destination2, filters2, axis2, dt2,
                                        nsegm, segm_size, norm, xds_type)

   logging.debug("get_cross_spectrum: Finish! %s" % data)

   return json.dumps(data, cls=NPEncoder)


def get_covariance_spectrum(src_filename, bck_filename, gti_filename, filters, target, dt, ref_band_interest, energy_range, n_bands, std):
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

    logging.debug("get_covariance_spectrum src: %s" % src_filename)
    logging.debug("get_covariance_spectrum bck: %s" % bck_filename)
    logging.debug("get_covariance_spectrum gti: %s" % gti_filename)
    logging.debug("get_covariance_spectrum: filters %s" % filters)
    logging.debug("get_covariance_spectrum dt: %s" % dt)
    logging.debug("get_covariance_spectrum ref_band_interest: %s" % ref_band_interest)
    logging.debug("get_phase_lag_spectrum: energy_range %s" % energy_range)
    logging.debug("get_covariance_spectrum n_bands: %s" % n_bands)
    logging.debug("get_covariance_spectrum std: %s" % std)

    data = DaveEngine.get_covariance_spectrum(src_destination, bck_destination, gti_destination,
                                            filters, dt, ref_band_interest, energy_range, n_bands, std)

    logging.debug("get_covariance_spectrum: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_phase_lag_spectrum(src_filename, bck_filename, gti_filename, target,
                    filters, axis, dt, nsegm, segm_size, norm, pds_type,
                    freq_range, energy_range, n_bands):
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

    logging.debug("get_phase_lag_spectrum src: %s" % src_filename)
    logging.debug("get_phase_lag_spectrum bck: %s" % bck_filename)
    logging.debug("get_phase_lag_spectrum gti: %s" % gti_filename)
    logging.debug("get_phase_lag_spectrum: filters %s" % filters)
    logging.debug("get_phase_lag_spectrum: axis %s" % axis)
    logging.debug("get_phase_lag_spectrum: dt %f" % dt)
    logging.debug("get_phase_lag_spectrum: nsegm %f" % nsegm)
    logging.debug("get_phase_lag_spectrum: segm_size %f" % segm_size)
    logging.debug("get_phase_lag_spectrum: norm %s" % norm)
    logging.debug("get_phase_lag_spectrum: type %s" % pds_type)
    logging.debug("get_phase_lag_spectrum: freq_range %s" % freq_range)
    logging.debug("get_phase_lag_spectrum: energy_range %s" % energy_range)
    logging.debug("get_phase_lag_spectrum: n_bands %s" % n_bands)

    data = DaveEngine.get_phase_lag_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type,
                                        freq_range, energy_range, n_bands)

    logging.debug("get_phase_lag_spectrum: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_rms_spectrum(src_filename, bck_filename, gti_filename, target,
                    filters, axis, dt, nsegm, segm_size, norm, pds_type,
                    freq_range, energy_range, n_bands):
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

    logging.debug("get_rms_spectrum src: %s" % src_filename)
    logging.debug("get_rms_spectrum bck: %s" % bck_filename)
    logging.debug("get_rms_spectrum gti: %s" % gti_filename)
    logging.debug("get_rms_spectrum: filters %s" % filters)
    logging.debug("get_rms_spectrum: axis %s" % axis)
    logging.debug("get_rms_spectrum: dt %f" % dt)
    logging.debug("get_rms_spectrum: nsegm %f" % nsegm)
    logging.debug("get_rms_spectrum: segm_size %f" % segm_size)
    logging.debug("get_rms_spectrum: norm %s" % norm)
    logging.debug("get_rms_spectrum: type %s" % pds_type)
    logging.debug("get_rms_spectrum: freq_range %s" % freq_range)
    logging.debug("get_rms_spectrum: energy_range %s" % energy_range)
    logging.debug("get_rms_spectrum: n_bands %s" % n_bands)

    data = DaveEngine.get_rms_spectrum(src_destination, bck_destination, gti_destination,
                                        filters, axis, dt, nsegm, segm_size, norm, pds_type,
                                        freq_range, energy_range, n_bands)

    logging.debug("get_rms_spectrum: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_plot_data_from_models(models, x_values):

    logging.debug("get_plot_data_from_models models: %s" % models)
    logging.debug("get_plot_data_from_models x_values: %s" % str(len(x_values)))

    data = DaveEngine.get_plot_data_from_models(models, x_values)

    logging.debug("get_plot_data_from_models: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_fit_powerspectrum_result(src_filename, bck_filename, gti_filename, target,
                                filters, axis, dt, nsegm, segm_size, norm, pds_type, models):
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

    logging.debug("get_fit_powerspectrum_result src: %s" % src_filename)
    logging.debug("get_fit_powerspectrum_result bck: %s" % bck_filename)
    logging.debug("get_fit_powerspectrum_result gti: %s" % gti_filename)
    logging.debug("get_fit_powerspectrum_result: filters %s" % filters)
    logging.debug("get_fit_powerspectrum_result: axis %s" % axis)
    logging.debug("get_fit_powerspectrum_result: dt %f" % dt)
    logging.debug("get_fit_powerspectrum_result: nsegm %f" % nsegm)
    logging.debug("get_fit_powerspectrum_result: segm_size %f" % segm_size)
    logging.debug("get_fit_powerspectrum_result: norm %s" % norm)
    logging.debug("get_fit_powerspectrum_result: type %s" % pds_type)
    logging.debug("get_fit_powerspectrum_result: models %s" % models)

    data = DaveEngine.get_fit_powerspectrum_result(src_destination, bck_destination, gti_destination,
                                                filters, axis, dt, nsegm, segm_size, norm, pds_type, models)

    logging.debug("get_fit_powerspectrum_result: Finish!")

    return json.dumps(data, cls=NPEncoder)


def get_bootstrap_results(src_filename, bck_filename, gti_filename, target,
                            filters, axis, dt, nsegm, segm_size, norm, pds_type,
                            models, n_iter, mean, red_noise, seed):
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

    logging.debug("get_bootstrap_results src: %s" % src_filename)
    logging.debug("get_bootstrap_results bck: %s" % bck_filename)
    logging.debug("get_bootstrap_results gti: %s" % gti_filename)
    logging.debug("get_bootstrap_results: filters %s" % filters)
    logging.debug("get_bootstrap_results: axis %s" % axis)
    logging.debug("get_bootstrap_results: dt %f" % dt)
    logging.debug("get_bootstrap_results: nsegm %f" % nsegm)
    logging.debug("get_bootstrap_results: segm_size %f" % segm_size)
    logging.debug("get_bootstrap_results: norm %s" % norm)
    logging.debug("get_bootstrap_results: type %s" % pds_type)
    logging.debug("get_bootstrap_results: models %s" % models)
    logging.debug("get_bootstrap_results: n_iter %s" % n_iter)
    logging.debug("get_bootstrap_results: mean %s" % mean)
    logging.debug("get_bootstrap_results: red_noise %s" % red_noise)
    logging.debug("get_bootstrap_results: seed %s" % seed)

    data = DaveEngine.get_bootstrap_results(src_destination, bck_destination, gti_destination,
                                            filters, axis, dt, nsegm, segm_size, norm, pds_type,
                                            models, n_iter, mean, red_noise, seed)

    logging.debug("get_bootstrap_results: Finish!")

    return json.dumps(data, cls=NPEncoder)


# Creates MaLTPyNT intermediate files from local absolute paths and stores them on target folder
def get_intermediate_files(filepaths, target):
    filenames = []

    for filepath in filepaths:
        if not FileUtils.is_valid_file(filepath):
            logging.error("Filepath not found or invalid: %s" % filepath)
        else:
            filename = DaveBulk.get_intermediate_file(filepath, target)
            logging.debug("get_intermediate_files filename: %s" % filename)
            if filename:
                filenames.append(filename)

    return json.dumps(filenames, cls=NPEncoder)


def bulk_analisys(filenames, plot_configs, outdir, target):

    logging.debug("bulk_analisys filenames: %s" % filenames)
    logging.debug("bulk_analisys plot_configs: %s" % plot_configs)
    logging.debug("bulk_analisys outdir: %s" % outdir)

    absolute_outdir = "/".join([target, outdir])
    bulk_data = DaveBulk.bulk_analisys(filenames, plot_configs, absolute_outdir)
    logging.debug("bulk_analisys: Finish!")
    return json.dumps(bulk_data, cls=NPEncoder)
