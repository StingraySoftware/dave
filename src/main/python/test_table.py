from model.column import Column

import sys, os
myPath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, myPath + '/../')

from hypothesis import given
import hypothesis.strategies as st


@given(st.text())
def test_init(s):
    column = Column(s)
    assert column and column.id == s


@given(st.text(), st.integers())
def test_add_value(s, v):
    column = Column(s)
    column.add_value(v)
    assert len(column.values) == 1


@given(st.text(), st.integers())
def test_get_value(s, v):
    column = Column(s)
    column.add_value(v)
    assert column.get_value(0) == v


@given(st.text(), st.integers())
def test_get_shema(s, v):
    column = Column(s)
    column.add_value(v)
    schema = column.get_schema()
    assert "id" in schema and schema["id"] == s and "count" in schema and schema["count"] == 1 and "min_value" in schema and schema["min_value"] == v and "max_value" in schema and schema["max_value"] == v

@given(st.text(), st.integers())
def test_clone(s, v):
    column1 = Column(s)
    column1.add_value(v)
    schema1 = column1.get_schema()
    column2 = column1.clone()
    schema2 = column1.get_schema()
    assert schema1 == schema2
