# from: http://flask.pocoo.org/snippets/116/
#
# THIS FILE IS FOR SENDING EVENTS TO DAVE GUI LOGGER
#
# Make sure your gevent version is >= 1.0
import gevent
from gevent.wsgi import WSGIServer
from gevent.queue import Queue
from flask import Response

subscriptions = []


# SSE "protocol" is described here: http://mzl.la/UPFyxY
class ServerSentEvent(object):

    def __init__(self, data):
        self.data = data
        self.event = None
        self.id = None
        self.desc_map = {
            self.data: "data",
            self.event: "event",
            self.id: "id"
        }

    def encode(self):
        if not self.data:
            return ""
        lines = ["%s: %s" % (v, k)
                 for k, v in self.desc_map.items() if k]

        return "%s\n\n" % "\n".join(lines)


def start(server_port, app):
    server = WSGIServer(("", server_port), app)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        # Clean-up server (close socket, etc.)
        server.close()


def subscribe():
    def join():
        q = Queue()
        subscriptions.append(q)
        try:
            while True:
                result = q.get()
                ev = ServerSentEvent(str(result))
                yield ev.encode()
        except GeneratorExit:  # Or maybe use flask signals
            subscriptions.remove(q)

    return Response(join(), mimetype="text/event-stream")


def publish(message):
    def notify(message):
        for sub in subscriptions[:]:
            sub.put(message)

    gevent.spawn(notify(message))
