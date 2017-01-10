from test.fixture import *

from hypothesis import given
from hypothesis.strategies import text

import utils.file_utils as FileUtils


@given(text())
def test_is_valid_file(s):
    assert FileUtils.is_valid_file(s) == (s.endswith(".txt") or s.endswith(".lc"))
