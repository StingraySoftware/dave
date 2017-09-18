
import os
import magic
import utils.dave_logger as logging
import utils.exception_helper as ExHelper
from shutil import copyfile
from werkzeug import secure_filename
from config import CONFIG


def get_destination(target, filename):
    try:
        if CONFIG.IS_LOCAL_SERVER:
            if filename.startswith('/') and os.path.isfile(filename):
                # This is supposed to be an absolute path
                return filename
            else:
                # Relative path
                return "/".join([target, filename])
        else:
            return "/".join([target, secure_filename(filename)])
    except:
        logging.error(ExHelper.getException('get_destination'))
        return ""

def file_exist(target, filename):
    return os.path.isfile(get_destination(target, filename))

def is_valid_file(destination):
    try:
        if not destination or not os.path.isfile(destination):
            return False

        ext = magic.from_file(destination)

        base=os.path.basename(destination)
        file_extension = os.path.splitext(base)[1]

        return (ext.find("ASCII") == 0) \
                or (ext.find("FITS") == 0) \
                or (ext.find("gzip") > -1) \
                or ((ext == "data") and (file_extension in [".p", ".nc"]))
    except:
        return False

# save_file: Upload a data file to the Flask server path
#            Only called if not IS_LOCAL_SERVER
# @param: file: file to upload
# @param: target: folder name for upload destination
#
def save_file(target, file):

    logging.debug("save_file: %s - %s" % (type(file), file))

    if not os.path.isdir(target):
        os.mkdir(target)

    destination = get_destination(target, file.filename)
    file.save(destination)

    return destination


# get_intermediate_filename: Upload a data file to the Flask server path
#
# @param: filepath: file to upload
# @param: target: folder name for upload destination
#
def get_intermediate_filename(target, filepath, extension):

    if not os.path.isdir(target):
        os.mkdir(target)

    base=os.path.basename(filepath)
    filename = os.path.splitext(base)[0]
    destination = get_destination(target, filename + extension)

    if os.path.isfile(destination):
        os.remove(destination)

    return destination


def get_files_in_dir(dirpath):
    return [f for f in os.listdir(dirpath) if os.path.isfile(os.path.join(dirpath, f))]
