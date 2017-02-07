import math

def createFilter(table, column, from_val, to_val):
    filter = dict()
    filter["table"] = table
    filter["column"] = column
    filter["from"] = from_val
    filter["to"] = to_val
    return filter


# Creates a filter from-to in EVENTS.TIME axis
def createTimeFilter(from_val, to_val):
    return createFilter ("EVENTS", "TIME", from_val, to_val)


#Returns the filter refered to TIME from a list of filters
def get_time_filter(filters):
    for filter in filters:
        if filter["column"] == "TIME":
            return filter

    return None


#Returns the filters applied to a passed bin size
def apply_bin_size_to_filters(filters, bin_size):

    time_filter = get_time_filter(filters)
    if time_filter:
        if time_filter["from"] < time_filter["to"]:
            time_filter["from"] = math.floor(time_filter["from"] / bin_size) * bin_size
            time_filter["to"] = math.ceil(time_filter["to"] / bin_size) * bin_size

    return filters
