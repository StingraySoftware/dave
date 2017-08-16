from test.fixture import *

from hypothesis import given
from hypothesis.strategies import text
from astropy.io import fits

import utils.dave_reader as DaveReader
from utils.dave_reader import save_to_intermediate_file, load_dataset_from_intermediate_file
import utils.file_utils as FileUtils
from stingray.events import EventList
from stingray import Lightcurve, Powerspectrum, AveragedCrossspectrum
from hendrics.io import HEN_FILE_EXTENSION
import numpy as np


class TestStingrayTypes():
    @classmethod
    def setup_class(cls):
        cls.dum = 'bubu' + HEN_FILE_EXTENSION

    def test_load_and_save_events(self):
        events = EventList([0, 2, 3.], pi=[1, 2, 3], mjdref=54385.3254923845,
                           gti = np.longdouble([[-0.5, 3.5]]))
        events.energy = np.array([3., 4., 5.])
        save_to_intermediate_file(events, self.dum)
        ds = load_dataset_from_intermediate_file(self.dum)
        assert ds

    def test_load_and_save_lcurve(self):
        lcurve = Lightcurve(np.linspace(0, 10, 15), np.random.poisson(30, 15),
                            mjdref=54385.3254923845,
                            gti = np.longdouble([[-0.5, 3.5]]))
        save_to_intermediate_file(lcurve, self.dum)
        ds = load_dataset_from_intermediate_file(self.dum)
        assert ds


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
