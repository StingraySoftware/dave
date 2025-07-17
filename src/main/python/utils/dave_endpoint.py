from flask import Response, jsonify
from werkzeug.datastructures import FileStorage

import utils.dataset_cache as DsCache
import utils.dave_bulk as DaveBulk
import utils.dave_engine as DaveEngine
import utils.dave_logger as logging
import utils.file_utils as FileUtils
import utils.session_helper as SessionHelper


# UPLOADS THE FILE AND STORES IT ON SESSION,
# only called if IS_LOCAL_SERVER=False configuration setted
def upload(files: list[FileStorage], target: str) -> Response | dict[str, str]:
    if len(files) == 0:
        return common_error("No sent files")

    filenames = []
    upload_errors = []

    for file in files:
        try:
            # Validate filename first
            if not file.filename:
                upload_errors.append(f"File {len(filenames) + 1}: No filename provided")
                continue

            # Looks if same filename was previously uploaded
            if not FileUtils.file_exist(target, file.filename):
                destination = FileUtils.save_file(target, file)

                if not destination:
                    upload_errors.append(
                        f"File '{file.filename}': Upload failed - invalid destination"
                    )
                    continue

                if not FileUtils.is_valid_file(destination):
                    upload_errors.append(f"File '{file.filename}': File format not supported")
                    continue

                logging.info(f"Successfully uploaded: {destination}")
            else:
                destination = FileUtils.get_destination(target, file.filename)
                logging.info(f"Previously uploaded file found: {destination}")

            SessionHelper.add_uploaded_file_to_session(file.filename)
            filenames.append(file.filename)

        except Exception as e:
            logging.error(
                f"Error processing file '{file.filename if file.filename else 'unknown'}': {str(e)}"
            )
            upload_errors.append(
                f"File '{file.filename if file.filename else 'unknown'}': {str(e)}"
            )
            continue

    # Return results based on success/failure counts
    if len(filenames) == 0 and len(upload_errors) > 0:
        # All files failed
        return common_error(f"All uploads failed: {'; '.join(upload_errors)}")
    elif len(upload_errors) > 0:
        # Some files failed, some succeeded
        logging.warning(f"Partial upload success. Errors: {'; '.join(upload_errors)}")
        # Return successful filenames but log errors
        return jsonify({"filenames": filenames, "warnings": upload_errors})
    else:
        # All files succeeded
        return jsonify(filenames)


# Returns filename destination or a valid cache key, None if invalid
def get_destination(filename: str, target: str) -> str | None:
    if not filename:
        logging.error(f"No filename or cache key setted for filename {filename}")
        return None

    if (
        not SessionHelper.is_file_uploaded(filename)
        and not DsCache.contains(filename)
        and not FileUtils.file_exist(target, filename)
    ):
        logging.error(f"Filename not uploaded or not found in cache for filename {filename}")
        return None

    destination = FileUtils.get_destination(target, filename)
    if not FileUtils.is_valid_file(destination):
        if not DsCache.contains(filename):
            logging.error(f"Invalid file or not found in cache filename {filename}")
            return None
        else:
            destination = filename  # Filename represents only a joined dataset key, not a real file

    return destination


def get_dataset_schema(filename: str, target: str) -> Response | dict[str, str]:
    destination = get_destination(filename, target)
    if not destination:
        return common_error(f"Invalid file or cache key, filename: {filename}")

    schema = DaveEngine.get_dataset_schema(destination)
    return jsonify(schema)


def get_dataset_header(filename: str, target: str) -> Response | dict[str, str]:
    destination = get_destination(filename, target)
    if not destination:
        return common_error(f"Invalid file or cache key, filename: {filename}")

    header = DaveEngine.get_dataset_header(destination)
    return jsonify(header)


