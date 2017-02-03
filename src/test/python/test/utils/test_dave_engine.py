from test.fixture import *

from hypothesis import given
from hypothesis import example
from hypothesis.strategies import text

import utils.dave_engine as DaveEngine
import utils.file_utils as FileUtils
import utils.dave_reader as DaveReader

@given(text(min_size=1))
@example("Test_Input_1.txt")
# @example("Test_Input_2.lc")
@example("test.evt")
def test_get_dataset_schema(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, s)
    schema = None

    if FileUtils.is_valid_file(destination):
        schema = DaveEngine.get_dataset_schema(destination)

    assert not os.path.isfile(destination) or schema is not None


@given(text(min_size=1))
@example("test.evt")
@example("test_Gtis.evt")
def test_get_ligthcurve(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, s)
    result = None

    axis = [dict() for i in range(2)]
    axis[0]["table"] = "EVENTS"
    axis[0]["column"] = "TIME"
    axis[1]["table"] = "EVENTS"
    axis[1]["column"] = "PI"

    if FileUtils.is_valid_file(destination):
        result = DaveEngine.get_ligthcurve(destination, "", [], axis, 16.)

    assert not os.path.isfile(destination) or result is not None
