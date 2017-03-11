import hashlib
from random import randint

cached_datasets = dict()


# DATASET CACHE METHODS
def add(destination, dataset):
    cached_datasets[destination] = dataset


def contains(destination):
    if destination in cached_datasets:
        return True

    return False


def get(destination):
    if destination in cached_datasets:
        return cached_datasets[destination]

    return None


def remove(destination):
    if destination in cached_datasets:
        cached_datasets.pop(destination, None)
        return True

    return False


def get_key(value):
    m = hashlib.md5()
    m.update(str(value + str(randint(0,99999))).encode('utf-8'))
    ugly_key = str(m.digest())
    return "".join(e for e in ugly_key if e.isalnum())
