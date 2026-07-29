"""Tests for server.py — the Flask application wiring.

These tests exercise the real app object through Flask's test client:
infrastructure routes, security headers, error handling, config plumbing,
the SSE bridge and the shutdown protection. The analysis routes are covered
in test/utils/test_dave_endpoint.py.
"""

import os
import signal

import gevent
import numpy as np
import pytest
from security_config import SecurityConfig

import utils.dataset_cache as DsCache
import utils.gevent_helper as GeHelper
from config import CONFIG
from test.server_support import TEST_BUILD_VERSION, import_server

server = import_server()


@pytest.fixture
def client(monkeypatch, tmp_path):
    """Test client with the uploads target redirected to a temp directory so
    tests never write into the repository tree."""
    monkeypatch.setattr(server, "UPLOADS_TARGET", str(tmp_path / "uploadeddataset"))
    return server.app.test_client()


# ---------- infrastructure routes ----------


def test_health_reports_status_and_build_version(client):
    """/health returns the liveness payload with the argv build version."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "healthy", "version": TEST_BUILD_VERSION}


def test_ready_reports_dependencies_and_creates_uploads_dir(client, tmp_path):
    """/ready verifies scientific imports and ensures the uploads dir exists."""
    response = client.get("/ready")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ready"
    assert payload["stingray_available"] is True
    assert payload["hendrics_available"] is True
    assert payload["numpy_version"] == np.__version__
    assert os.path.isdir(tmp_path / "uploadeddataset")


def test_root_renders_master_page(client):
    """/ renders the DAVE master page template."""
    response = client.get("/")
    assert response.status_code == 200
    assert b"<title>DAVE</title>" in response.data


def test_security_headers_are_applied_to_every_response(client):
    """The after_request hook stamps all configured security headers."""
    response = client.get("/health")
    for header, value in SecurityConfig.SECURITY_HEADERS.items():
        assert response.headers[header] == value


def test_unknown_route_is_answered_by_the_error_handler(client):
    """404s flow through http_error_handler, which JSON-wraps the error.

    Note: the handler returns a bare jsonify() without a status code, so the
    client actually receives HTTP 200 with the error message in the body —
    that is the current contract with the GUI.
    """
    response = client.get("/definitely-not-a-route")
    assert response.status_code == 200
    assert "404 Not Found" in response.get_json()["error"]


def test_http_error_handler_outside_app_context_swallows_failure():
    """If jsonify itself fails (no app context) the handler returns None."""
    assert server.http_error_handler(ValueError("boom")) is None


# ---------- config / cache routes ----------


@pytest.fixture
def restore_config():
    attrs = [
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
    saved = {name: getattr(CONFIG, name) for name in attrs}
    yield
    for name, value in saved.items():
        setattr(CONFIG, name, value)


def test_set_config_route_applies_config_and_clears_cache(client, restore_config):
    """/set_config clears the dataset cache and applies the GUI settings."""
    DsCache.add("stale-key", "stale")
    response = client.post(
        "/set_config",
        json={
            "CONFIG": {
                "IS_LOCAL_SERVER": True,
                "LOG_TO_SERVER_ENABLED": False,
                "LOG_LEVEL": "2",
                "MAX_PLOT_POINTS": "800",
                "TIME_COLUMN": "TIME",
                "EVENTS_STRING": "EVENTS,XTE_SE,XTE_SA",
                "GTI_STRING": "GTI,STDGTI,STDGTI04,SRC_GTIS,BKG_GTIS",
                "FRACEXP_LIMIT": "0.5",
                "SERVER_DATA_PRECISION": "6",
            }
        },
    )
    assert response.status_code == 200
    assert b"MAX_PLOT_POINTS: 800" in response.data
    assert CONFIG.MAX_PLOT_POINTS == 800
    assert not DsCache.contains("stale-key")


def test_clear_cache_route_empties_dataset_cache(client):
    """/clear_cache drops every cached dataset."""
    DsCache.add("some-key", "value")
    response = client.post("/clear_cache")
    assert response.status_code == 200
    assert DsCache.count() == 0


def test_get_version_depends_on_javascript_cache_flag(monkeypatch):
    """With JS caching on, the build version is served; otherwise a random
    cache-busting number is generated per call."""
    monkeypatch.setattr(CONFIG, "USE_JAVASCRIPT_CACHE", True)
    assert server.get_version() == TEST_BUILD_VERSION

    monkeypatch.setattr(CONFIG, "USE_JAVASCRIPT_CACHE", False)
    version = server.get_version()
    assert version.isdigit()
    assert 0 <= int(version) <= CONFIG.BIG_NUMBER


# ---------- JSON provider ----------


def test_custom_json_provider_delegates_numpy_encoding():
    """The app's JSON provider serializes numpy objects via NPEncoder."""
    provider = server.CustomJSONProvider(server.app)
    assert provider.default(np.int64(5)) == 5
    assert provider.default(np.array([1.5, 2.5])) == [1.5, 2.5]


