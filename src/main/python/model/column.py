import numpy as np

class Column:
    id = ""
    values = []

    def __init__(self, id):
        self.id = id
        self.values = np.array([])

    def get_schema (self):
        schema = dict()
        schema["id"] = self.id
        schema["min_value"] = min(self.values)
        schema["max_value"] = max(self.values)
        schema["count"] = len(self.values)
        return schema

    def clone (self):
        column = Column(self.id)
        column.values = np.copy(self.values)
        return column

    def get_value (self, index):
        return self.values[index].copy()

    def add_value (self, value):
        self.values = np.append(self.values, [ value ])
