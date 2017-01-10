from test.fixture import *

from hypothesis import given
from hypothesis.strategies import text

import utils.dave_reader as DaveReader
import utils.file_utils as FileUtils


@given(text())
def test_get_txt_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_1.txt")
    table_id = "txt_table"
    header_names = ["Time", "Error_time", "Rate", "Error_rate", "color1", "Error_color1", "color2", "Error_color2"]
    dataset = DaveReader.get_txt_dataset(destination, table_id, header_names)
    num_rows = 10
    assert dataset
    assert len(dataset.tables) == 1
    assert table_id in dataset.tables
    assert len(dataset.tables[table_id].columns) == len(header_names)
    assert len(dataset.tables[table_id].columns[header_names[0]].values) == num_rows


@given(text())
def test_get_fits_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_2.lc")
    table_id = "lc_table"
    dataset = DaveReader.get_fits_dataset(destination, table_id)
    assert dataset
    assert len(dataset.tables) == 1
    assert table_id in dataset.tables
    assert len(dataset.tables[table_id].columns) == 4


@given(text())
def test_get_file_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_2.lc")
    table_id = "lc_table"
    dataset = DaveReader.get_file_dataset(destination)
    assert dataset
    assert len(dataset.tables) == 1
    assert table_id in dataset.tables
