"""Tests for config.CONFIG.set_config and the package version metadata."""

import pytest
from __version__ import __version__, __version_info__

from config import CONFIG

_MANAGED_ATTRS = [
    "IS_LOCAL_SERVER",
    "LOG_TO_SERVER_ENABLED",
    "LOG_LEVEL",
    "MAX_PLOT_POINTS",
    "TIME_COLUMN",
    "EVENTS_STRING",
    "GTI_STRING",
    "FRACEXP_LIMIT",
    "PRECISION",
]


@pytest.fixture
def restore_config():
    """CONFIG is process-global class state: snapshot and restore around a test."""
    saved = {name: getattr(CONFIG, name) for name in _MANAGED_ATTRS}
    yield
    for name, value in saved.items():
        setattr(CONFIG, name, value)


def test_set_config_applies_every_field_with_type_coercion(restore_config):
    """set_config must set all runtime attributes, coercing numeric strings."""
    summary = CONFIG.set_config(
        {
            "IS_LOCAL_SERVER": False,
            "LOG_TO_SERVER_ENABLED": False,
            "LOG_LEVEL": "3",
            "MAX_PLOT_POINTS": "500",
            "TIME_COLUMN": "T",
            "EVENTS_STRING": "EVENTS",
            "GTI_STRING": "GTI",
            "FRACEXP_LIMIT": "0.7",
            "SERVER_DATA_PRECISION": "4",
        }
    )

    assert CONFIG.IS_LOCAL_SERVER is False
    assert CONFIG.LOG_TO_SERVER_ENABLED is False
    assert CONFIG.LOG_LEVEL == 3
    assert CONFIG.MAX_PLOT_POINTS == 500
    assert CONFIG.TIME_COLUMN == "T"
    assert CONFIG.EVENTS_STRING == "EVENTS"
    assert CONFIG.GTI_STRING == "GTI"
    assert CONFIG.FRACEXP_LIMIT == 0.7
    assert CONFIG.PRECISION == 4

    # The returned summary is what the GUI logs: it must reflect the new state.
    assert "IS_LOCAL_SERVER: False" in summary
    assert "LOG_LEVEL: 3" in summary
    assert "MAX_PLOT_POINTS: 500" in summary
    assert "PRECISION: 4" in summary
    assert "FRACEXP_LIMIT: 0.7" in summary


def test_version_metadata_is_consistent():
    """__version__ string and __version_info__ tuple must describe the same release."""
    assert __version__ == ".".join(str(part) for part in __version_info__)
    assert len(__version_info__) == 3
