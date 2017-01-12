from test.fixture import *
from hypothesis import given
import hypothesis.strategies as st
from model.dataset import DataSet


@given(st.text(min_size=1))
def test_init(s):
    dataset = DataSet(s)
    assert dataset
    assert dataset.id == s


@given(st.text(min_size=1), st.text(min_size=1), st.text(min_size=1))
def test_add_table(s, t, c):
    dataset = DataSet(s)
    dataset.add_table(t, [c])
    assert len(dataset.tables) == 1


@given(
    st.text(min_size=1),
    st.text(min_size=1),
    st.text(min_size=1),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_get_shema(s, t, c, v, e):
    dataset = DataSet(s)
    dataset.add_table(t, [c])
    dataset.tables[t].columns[c].add_value(v, e)
    schema = dataset.get_schema()

    assert t in schema
    assert schema[t]
    assert c in schema[t]
    assert schema[t][c]["id"] == c
    assert "count" in schema[t][c]
    assert schema[t][c]["count"] == 1


@given(
    st.text(min_size=1),
    st.text(min_size=1),
    st.text(min_size=1),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_clone(s, t, c, v, e):
    dataset1 = DataSet(s)
    dataset1.add_table(t, [c])
    dataset1.tables[t].columns[c].add_value(v, e)
    schema1 = dataset1.get_schema()
    dataset2 = dataset1.clone()
    schema2 = dataset2.get_schema()
    assert schema1 == schema2


@given(
    st.text(min_size=1),
    st.text(min_size=1),
    st.text(min_size=1),
    st.lists(st.integers()),
    st.integers(),
    st.integers()
)
def test_apply_filters(s, t, c, list, min_value, max_value):
    dataset1 = DataSet(s)
    dataset1.add_table(t, [c])
    for v in list:
        dataset1.tables[t].columns[c].add_value(v, v)

    filter = dict()
    filter["table"] = t
    filter["column"] = c
    filter["from"] = min_value
    filter["to"] = max_value

    filtered_dataset = dataset1.apply_filters([filter, filter])
    schema = filtered_dataset.get_schema()

    assert t in schema
    assert schema[t]
    assert c in schema[t]
    assert "count" in schema[t][c]

    filteredItemsCount = schema[t][c]["count"]
    if filteredItemsCount > 0 and min_value <= max_value:
        assert schema[t][c]["min_value"] >= min_value
        assert schema[t][c]["max_value"] <= max_value

    elif filteredItemsCount == 0:
        assert schema[t][c]["count"] == 0

    else:
        assert schema[t][c]["count"] == len(list)
