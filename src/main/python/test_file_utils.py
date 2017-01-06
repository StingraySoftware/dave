import utils.file_utils as FileUtils

import sys, os
myPath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, myPath + '/../')

from hypothesis import given
from hypothesis.strategies import text


@given(text())
def test_is_valid_file(s):
    assert FileUtils.is_valid_file(s) == (s.endswith(".txt") or s.endswith(".lc"))
