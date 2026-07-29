"""Behavioral tests for the model-layer paths the hypothesis suites miss:
header propagation, time filtering through GTIs, wrong-input guards,
column extras and the stingray-object conversion edge cases.
"""

import numpy as np
from astropy.io.fits import Header
from stingray.events import EventList
from stingray.lightcurve import Lightcurve

import model.dataset as DataSet
from model.column import Column
from model.table import Table


def _events_dataset():
    """EVENTS+GTI dataset with 5 events at 0.5..4.5 and one GTI [0, 5]."""
    dataset = DataSet.get_hdu_type_dataset("DS", ["TIME", "PHA"], "EVENTS")
    dataset.tables["EVENTS"].columns["TIME"].add_values([0.5, 1.5, 2.5, 3.5, 4.5], [0.0] * 5)
    dataset.tables["EVENTS"].columns["PHA"].add_values([1, 2, 3, 4, 5], [0.0] * 5)
    dataset.tables["GTI"].columns["START"].add_value(0.0)
    dataset.tables["GTI"].columns["STOP"].add_value(5.0)
    return dataset


# ---------- headers ----------


def test_dataset_get_header_returns_headers_per_table():
    """get_header exposes each table's header info under its table id."""
    dataset = DataSet.get_dataset("DS", "EVENTS", ["TIME"])
    dataset.tables["EVENTS"].set_header_info({"TSTART": "80000000"}, {"TSTART": "start"})
    header = dataset.get_header()
    assert header["EVENTS"] == {"TSTART": "80000000"}
    assert dataset.tables["EVENTS"].get_header() == {"TSTART": "80000000"}


# ---------- apply_filters / apply_time_filter ----------


def test_apply_filters_routes_time_filter_through_gtis():
    """A TIME filter on EVENTS is applied via the GTI machinery: only events
    inside [from, to] survive, and the additional columns are sliced along."""
    dataset = _events_dataset()
    filtered = dataset.apply_filters([{"table": "EVENTS", "column": "TIME", "from": 1.0, "to": 3.0}])

    times = filtered.tables["EVENTS"].columns["TIME"].values
    phas = filtered.tables["EVENTS"].columns["PHA"].values
    assert all(1.0 <= time <= 3.0 for time in times)
    assert len(times) == len(phas) > 0
    # The GTI table records the clamped interval that produced the slice.
    assert filtered.tables["GTI"].columns["START"].values == [1.0]
    assert filtered.tables["GTI"].columns["STOP"].values == [3.0]


def test_apply_time_filter_without_gti_table_returns_dataset_unchanged():
    """Datasets without a GTI table cannot be time filtered: same object back."""
    dataset = DataSet.get_dataset("DS", "EVENTS", ["TIME"])
    result = dataset.apply_time_filter({"from": 0, "to": 1}, "EVENTS")
    assert result is dataset


def test_apply_time_filter_with_empty_gtis_returns_dataset_unchanged():
    """Datasets whose GTI table has no rows are returned as-is."""
    dataset = DataSet.get_hdu_type_dataset("DS", ["TIME"], "EVENTS")
    result = dataset.apply_time_filter({"from": 0, "to": 1}, "EVENTS")
    assert result is dataset


def test_apply_filters_logs_and_skips_unknown_table():
    """A filter naming a table the dataset lacks is skipped without effect."""
    dataset = _events_dataset()
    filtered = dataset.apply_filters([{"table": "NOPE", "column": "PHA", "from": 0, "to": 9}])
    assert len(filtered.tables["EVENTS"].columns["PHA"].values) == 5


def test_apply_filters_with_empty_filter_list_returns_self():
    """No filters means no cloning: the very same dataset is returned."""
    dataset = _events_dataset()
    assert dataset.apply_filters([]) is dataset


# ---------- static constructors ----------


def test_get_dataset_creates_single_table_dataset():
    """get_dataset wires one table with the requested columns."""
    dataset = DataSet.get_dataset("DS", "TBL", ["A", "B"])
    assert set(dataset.tables) == {"TBL"}
    assert set(dataset.tables["TBL"].columns) == {"A", "B"}


