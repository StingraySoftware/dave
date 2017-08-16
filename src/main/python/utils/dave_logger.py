import logging
import utils.gevent_helper as GeHelper
from datetime import datetime
from config import CONFIG

# LOGGING WRAPPED METHODS
# ALL = -1, DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, NONE = 4

def debug(obj):
    if CONFIG.LOG_LEVEL <= 0:
        logging.debug(obj)
        log_to_server("DEBUG: " + str(obj))


def info(obj):
    if CONFIG.LOG_LEVEL <= 1:
        logging.info(obj)
        log_to_server("INFO: " + str(obj))


def warn(obj):
    if CONFIG.LOG_LEVEL <= 2:
        logging.warning(obj)
        log_to_server("WARN: " + str(obj))


def error(obj):
    if CONFIG.LOG_LEVEL <= 3:
        logging.error(obj)
        log_to_server("ERROR: " + str(obj))


# User GeHelper to send msg to client
def log_to_server(msg):
    if CONFIG.LOG_TO_SERVER_ENABLED:
        GeHelper.publish(msg)