# append_file_to_dataset: Appends Fits data to a dataset
#
# @param: filename: filename or dataset cache key
# @param: nextfile: file to append
#
def append_file_to_dataset(filename: str, nextfile: str, target: str) -> Response | dict[str, str]:
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key")

    if not nextfile:
        return common_error("No nextfile setted")

    if not SessionHelper.is_file_uploaded(nextfile) and not FileUtils.file_exist(target, nextfile):
        logging.error(f"Filename not uploaded for nextfile {nextfile}")
        return common_error("Nextfile not uploaded")

    next_destination = FileUtils.get_destination(target, nextfile)
    if not FileUtils.is_valid_file(next_destination):
        return common_error("Invalid next file")

    logging.debug(f"append_file_to_dataset, destination: {destination}")
    logging.debug(f"append_file_to_dataset, next_destination: {next_destination}")

    new_filename = DaveEngine.append_file_to_dataset(destination, next_destination)

    logging.debug(f"append_file_to_dataset, cache_key: {new_filename}")

    return jsonify(new_filename)


# apply_rmf_file_to_dataset: Applies and Rmf file to an events dataset
#                            Creates a new column E with Enery data on dataset
# @param: filename: filename or dataset cache key
# @param: rmf_filename: rmf file to apply
# @param: column: column to use for the conversion: PHA, or PI for NuSTAR
#
def apply_rmf_file_to_dataset(
    filename: str, rmf_filename: str, column: str, target: str
) -> Response | dict[str, str]:
    destination = get_destination(filename, target)
    if not destination:
        return common_error("Invalid file or cache key")

    if not rmf_filename:
        return common_error("No rmf_filename setted")

    rmf_destination = FileUtils.get_destination(target, rmf_filename)
    if not FileUtils.is_valid_file(rmf_destination):
        return common_error("Invalid RMF file")

    result = DaveEngine.apply_rmf_file_to_dataset(destination, rmf_destination, column)
    return jsonify(result)


def common_error(error: str) -> Response:
    """Return a standardized error response"""
    logging.error(f"API Error: {error}")
    return jsonify(error=error), 400


def get_plot_data(
    src_filename: str,
    bck_filename: str,
    gti_filename: str,
    target: str,
    filters: dict,
    styles: dict,
    axis: list,
) -> Response | dict[str, str]:
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

    logging.debug(f"get_plot_data src: {src_filename}")
    logging.debug(f"get_plot_data bck: {bck_filename}")
    logging.debug(f"get_plot_data gti: {gti_filename}")
    logging.debug(f"get_plot_data: filters {filters}")
    logging.debug(f"get_plot_data: styles {styles}")
    logging.debug(f"get_plot_data: axis {axis}")

    data = DaveEngine.get_plot_data(
        src_destination, bck_destination, gti_destination, filters, styles, axis
    )

    logging.debug("get_plot_data: Finish!")

    return jsonify(data)


def get_lightcurve(
    src_filename: str,
    bck_filename: str,
    gti_filename: str,
    target: str,
    filters: dict,
    axis: list,
    dt: float,
    baseline_opts: dict,
    meanflux_opts: dict,
    variance_opts: dict,
) -> Response | dict[str, str]:
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

    logging.debug(f"get_lightcurve src: {src_filename}")
    logging.debug(f"get_lightcurve bck: {bck_filename}")
    logging.debug(f"get_lightcurve gti: {gti_filename}")
    logging.debug(f"get_lightcurve: filters {filters}")
    logging.debug(f"get_lightcurve: axis {axis}")
    logging.debug(f"get_lightcurve: dt {dt}")
    logging.debug(f"get_lightcurve: baseline_opts {baseline_opts}")
    logging.debug(f"get_lightcurve: meanflux_opts {meanflux_opts}")
    logging.debug(f"get_lightcurve: variance_opts {variance_opts}")

    data = DaveEngine.get_lightcurve(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        baseline_opts,
        meanflux_opts,
        variance_opts,
    )

    logging.debug("get_lightcurve: Finish!")

    return jsonify(data)


