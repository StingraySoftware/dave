import logging
import utils.gevent_helper as GeHelper
from datetime import datetime

LOG_TO_SERVER_ENABLED = True

# LOGGING WRAPPED METHODS
def debug(obj):
    logging.debug(obj)
    log_to_server("DEBUG: " + str(obj))


def info(obj):
    logging.info(obj)
    log_to_server("INFO: " + str(obj))


def warn(obj):
    logging.warning(obj)
    log_to_server("WARN: " + str(obj))


def error(obj):
    logging.error(obj)
    log_to_server("ERROR: " + str(obj))


# User GeHelper to send msg to client
def log_to_server(msg):
    if LOG_TO_SERVER_ENABLED:
        GeHelper.publish(msg)
