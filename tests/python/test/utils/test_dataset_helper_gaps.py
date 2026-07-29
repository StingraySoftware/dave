"""Tests for the utils.dataset_helper behaviors the original suite misses:
stingray conversions, GTI table algebra, dataset predicates, gap and split
detection, histogramming, time offsets and GTI-driven filtering.
"""

import numpy as np
import pytest

import model.dataset as DataSet
import utils.dataset_cache as DsCache
import utils.dataset_helper as DsHelper
import utils.dave_reader as DaveReader
from test.fixture import DATA_RESOURCES, TEST_RESOURCES


@pytest.fixture(autouse=True)
def clean_cache():
    DsCache.clear()
    yield
    DsCache.clear()


def _events_dataset(name="monol_testA.evt", base=DATA_RESOURCES):
    import os

    dataset, _ = DaveReader.get_file_dataset(os.path.join(base, name))
    return dataset


def _lc_dataset(name="Test_Input_2.lc"):
    return _events_dataset(name, TEST_RESOURCES)


# ---------- eventlist / lightcurve conversion ----------


def test_eventlist_uses_pi_when_pha_is_missing():
    """monol_testA.evt has PI but no PHA: the PI values back the fake PHA."""
    dataset = _events_dataset()
    assert "PHA" not in dataset.tables["EVENTS"].columns
    events = DsHelper.get_eventlist_from_evt_dataset(dataset)
    assert len(events.time) == 999
    assert list(events.pi[:3]) == list(dataset.tables["EVENTS"].columns["PI"].values[:3])
    # The synthesized PHA column is flagged so it never leaks into schemas.
    assert dataset.tables["EVENTS"].columns["PHA"].has_extra("FAKE_COLUMN")


def test_eventlist_falls_back_to_zero_pha_without_pi():
    """With neither PHA nor PI available the synthetic PHA column is all
    zeros (the PI-copy attempt fails and the zeros fallback kicks in)."""
    dataset = _events_dataset("test.evt", TEST_RESOURCES).clone()
    del dataset.tables["EVENTS"].columns["PHA"]
    if "PI" in dataset.tables["EVENTS"].columns:
        del dataset.tables["EVENTS"].columns["PI"]
    events = DsHelper.get_eventlist_from_evt_dataset(dataset)
    assert len(events.time) > 0
    assert not np.any(events.pi)


def test_eventlist_from_non_events_dataset_is_none():
    """A lightcurve dataset cannot be converted to an event list."""
    assert DsHelper.get_eventlist_from_evt_dataset(_lc_dataset()) is None


def test_lightcurve_from_lc_dataset_preserves_counts_and_errors():
    """The stingray Lightcurve mirrors the RATE column and its errors."""
    dataset = _lc_dataset()
    lightcurve = DsHelper.get_lightcurve_from_lc_dataset(dataset)
    rate = np.array(dataset.tables["RATE"].columns["RATE"].values)
    assert len(lightcurve.counts) == len(rate)
    assert lightcurve.counts[0] == rate[0]


def test_lightcurve_from_lc_dataset_accepts_gti_override():
    """An explicit GTI restricts the produced lightcurve."""
    dataset = _lc_dataset()
    times = np.array(dataset.tables["RATE"].columns["TIME"].values)
    gti = [[times[0] - 0.5, times[100] + 0.5]]
    lightcurve = DsHelper.get_lightcurve_from_lc_dataset(dataset, gti=gti)
    assert lightcurve.gti[0][0] == pytest.approx(gti[0][0])


def test_lightcurve_from_non_lc_dataset_is_none():
    """An events dataset cannot be converted to a lightcurve directly."""
    assert DsHelper.get_lightcurve_from_lc_dataset(_events_dataset()) is None


def test_lightcurve_from_lc_dataset_without_any_gtis():
    """With no override and an empty GTI table the Lightcurve is built
    without explicit GTIs (stingray derives a default one)."""
    dataset = _lc_dataset().clone()
    dataset.tables["GTI"] = DsHelper.get_empty_gti_table()
    lightcurve = DsHelper.get_lightcurve_from_lc_dataset(dataset)
    assert lightcurve is not None
    assert len(lightcurve.gti) == 1  # stingray's derived full-span GTI


# ---------- predicates ----------