def get_joined_lightcurves(
    lc0_filename: str,
    lc1_filename: str,
    lc0_bck_filename: str,
    lc1_bck_filename: str,
    target: str,
    filters: dict,
    axis: list,
    dt: float,
) -> Response | dict[str, str]:
    lc0_destination = get_destination(lc0_filename, target)
    if not lc0_destination:
        return common_error("Invalid file or cache key for lc0 data")

    lc1_destination = get_destination(lc1_filename, target)
    if not lc1_destination:
        return common_error("Invalid file or cache key for lc1 data")

    lc0_bck_destination = ""
    if lc0_bck_filename:
        lc0_bck_destination = get_destination(lc0_bck_filename, target)
        if not lc0_bck_destination:
            return common_error("Invalid file or cache key for lc0_bck data")

    lc1_bck_destination = ""
    if lc1_bck_filename:
        lc1_bck_destination = get_destination(lc1_bck_filename, target)
        if not lc1_bck_destination:
            return common_error("Invalid file or cache key for lc1_bck data")

    logging.debug(f"get_joined_lightcurves lc0: {lc0_filename}")
    logging.debug(f"get_joined_lightcurves lc1: {lc1_filename}")
    logging.debug(f"get_joined_lightcurves lc0_bck: {lc0_bck_filename}")
    logging.debug(f"get_joined_lightcurves lc1_bck: {lc1_bck_filename}")
    logging.debug(f"get_joined_lightcurves: filters {filters}")
    logging.debug(f"get_joined_lightcurves: axis {axis}")
    logging.debug(f"get_joined_lightcurves: dt {dt}")

    data = DaveEngine.get_joined_lightcurves(
        lc0_destination,
        lc1_destination,
        lc0_bck_destination,
        lc1_bck_destination,
        filters,
        axis,
        dt,
    )

    logging.debug("get_joined_lightcurves: Finish!")

    return jsonify(data)


def get_divided_lightcurves_from_colors(
    src_filename: str,
    bck_filename: str,
    gti_filename: str,
    target: str,
    filters: dict,
    axis: list,
    dt: float,
) -> Response | dict[str, str]:
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

    logging.debug(f"get_divided_lightcurves_from_colors src: {src_filename}")
    logging.debug(f"get_divided_lightcurves_from_colors bck: {bck_filename}")
    logging.debug(f"get_divided_lightcurves_from_colors gti: {gti_filename}")
    logging.debug(f"get_divided_lightcurves_from_colors: filters {filters}")
    logging.debug(f"get_divided_lightcurves_from_colors: axis {axis}")
    logging.debug(f"get_divided_lightcurves_from_colors: dt {dt}")

    data = DaveEngine.get_divided_lightcurves_from_colors(
        src_destination, bck_destination, gti_destination, filters, axis, dt
    )

    logging.debug("get_divided_lightcurves_from_colors: Finish!")

    return jsonify(data)


def get_divided_lightcurve_ds(
    lc0_filename: str, lc1_filename: str, lc0_bck_filename: str, lc1_bck_filename: str, target: str
) -> Response | dict[str, str]:
    lc0_destination = get_destination(lc0_filename, target)
    if not lc0_destination:
        return common_error("Invalid file or cache key for lc0 data")

    lc1_destination = get_destination(lc1_filename, target)
    if not lc1_destination:
        return common_error("Invalid file or cache key for lc1 data")

    lc0_bck_destination = ""
    if lc0_bck_filename:
        lc0_bck_destination = get_destination(lc0_bck_filename, target)
        if not lc0_bck_destination:
            return common_error("Invalid file or cache key for lc0_bck data")

    lc1_bck_destination = ""
    if lc1_bck_filename:
        lc1_bck_destination = get_destination(lc1_bck_filename, target)
        if not lc1_bck_destination:
            return common_error("Invalid file or cache key for lc1_bck data")

    logging.debug(f"get_divided_lightcurve_ds lc0: {lc0_filename}")
    logging.debug(f"get_divided_lightcurve_ds lc1: {lc1_filename}")
    logging.debug(f"get_divided_lightcurve_ds lc0_bck: {lc0_bck_filename}")
    logging.debug(f"get_divided_lightcurve_ds lc1_bck: {lc1_bck_filename}")

    cache_key = DaveEngine.get_divided_lightcurve_ds(
        lc0_destination, lc1_destination, lc0_bck_destination, lc1_bck_destination
    )

    logging.debug(f"get_divided_lightcurve_ds: Finish! cache_key ->  {cache_key}")

    return jsonify(cache_key)


