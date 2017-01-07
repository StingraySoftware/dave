from python.test_fixture import *

from hypothesis import given
from hypothesis import example
from hypothesis.strategies import text

import utils.dave_engine as DaveEngine
import utils.file_utils as FileUtils

@given(text(min_size=1))
@example("Test_Input_1.txt")
@example("Test_Input_2.lc")
def test_get_dataset_schema(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, s)
    schema = None

    if destination:
        schema = DaveEngine.get_dataset_schema(destination)

    assert not os.path.isfile(destination) or schema != None
