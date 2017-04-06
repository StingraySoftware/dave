from flask import Flask, render_template, request, session

import pkg_resources
import sys
import os
import logging

import utils.dave_endpoint as DaveEndpoint
import utils.gevent_helper as GeHelper
import utils.dave_logger as Logger

logsdir = "."
if len(sys.argv) > 1 and sys.argv[1] != "":
    logsdir = sys.argv[1]

scriptdir = "."
if len(sys.argv) > 2 and sys.argv[2] != "":
    scriptdir = sys.argv[2]

server_port = 5000
if len(sys.argv) > 3 and sys.argv[3] != "":
    server_port = int(sys.argv[3])

logging.basicConfig(filename=logsdir + '/flaskserver.log', level=logging.DEBUG)

logging.info("Logs file is " + logsdir + "/flaskserver.log")
logging.info("Templates dir is " + scriptdir + "/../resources/templates")

app = Flask("dave_srv",
            template_folder=scriptdir + "/../resources/templates",
            static_folder=scriptdir + "/../resources/static")

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS_TARGET = os.path.join(APP_ROOT, 'uploadeddataset')

app.secret_key = os.urandom(24)


# Routes methods
@app.route('/upload', methods=['GET', 'POST'])
def upload():
    return DaveEndpoint.upload(request.files.getlist("file"), UPLOADS_TARGET)


@app.route('/get_dataset_schema', methods=['GET'])
def get_dataset_schema():
    return DaveEndpoint.get_dataset_schema(request.args['filename'], UPLOADS_TARGET)


@app.route('/append_file_to_dataset', methods=['GET'])
def append_file_to_dataset():
    return DaveEndpoint.append_file_to_dataset(request.args['filename'], request.args['nextfile'], UPLOADS_TARGET)


@app.route('/apply_rmf_file_to_dataset', methods=['GET'])
def apply_rmf_file_to_dataset():
    return DaveEndpoint.apply_rmf_file_to_dataset(request.args['filename'], request.args['rmf_filename'], UPLOADS_TARGET)


@app.route('/get_plot_data', methods=['POST'])
def get_plot_data():
    return DaveEndpoint.get_plot_data(request.json['filename'],
            request.json['bck_filename'], request.json['gti_filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['styles'], request.json['axis'])


@app.route('/get_histogram', methods=['POST'])
def get_histogram():
    return DaveEndpoint.get_histogram(request.json['filename'],
            request.json['bck_filename'], request.json['gti_filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['axis'])


@app.route('/get_lightcurve', methods=['POST'])
def get_lightcurve():
    return DaveEndpoint.get_lightcurve(request.json['filename'],
            request.json['bck_filename'], request.json['gti_filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['axis'], float(request.json['dt']))


@app.route('/get_joined_lightcurves', methods=['POST'])
def get_joined_lightcurves():
    return DaveEndpoint.get_joined_lightcurves(request.json['lc0_filename'],
            request.json['lc1_filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['axis'], float(request.json['dt']))


@app.route('/get_joined_lightcurves_from_colors', methods=['POST'])
def get_joined_lightcurves_from_colors():
    return DaveEndpoint.get_joined_lightcurves_from_colors(request.json['filename'],
            request.json['bck_filename'], request.json['gti_filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['axis'], float(request.json['dt']))


@app.route('/get_divided_lightcurve_ds', methods=['POST'])
def get_divided_lightcurve_ds():
    return DaveEndpoint.get_divided_lightcurve_ds(request.json['lc0_filename'],
            request.json['lc1_filename'], UPLOADS_TARGET)


@app.route('/get_lightcurve_ds_from_events_ds', methods=['POST'])
def get_lightcurve_ds_from_events_ds():
    return DaveEndpoint.get_lightcurve_ds_from_events_ds(request.json['filename'],
            UPLOADS_TARGET, request.json['axis'], float(request.json['dt']))


@app.route('/get_power_density_spectrum', methods=['POST'])
def get_power_density_spectrum():
    return DaveEndpoint.get_power_density_spectrum(request.json['filename'],
            request.json['bck_filename'], request.json['gti_filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['axis'], float(request.json['dt']),
            float(request.json['nsegm']), float(request.json['segment_size']), request.json['norm'],
            request.json['type'])


@app.route('/get_cross_spectrum', methods=['POST'])
def get_cross_spectrum():
    return DaveEndpoint.get_cross_spectrum(request.json['filename1'],
            request.json['bck_filename1'], request.json['gti_filename1'],
            request.json['filters1'], request.json['axis1'], float(request.json['dt1']),
            request.json['filename2'], request.json['bck_filename2'], request.json['gti_filename2'],
            request.json['filters2'], request.json['axis2'], float(request.json['dt2']),
            UPLOADS_TARGET, float(request.json['nsegm']), float(request.json['segment_size']),
            request.json['norm'], request.json['type'])


@app.route('/get_unfolded_spectrum', methods=['POST'])
def get_unfolded_spectrum():
    return DaveEndpoint.get_unfolded_spectrum(request.json['filename'],
            request.json['bck_filename'], request.json['gti_filename'], request.json['filters'],
            request.json['arf_filename'], UPLOADS_TARGET)


# Receives a message from client and send it to all subscribers
@app.route("/publish", methods=['POST'])
def publish():
    return GeHelper.publish(request.json['message'])


@app.route("/subscribe")
def subscribe():
    return GeHelper.subscribe()


@app.route('/')
def root():
    return render_template("master_page.html")


@app.route('/shutdown')
def shutdown():
    logging.info('Server shutting down...')
    shutdown_server()
    return 'Server shutting down...'


# Shutdown flask server
def shutdown_server():
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        logging.warn('Not running with the Werkzeug Server')
        exit()
    func()


# Setting error handler
def http_error_handler(error):
    return render_template("error.html", error=error), error


for error in (400, 401, 403, 404, 500):  # or with other http code you consider as error
    app.error_handler_spec[None][error] = http_error_handler

if __name__ == '__main__':
    GeHelper.start(server_port, app)
    app.run(debug=True, threaded=True)  # Use app.run(host='0.0.0.0') for listen on all interfaces
