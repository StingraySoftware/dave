import base64
import hashlib
import io
import json
import numpy as np
import os
import sys


# Allow importing from main dir
sys.path.insert(0, '../../main/js/electron/')

TEST_ROOT = os.path.dirname(os.path.abspath(__file__)) + "/"

def md5(fname):
    with open(fname, "rb") as f:
        iterable = iter(lambda: f.read(4096), b"")
        md5checksum = md5_iterable(iterable)
    return md5checksum

def md5_iterable(iterable):
    hash_md5 = hashlib.md5()
    for chunk in iterable:
        hash_md5.update(chunk)
    return hash_md5.hexdigest()

def md5_from_string(line):
    hash_md5 = hashlib.md5()
    hash_md5.update(line)
    return hash_md5.hexdigest()

class NumpyEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, np.ndarray) and obj.ndim == 1:
            dictionary = {'__ndarray__' : obj.tolist()}
            return dictionary

        # Let the base class default method raise the TypeError
        try:
            return json.JSONEncoder.default(self, obj)
        except TypeError:
            raise TypeError("Failed to JSONify object of type %s" % type(obj))

def json_numpy_obj_hook(dct):
    """Decodes a previously encoded numpy ndarray with proper shape and dtype.

    :param dct: (dict) json encoded ndarray
    :return: (ndarray) if input was an encoded ndarray
    """
    if isinstance(dct, dict) and '__ndarray__' in dct:
        return np.array(dct[__ndarray__])
    return dct
