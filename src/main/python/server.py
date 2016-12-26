from flask import Flask, jsonify, render_template, request, send_from_directory, session
from flask import Markup

import pkg_resources
import sys
import os
import uuid
import json
import logging

import utils.file_utils as FileUtils
import utils.dave_engine as DaveEngine

logging.basicConfig(filename='flaskserver.log', level=logging.DEBUG)

scriptdir = os.path.dirname(sys.argv[0])
if scriptdir == "":
    scriptdir = "."

logging.info("Templates dir is " + scriptdir + "/../resources/templates")

app = Flask("dave_srv", \
    template_folder=scriptdir + "/../resources/templates", \
    static_folder=scriptdir + "/../resources/static")


APP_ROOT = os.path.dirname(os.path.abspath(__file__))

app.secret_key=os.urandom(24)


@app.route('/upload', methods = ['GET', 'POST'])
def request_upload_file():

    target = os.path.join(APP_ROOT, 'uploadeddataset')

    f = request.files['file']
    if f.filename:

        #UPLOADS THE FILE AND STORES IT ON SESSION
        if not FileUtils.is_valid_file(f.filename):
            return render_template("error.html", error="Files uploaded are not supported...")

        destination = FileUtils.save_file (f, target)

        if not destination:
            return render_template("error.html", error="Error uploading file...")

        logging.debug("Uploaded filename: %s" % destination)
        session['uploaded_filename'] = f.filename


    if 'uploaded_filename' in session:
        filename = session['uploaded_filename']
    else:
        return render_template("master_page.html");


    start_time = request.form['from_time']
    end_time = request.form['to_time']
    start_count = request.form['from_count']
    end_count = request.form['to_count']

    start_color1 = request.form['from_color1']
    end_color1 = request.form['to_color1']
    start_color2 = request.form['from_color2']
    end_color2 = request.form['to_color2']

    destination = FileUtils.get_destination(target, filename)

    fig = DaveEngine.get_plotdivs(destination,
        start_time, end_time,
        start_count, end_count,
        start_color1, end_color1,
        start_color2, end_color2)

    return render_template('master_page.html',
        div_placeholder_fig1 = Markup(fig["plot1"]),
        div_placeholder_fig2 = Markup(fig["plot2"]),
        div_placeholder_fig3 = Markup(fig["plot3"]),
        div_placeholder_fig4 = Markup(fig["plot4"]),
        filename = json.dumps(filename),
        start_time_slider = json.dumps(int(fig["start_time_int"])),
        end_time_slider = json.dumps(int(fig["end_time_int"])),
        start_count_slider = json.dumps(int(fig["start_count_int"])),
        end_count_slider = json.dumps(int(fig["end_count_int"])),
        start_color1_slider = json.dumps(int(fig["start_color1_int"])),
        end_color1_slider = json.dumps(int(fig["end_color1_int"])),
        start_color2_slider = json.dumps(int(fig["start_color2_int"])),
        end_color2_slider = json.dumps(int(fig["end_color2_int"])),
    )

@app.route('/')
def root():
    logging.debug("Root page requested!")
    return render_template("master_page.html")

#Setting error handler
def http_error_handler(error):
    return render_template("error.html", error=error ), error

for error in (400, 401, 403, 404, 500): # or with other http code you consider as error
    app.error_handler_spec[None][error] = http_error_handler

if __name__ == '__main__':
    app.run()
