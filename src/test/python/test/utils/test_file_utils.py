from test.fixture import *
import os

from hypothesis import given
from hypothesis.strategies import text
from hypothesis import example

import utils.file_utils as FileUtils


@given(text(min_size=1))
@example("Test_Input_1.txt")
@example("Test_Input_2.lc")
def test_is_valid_file(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, s)
    assert FileUtils.is_valid_file(destination) == os.path.isfile(destination)
