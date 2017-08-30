import hashlib
from random import randint
from lru import LRU
from config import CONFIG

cached_datasets = LRU(CONFIG.PYTHON_CACHE_SIZE)

# DATASET CACHE METHODS
def add(key, dataset):
    cached_datasets[key] = dataset


def contains(key):
    return key in cached_datasets


def get(key):
    if contains(key):
        return cached_datasets[key]

    return None


def remove(key):
    if contains(key):
        cached_datasets.pop(key, None)
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
