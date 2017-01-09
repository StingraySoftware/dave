from python.test_fixture import *

from model.table import Table
from hypothesis import given
import hypothesis.strategies as st


@given(st.text(min_size=1))
def test_init(s):
    table = Table(s)
    assert table
    assert table.id == s


@given(st.text(min_size=1), st.text(min_size=1))
def test_add_columns(s, c):
    table = Table(s)
    table.add_columns([c])
    assert len(table.columns) == 1


@given(st.text(min_size=1), st.text(min_size=1), st.integers(), st.floats(allow_nan=False, allow_infinity=False))
def test_get_shema(s, c, v, e):
    table = Table(s)
    table.add_columns([c])
    table.columns[c].add_value(v, e)
    schema = table.get_schema()

    assert c in schema
    assert schema[c]["id"] == c
    assert "count" in schema[c]
    assert schema[c]["count"] == 1


@given(st.text(min_size=1), st.text(min_size=1), st.integers(), st.floats(allow_nan=False, allow_infinity=False))
def test_clone(s, c, v, e):
    table1 = Table(s)
    table1.add_columns([c])
    table1.columns[c].add_value(v, e)
    schema1 = table1.get_schema()
    table2 = table1.clone()
    schema2 = table2.get_schema()
    assert schema1 == schema2


@given(st.text(min_size=1), st.text(min_size=1), st.lists(st.integers()), st.integers(), st.integers())
def test_apply_filter(s, c, list, min_value, max_value):
    table = Table(s)
    table.add_columns([c])
    for v in list:
        table.columns[c].add_value(v, v)

    filter = dict()
    filter ["table"] = s
    filter ["column"] = c
    filter ["from"] = min_value
    filter ["to"] = max_value

    filtered_table = table.apply_filter( filter )
    schema = filtered_table.get_schema()

    assert c in schema
    assert "count" in schema[c]

    filteredItemsCount = schema[c]["count"]
    if filteredItemsCount > 0 and min_value <= max_value:
        assert schema[c]["min_value"] >= min_value
        assert schema[c]["max_value"] <= max_value
    elif filteredItemsCount == 0:
        assert schema[c]["count"] == 0
    else:
        assert schema[c]["count"] == len(list)


@given(st.text(min_size=1), st.text(min_size=1), st.lists(st.integers()), st.integers())
def test_get_row(s, c, list, index):
    table = Table(s)
    table.add_columns([c])
    for v in list:
        table.columns[c].add_value(v, v)

    row = table.get_row(index)

    if index >= 0 and index < len(list):
        assert index < len(table.columns[c].values)
        assert row
        assert c in row
        assert len(row) == 1
    elif len(list) == 0:
        assert len(table.columns[c].values) == 0
    else:
        assert index >= len(table.columns[c].values) or index < 0


@given(st.text(min_size=1), st.text(min_size=1), st.integers(), st.floats(allow_nan=False, allow_infinity=False))
def test_add_row(s, c, v, e):
    table = Table(s)
    table.add_columns([c])

    row = dict()
    row[c] = dict()
    row[c]["value"] = v
    row[c]["error_value"] = v

    table.add_row(row)

    assert len(table.columns[c].values) == 1
