import os

import hypothesis.strategies as st
import utils.dataset_helper as DsHelper
import utils.dave_reader as DaveReader
import utils.file_utils as FileUtils
from hypothesis import example, given

from test.fixture import *


@given(st.text(min_size=1))
@example("test.evt")
@example("test_Gtis.evt")
def test_get_eventlist_from_evt_dataset(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, s)

    if not FileUtils.is_valid_file(destination):
        return None

    dataset, cache_key = DaveReader.get_file_dataset(destination)

    if not dataset:
        return None

    eventList = DsHelper.get_eventlist_from_evt_dataset(dataset)

    assert not os.path.isfile(destination) or len(eventList.time) > 0
