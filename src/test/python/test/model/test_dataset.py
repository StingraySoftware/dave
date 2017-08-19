from test.fixture import *
from hypothesis import given
import hypothesis.strategies as st
from model.dataset import DataSet
from model.dataset import get_eventlist_dataset_from_stingray_Eventlist, \
    get_lightcurve_dataset_from_stingray_Lightcurve
import pytest
import numpy as np


@given(st.text(min_size=1))
def test_init(s):
    dataset = DataSet(s)
    assert dataset
    assert len(dataset.id) > len(s)


def test_get_lightcurve_dataset_from_stingray_Lightcurve(capsys):
    from stingray.lightcurve import Lightcurve
    from astropy.io.fits import Header
    lc = Lightcurve([0, 1], [2, 2])

    ds = get_lightcurve_dataset_from_stingray_Lightcurve(lc)
    out, err = capsys.readouterr()

    if err:
        assert err.strip().endswith("Light curve has no header")

    header = Header()
    header["Bu"] = "Bu"
    lc.header = header.tostring()

    ds = get_lightcurve_dataset_from_stingray_Lightcurve(lc)

    assert np.allclose(ds.tables["RATE"].columns["TIME"].values, lc.time)
    assert np.allclose(ds.tables["RATE"].columns["RATE"].values, lc.counts)


def test_get_eventlist_dataset_from_stingray_Eventlist(capsys):
    from stingray.events import EventList
    from astropy.io.fits import Header
    ev = EventList(time=[0, 1], pi=[2, 2], energy=[3., 4.],
                   gti=np.array([[-0.5, 1.5]]))

    ds = get_eventlist_dataset_from_stingray_Eventlist(ev)
    out, err = capsys.readouterr()

    print("Out:", out)
    print("Err:", err)
    if err:
        assert "Event list has no header" in err

    header = Header()
    header["Bu"] = "Bu"
    ev.header = header.tostring()

    ds = get_eventlist_dataset_from_stingray_Eventlist(ev)

    assert np.allclose(ds.tables["EVENTS"].columns["TIME"].values, ev.time)
    if "ENERGY" in ds.tables["EVENTS"].columns:
        assert np.allclose(ds.tables["EVENTS"].columns["ENERGY"].values, ev.energy)
    assert np.allclose(ds.tables["EVENTS"].columns["PI"].values, ev.pi)


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
def test_get_schema(s, t, c, v, e):
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


@given(
    st.text(min_size=1),
    st.text(min_size=1),
    st.text(min_size=1),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False),
    st.integers(),
    st.floats(allow_nan=False, allow_infinity=False)
)
def test_join(s, t, c, v0, e0, v1, e1):
    dataset1 = DataSet(s)
    dataset1.add_table(t, [c])
    dataset1.tables[t].columns[c].add_value(v0, e0)
    dataset2 = DataSet(s)
    dataset2.add_table(t, [c])
    dataset2.tables[t].columns[c].add_value(v1, e0)

    dataset1 = dataset1.join(dataset2)
    schema = dataset1.get_schema()

    assert t in schema
    assert schema[t]
    assert c in schema[t]
    assert "count" in schema[t][c]
    assert schema[t][c]["count"] == 2
