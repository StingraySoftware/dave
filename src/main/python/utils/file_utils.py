
import os
import logging
import magic
from werkzeug import secure_filename


def get_destination (target, filename):
    return "/".join([target, secure_filename(filename)])

def is_valid_file (destination):
    if not destination or not os.path.isfile(destination):
        return False

    print("destination: %s" % destination)
    ext = magic.from_file(destination)
    print("File extension: %s" % ext)
    return (ext.find("ASCII") == 0) or (ext.find("FITS") == 0)


# save_file: Upload a data file to the Flask server path
#
# @param: file: file to upload
# @param: target: folder name for upload destination
#
def save_file (file, target):

    logging.debug("file: %s - %s" % (type(file), file))

    if not os.path.isdir(target):
        os.mkdir(target)

    destination = get_destination(target, file.filename)
    file.save(destination)

    return destination
