from test.fixture import *

print("Syspath: %s" % sys.path)

from hypothesis import given
import hypothesis.strategies as st

from model import table
from model.table import Table


@given(st.text(min_size=1))
def test_init(s):
    table = Table(s)
    assert table and table.id == s


@given(st.text(min_size=1), st.text(min_size=1))
def test_add_columns(s, c):
    table = Table(s)
    table.add_columns([c])
    assert len(table.columns) == 1


@given(st.text(min_size=1), st.text(min_size=1), st.integers())
def test_get_shema(s, c, v):
    table = Table(s)
    table.add_columns([c])
    table.columns[c].add_value(v)
    schema = table.get_schema()

    assert c in schema and schema[c]["id"] == c and "count" in schema[c] and schema[c]["count"] == 1


@given(st.text(min_size=1), st.text(min_size=1), st.integers())
def test_clone(s, c, v):
    table1 = Table(s)
    table1.add_columns([c])
    table1.columns[c].add_value(v)
    schema1 = table1.get_schema()
    table2 = table1.clone()
    schema2 = table2.get_schema()
    assert schema1 == schema2


@given(st.text(min_size=1), st.text(min_size=1), st.lists(st.integers()), st.integers(), st.integers())
def test_apply_filter(s, c, list, min_value, max_value):
    table = Table(s)
    table.add_columns([c])
    for v in list:
        table.columns[c].add_value(v)

    filter = dict()
    filter ["table"] = s
    filter ["column"] = c
    filter ["from"] = min_value
    filter ["to"] = max_value

    filtered_table = table.apply_filter( filter )
    schema = filtered_table.get_schema()

    column_in_schema = c in schema
    column_has_values_inside_range = (schema[c]["count"] > 0 and schema[c]["min_value"] >= min_value and schema[c]["max_value"] <= max_value)
    column_is_empty = (schema[c]["count"] == 0)
    wrong_filter_range = min_value > max_value

    assert column_in_schema and (column_has_values_inside_range or column_is_empty or wrong_filter_range)


@given(st.text(min_size=1), st.text(min_size=1), st.lists(st.integers()), st.integers())
def test_get_row(s, c, list, index):
    table = Table(s)
    table.add_columns([c])
    for v in list:
        table.columns[c].add_value(v)

    row = table.get_row(index)

    has_row = (index < len(table.columns[c].values) and row and (c in row) and len(row) == 1)
    empty_table = len(table.columns[c].values) == 0
    inValid_index = len(table.columns[c].values) <= index

    assert has_row or empty_table or inValid_index


@given(st.text(min_size=1), st.text(min_size=1), st.integers())
def test_add_row(s, c, v):
    table = Table(s)
    table.add_columns([c])

    row = dict()
    row[c] = v

    table.add_row(row)

    assert len(table.columns[c].values) == 1
