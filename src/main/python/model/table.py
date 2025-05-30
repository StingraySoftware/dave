import numpy as np
import utils.dave_logger as logging

from model.column import Column


class Table:
    id: str = ""
    header: dict = dict()
    header_comments: dict = dict()
    columns: dict[str, Column] = dict()

    def __init__(self, id: str) -> None:
        self.id = id
        self.columns = dict()

    def add_columns(self, column_names: list[str]) -> None:
        for i in range(len(column_names)):
            self.columns[column_names[i]] = Column(column_names[i])

    def set_header_info(self, header: dict, header_comments: dict) -> None:
        self.header = header
        self.header_comments = header_comments

    def get_header(self) -> dict:
        return self.header

    def get_schema(self) -> dict:
        schema = dict()
        schema["HEADER"] = self.header
        schema["HEADER_COMMENTS"] = self.header_comments
        for column_name in self.columns:
            column_shema = self.columns[column_name].get_schema()
            if column_shema is not None:
                schema[column_name] = column_shema
        return schema

    def clone(self, with_values: bool = True) -> "Table":
        table = Table(self.id)
        table.header = self.header
        table.header_comments = self.header_comments
        for column_name in self.columns:
            table.columns[column_name] = self.columns[column_name].clone(with_values)
        return table

    def apply_filter(self, filter: dict) -> "Table":
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

        values = np.array(column.values)
        filtered_indexes = np.where((values >= filter["from"]) & (values <= filter["to"]))[0]

        for column_name in self.columns:
            col_values, col_error_values = self.columns[column_name].get_values(filtered_indexes)
            filtered_table.columns[column_name].add_values(col_values, col_error_values)

        return filtered_table

    def get_row(self, index: int) -> dict[str, dict[str, float]]:
        row = dict()
        for column_name in self.columns:
            column = self.columns[column_name]
            row[column_name] = dict()
            row[column_name]["value"] = column.get_value(index)
            row[column_name]["error_value"] = column.get_error_value(index)
        return row

    def add_row(self, row: dict[str, dict[str, float]]) -> None:
        for column_name in row:
            value = row[column_name]["value"]
            error = row[column_name]["error_value"]
            self.columns[column_name].add_value(value, error)

    def join(self, table: "Table") -> "Table":
        res_table = self.clone(True)
        for column_name in table.columns:
            col_values, col_error_values = table.columns[column_name].get_values()
            res_table.columns[column_name].add_values(col_values, col_error_values)
        return res_table
