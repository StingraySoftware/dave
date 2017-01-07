from test.fixture import *
from hypothesis import given
import hypothesis.strategies as st
from model.dataset import DataSet


@given(st.text(min_size=1))
def test_init(s):
    dataset = DataSet(s)
    assert dataset and dataset.id == s


@given(st.text(min_size=1), st.text(min_size=1), st.text(min_size=1))
def test_add_table(s, t, c):
    dataset = DataSet(s)
    dataset.add_table(t, [c])
    assert len(dataset.tables) == 1


@given(st.text(min_size=1), st.text(min_size=1), st.text(min_size=1), st.integers())
def test_get_shema(s, t, c, v):
    dataset = DataSet(s)
    dataset.add_table(t, [c])
    dataset.tables[t].columns[c].add_value(v)
    schema = dataset.get_schema()

    assert t in schema and schema[t] and c in schema[t] and schema[t][c]["id"] == c and "count" in schema[t][c] and schema[t][c]["count"] == 1


@given(st.text(min_size=1), st.text(min_size=1), st.text(min_size=1), st.integers())
def test_clone(s, t, c, v):
    dataset1 = DataSet(s)
    dataset1.add_table(t, [c])
    dataset1.tables[t].columns[c].add_value(v)
    schema1 = dataset1.get_schema()
    dataset2 = dataset1.clone()
    schema2 = dataset2.get_schema()
    assert schema1 == schema2


@given(st.text(min_size=1), st.text(min_size=1), st.text(min_size=1), st.lists(st.integers()), st.integers(), st.integers())
def test_apply_filters(s, t, c, list, min_value, max_value):
    dataset1 = DataSet(s)
    dataset1.add_table(t, [c])
    for v in list:
        dataset1.tables[t].columns[c].add_value(v)

    filter = dict()
    filter["table"] = t
    filter["column"] = c
    filter["from"] = min_value
    filter["to"] = max_value

    filtered_dataset = dataset1.apply_filters([filter, filter])
    schema = filtered_dataset.get_schema()

    table_and_column_in_schema = t in schema and schema[t] and c in schema[t]
    column_has_values_inside_range = (schema[t][c]["count"] > 0 and schema[t][c]["min_value"] >= min_value and schema[t][c]["max_value"] <= max_value)
    column_is_empty = schema[t][c]["count"] == 0
    wrong_filter_range = min_value > max_value

    assert table_and_column_in_schema and (column_has_values_inside_range or column_is_empty or wrong_filter_range)
