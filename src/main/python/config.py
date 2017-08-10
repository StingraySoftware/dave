# config.py
import json

class CONFIG:
    IS_LOCAL_SERVER = True #If False consider that uploaded files are relatives and can have dangerous paths.
    BIG_NUMBER = 9999999999999
    PRECISSION = 4

    def set_config(config):
        
        CONFIG.IS_LOCAL_SERVER = config['IS_LOCAL_SERVER']

        return "IS_LOCAL_SERVER: " + str(CONFIG.IS_LOCAL_SERVER) \
                + ", BIG_NUMBER: " + str(CONFIG.BIG_NUMBER) \
                + ", PRECISSION: " + str(CONFIG.PRECISSION)
