import numpy as np
import copy

class Column:
    id = ""
    values = []

    def __init__(self, id):
        self.id = id
        self.values = np.array([])

    def get_schema (self):
        schema = dict()
        schema["id"] = self.id
        schema["count"] = len(self.values)
        if (schema["count"] > 0):
            schema["min_value"] = min(self.values)
            schema["max_value"] = max(self.values)
        else:
            schema["min_value"] = 0
            schema["max_value"] = 0
        return schema

    def clone (self):
        column = Column(self.id)
        column.values = np.copy(self.values)
        return column

    def get_value (self, index):
        if index >= 0 and index < len(self.values):
            return copy.copy(self.values[index])
        else:
            return None

    def add_value (self, value):
        self.values = np.append(self.values, [ value ])