def get_power_density_spectrum(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    nsegm,
    segm_size,
    norm,
    pds_type,
    df,
):
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

    logging.debug(f"get_power_density_spectrum src: {src_filename}")
    logging.debug(f"get_power_density_spectrum bck: {bck_filename}")
    logging.debug(f"get_power_density_spectrum gti: {gti_filename}")
    logging.debug(f"get_power_density_spectrum: filters {filters}")
    logging.debug(f"get_power_density_spectrum: axis {axis}")
    logging.debug(f"get_power_density_spectrum: dt {dt}")
    logging.debug(f"get_power_density_spectrum: nsegm {nsegm:f}")
    logging.debug(f"get_power_density_spectrum: segm_size {segm_size:f}")
    logging.debug(f"get_power_density_spectrum: norm {norm}")
    logging.debug(f"get_power_density_spectrum: type {pds_type}")
    logging.debug(f"get_power_density_spectrum: df {df}")

    data = DaveEngine.get_power_density_spectrum(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        nsegm,
        segm_size,
        norm,
        pds_type,
        df,
    )

    logging.debug("get_power_density_spectrum: Finish!")

    return jsonify(data)


def get_dynamical_spectrum(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    nsegm,
    segm_size,
    norm,
    freq_range,
    df,
):
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

    logging.debug(f"get_dynamical_spectrum src: {src_filename}")
    logging.debug(f"get_dynamical_spectrum bck: {bck_filename}")
    logging.debug(f"get_dynamical_spectrum gti: {gti_filename}")
    logging.debug(f"get_dynamical_spectrum: filters {filters}")
    logging.debug(f"get_dynamical_spectrum: axis {axis}")
    logging.debug(f"get_dynamical_spectrum: dt {dt}")
    logging.debug(f"get_dynamical_spectrum: nsegm {nsegm:f}")
    logging.debug(f"get_dynamical_spectrum: segm_size {segm_size:f}")
    logging.debug(f"get_dynamical_spectrum: norm {norm}")
    logging.debug(f"get_dynamical_spectrum: freq_range {freq_range}")
    logging.debug(f"get_dynamical_spectrum: df {df}")

    data = DaveEngine.get_dynamical_spectrum(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        nsegm,
        segm_size,
        norm,
        freq_range,
        df,
    )

    logging.debug("get_dynamical_spectrum: Finish!")

    return jsonify(data)


def get_cross_spectrum(
    src_filename1,
    bck_filename1,
    gti_filename1,
    filters1,
    axis1,
    dt1,
    src_filename2,
    bck_filename2,
    gti_filename2,
    filters2,
    axis2,
    dt2,
    target,
    nsegm,
    segm_size,
    norm,
    xds_type,
):
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

    logging.debug(f"get_cross_spectrum src 1: {src_filename1}")
    logging.debug(f"get_cross_spectrum bck 1: {bck_filename1}")
    logging.debug(f"get_cross_spectrum gti 1: {gti_filename1}")
    logging.debug(f"get_cross_spectrum: filters 1 {filters1}")
    logging.debug(f"get_cross_spectrum: axis 1 {axis1}")
    logging.debug(f"get_cross_spectrum: dt 1 {dt1:f}")
    logging.debug(f"get_cross_spectrum src 2: {src_filename2}")
    logging.debug(f"get_cross_spectrum bck 2: {bck_filename2}")
    logging.debug(f"get_cross_spectrum gti 2: {gti_filename2}")
    logging.debug(f"get_cross_spectrum: filters 2 {filters2}")
    logging.debug(f"get_cross_spectrum: axis 2 {axis2}")
    logging.debug(f"get_cross_spectrum: dt 2 {dt2:f}")
    logging.debug(f"get_cross_spectrum: nsegm {nsegm:f}")
    logging.debug(f"get_cross_spectrum: segm_size {segm_size:f}")
    logging.debug(f"get_cross_spectrum: norm {norm}")
    logging.debug(f"get_cross_spectrum: type {xds_type}")

    data = DaveEngine.get_cross_spectrum(
        src_destination1,
        bck_destination1,
        gti_destination1,
        filters1,
        axis1,
        dt1,
        src_destination2,
        bck_destination2,
        gti_destination2,
        filters2,
        axis2,
        dt2,
        nsegm,
        segm_size,
        norm,
        xds_type,
    )

    logging.debug("get_cross_spectrum: Finish!")

    return jsonify(data)