def test_get_gti_dataset_from_stingray_gti():
    """A stingray GTI array becomes a GTI-only dataset with START/STOP."""
    dataset = DataSet.get_gti_dataset_from_stingray_gti(np.array([[0.0, 5.0], [7.0, 9.0]]))
    assert list(dataset.tables["GTI"].columns["START"].values) == [0.0, 7.0]
    assert list(dataset.tables["GTI"].columns["STOP"].values) == [5.0, 9.0]


# ---------- stingray conversions: header object and degenerate columns ----------


def test_lightcurve_dataset_accepts_header_object():
    """A Lightcurve carrying an astropy Header instance (not a string) is read."""
    lc = Lightcurve([0, 1], [2, 2])
    header = Header()
    header["BU"] = "BU"
    lc.header = header
    dataset = DataSet.get_lightcurve_dataset_from_stingray_Lightcurve(lc)
    assert dataset.tables["RATE"].header["BU"] == "BU"


def test_eventlist_dataset_accepts_header_object():
    """An EventList carrying an astropy Header instance is read the same way."""
    events = EventList(time=[0, 1], pi=[2, 2], gti=np.array([[-0.5, 1.5]]))
    header = Header()
    header["BU"] = "BU"
    events.header = header
    dataset = DataSet.get_eventlist_dataset_from_stingray_Eventlist(events)
    assert dataset.tables["EVENTS"].header["BU"] == "BU"


def test_eventlist_dataset_zeroes_mismatched_energies():
    """If energies do not line up with event times they are replaced by 0s."""
    events = EventList(time=[0, 1], pi=[2, 2], gti=np.array([[-0.5, 1.5]]))
    events.energy = np.array([3.0])  # deliberately wrong length
    dataset = DataSet.get_eventlist_dataset_from_stingray_Eventlist(events)
    assert list(dataset.tables["EVENTS"].columns["E"].values) == [0.0, 0.0]


def test_eventlist_dataset_zeroes_missing_pi():
    """An EventList without PI values gets an all-zero PI column."""
    events = EventList(time=[0, 1], gti=np.array([[-0.5, 1.5]]))
    dataset = DataSet.get_eventlist_dataset_from_stingray_Eventlist(events)
    assert list(dataset.tables["EVENTS"].columns["PI"].values) == [0.0, 0.0]


# ---------- table guards ----------


def test_table_apply_filter_with_unknown_column_returns_self():
    """Filtering on a column the table lacks returns the table unchanged."""
    table = Table("T")
    table.add_columns(["A"])
    assert table.apply_filter({"column": "MISSING", "from": 0, "to": 1}) is table


def test_table_apply_filter_with_inverted_range_returns_self():
    """A from > to filter range is refused and the table returned unchanged."""
    table = Table("T")
    table.add_columns(["A"])
    assert table.apply_filter({"column": "A", "from": 5, "to": 1}) is table


# ---------- column extras ----------


def test_column_schema_hidden_for_fake_columns():
    """Columns flagged FAKE_COLUMN are excluded from the schema entirely."""
    column = Column("PHA")
    column.set_extra("FAKE_COLUMN", True)
    assert column.get_schema() is None

    table = Table("T")
    table.columns["PHA"] = column
    assert "PHA" not in table.get_schema()


def test_column_extras_roundtrip_and_clear():
    """set/get/has extra round-trip; clear() wipes values and extras."""
    column = Column("C")
    assert column.has_extra("TSTART") is False
    assert column.get_extra("TSTART") is None
    column.set_extra("TSTART", 123.0)
    assert column.has_extra("TSTART") is True
    assert column.get_extra("TSTART") == 123.0

    column.add_value(1.0, 0.1)
    column.clear()
    assert column.values == [] and column.error_values == []
    assert column.has_error_values is False
    assert column.get_extra("TSTART") is None


def test_column_get_values_with_indexes_and_without_errors():
    """Index selection returns matching values; missing errors come back None."""
    column = Column("C")
    column.add_values([10.0, 20.0, 30.0])  # no error values
    values, errors = column.get_values(np.array([0, 2]))
    assert list(values) == [10.0, 30.0]
    assert errors is None


def test_column_get_value_out_of_range_returns_none():
    """Out-of-range indexes return None for values and errors alike."""
    column = Column("C")
    column.add_value(1.0, 0.5)
    assert column.get_value(5) is None
    assert column.get_error_value(5) is None
    # Without stored errors the error lookup reports 0 by convention.
    bare = Column("D")
    bare.add_values([1.0])
    assert bare.get_error_value(0) == 0
