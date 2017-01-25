from model.column import Column
import logging


class Table:
    id = ""
    columns = dict()

    def __init__(self, id):
        self.id = id
        self.columns = dict()

    def add_columns(self, column_names):
        for i in range(len(column_names)):
            self.columns[column_names[i]] = Column(column_names[i])

    def get_schema(self):
        schema = dict()
        for column_name in self.columns:
            schema[column_name] = self.columns[column_name].get_schema()
        return schema

    def clone(self):
        table = Table(self.id)

        for column_name in self.columns:
            table.columns[column_name] = self.columns[column_name].clone()

        return table

    def apply_filter(self, filter):
        column_name = filter["column"]
        if column_name not in self.columns:
            logging.error("table.apply_filter wrong column: %s" % column_name)
            return self

        if filter["from"] > filter["to"]:
            logging.error("table.apply_filter wrong from-to: %s" % column_name)
            return self

        filtered_table = Table(self.id)
        for tmp_column_name in self.columns:
            filtered_table.columns[tmp_column_name] = Column(tmp_column_name)

        column = self.columns[column_name]
        for i in range(len(column.values)):
            value = column.values[i]
            if (value >= filter["from"]) and (value <= filter["to"]):
                filtered_table.add_row(self.get_row(i))

        return filtered_table

    def get_row(self, index):
        row = dict()
        for column_name in self.columns:
            column = self.columns[column_name]
            row[column_name] = dict()
            row[column_name]["value"] = column.get_value(index)
            row[column_name]["error_value"] = column.get_error_value(index)
        return row

    def add_row(self, row):
        for column_name in row:
            value = row[column_name]["value"]
            error = row[column_name]["error_value"]
            self.columns[column_name].add_value(value, error)

    def join (self, table):
        res_table = self.clone()
        any_column = table.columns[list(table.columns.keys())[0]]
        for i in range(len(any_column.values)):
            res_table.add_row(table.get_row(i))

        return res_table
