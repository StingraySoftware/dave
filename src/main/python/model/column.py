import copy

class Column:
    id = ""
    values = []
    error_values = []
    has_error_values = False

    def __init__(self, id):
        self.id = id
        self.values = []
        self.error_values = []

    def get_schema(self):
        schema = dict()
        schema["id"] = self.id
        self.add_list_to_schema("", self.values, schema)
        self.add_list_to_schema("error_", self.error_values, schema)
        return schema

    def add_list_to_schema(self, list_prefix, list, schema):
        count = len(list)
        if (count > 0):
            schema[list_prefix + "count"] = count
            schema[list_prefix + "min_value"] = min(list)
            schema[list_prefix + "max_value"] = max(list)
            schema[list_prefix + "avg_value"] = float(sum(list)) / count
        else:
            schema[list_prefix + "count"] = 0
            schema[list_prefix + "min_value"] = 0
            schema[list_prefix + "max_value"] = 0
            schema[list_prefix + "avg_value"] = 0
        return schema

    def clone(self, with_values=True):
        column = Column(self.id)
        if with_values:
            column.values = copy.copy(self.values)
            column.error_values = copy.copy(self.error_values)
        return column

    def get_value(self, index):
        if index >= 0 and index < len(self.values):
            return copy.copy(self.values[index])
        else:
            return None

    def get_error_value(self, index):
        if self.has_error_values:
            if index >= 0 and index < len(self.error_values):
                return copy.copy(self.error_values[index])
            else:
                return None
        else:
            return 0

    def add_value(self, value, error=None):
        self.values.extend([value])
        self.has_error_values = not (error is None)
        if self.has_error_values:
            self.error_values.extend([error])

    def add_values(self, values, errors=None):
        self.values.extend(values)
        self.has_error_values = not (errors is None)
        if self.has_error_values:
            self.error_values.extend(errors)

    def clear(self):
        self.values = []
        self.error_values = []
        self.has_error_values = False;
