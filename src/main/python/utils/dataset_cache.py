import hashlib
import utils.exception_helper as ExHelper
from random import randint
from lru import LRU
from config import CONFIG

cached_datasets = LRU(CONFIG.PYTHON_CACHE_SIZE)

# DATASET CACHE METHODS
def add(key, dataset):
    try:
        cached_datasets[key] = dataset
    except:
        logging.error(ExHelper.getException('dataset_cache.add'))

def contains(key):
    try:
        return key in cached_datasets
    except:
        logging.error(ExHelper.getException('dataset_cache.contains'))
        return False

def get(key):
    try:
        if contains(key):
            return cached_datasets[key]
    except:
        logging.error(ExHelper.getException('dataset_cache.get'))

    return None


def remove(key):
    try:
        if contains(key):
            del cached_datasets[key]
            return True
    except:
        logging.error(ExHelper.getException('dataset_cache.remove'))

    return False


def remove_with_prefix(key_prefix):
    try:
        remove_keys = []
        for key in cached_datasets.keys():
            if key.startswith(key_prefix):
                remove_keys.append(key)
        for key in remove_keys:
            remove(key)
    except:
        logging.error(ExHelper.getException('dataset_cache.remove_with_prefix'))


def get_key(value, strict=False):
    try:
        m = hashlib.md5()
        if strict:
            m.update(str(value).encode('utf-8'))
        else:
            m.update(str(value + str(randint(0,99999))).encode('utf-8'))
        ugly_key = str(m.digest())
        return "".join(e for e in ugly_key if e.isalnum())
    except:
        logging.error(ExHelper.getException('dataset_cache.remove_with_prefix'))

    return ""

def count():
    return len(cached_datasets.items())
