from flask import Flask, jsonify, render_template, request , send_from_directory
app = Flask(__name__)
import json

import plotly
import plotly.offline as plt
from plotly import session, tools, utils

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
def upload_file():

    upload = request.files['file']
    
    target = os.path.join(APP_ROOT, 'uploadeddataset')
    
    if not os.path.isdir(target):
        os.mkdir(target)

    for upload in request.files.getlist("file"):
    
        filename = upload.filename
        ext = os.path.splitext(filename)[1]
        
        if (ext == ".txt") or (ext == ".lc"):
            logging.debug("File supported moving on...")
        else:
            render_template("error.html", message="Files uploaded are not supported...")
        destination = "/".join([target, filename])
        
        upload.save(destination)


    logging.debug("I reached here")
    f = request.files['file']
    text=f.filename

    #text = request.form['text']
    f = request.files['file']
    logging.debug(secure_filename(f.filename))
    start_time = request.form['from_time']
    end_time =request.form['to_time']
    start_count = request.form['from_count']
    end_count =request.form['to_count']

    if not text:
      return render_template("welcome.html");

    text="uploadeddataset/"+text

    filename, file_extension = os.path.splitext(text)

    if file_extension == ".txt":
        light_curve = pkg_resources.resource_stream(__name__,text)
        data = np.loadtxt(light_curve)
        Time = data[0:len(data),0]
        Rate = data[0:len(data),1]
        Error_y= data[0:len(data),2]
        Error_x= data[0:len(data),3]
        logging.debug(file_extension)
        logging.debug("Read txt file successfully ")

    else:
        hdulist = fits.open(text)
        tbdata = hdulist[1].data
        Time =tbdata.field(0)
        Rate=tbdata.field(1)
        Error=tbdata.field(2)
        logging.debug(file_extension)
        logging.debug("Read fits file successfully ")

    trace1 = dict(
            type = 'scatter',
            x=Time,
            y=Rate,
            error_x=dict(
               type='data',
               array=Error_x,
               visible=True
                ),
            error_y=dict(
               type='data',
               array=Error_y,
               visible=True
                )
    )

    layout=dict(
                 title='',
                 xaxis=dict(
                     title='Time',
                     range=[start_time,end_time],
                     rangeslider=dict(),
                     titlefont=dict(
                     family='Courier New, monospace',
                     size=18,
                     color='#7f7f7f'
                        )
                 ),
                 yaxis=dict(
                     title='Count Rate',
                     range=[start_count,end_count],
                     titlefont=dict(
                     family='Courier New, monospace',
                     size=18,
                     #range=[int(start), int(end)],
                     #range=[10,20],
                     color='#7f7f7f'
                      )
                 )
        )
    fig = dict(data = [trace1], layout = layout)
    plt.plot(fig, filename='templates/basic__plot.html',auto_open=False)

    return render_template('index.html')



@app.route('/')
def my_form():
    logging.debug("I am here")
    return render_template("welcome.html")



if __name__ == '__main__':
    app.run()
