"""Helper to import server.py safely inside the test process.

server.py reads sys.argv at import time (logs dir, script dir, port, build
version) and forces the TkAgg matplotlib backend. Tests import it through
import_server(), which supplies a controlled argv (temp logs dir, the real
src/main/python script dir so templates/static resolve, port 0 and a fixed
build version) and neutralizes the backend switch, since CI is headless and
the suite standardizes on Agg.
"""

import os
import sys
import tempfile
from unittest import mock

import matplotlib

SRC_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "src", "main", "python")
)

TEST_BUILD_VERSION = "TESTBUILD"


def import_server():
    """Import (or return the already-imported) server module for testing."""
    if "server" in sys.modules:
        return sys.modules["server"]

    logs_dir = tempfile.mkdtemp(prefix="dave-test-logs-")
    saved_argv = sys.argv
    sys.argv = ["server.py", logs_dir, SRC_DIR, "0", TEST_BUILD_VERSION]
    try:
        with mock.patch.object(matplotlib, "use"):
            import server
    finally:
        sys.argv = saved_argv

    server.app.config["TESTING"] = True
    return server
