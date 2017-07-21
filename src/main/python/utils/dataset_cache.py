import hashlib
from random import randint
import utils.dave_logger as logging

cached_datasets = dict()
dataset_hits = dict()
LOG_CACHE_HITS = False

# DATASET CACHE METHODS
def add(key, dataset):
    cached_datasets[key] = dataset
    dataset_hits[key] = 1


def contains(key):
    if key in cached_datasets:
        return True

    return False


def get(key):

    if key in cached_datasets:
        dataset_hits[key] = dataset_hits[key] + 1
        if LOG_CACHE_HITS:
            logging.debug("DATASET CACHE: n(" + str(len(cached_datasets)) + ") HITS -> " + str(dataset_hits))
        return cached_datasets[key]

    return None


def remove(key):
    if key in cached_datasets:
        cached_datasets.pop(key, None)
        dataset_hits.pop(key, None)
        return True

    return False


def remove_with_prefix(key_prefix):
    remove_keys = []
    for key in cached_datasets:
        if key.startswith(key_prefix):
            remove_keys.append(key)
    for key in remove_keys:
        remove(key)


def get_key(value, strict=False):
    m = hashlib.md5()
    if strict:
        m.update(str(value).encode('utf-8'))
    else:
        m.update(str(value + str(randint(0,99999))).encode('utf-8'))
    ugly_key = str(m.digest())
    return "".join(e for e in ugly_key if e.isalnum())


def count():
    return len(cached_datasets)
