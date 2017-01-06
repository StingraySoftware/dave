import utils.dave_engine as DaveEngine
import utils.file_utils as FileUtils

import sys, os
myPath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, myPath + '/../')

from hypothesis import given
from hypothesis import example
from hypothesis.strategies import text

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS_TARGET = os.path.join(APP_ROOT, 'test_resources')


@given(text(min_size=1))
@example("Test_Input_1.txt")
@example("Test_Input_2.lc")
def test_get_dataset_schema(s):
    destination = FileUtils.get_destination(UPLOADS_TARGET, s)
    schema = None

    if destination:
        schema = DaveEngine.get_dataset_schema(destination)

    assert not os.path.isfile(destination) or schema != None
