import numbers
from typing import Any

import numpy as np


class Column:
    id: str = ""
    values: list[float] = []
    error_values: list[float] = []
    has_error_values: bool = False
    extra: dict[str, Any] | None = None

    def __init__(self, id: str) -> None:
        self.id = id
        self.values = []
        self.error_values = []

    def get_schema(self) -> dict[str, Any] | None:
        if not self.has_extra("FAKE_COLUMN"):
            schema = dict()
            schema["id"] = self.id
            self.add_list_to_schema("", self.values, schema)
            #self.add_list_to_schema("error_", self.error_values, schema)
            return schema
        else:
            return None

    def add_list_to_schema(self, list_prefix: str, dlist: list, schema: dict) -> dict:
        count = len(dlist)
        if (count > 0 and isinstance(dlist[0], numbers.Number)):
            schema[list_prefix + "count"] = count
            schema[list_prefix + "min_value"] = min(dlist)
            schema[list_prefix + "max_value"] = max(dlist)
        else:
            schema[list_prefix + "count"] = 0
            schema[list_prefix + "min_value"] = 0
            schema[list_prefix + "max_value"] = 0
        return schema

    def clone(self, with_values: bool = True) -> 'Column':
        column = Column(self.id)
        if with_values:
            column.values = list(self.values)
            column.error_values = list(self.error_values)
        if self.extra:
            column.extra = dict(self.extra)
        return column

    def get_value(self, index: int) -> float | None:
        if index >= 0 and index < len(self.values):
            return self.values[index]
        else:
            return None

    def get_values(self, indexes: np.ndarray | None = None) -> tuple[list | np.ndarray, list | np.ndarray | None]:
        if indexes is None:
            return self.values, self.error_values
        else:
            values = np.array(self.values)[indexes]
            error_values = None
            if len(self.error_values):
                error_values = np.array(self.error_values)[indexes]
            return values, error_values

    def get_error_value(self, index: int) -> float | None:
        if self.has_error_values:
            if index >= 0 and index < len(self.error_values):
                return self.error_values[index]
            else:
                return None
        else:
            return 0

    def add_value(self, value: float, error: float | None = None) -> None:
        if error is None:
            self.add_values([value])
        else:
            self.add_values([value], [error])

    def add_values(self, values: list[float], errors: list[float] | None = None) -> None:
        self.values.extend(values)
        self.has_error_values = errors is not None
        if self.has_error_values:
            self.error_values.extend(errors)

    def set_extra(self, key: str, value: Any) -> None:
        if self.extra is None:
            self.extra = dict()
        self.extra[key] = value

    def get_extra(self, key: str) -> Any:
        if self.extra is not None and key in self.extra:
            return self.extra[key]
        else:
            return None

    def has_extra(self, key: str) -> bool:
        return self.extra is not None and key in self.extra

    def clear(self) -> None:
        self.values = []
        self.error_values = []
        self.has_error_values = False
        self.extra = None