def get_covariance_spectrum(
    src_filename,
    bck_filename,
    gti_filename,
    filters,
    target,
    dt,
    ref_band_interest,
    energy_range,
    n_bands,
    std,
):
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

    logging.debug(f"get_covariance_spectrum src: {src_filename}")
    logging.debug(f"get_covariance_spectrum bck: {bck_filename}")
    logging.debug(f"get_covariance_spectrum gti: {gti_filename}")
    logging.debug(f"get_covariance_spectrum: filters {filters}")
    logging.debug(f"get_covariance_spectrum dt: {dt}")
    logging.debug(f"get_covariance_spectrum ref_band_interest: {ref_band_interest}")
    logging.debug(f"get_covariance_spectrum: energy_range {energy_range}")
    logging.debug(f"get_covariance_spectrum n_bands: {n_bands}")
    logging.debug(f"get_covariance_spectrum std: {std}")

    data = DaveEngine.get_covariance_spectrum(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        dt,
        ref_band_interest,
        energy_range,
        n_bands,
        std,
    )

    logging.debug("get_covariance_spectrum: Finish!")

    return jsonify(data)


def get_phase_lag_spectrum(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    nsegm,
    segm_size,
    norm,
    pds_type,
    df,
    freq_range,
    energy_range,
    n_bands,
):
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

    logging.debug(f"get_phase_lag_spectrum src: {src_filename}")
    logging.debug(f"get_phase_lag_spectrum bck: {bck_filename}")
    logging.debug(f"get_phase_lag_spectrum gti: {gti_filename}")
    logging.debug(f"get_phase_lag_spectrum: filters {filters}")
    logging.debug(f"get_phase_lag_spectrum: axis {axis}")
    logging.debug(f"get_phase_lag_spectrum: dt {dt}")
    logging.debug(f"get_phase_lag_spectrum: nsegm {nsegm:f}")
    logging.debug(f"get_phase_lag_spectrum: segm_size {segm_size:f}")
    logging.debug(f"get_phase_lag_spectrum: norm {norm}")
    logging.debug(f"get_phase_lag_spectrum: type {pds_type}")
    logging.debug(f"get_phase_lag_spectrum: df {df}")
    logging.debug(f"get_phase_lag_spectrum: freq_range {freq_range}")
    logging.debug(f"get_phase_lag_spectrum: energy_range {energy_range}")
    logging.debug(f"get_phase_lag_spectrum: n_bands {n_bands}")

    data = DaveEngine.get_phase_lag_spectrum(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        nsegm,
        segm_size,
        norm,
        pds_type,
        df,
        freq_range,
        energy_range,
        n_bands,
    )

    logging.debug("get_phase_lag_spectrum: Finish!")

    return jsonify(data)


def get_rms_spectrum(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    nsegm,
    segm_size,
    norm,
    pds_type,
    df,
    freq_range,
    energy_range,
    n_bands,
    white_noise_offset,
):
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

    logging.debug(f"get_rms_spectrum src: {src_filename}")
    logging.debug(f"get_rms_spectrum bck: {bck_filename}")
    logging.debug(f"get_rms_spectrum gti: {gti_filename}")
    logging.debug(f"get_rms_spectrum: filters {filters}")
    logging.debug(f"get_rms_spectrum: axis {axis}")
    logging.debug(f"get_rms_spectrum: dt {dt}")
    logging.debug(f"get_rms_spectrum: nsegm {nsegm:f}")
    logging.debug(f"get_rms_spectrum: segm_size {segm_size:f}")
    logging.debug(f"get_rms_spectrum: norm {norm}")
    logging.debug(f"get_rms_spectrum: type {pds_type}")
    logging.debug(f"get_rms_spectrum: df {df}")
    logging.debug(f"get_rms_spectrum: freq_range {freq_range}")
    logging.debug(f"get_rms_spectrum: energy_range {energy_range}")
    logging.debug(f"get_rms_spectrum: n_bands {n_bands}")
    logging.debug(f"get_rms_spectrum: white_noise_offset {white_noise_offset}")

    data = DaveEngine.get_rms_spectrum(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        nsegm,
        segm_size,
        norm,
        pds_type,
        df,
        freq_range,
        energy_range,
        n_bands,
        white_noise_offset,
    )

    logging.debug("get_rms_spectrum: Finish!")

    return jsonify(data)


