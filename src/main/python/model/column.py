import numpy as np
import copy

class Column:
    id = ""
    values = []
    error_values = []

    def __init__(self, id):
        self.id = id
        self.values = np.array([])
        self.error_values = np.array([])

    def get_schema (self):
        schema = dict()
        schema["id"] = self.id
        self.add_list_to_schema("", self.values, schema)
        self.add_list_to_schema("error_", self.error_values, schema)
        return schema

    def add_list_to_schema (self, list_prefix, list, schema):
        schema[list_prefix + "count"] = len(list)
        if (schema[list_prefix + "count"] > 0):
            schema[list_prefix + "min_value"] = min(list)
            schema[list_prefix + "max_value"] = max(list)
            schema[list_prefix + "avg_value"] = float(sum(list)) / schema[list_prefix + "count"]
        else:
            schema[list_prefix + "min_value"] = 0
            schema[list_prefix + "max_value"] = 0
            schema[list_prefix + "avg_value"] = 0
        return schema

    def clone (self):
        column = Column(self.id)
        column.values = np.copy(self.values)
        column.error_values = np.copy(self.error_values)
        return column

    def get_value (self, index):
        if index >= 0 and index < len(self.values):
            return copy.copy(self.values[index])
        else:
            return None

    def get_error_value (self, index):
        if index >= 0 and index < len(self.error_values):
            return copy.copy(self.error_values[index])
        else:
            return None

    def add_value (self, value, error):
        self.values = np.append(self.values, [ value ])
        self.error_values = np.append(self.error_values, [ error ])
