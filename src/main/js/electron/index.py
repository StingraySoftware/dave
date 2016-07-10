from flask import Flask, jsonify, render_template, request, send_from_directory
from flask import Markup

app = Flask(__name__)
import json

import plotly
from plotly.offline import plot

import pandas as pd
import numpy as np
import pkg_resources
import sys
import os
import uuid
import json
import logging
from werkzeug import secure_filename
from astropy.io import fits

logging.basicConfig(filename='logfile.log', level=logging.DEBUG)
APP_ROOT = os.path.dirname(os.path.abspath(__file__))


@app.route('/hello')
def hello():
    return render_template('basic__plot.html')
filename, file_extension = os.path.splitext('/path/to/somefile.ext')

@app.route('/uploader', methods = ['GET', 'POST'])
def request_upload_file():

    f = request.files['file']
    start_time = request.form['from_time']
    end_time = request.form['to_time']
    start_count = request.form['from_count']
    end_count = request.form['to_count']

    fig = upload_file(f, start_time, end_time, start_count, end_count)
    plot_div = plot(fig, output_type='div')

    return render_template('index.html',
        div_placeholder= Markup(plot_div)
    )

# upload_file: Upload a data file to the Flask server and generate a DIV with
# the plot inside
#
# @param: files_to_load: List of werkzeug.datastructures.FileStorage
#

def upload_file(f, start_time=None, end_time=None, start_count=None, end_count=None):

    logging.debug("file: %s - %s" % (type(f), f))

    target = os.path.join(APP_ROOT, 'uploadeddataset')
    if not os.path.isdir(target):
        os.mkdir(target)

    upload = f
    filename = upload.filename
    if not filename:
      return render_template("welcome.html");
    ext = os.path.splitext(filename)[1]

    if (ext == ".txt") or (ext == ".lc"):
        logging.debug("File supported moving on...")
    else:
        render_template("error.html", message="Files uploaded are not supported...")
    destination = "/".join([target, secure_filename(filename)])

    upload.save(destination)

    logging.debug("I reached here")
    logging.debug("destination filename: %s" % destination)

    if not destination:
      return render_template("welcome.html");

    filename, file_extension = os.path.splitext(destination)

    if file_extension != ".txt" and  file_extension != ".lc":
        return render_template("error.html");

    if file_extension == ".txt":

        logging.debug("Read txt file successfully")
        data = np.loadtxt(destination)
        Time = data[0:len(data),0]
        Rate = data[0:len(data),1]
        Error_y = data[0:len(data),2]
        Error_x =data[0:len(data),3]
        logging.debug(file_extension)
        logging.debug("Read txt file successfully ")

    else:
        hdulist = fits.open(destination)
        tbdata = hdulist[1].data
        Time = tbdata.field(0)
        Rate = tbdata.field(1)
        Error_y = tbdata.field(2)
        Error_x = tbdata.field(3)
        logging.debug(file_extension)
        logging.debug("Read fits file successfully ")

    trace1 = dict(
        type = 'scatter',
        x = Time,
        y = Rate,
        error_x = dict(
           type = 'data',
           array = Error_x,
           visible = True
        ),
        error_y = dict(
           type = 'data',
           array = Error_y,
           visible = True
        )
    )

    layout = dict(
         title = '',
         xaxis = dict(
             title = 'Time',
             range = [start_time, end_time],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title='Count Rate',
             range=[start_count, end_count],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         )
    )
    fig = dict(data = [trace1], layout = layout)

    return fig

@app.route('/')
def my_form():
    logging.debug("I am here")
    return render_template("welcome.html")



if __name__ == '__main__':
    app.run()
