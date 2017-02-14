import json
import numpy

BIG_NUMBER = 9999999999999

class NPEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, numpy.integer):
            return int(obj)
        elif isinstance(obj, numpy.floating):
            if obj > BIG_NUMBER:
                return BIG_NUMBER
            if obj < -BIG_NUMBER:
                return BIG_NUMBER
            return float(obj)
        elif isinstance(obj, numpy.ndarray):
            return obj.tolist()
        else:
            return super(NPEncoder, self).default(obj)