def test_dataset_type_predicates():
    """Events/lightcurve/gti/rmf predicates recognize each dataset type."""
    events = _events_dataset()
    lightcurve = _lc_dataset()
    assert DsHelper.is_events_dataset(events) and not DsHelper.is_events_dataset(lightcurve)
    assert DsHelper.is_lightcurve_dataset(lightcurve) and not DsHelper.is_lightcurve_dataset(events)
    assert DsHelper.is_gti_dataset(events)  # has a GTI table with START
    assert not DsHelper.is_rmf_dataset(events)
    assert not DsHelper.is_events_dataset(None)


def test_is_rmf_dataset_recognizes_ebounds(rmf_file):
    """The synthetic EBOUNDS dataset is an RMF dataset."""
    dataset, _ = DaveReader.get_file_dataset(rmf_file)
    assert DsHelper.is_rmf_dataset(dataset)


def test_are_datasets_of_same_type():
    """Two events datasets match; an events and a lightcurve do not."""
    events_a = _events_dataset()
    events_b = _events_dataset("test.evt", TEST_RESOURCES)
    assert DsHelper.are_datasets_of_same_type(events_a, events_b) is True
    assert DsHelper.are_datasets_of_same_type(events_a, _lc_dataset()) is False


def test_get_hdutable_from_dataset_returns_none_for_other_types(rmf_file):
    """Datasets that are neither events nor lightcurve have no HDU table."""
    dataset, _ = DaveReader.get_file_dataset(rmf_file)
    assert DsHelper.get_hdutable_from_dataset(dataset) is None


# ---------- start time / bin size ----------


def test_get_dataset_start_time_prefers_tstart_extra():
    """The recorded TSTART keyword wins over the first event time."""
    assert DsHelper.get_dataset_start_time(_events_dataset()) == 80000000.0


def test_get_column_start_time_falls_back_to_first_value():
    """Without a TSTART extra the first value is the start time; an empty
    column has start time 0."""
    from model.column import Column

    column = Column("TIME")
    column.add_values([5.0, 6.0])
    assert DsHelper.get_column_start_time(column) == 5.0
    assert DsHelper.get_column_start_time(Column("TIME")) == 0


def test_get_dataset_start_time_for_wrong_dataset_is_zero(rmf_file):
    """Datasets without an HDU table report a start time of 0."""
    dataset, _ = DaveReader.get_file_dataset(rmf_file)
    assert DsHelper.get_dataset_start_time(dataset) == 0


def test_get_binsize_reads_timedel_and_frmtime():
    """TIMEDEL is used directly; FRMTIME is milliseconds; non-lightcurve
    datasets have no bin size."""
    dataset = _lc_dataset()
    assert DsHelper.get_binsize_from_lightcurve_ds(dataset) == 1.0

    frmtime_ds = dataset.clone()
    header = dict(frmtime_ds.tables["RATE"].header)
    del header["TIMEDEL"]
    header["FRMTIME"] = "250"
    frmtime_ds.tables["RATE"].set_header_info(header, {})
    assert DsHelper.get_binsize_from_lightcurve_ds(frmtime_ds) == 0.25

    assert not DsHelper.get_binsize_from_lightcurve_ds(_events_dataset())


# ---------- GTI table algebra ----------


def test_gti_table_stingray_roundtrip():
    """GTI table -> stingray array -> GTI table preserves the intervals."""
    table = DsHelper.get_gti_table(1.0, 9.0)
    st_gti = DsHelper.get_stingray_gti_from_gti_table(table)
    assert st_gti.tolist() == [[1.0, 9.0]]
    back = DsHelper.get_gti_table_from_stingray_gti(st_gti)
    assert back.columns["START"].values == [1.0]
    assert back.columns["STOP"].values == [9.0]


def test_join_gti_tables_merges_disjoint_intervals():
    """Two disjoint GTIs are both present after the join."""
    joined = DsHelper.join_gti_tables(
        DsHelper.get_gti_table(0.0, 10.0), DsHelper.get_gti_table(20.0, 30.0)
    )
    assert list(joined.columns["START"].values) == [0.0, 20.0]
    assert list(joined.columns["STOP"].values) == [10.0, 30.0]


