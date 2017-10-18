# config.py
import json

class CONFIG:
    IS_LOCAL_SERVER = True  # If False consider that uploaded files are relatives and can have dangerous paths.
    DEBUG_MODE = True  # If True the server will run on Debug mode
    BIG_NUMBER = 9999999999999
    PRECISION = 6 # Precision of the data returned by the server
    LOG_TO_SERVER_ENABLED = True
    LOG_LEVEL = -1  # ALL = -1, DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, NONE = 4
    USE_JAVASCRIPT_CACHE = False  # If true, DAVE GUI will try to get js files from browser cache. Use False for development environments
    PYTHON_CACHE_SIZE = 32  # The maximun number of items to store in the LRU cache
    MAX_PLOT_POINTS = 1000  # The maximun number of elements to return in a JSON NDARRAY
    TIME_COLUMN='TIME'  # Represents the Time column name
    GTI_STRING='GTI,STDGTI,STDGTI04,SRC_GTIS,BKG_GTIS'  # Supported GTI HDU names
    FRACEXP_LIMIT=0.5  # Minimum exposure fraction allowed

    def set_config(config):

        CONFIG.IS_LOCAL_SERVER = config['IS_LOCAL_SERVER']
        CONFIG.LOG_TO_SERVER_ENABLED = config['LOG_TO_SERVER_ENABLED']
        CONFIG.LOG_LEVEL = int(config['LOG_LEVEL'])
        CONFIG.MAX_PLOT_POINTS = int(config['MAX_PLOT_POINTS'])
        CONFIG.TIME_COLUMN = config['TIME_COLUMN']
        CONFIG.GTI_STRING = config['GTI_STRING']
        CONFIG.FRACEXP_LIMIT = float(config['FRACEXP_LIMIT'])
        CONFIG.PRECISION = int(config['SERVER_DATA_PRECISION'])

        return "IS_LOCAL_SERVER: " + str(CONFIG.IS_LOCAL_SERVER) \
                + ", DEBUG_MODE: " + str(CONFIG.DEBUG_MODE) \
                + ", LOG_TO_SERVER_ENABLED: " + str(CONFIG.LOG_TO_SERVER_ENABLED) \
                + ", LOG_LEVEL: " + str(CONFIG.LOG_LEVEL) \
                + ", BIG_NUMBER: " + str(CONFIG.BIG_NUMBER) \
                + ", MAX_PLOT_POINTS: " + str(CONFIG.MAX_PLOT_POINTS) \
                + ", PRECISION: " + str(CONFIG.PRECISION) \
                + ", TIME_COLUMN: " + str(CONFIG.TIME_COLUMN) \
                + ", GTI_STRING: " + str(CONFIG.GTI_STRING) \
                + ", FRACEXP_LIMIT: " + str(CONFIG.FRACEXP_LIMIT) \
                + ", SERVER_DATA_PRECISION: " + str(CONFIG.SERVER_DATA_PRECISION) \
                + ", USE_JAVASCRIPT_CACHE: " + str(CONFIG.USE_JAVASCRIPT_CACHE)
