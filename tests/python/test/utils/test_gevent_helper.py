"""Tests for utils.gevent_helper.

gevent_helper implements the server-sent-events channel that streams DAVE
log messages to the GUI, plus the gevent WSGI server bootstrap. The pub/sub
tests drive real gevent greenlets with cooperative yields (gevent.sleep(0)),
never wall-clock sleeps.
"""

import gevent
import pytest

import utils.gevent_helper as GeHelper


@pytest.fixture(autouse=True)
def no_leftover_subscriptions():
    """The subscription list is module-global state: keep tests isolated."""
    del GeHelper.subscriptions[:]
    yield
    del GeHelper.subscriptions[:]


# ---------- ServerSentEvent ----------


def test_server_sent_event_encodes_data_in_sse_format():
    """A message encodes as a `data: <msg>` block terminated by a blank line."""
    event = GeHelper.ServerSentEvent("hello")
    assert event.encode() == "data: hello\n\n"


def test_server_sent_event_with_empty_data_encodes_to_empty_string():
    """Empty payloads produce no SSE frame at all."""
    assert GeHelper.ServerSentEvent("").encode() == ""


# ---------- subscribe / publish ----------


def test_publish_delivers_message_to_subscriber_and_returns_response_body():
    """A subscriber's generator yields the encoded frame after a publish, and
    publish returns the empty string the /publish route sends back."""
    response = GeHelper.subscribe()
    assert response.mimetype == "text/event-stream"

    generator = response.response
    received = []
    consumer = gevent.spawn(lambda: received.append(next(generator)))
    gevent.sleep(0)  # let the consumer register its queue
    assert len(GeHelper.subscriptions) == 1

    assert GeHelper.publish("msg1") == ""
    consumer.join(timeout=5)
    assert received == ["data: msg1\n\n"]

    generator.close()  # GeneratorExit must unsubscribe the queue
    assert GeHelper.subscriptions == []


def test_publish_reaches_every_subscriber():
    """All registered subscribers receive each published message."""
    generators = [GeHelper.subscribe().response for _ in range(2)]
    received = []
    consumers = [
        gevent.spawn(lambda gen=gen: received.append(next(gen))) for gen in generators
    ]
    gevent.sleep(0)
    assert len(GeHelper.subscriptions) == 2

    GeHelper.publish("broadcast")
    gevent.joinall(consumers, timeout=5)
    assert received == ["data: broadcast\n\n", "data: broadcast\n\n"]

    for generator in generators:
        generator.close()
    assert GeHelper.subscriptions == []


def test_subscribe_stream_consumed_from_the_main_greenlet():
    """The SSE generator can be driven from the main greenlet with the
    publisher spawned: the publisher only runs once the consumer blocks on
    the queue, so ordering is deterministic. (Also keeps the yield path in
    a greenlet coverage.py traces.)"""
    generator = GeHelper.subscribe().response
    publisher = gevent.spawn(GeHelper.publish, "from-main")
    frame = next(generator)
    assert frame == "data: from-main\n\n"
    publisher.join(timeout=5)
    generator.close()
    assert GeHelper.subscriptions == []


def test_publish_without_subscribers_is_a_safe_noop():
    """Publishing with nobody listening must not fail."""
    assert GeHelper.publish("into the void") == ""
    gevent.sleep(0)  # let the notify greenlet run to completion


# ---------- start ----------


class _StubWSGIServer:
    """Stands in for gevent's WSGIServer so start() can be driven without
    binding sockets; records construction args and close() calls."""

    serve_error: Exception | None = None
    instances: list = []

    def __init__(self, listener, app):
        self.listener = listener
        self.app = app
        self.closed = False
        _StubWSGIServer.instances.append(self)

    def serve_forever(self):
        raise type(self).serve_error

    def close(self):
        self.closed = True


@pytest.fixture
def stub_server(monkeypatch):
    _StubWSGIServer.instances = []
    monkeypatch.setattr(GeHelper, "WSGIServer", _StubWSGIServer)
    return _StubWSGIServer


def test_start_swallows_keyboard_interrupt_and_closes_server(stub_server):
    """Ctrl-C stops serve_forever: start() must exit cleanly and close."""
    stub_server.serve_error = KeyboardInterrupt
    GeHelper.start(5432, app="the-app")
    (server,) = stub_server.instances
    assert server.listener == ("", 5432)
    assert server.app == "the-app"
    assert server.closed is True


def test_start_reraises_unexpected_errors_but_still_closes(stub_server):
    """Unexpected server errors propagate, but cleanup must still run."""
    stub_server.serve_error = RuntimeError("bind failed")
    with pytest.raises(RuntimeError, match="bind failed"):
        GeHelper.start(5432, app="the-app")
    (server,) = stub_server.instances
    assert server.closed is True
