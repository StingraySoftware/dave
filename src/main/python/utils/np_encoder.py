import json

import numpy
from config import CONFIG

import utils.dave_logger as logging
import utils.exception_helper as ExHelper


class NPEncoder(json.JSONEncoder):

    """Minify JSON output."""
    item_separator = ','
    key_separator = ':'

    def default(self, obj):
        try:
            if isinstance(obj, int):
                if obj > CONFIG.BIG_NUMBER:
                    return CONFIG.BIG_NUMBER
                if obj < -CONFIG.BIG_NUMBER:
                    return -CONFIG.BIG_NUMBER
                return int(obj)
            elif isinstance(obj, float):
                if obj > CONFIG.BIG_NUMBER:
                    return CONFIG.BIG_NUMBER
                if obj < -CONFIG.BIG_NUMBER:
                    return -CONFIG.BIG_NUMBER
                return float(obj)
            if isinstance(obj, numpy.int8 | numpy.int16 | numpy.int32 | numpy.int64):
                if obj > CONFIG.BIG_NUMBER:
                    return CONFIG.BIG_NUMBER
                if obj < -CONFIG.BIG_NUMBER:
                    return -CONFIG.BIG_NUMBER
                return int(obj)
            elif isinstance(obj, numpy.float16 | numpy.float32 | numpy.float64):
                if obj > CONFIG.BIG_NUMBER:
                    return CONFIG.BIG_NUMBER
                if obj < -CONFIG.BIG_NUMBER:
                    return -CONFIG.BIG_NUMBER
                return float(obj)
            elif isinstance(obj, complex):
                return self.default(numpy.real(obj))
            elif isinstance(obj, numpy.ndarray):
                return obj.tolist()
            else:
                return super().default(obj)
        except:
            logging.error(ExHelper.getException('NPEncoder'))
            return None
