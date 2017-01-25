from test.fixture import *

from hypothesis import given
from hypothesis.strategies import text

import utils.dave_reader as DaveReader
import utils.file_utils as FileUtils


@given(text())
def test_get_txt_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_1.txt")
    table_id = "txt_table"
    header_names = ["Time", "Rate", "color1", "color2"]
    dataset = DaveReader.get_txt_dataset(destination, table_id, header_names)
    num_rows = 10

    assert dataset
    assert len(dataset.tables) == 1
    assert table_id in dataset.tables

    table = dataset.tables[table_id]
    assert len(table.columns) == len(header_names)
    assert len(table.columns[header_names[0]].values) == num_rows


@given(text())
def test_get_fits_dataset_lc(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_2.lc")
    ds_id = "fits_table"
    table_ids = ["Primary", "RATE", "STDGTI"]
    dataset = DaveReader.get_fits_dataset(destination, ds_id, table_ids)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
    assert len(dataset.tables[table_ids[1]].columns) == 4


@given(text())
def test_get_fits_table_column_names(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "test.evt")
    column_names = DaveReader.get_fits_table_column_names(destination, "EVENTS")
    assert len(column_names) == 2


@given(text())
def test_get_fits_dataset_evt(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "test.evt")
    ds_id = "fits_table"
    table_ids = ["Primary", "EVENTS", "GTI"]
    dataset = DaveReader.get_fits_dataset(destination, ds_id, table_ids)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
    assert len(dataset.tables[table_ids[1]].columns) == 2


@given(text())
def test_get_fits_dataset_with_stingray(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "test.evt")
    ds_id = "fits_table"
    table_ids = ["Primary", "EVENTS", "GTI"]
    dataset = DaveReader.get_fits_dataset_with_stingray(destination)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
    assert len(dataset.tables[table_ids[1]].columns) == 2


@given(text())
def test_get_file_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_2.lc")
    ds_id = "fits_table"
    table_ids = ["Primary", "RATE", "STDGTI"]
    dataset = DaveReader.get_fits_dataset(destination, ds_id, table_ids)
    assert dataset
    assert len(dataset.tables) == 2
    assert table_ids[1] in dataset.tables
