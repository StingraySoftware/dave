
import os
import utils.dave_logger as logging
import magic
from shutil import copyfile


def get_destination(target, filename):
    return "/".join([target, filename])

def file_exist(target, filename):
    return os.path.isfile(get_destination(target, filename))

def is_valid_file(destination):
    if not destination or not os.path.isfile(destination):
        return False

    ext = magic.from_file(destination)

    base=os.path.basename(destination)
    file_extension = os.path.splitext(base)[1]

    return (ext.find("ASCII") == 0) \
            or (ext.find("FITS") == 0) \
            or ((ext == "data") and (file_extension in [".p", ".nc"]))


# save_file: Upload a data file to the Flask server path
#
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

# copy_file: Upload a data file to the Flask server path
#
# @param: filepath: file to upload
# @param: target: folder name for upload destination
#
def copy_file(target, filepath):

    base = os.path.basename(filepath)

    logging.debug("copy_file: %s" % filepath)

    if not os.path.isdir(target):
        os.mkdir(target)

    destination = get_destination(target, base)

    if os.path.isfile(destination):
        os.remove(destination)

    copyfile(filepath, destination)

    return base


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
