import math
import copy

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


# Returns the filter refered to TIME from a list of filters
def get_time_filter(filters):
    for filter in filters:
        if filter["column"] == "TIME":
            return filter

    return None


# Returns the filters applied to a passed bin size
def apply_bin_size_to_filters(filters, bin_size):

    time_filter = get_time_filter(filters)
    if time_filter:
        if time_filter["from"] < time_filter["to"]:
            time_filter["from"] = math.floor(time_filter["from"] / bin_size) * bin_size
            time_filter["to"] = math.ceil(time_filter["to"] / bin_size) * bin_size

    return filters


# Returns the filters removing all color filters
def get_filters_clean_color_filters(filters):
    return get_filters_from_color_filters(filters, "", "")


# Returns the filters removing unmatched color filters, and renaming color_column_name by column_name
def get_filters_from_color_filters(filters, color_column_name, column_name):
    ret_filters = []
    for filter in filters:
        if "source" not in filter:
            # This filter is general dataset filter, must be appended
            new_filter = copy.copy(filter)
            ret_filters.append(new_filter)
        elif filter["column"] == color_column_name:
            new_filter = copy.copy(filter)
            new_filter["column"] = column_name
            ret_filters.append(new_filter)

    return ret_filters
