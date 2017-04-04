from test.fixture import *

from hypothesis import given
from hypothesis.strategies import text
from astropy.io import fits

import utils.dave_reader as DaveReader
import utils.file_utils as FileUtils


@given(text())
def test_get_txt_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_1.txt")
    table_id = "EVENTS"
    header_names = ["TIME", "PHA", "Color1", "Color2"]
    dataset = DaveReader.get_txt_dataset(destination, table_id, header_names)
    num_rows = 10

    assert dataset
    assert len(dataset.tables) == 2
    assert table_id in dataset.tables

    table = dataset.tables[table_id]
    assert len(table.columns) == len(header_names)
    assert len(table.columns[header_names[0]].values) == num_rows


@given(text())
def test_get_fits_dataset_lc(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_2.lc")
    ds_id = "fits_table"
    table_ids = ["Primary", "RATE", "STDGTI"]
    hdulist = fits.open(destination)
    dataset = DaveReader.get_fits_dataset(hdulist, ds_id, table_ids)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
    assert len(dataset.tables[table_ids[1]].columns) == 4


@given(text())
def test_get_fits_table_column_names(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "test.evt")

    # Opening Fits
    hdulist = fits.open(destination)

    column_names = DaveReader.get_fits_table_column_names(hdulist, "EVENTS")
    assert len(column_names) == 2


@given(text())
def test_get_fits_dataset_evt(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "test.evt")
    ds_id = "fits_table"
    table_ids = ["Primary", "EVENTS", "GTI"]
    hdulist = fits.open(destination)
    dataset = DaveReader.get_fits_dataset(hdulist, ds_id, table_ids)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
    assert len(dataset.tables[table_ids[1]].columns) == 2


@given(text())
def test_get_events_fits_dataset_with_stingray(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "test.evt")
    ds_id = "fits_table"
    table_ids = ["Primary", "EVENTS", "GTI"]

    # Opening Fits
    hdulist = fits.open(destination)

    dataset = DaveReader.get_events_fits_dataset_with_stingray(destination, hdulist)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
    assert len(dataset.tables[table_ids[1]].columns) == 2


@given(text())
def test_get_lightcurve_fits_dataset_with_stingray(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "PN_source_lightcurve_raw.lc")

    # Opening Fits
    hdulist = fits.open(destination)

    dataset = DaveReader.get_lightcurve_fits_dataset_with_stingray(destination, hdulist, hduname='RATE',
                                                column='TIME', gtistring='GTI,STDGTI')
    assert dataset


@given(text())
def test_get_file_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_2.lc")
    ds_id = "fits_table"
    table_ids = ["Primary", "RATE", "STDGTI"]
    hdulist = fits.open(destination)
    dataset = DaveReader.get_fits_dataset(hdulist, ds_id, table_ids)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