def get_rms_vs_countrate(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    nsegm,
    df,
    freq_range,
    energy_range,
    white_noise_offset,
):
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

    logging.debug(f"get_rms_vs_countrate src: {src_filename}")
    logging.debug(f"get_rms_vs_countrate bck: {bck_filename}")
    logging.debug(f"get_rms_vs_countrate gti: {gti_filename}")
    logging.debug(f"get_rms_vs_countrate: filters {filters}")
    logging.debug(f"get_rms_vs_countrate: axis {axis}")
    logging.debug(f"get_rms_vs_countrate: dt {dt}")
    logging.debug(f"get_rms_vs_countrate: nsegm {nsegm:f}")
    logging.debug(f"get_rms_vs_countrate: df {df}")
    logging.debug(f"get_rms_vs_countrate: freq_range {freq_range}")
    logging.debug(f"get_rms_vs_countrate: energy_range {energy_range}")
    logging.debug(f"get_rms_vs_countrate: white_noise_offset {white_noise_offset}")

    data = DaveEngine.get_rms_vs_countrate(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        nsegm,
        df,
        freq_range,
        energy_range,
        white_noise_offset,
    )

    logging.debug("get_rms_vs_countrate: Finish!")

    return jsonify(data)


def get_plot_data_from_models(models: list[dict], x_values: list[float]) -> Response:
    logging.debug(f"get_plot_data_from_models models: {models}")
    logging.debug(f"get_plot_data_from_models x_values: {str(len(x_values))}")

    data = DaveEngine.get_plot_data_from_models(models, x_values)

    logging.debug("get_plot_data_from_models: Finish!")

    return jsonify(data)


def get_fit_powerspectrum_result(
    src_filename: str,
    bck_filename: str,
    gti_filename: str,
    target: str,
    filters: dict,
    axis: list,
    dt: float,
    nsegm: int,
    segm_size: float,
    norm: str,
    pds_type: str,
    df: float,
    models: list[dict],
    priors: list[dict] | None = None,
    sampling_params: dict | None = None,
) -> Response | dict[str, str]:
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

    logging.debug(f"get_fit_powerspectrum_result src: {src_filename}")
    logging.debug(f"get_fit_powerspectrum_result bck: {bck_filename}")
    logging.debug(f"get_fit_powerspectrum_result gti: {gti_filename}")
    logging.debug(f"get_fit_powerspectrum_result: filters {filters}")
    logging.debug(f"get_fit_powerspectrum_result: axis {axis}")
    logging.debug(f"get_fit_powerspectrum_result: dt {dt}")
    logging.debug(f"get_fit_powerspectrum_result: nsegm {nsegm:f}")
    logging.debug(f"get_fit_powerspectrum_result: segm_size {segm_size:f}")
    logging.debug(f"get_fit_powerspectrum_result: norm {norm}")
    logging.debug(f"get_fit_powerspectrum_result: type {pds_type}")
    logging.debug(f"get_fit_powerspectrum_result: df {df}")
    logging.debug(f"get_fit_powerspectrum_result: models {models}")
    logging.debug(f"get_fit_powerspectrum_result: priors {priors}")
    logging.debug(f"get_fit_powerspectrum_result: sampling_params {sampling_params}")

    data = DaveEngine.get_fit_powerspectrum_result(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        nsegm,
        segm_size,
        norm,
        pds_type,
        df,
        models,
        priors,
        sampling_params,
    )

    logging.debug("get_fit_powerspectrum_result: Finish!")

    return jsonify(data)