# ---------- SSE bridge ----------


def test_publish_route_returns_empty_body(client):
    """/publish acknowledges with an empty 200 (regression for the None
    return that used to make Flask reject the response)."""
    response = client.post("/publish", json={"message": "ping"})
    assert response.status_code == 200
    assert response.data == b""
    gevent.sleep(0)  # let the notify greenlet run with no subscribers


def test_subscribe_route_returns_the_event_stream_response(client, monkeypatch):
    """/subscribe hands back the SSE response built by gevent_helper.

    The endpoint is a one-line delegation; the live streaming behavior of
    that response (queue registration, frame encoding, unsubscribe on close)
    is covered against real greenlets in test/utils/test_gevent_helper.py.
    Flask's test client eagerly drains streamed responses, which would block
    the hub forever on the never-ending SSE generator.
    """
    sentinel = server.Response("stub-stream", mimetype="text/event-stream")
    monkeypatch.setattr(GeHelper, "subscribe", lambda: sentinel)
    response = client.get("/subscribe")
    assert response.mimetype == "text/event-stream"
    assert response.data == b"stub-stream"


# ---------- shutdown ----------


def test_shutdown_protected_rejects_bad_password(client):
    """With protection on (default) and no password configured, every
    shutdown attempt is unauthorized."""
    response = client.post("/shutdown", json={"password": "guess"})
    assert response.status_code == 401
    assert response.get_json()["error"] == "Unauthorized"


def test_shutdown_with_correct_password_stops_server(client, monkeypatch):
    """The configured password authorizes the shutdown path."""
    calls = []
    monkeypatch.setattr(SecurityConfig, "PROTECT_SHUTDOWN", True)
    monkeypatch.setattr(SecurityConfig, "SHUTDOWN_PASSWORD", "sesame")
    monkeypatch.setattr(server, "shutdown_server", lambda: calls.append("stopped"))
    response = client.post("/shutdown", json={"password": "sesame"})
    assert response.status_code == 200
    assert b"Server shutting down" in response.data
    assert calls == ["stopped"]


def test_shutdown_unprotected_stops_without_password(client, monkeypatch):
    """With protection disabled no password is required at all."""
    calls = []
    monkeypatch.setattr(SecurityConfig, "PROTECT_SHUTDOWN", False)
    monkeypatch.setattr(server, "shutdown_server", lambda: calls.append("stopped"))
    response = client.post("/shutdown")
    assert response.status_code == 200
    assert calls == ["stopped"]


def test_shutdown_server_sends_sigint_to_own_process(monkeypatch):
    """shutdown_server stops the process by signalling itself with SIGINT."""
    kills = []
    monkeypatch.setattr(os, "kill", lambda pid, sig: kills.append((pid, sig)))
    server.shutdown_server()
    assert kills == [(os.getpid(), signal.SIGINT)]
