from flask import Flask, render_template, request, session

import pkg_resources
import sys
import os
import logging

import utils.dave_endpoint as DaveEndpoint

logsdir = "."
if len(sys.argv) > 1 and sys.argv[1] != "":
    logsdir = os.path.dirname(sys.argv[1])

scriptdir = "."
if len(sys.argv) > 2 and sys.argv[2] != "":
    scriptdir = os.path.dirname(sys.argv[2])

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
    return DaveEndpoint.upload(request.files['file'], UPLOADS_TARGET)


@app.route('/get_dataset_schema', methods=['GET'])
def get_dataset_schema():
    return DaveEndpoint.get_dataset_schema(request.args['filename'], UPLOADS_TARGET)


@app.route('/get_plot_data', methods = ['POST'])
def get_plot_data():
    return DaveEndpoint.get_plot_data (request.json['filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['styles'], request.json['axis'])


@app.route('/get_ligthcurve', methods = ['POST'])
def get_ligthcurve():
    return DaveEndpoint.get_ligthcurve (request.json['filename'], UPLOADS_TARGET,
            request.json['filters'], request.json['axis'], request.json['dt'])


@app.route('/')
def root():
    logging.debug("Root page requested!")
    return render_template("master_page.html")


# Setting error handler
def http_error_handler(error):
    return render_template("error.html", error=error), error

for error in (400, 401, 403, 404, 500):  # or with other http code you consider as error
    app.error_handler_spec[None][error] = http_error_handler

if __name__ == '__main__':
    app.run(debug=True)  # Use app.run(host='0.0.0.0') for listen on all interfaces
