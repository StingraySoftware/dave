print("Running fixture")

import sys, os
myPath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, myPath + '/../../../main/python')

print("Syspath: %s" % sys.path)

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
TEST_RESOURCES = os.path.join(APP_ROOT, '../../resources/pytest')
