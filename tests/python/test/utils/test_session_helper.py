"""Tests for utils.session_helper.

session_helper tracks which filenames were uploaded in the current Flask
session so endpoints can reject requests for files the client never sent.
"""

from flask import Flask, session

import utils.session_helper as SessionHelper


def _make_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = "test-secret-key"
    return app


def test_is_file_uploaded_false_on_fresh_session():
    """Without any upload the session has no filenames, so lookups are False."""
    app = _make_app()
    with app.test_request_context("/"):
        assert SessionHelper.is_file_uploaded("data.evt") is False


def test_add_uploaded_file_registers_filename_in_session():
    """After registering a filename it is reported as uploaded."""
    app = _make_app()
    with app.test_request_context("/"):
        SessionHelper.add_uploaded_file_to_session("data.evt")
        assert SessionHelper.is_file_uploaded("data.evt") is True
        assert session["uploaded_filenames"] == ["data.evt"]


def test_add_uploaded_file_is_idempotent():
    """Registering the same filename twice must not duplicate the entry."""
    app = _make_app()
    with app.test_request_context("/"):
        SessionHelper.add_uploaded_file_to_session("data.evt")
        SessionHelper.add_uploaded_file_to_session("data.evt")
        assert session["uploaded_filenames"] == ["data.evt"]


def test_uploaded_filenames_accumulate_distinct_files():
    """Distinct filenames all stay registered, unknown names stay unregistered."""
    app = _make_app()
    with app.test_request_context("/"):
        SessionHelper.add_uploaded_file_to_session("a.evt")
        SessionHelper.add_uploaded_file_to_session("b.lc")
        assert SessionHelper.is_file_uploaded("a.evt") is True
        assert SessionHelper.is_file_uploaded("b.lc") is True
        assert SessionHelper.is_file_uploaded("c.txt") is False
