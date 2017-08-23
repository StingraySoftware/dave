# config.py
import json

class CONFIG:
    IS_LOCAL_SERVER = True #If False consider that uploaded files are relatives and can have dangerous paths.
    DEBUG_MODE = True #If True the server will run on Debug mode
    BIG_NUMBER = 9999999999999
    PRECISSION = 4
    LOG_TO_SERVER_ENABLED = True
    LOG_LEVEL = -1 # ALL = -1, DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, NONE = 4
    USE_JAVASCRIPT_CACHE = False #If true, DAVE GUI will try to get js files from browser cache. Use False for development environments

    def set_config(config):

        CONFIG.IS_LOCAL_SERVER = config['IS_LOCAL_SERVER']
        CONFIG.LOG_TO_SERVER_ENABLED = config['LOG_TO_SERVER_ENABLED']
        CONFIG.LOG_LEVEL = int(config['LOG_LEVEL'])

        return "IS_LOCAL_SERVER: " + str(CONFIG.IS_LOCAL_SERVER) \
                + ", DEBUG_MODE: " + str(CONFIG.DEBUG_MODE) \
                + ", LOG_TO_SERVER_ENABLED: " + str(CONFIG.LOG_TO_SERVER_ENABLED) \
                + ", LOG_LEVEL: " + str(CONFIG.LOG_LEVEL) \
                + ", BIG_NUMBER: " + str(CONFIG.BIG_NUMBER) \
                + ", PRECISSION: " + str(CONFIG.PRECISSION) \
                + ", USE_JAVASCRIPT_CACHE: " + str(CONFIG.USE_JAVASCRIPT_CACHE)
