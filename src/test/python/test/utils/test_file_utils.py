import os

import utils.file_utils as FileUtils
from hypothesis import example, given
from hypothesis.strategies import text

from test.fixture import *


@given(text(min_size=1))
@example("Test_Input_1.txt")
@example("Test_Input_2.lc")
def test_is_valid_file(s):
    destination = FileUtils.get_destination(TEST_RESOURCES, s)
    try:
        assert FileUtils.is_valid_file(destination) == os.path.isfile(destination)
    except:
        assert not FileUtils.is_valid_file(destination)