def test_join_gti_tables_with_missing_side_returns_the_other():
    """A None side falls back to the other table untouched."""
    table = DsHelper.get_gti_table(0.0, 10.0)
    assert DsHelper.join_gti_tables(None, table) is table
    assert DsHelper.join_gti_tables(table, None) is table


def test_get_exposure_time_sums_gti_lengths():
    """Exposure is the summed length of all GTI intervals."""
    dataset = _events_dataset("test_Gtis.evt", TEST_RESOURCES)
    gti_table = dataset.tables["GTI"]
    lengths = np.array(gti_table.columns["STOP"].values) - np.array(
        gti_table.columns["START"].values
    )
    assert DsHelper.get_exposure_time(gti_table) == pytest.approx(lengths.sum())


# ---------- gaps / splitting / histogram ----------


def test_has_gti_gaps_detects_a_large_jump():
    """A jump hundreds of times the running cadence is a gap; a uniform
    series is not."""
    uniform = np.arange(0.0, 100.0, 1.0)
    assert DsHelper.hasGTIGaps(uniform) is False

    with_gap = np.concatenate([np.arange(0.0, 50.0, 1.0), np.arange(10000.0, 10050.0, 1.0)])
    assert DsHelper.hasGTIGaps(with_gap) is True


def test_get_splited_gti_produces_equal_segments():
    """A [0, 1000] GTI split by 250 yields four contiguous segments."""
    segments = DsHelper.get_splited_gti(np.array([0.0, 1000.0]), 250.0)
    assert segments.tolist() == [
        [0.0, 250.0],
        [250.0, 500.0],
        [500.0, 750.0],
        [750.0, 1000.0],
    ]


def test_get_splited_gti_refuses_oversized_interval():
    """A split interval longer than half the GTI is not splittable."""
    assert DsHelper.get_splited_gti(np.array([0.0, 100.0]), 80.0) is None


def test_get_histogram_bins_by_precision():
    """Values are binned to the requested precision with exact counts.

    Bin keys are computed as int(value / precision) * precision, so lookups
    use the same expression to stay bit-identical.
    """
    histogram, keys = DsHelper.get_histogram([1.01, 1.02, 1.19, 2.5], precision=0.1)
    assert histogram[int(1.01 / 0.1) * 0.1] == 2  # 1.01 and 1.02 share a bin
    assert histogram[int(1.19 / 0.1) * 0.1] == 1
    assert histogram[int(2.5 / 0.1) * 0.1] == 1
    assert list(keys) == sorted(histogram.keys())


def test_get_histogram_with_default_precision_counts_exact_values():
    """With precision 1.0 the raw values are the bin keys."""
    histogram, keys = DsHelper.get_histogram([3, 3, 4])
    assert histogram == {3: 2, 4: 1}


# ---------- columns helpers ----------


def test_get_additional_column_names_excludes_requested_column():
    """All columns except the pivot column are listed."""
    dataset = _events_dataset()
    names = DsHelper.get_additional_column_names(dataset.tables["EVENTS"].columns, "TIME")
    assert "TIME" not in names
    assert "PI" in names


def test_get_columns_as_dict_and_errors():
    """Column values and error values are exported keyed by column name."""
    dataset = _events_dataset()
    columns = dataset.tables["EVENTS"].columns
    values = DsHelper.get_columns_as_dict(columns, "TIME")
    errors = DsHelper.get_columns_errors_as_dict(columns, "TIME")
    assert set(values) == set(errors)
    assert "TIME" not in values
    assert len(values["PI"]) == 999


# ---------- find_idx_nearest_val ----------


@pytest.mark.parametrize(
    ("value", "expected_idx"),
    [
        (-5.0, 0),  # below the range clamps to the first element
        (100.0, 4),  # above the range clamps to the last element
        (2.0, 1),  # exact match
        (2.9, 2),  # nearest neighbour wins
        (2.4, 1),
    ],
)
def test_find_idx_nearest_val(value, expected_idx):
    """The nearest index is returned, clamped at both array ends."""
    array = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert DsHelper.find_idx_nearest_val(array, value) == expected_idx


# ---------- time offset ----------


