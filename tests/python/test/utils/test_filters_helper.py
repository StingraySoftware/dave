import hypothesis.strategies as st
from hypothesis import given

import utils.filters_helper as FltHelper


@given(
    st.text(min_size=1),
    st.text(min_size=1),
    st.floats(allow_nan=False, allow_infinity=False),
    st.floats(allow_nan=False, allow_infinity=False),
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
    time_filter = FltHelper.get_time_filter([filter1, filter2, filter3])
    assert time_filter
    assert time_filter["column"] == "TIME"


@given(st.text(min_size=1))
def test_get_color_keys_from_filters(s):
    filter1 = FltHelper.createFilter("EVENTS", "1", 0, 1)
    filter2 = FltHelper.createFilter("EVENTS", "2", 0, 1, "ColorSelector")
    filter3 = FltHelper.createFilter("EVENTS", "3", 0, 1, "ColorSelector")
    filter4 = FltHelper.createTimeFilter(0, 1)
    color_keys = FltHelper.get_color_keys_from_filters([filter1, filter2, filter3, filter4])
    assert color_keys
    assert len(color_keys) == 2


def test_get_rate_filter_finds_rate_column():
    """get_rate_filter returns the filter targeting the RATE column."""
    rate_filter = FltHelper.createFilter("RATE", "RATE", 10, 20)
    other_filter = FltHelper.createFilter("RATE", "TIME", 0, 1)
    assert FltHelper.get_rate_filter([other_filter, rate_filter]) is rate_filter
    assert FltHelper.get_rate_filter([other_filter]) is None


def test_apply_bin_size_snaps_time_filter_to_bin_edges():
    """The time filter is floored/ceiled to multiples of the bin size."""
    filters = [FltHelper.createTimeFilter(3.2, 9.1)]
    result = FltHelper.apply_bin_size_to_filters(filters, 2.0)
    assert result[0]["from"] == 2.0
    assert result[0]["to"] == 10.0


def test_apply_bin_size_leaves_degenerate_time_filter_alone():
    """A from >= to time filter is not snapped (nothing sensible to do)."""
    filters = [FltHelper.createTimeFilter(9.0, 3.0)]
    result = FltHelper.apply_bin_size_to_filters(filters, 2.0)
    assert result[0]["from"] == 9.0
    assert result[0]["to"] == 3.0


def test_apply_bin_size_without_time_filter_is_a_noop():
    """Filters without a TIME entry pass through unchanged."""
    filters = [FltHelper.createFilter("EVENTS", "PHA", 1, 5)]
    result = FltHelper.apply_bin_size_to_filters(filters, 2.0)
    assert result == [FltHelper.createFilter("EVENTS", "PHA", 1, 5)]


def test_get_filters_from_color_filters_renames_matching_color():
    """A color filter matching the requested key is renamed to replaceColumn;
    unmatched color filters are dropped; general filters are kept."""
    general = FltHelper.createTimeFilter(0, 10)
    color1 = FltHelper.createFilter("EVENTS", "Color1", 1, 5, "ColorSelector")
    color1["replaceColumn"] = "PHA"
    color2 = FltHelper.createFilter("EVENTS", "Color2", 6, 9, "ColorSelector")
    color2["replaceColumn"] = "PHA"

    result = FltHelper.get_filters_from_color_filters([general, color1, color2], "Color1")

    assert len(result) == 2
    assert result[0]["column"] == "TIME"
    assert result[1]["column"] == "PHA"
    assert result[1]["from"] == 1 and result[1]["to"] == 5
    # The original filter list must not be mutated by the renaming.
    assert color1["column"] == "Color1"


def test_get_filters_clean_color_filters_drops_all_sourced_filters():
    """Cleaning removes every filter that has a source, keeping the rest."""
    general = FltHelper.createTimeFilter(0, 10)
    color = FltHelper.createFilter("EVENTS", "Color1", 1, 5, "ColorSelector")
    result = FltHelper.get_filters_clean_color_filters([general, color])
    assert len(result) == 1
    assert result[0]["column"] == "TIME"
