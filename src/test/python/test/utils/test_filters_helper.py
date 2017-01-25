from test.fixture import *
import os

from hypothesis import given
import hypothesis.strategies as st

import utils.filters_helper as FltHelper

@given(
    st.text(min_size=1),
    st.text(min_size=1),
    st.floats(allow_nan=False, allow_infinity=False),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_createFilter(tn, c, f, t):

    filter = FltHelper.createFilter(tn, c, f, t)
    assert len(filter) == 4
    assert filter["table"] == tn
    assert filter["column"] == c
    assert filter["from"] == f
    assert filter["to"] == t


@given(st.text(min_size=1))
def test_get_time_filter(s):

    filter1 = FltHelper.createFilter("EVENTS", "1", 0, 1)
    filter2 = FltHelper.createFilter("EVENTS", "2", 0, 1)
    filter3 = FltHelper.createTimeFilter(0, 1)
    time_filter = FltHelper.get_time_filter ([filter1, filter2, filter3])
    assert time_filter
    assert time_filter["column"] == "TIME"