def get_bootstrap_results(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    nsegm,
    segm_size,
    norm,
    pds_type,
    df,
    models,
    n_iter,
    mean,
    red_noise,
    seed,
):
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

    logging.debug(f"get_bootstrap_results src: {src_filename}")
    logging.debug(f"get_bootstrap_results bck: {bck_filename}")
    logging.debug(f"get_bootstrap_results gti: {gti_filename}")
    logging.debug(f"get_bootstrap_results: filters {filters}")
    logging.debug(f"get_bootstrap_results: axis {axis}")
    logging.debug(f"get_bootstrap_results: dt {dt}")
    logging.debug(f"get_bootstrap_results: nsegm {nsegm:f}")
    logging.debug(f"get_bootstrap_results: segm_size {segm_size:f}")
    logging.debug(f"get_bootstrap_results: norm {norm}")
    logging.debug(f"get_bootstrap_results: type {pds_type}")
    logging.debug(f"get_bootstrap_results: df {df}")
    logging.debug(f"get_bootstrap_results: models {models}")
    logging.debug(f"get_bootstrap_results: n_iter {n_iter}")
    logging.debug(f"get_bootstrap_results: mean {mean}")
    logging.debug(f"get_bootstrap_results: red_noise {red_noise}")
    logging.debug(f"get_bootstrap_results: seed {seed}")

    data = DaveEngine.get_bootstrap_results(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        nsegm,
        segm_size,
        norm,
        pds_type,
        df,
        models,
        n_iter,
        mean,
        red_noise,
        seed,
    )

    logging.debug("get_bootstrap_results: Finish!")

    return jsonify(data)


# Creates HENDRICS intermediate files from local absolute paths and stores them on target folder
def get_intermediate_files(filepaths, target):
    filenames = []

    for filepath in filepaths:
        if not FileUtils.is_valid_file(filepath):
            logging.error(f"Filepath not found or invalid: {filepath}")
        else:
            filename = DaveBulk.get_intermediate_file(filepath, target)
            logging.debug(f"get_intermediate_files filename: {filename}")
            if filename:
                filenames.append(filename)

    return jsonify(filenames)


def bulk_analisys(filenames, plot_configs, outdir, target):
    logging.debug(f"bulk_analisys filenames: {filenames}")
    logging.debug(f"bulk_analisys plot_configs: {plot_configs}")
    logging.debug(f"bulk_analisys outdir: {outdir}")

    absolute_outdir = "/".join([target, outdir])
    bulk_data = DaveBulk.bulk_analisys(filenames, plot_configs, absolute_outdir)
    logging.debug("bulk_analisys: Finish!")
    return jsonify(bulk_data)


def get_lomb_scargle_results(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    freq_range,
    nyquist_factor,
    ls_norm,
    samples_per_peak,
):
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

    logging.debug(f"get_lomb_scargle_results src: {src_filename}")
    logging.debug(f"get_lomb_scargle_results bck: {bck_filename}")
    logging.debug(f"get_lomb_scargle_results gti: {gti_filename}")
    logging.debug(f"get_lomb_scargle_results: filters {filters}")
    logging.debug(f"get_lomb_scargle_results: axis {axis}")
    logging.debug(f"get_lomb_scargle_results: dt {dt}")
    logging.debug(f"get_lomb_scargle_results: freq_range {freq_range}")
    logging.debug(f"get_lomb_scargle_results: nyquist_factor {nyquist_factor}")
    logging.debug(f"get_lomb_scargle_results: ls_norm {ls_norm}")
    logging.debug(f"get_lomb_scargle_results: samples_per_peak {samples_per_peak}")

    data = DaveEngine.get_lomb_scargle_results(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        freq_range,
        nyquist_factor,
        ls_norm,
        samples_per_peak,
    )

    logging.debug("get_lomb_scargle_results: Finish!")

    return jsonify(data)


