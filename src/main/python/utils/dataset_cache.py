

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
