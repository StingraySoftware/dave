
class Column:
    id = ""
    values = []

    def __init__(self, id):
        self.id = id

    def get_schema (self):
        schema = dict()
        schema["id"] = self.id
        schema["min_value"] = min(self.values)
        schema["max_value"] = max(self.values)
        schema["count"] = len(self.values)
        return schema