def get_fit_lomb_scargle_result(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    freq_range,
    nyquist_factor,
    ls_norm,
    samples_per_peak,
    models,
    priors=None,
    sampling_params=None,
):
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

    logging.debug(f"get_fit_lomb_scargle_result src: {src_filename}")
    logging.debug(f"get_fit_lomb_scargle_result bck: {bck_filename}")
    logging.debug(f"get_fit_lomb_scargle_result gti: {gti_filename}")
    logging.debug(f"get_fit_lomb_scargle_result: filters {filters}")
    logging.debug(f"get_fit_lomb_scargle_result: axis {axis}")
    logging.debug(f"get_fit_lomb_scargle_result: dt {dt}")
    logging.debug(f"get_fit_lomb_scargle_result: freq_range {freq_range}")
    logging.debug(f"get_fit_lomb_scargle_result: nyquist_factor {nyquist_factor}")
    logging.debug(f"get_fit_lomb_scargle_result: ls_norm {ls_norm}")
    logging.debug(f"get_fit_lomb_scargle_result: samples_per_peak {samples_per_peak}")
    logging.debug(f"get_fit_lomb_scargle_result: models {models}")
    logging.debug(f"get_fit_lomb_scargle_result: priors {priors}")
    logging.debug(f"get_fit_lomb_scargle_result: sampling_params {sampling_params}")

    data = DaveEngine.get_fit_lomb_scargle_result(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        freq_range,
        nyquist_factor,
        ls_norm,
        samples_per_peak,
        models,
        priors,
        sampling_params,
    )

    logging.debug("get_fit_lomb_scargle_result: Finish!")

    return jsonify(data)


def get_pulse_search(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    freq_range,
    mode,
    oversampling,
    nharm,
    nbin,
    segment_size,
):
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

    logging.debug(f"get_pulse_search src: {src_filename}")
    logging.debug(f"get_pulse_search bck: {bck_filename}")
    logging.debug(f"get_pulse_search gti: {gti_filename}")
    logging.debug(f"get_pulse_search: filters {filters}")
    logging.debug(f"get_pulse_search: axis {axis}")
    logging.debug(f"get_pulse_search: dt {dt}")
    logging.debug(f"get_pulse_search: freq_range {freq_range}")
    logging.debug(f"get_pulse_search: mode {mode}")
    logging.debug(f"get_pulse_search: oversampling {oversampling}")
    logging.debug(f"get_pulse_search: nharm {nharm}")
    logging.debug(f"get_pulse_search: nbin {nbin}")
    logging.debug(f"get_pulse_search: segment_size {segment_size}")

    data = DaveEngine.get_pulse_search(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        freq_range,
        mode,
        oversampling,
        nharm,
        nbin,
        segment_size,
    )

    logging.debug("get_pulse_search: Finish!")

    return jsonify(data)


def get_phaseogram(
    src_filename,
    bck_filename,
    gti_filename,
    target,
    filters,
    axis,
    dt,
    f,
    nph,
    nt,
    fdot=0,
    fddot=0,
    binary_parameters=None,
):
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

    logging.debug(f"get_phaseogram src: {src_filename}")
    logging.debug(f"get_phaseogram bck: {bck_filename}")
    logging.debug(f"get_phaseogram gti: {gti_filename}")
    logging.debug(f"get_phaseogram: filters {filters}")
    logging.debug(f"get_phaseogram: axis {axis}")
    logging.debug(f"get_phaseogram: dt {dt}")
    logging.debug(f"get_phaseogram: f {f}")
    logging.debug(f"get_phaseogram: nph {nph}")
    logging.debug(f"get_phaseogram: nt {nt}")
    logging.debug(f"get_phaseogram: fdot {fdot}")
    logging.debug(f"get_phaseogram: fddot {fddot}")
    logging.debug(f"get_phaseogram: binary_parameters {binary_parameters}")

    data = DaveEngine.get_phaseogram(
        src_destination,
        bck_destination,
        gti_destination,
        filters,
        axis,
        dt,
        f,
        nph,
        nt,
        fdot,
        fddot,
        binary_parameters,
    )

    logging.debug("get_phaseogram: Finish!")

    return jsonify(data)
