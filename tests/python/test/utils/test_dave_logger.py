"""Tests for utils.dave_logger.

dave_logger wraps stdlib logging with a CONFIG.LOG_LEVEL gate and mirrors
messages to the GUI through gevent_helper.publish when
CONFIG.LOG_TO_SERVER_ENABLED is set.
"""

import pytest

import utils.dave_logger as DaveLogger
from config import CONFIG


@pytest.fixture
def published(monkeypatch):
    """Capture GUI-bound messages instead of pushing them to SSE subscribers."""
    messages = []
    monkeypatch.setattr(DaveLogger.GeHelper, "publish", messages.append)
    monkeypatch.setattr(CONFIG, "LOG_TO_SERVER_ENABLED", True)
    return messages


def test_all_levels_forward_with_prefix_when_level_allows(monkeypatch, published):
    """At LOG_LEVEL=-1 (ALL) every helper publishes with its level prefix."""
    monkeypatch.setattr(CONFIG, "LOG_LEVEL", -1)
    DaveLogger.debug("d")
    DaveLogger.info("i")
    DaveLogger.warn("w")
    DaveLogger.error("e")
    assert published == ["DEBUG: d", "INFO: i", "WARN: w", "ERROR: e"]


def test_log_level_gates_lower_severities(monkeypatch, published):
    """At LOG_LEVEL=2 (WARN) debug and info are suppressed, warn/error pass."""
    monkeypatch.setattr(CONFIG, "LOG_LEVEL", 2)
    DaveLogger.debug("d")
    DaveLogger.info("i")
    DaveLogger.warn("w")
    DaveLogger.error("e")
    assert published == ["WARN: w", "ERROR: e"]


def test_log_level_none_silences_everything(monkeypatch, published):
    """At LOG_LEVEL=4 (NONE) nothing is forwarded at all."""
    monkeypatch.setattr(CONFIG, "LOG_LEVEL", 4)
    DaveLogger.debug("d")
    DaveLogger.info("i")
    DaveLogger.warn("w")
    DaveLogger.error("e")
    assert published == []


def test_log_to_server_disabled_keeps_messages_local(monkeypatch, published):
    """With LOG_TO_SERVER_ENABLED=False messages never reach the publisher."""
    monkeypatch.setattr(CONFIG, "LOG_LEVEL", -1)
    monkeypatch.setattr(CONFIG, "LOG_TO_SERVER_ENABLED", False)
    DaveLogger.error("kept local")
    assert published == []
