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

    def clone (self):
        table = Table(self.id)

        for column_name in self.columns:
            table.columns[column_name] = self.columns[column_name].clone()

        return table

    def apply_filter(filter):
        filtered_table = Table(self.id)
        for column_name in self.columns:
            filtered_table.columns[column_name] = Column(column_name)

        column_name = filter["column"]
        if filtered_table.columns[column_name]:
            column = filtered_table.columns[column_name]
            for i in range(len(column.values)):
                  if (column.values[i] >= filter["from"]) and (column.values[i] <= filter["to"]):
                      filtered_table.add_row(self.get_row(i))

        return filtered_table

    def get_row (index):
        row = dict()
        for column_name in self.columns:
            row[column_name] = self.columns[column_name].values[index]
        return row

    def add_row (row):
        for column_name in row:
            self.columns[column_name].values.append(row[column_name])
