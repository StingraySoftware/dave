from test.fixture import *

from hypothesis import given
import hypothesis.strategies as st

from model.column import Column


@given(st.text())
def test_init(s):
    column = Column(s)
    assert column and column.id == s


@given(
    st.text(),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_add_value(s, v, e):
    column = Column(s)
    column.add_value(v, e)
    assert len(column.values) == 1


@given(
    st.text(),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_get_value(s, v, e):
    column = Column(s)
    column.add_value(v, e)
    assert column.get_value(0) == v


@given(
    st.text(),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_get_error_value(s, v, e):
    column = Column(s)
    column.add_value(v, e)
    assert column.get_error_value(0) == e


@given(
    st.text(),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_get_shema(s, v, e):
    column = Column(s)
    column.add_value(v, e)
    schema = column.get_schema()
    assert "id" in schema
    assert schema["id"] == s
    assert "count" in schema
    assert schema["count"] == 1
    assert "min_value" in schema
    assert schema["min_value"] == v
    assert "max_value" in schema
    assert schema["max_value"] == v
    assert "error_count" in schema
    assert schema["error_count"] == 1
    assert "error_min_value" in schema
    assert schema["error_min_value"] == e
    assert "error_max_value" in schema
    assert schema["error_max_value"] == e


@given(
    st.text(),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_clone(s, v, e):
    column1 = Column(s)
    column1.add_value(v, e)
    schema1 = column1.get_schema()
    column2 = column1.clone()
    schema2 = column2.get_schema()
    assert schema1 == schema2