def test_add_time_offset_shifts_events_and_gtis():
    """A nonzero offset shifts the TIME column and both GTI boundaries.

    The offset is a numpy scalar, as produced in append_file_to_dataset by
    subtracting two dataset start times (a plain float would not broadcast
    over the column's value list).
    """
    dataset = _events_dataset().clone()
    before_first = dataset.tables["EVENTS"].columns["TIME"].values[0]
    before_gti = dataset.tables["GTI"].columns["START"].values[0]

    DsHelper.add_time_offset_to_dataset(dataset, np.float64(100.0))

    assert dataset.tables["EVENTS"].columns["TIME"].values[0] == pytest.approx(
        before_first + 100.0
    )
    assert dataset.tables["GTI"].columns["START"].values[0] == pytest.approx(before_gti + 100.0)


def test_add_time_offset_zero_is_a_noop():
    """Offset 0 leaves the dataset untouched."""
    dataset = _events_dataset()
    first = dataset.tables["EVENTS"].columns["TIME"].values[0]
    DsHelper.add_time_offset_to_dataset(dataset, 0)
    assert dataset.tables["EVENTS"].columns["TIME"].values[0] == first


# ---------- GTI dataset application ----------


def test_apply_gti_dataset_restricts_events_to_absolute_window(gti_file_absolute):
    """An absolute-time GTI dataset [80000100, 80000600] is shifted by the
    events table TSTART (80000000) and keeps only events in [100, 600]."""
    source = _events_dataset()
    gti_dataset, _ = DaveReader.get_file_dataset(gti_file_absolute)

    filtered = DsHelper.get_dataset_applying_gti_dataset(source, gti_dataset)

    times = np.array(filtered.tables["EVENTS"].columns["TIME"].values)
    assert len(times) > 0
    assert times.min() >= 100.0
    assert times.max() <= 600.0
    # Sanity: roughly half of the 1025 s observation was cut away.
    assert len(times) < 700


def test_apply_gti_dataset_rejects_wrong_input_types(gti_file_absolute, rmf_file):
    """Both arguments are type checked before any filtering happens: the
    source must be an events dataset and the filter must carry a GTI table
    (an RMF dataset has none)."""
    source = _events_dataset()
    gti_dataset, _ = DaveReader.get_file_dataset(gti_file_absolute)
    rmf_dataset, _ = DaveReader.get_file_dataset(rmf_file)
    assert DsHelper.get_dataset_applying_gti_dataset(_lc_dataset(), gti_dataset) is None
    assert DsHelper.get_dataset_applying_gti_dataset(source, rmf_dataset) is None


def test_update_dataset_filtering_by_gti_clamps_partial_overlaps():
    """must_filter mode: GTIs partially overlapping the filter window are
    clamped to it, fully outside ones are dropped."""
    hdu_table = DataSet.get_hdu_type_dataset("DS", ["TIME"], "EVENTS").tables["EVENTS"]
    gti_table = DsHelper.get_empty_gti_table()
    ev_list = np.arange(0.0, 100.0, 1.0)

    DsHelper.update_dataset_filtering_by_gti(
        hdu_table,
        gti_table,
        ev_list,
        [],
        {},
        {},
        gti_start=[0.0, 40.0, 90.0],
        gti_end=[10.0, 60.0, 95.0],
        additional_columns=[],
        filter_start=45.0,
        filter_end=70.0,
        must_filter=True,
    )

    # Only the middle GTI overlaps [45, 70]; it is clamped to [45, 60].
    assert gti_table.columns["START"].values == [45.0]
    assert gti_table.columns["STOP"].values == [60.0]
    times = np.array(hdu_table.columns["TIME"].values)
    assert times.min() >= 45.0
    assert times.max() <= 60.0


def test_update_dataset_filtering_by_gti_skips_gtis_without_events():
    """A GTI falling between two events contributes no rows at all."""
    hdu_table = DataSet.get_hdu_type_dataset("DS", ["TIME"], "EVENTS").tables["EVENTS"]
    gti_table = DsHelper.get_empty_gti_table()
    ev_list = np.arange(0.0, 100.0, 1.0)

    DsHelper.update_dataset_filtering_by_gti(
        hdu_table,
        gti_table,
        ev_list,
        [],
        {},
        {},
        gti_start=[40.2],
        gti_end=[40.3],
        additional_columns=[],
    )

    assert gti_table.columns["START"].values == []
    assert hdu_table.columns["TIME"].values == []
