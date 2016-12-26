from model.table import Table

class DataSet:
    id = ""
    tables = dict()

    def __init__(self, id):
        self.id = id
        self.tables = dict()

    def add_table(self, table_id, column_names ):
        self.tables[table_id] = Table (table_id)
        self.tables[table_id].add_columns (column_names)

    def get_schema (self):
        schema = dict()
        for table_id in self.tables:
            schema[table_id] = self.tables[table_id].get_schema()
        return schema
