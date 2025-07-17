import os
import sys

import matplotlib

matplotlib.use("Agg")  # Use non-interactive backend for headless CI

myPath = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, myPath + "/../../../main/python")

print(f"Syspath: {sys.path}")

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
TEST_RESOURCES = os.path.join(APP_ROOT, "../resources/pytest")
