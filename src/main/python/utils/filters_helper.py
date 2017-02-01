

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
