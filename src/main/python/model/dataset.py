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

    def clone (self):
        dataset = Dataset(self.id)

        for table_id in self.tables:
            table = self.tables[table_id].clone()
            dataset.tables[table_id] = table

        return dataset

    def apply_filters(filters):

        if not filters or not len(filters):
            return self

        filtered_dataset = self.clone()

        for filter in filters:
            table_id = filter["table"]
            if filtered_dataset.tables[table_id]:
                filtered_dataset.tables[table_id] = filtered_dataset.tables[table_id].apply_filter(filter)

        return filtered_dataset
