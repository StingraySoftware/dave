from model.column import Column

class Table:
    id = ""
    columns = dict()

    def __init__(self, id):
        self.id = id
        self.columns = dict()

    def add_columns(self, column_names ):
        for i in range(len(column_names)):
            self.columns[column_names[i]] = Column (column_names[i])

    def get_schema (self):
        schema = dict()
        for column_name in self.columns:
            schema[column_name] = self.columns[column_name].get_schema()
        return schema
