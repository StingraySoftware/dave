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

    start_color1 = request.form['from_color1']
    end_color1 = request.form['to_color1']
    start_color2 = request.form['from_color2']
    end_color2 = request.form['to_color2']

    filename = f.filename
    if not filename:
      return render_template("welcome.html");

    fig = upload_file(f, start_time, end_time, start_count, end_count,start_color1,end_color1,start_color2,end_color2)
    
    plot_div1 = plot(fig[0], output_type='div')
    plot_div2 = plot(fig[1], output_type='div')

    return render_template('index.html',
        div_placeholder_fig1= Markup(plot_div1),
        div_placeholder_fig2= Markup(plot_div2)
    )

# upload_file: Upload a data file to the Flask server and generate a DIV with
# the plot inside
#
# @param: files_to_load: List of werkzeug.datastructures.FileStorage
#

def upload_file(f, start_time=None, end_time=None, start_count=None, end_count=None,start_color1=None,end_color1=None,start_color2=None,end_color2=None):

    logging.debug("file: %s - %s" % (type(f), f))

    target = os.path.join(APP_ROOT, 'uploadeddataset')
    if not os.path.isdir(target):
        os.mkdir(target)

    upload = f
    filename = upload.filename
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
            logging.debug("Read txt file successfully for time")
            data = np.loadtxt(destination)

            Time = data[0:len(data),0]
            Error_time =data[0:len(data),1]
            Rate = data[0:len(data),2]
            Error_rate = data[0:len(data),3]
            
            color1 = data[0:len(data),4]
            Error_color1 =data[0:len(data),5]
            color2= data[0:len(data),6]
            Error_color2 = data[0:len(data),7]

            logging.debug(file_extension)
            logging.debug("Read txt file successfully for time ")
            
    else :
            hdulist = fits.open(destination)
            tbdata = hdulist[1].data
            Time = tbdata.field(0)
            Rate = tbdata.field(1)
            Error_y = tbdata.field(2)
            Error_x = tbdata.field(3)
            logging.debug(file_extension)
            logging.debug("Read fits file successfully ")

    newTime=[]
    newRate=[]
    newError_time=[]
    newError_rate=[] 
    newcolor1=[];
    newcolor2=[];
    newError_color1=[];
    newError_color2=[];       

    if (not start_time) and (not end_time):
          start_time_int = min(Time)
          end_time_int = max(Time)
    else:
          start_time_int=int(start_time)
          end_time_int=int(end_time)

    if (not start_count) and (not end_count):
          start_count_int = min(Rate)
          end_count_int = max(Rate)
    else:
          start_count_int=int(start_count)
          end_count_int=int(end_count)

    if (not start_color1) and (not end_color1):
          start_color1_int = min(color1)
          end_color1_int = max(color1)
    else:
          start_color1_int=int(start_color1)
          end_color1_int=int(end_color1)

    if (not start_color2) and (not end_color2):
          start_color2_int = min(color2)
          end_color2_int = max(color2)
    else:
          start_color2_int=int(start_color2)
          end_color2_int=int(end_color2)
          
    for i in range(len(Time)):
          if ((Time[i] >= (start_time_int) and Time[i] <= (end_time_int)) and (Rate[i] >= (start_count_int) and Rate[i] <= (end_count_int)) and (color1[i] >= (start_color1_int) and color1[i] <= (end_color1_int)) and (color1[i] >= (start_color1_int) and color1[i] <= (end_color1_int)) ) :
            newTime.append(Time[i])
            newRate.append(Rate[i])
            newError_time.append(Error_time[i])
            newError_rate.append(Error_rate[i])
            newcolor1.append(color1[i])
            newcolor2.append(color2[i])
            newError_color1.append(Error_color1[i])
            newError_color2.append(Error_color2[i])




    trace1 = dict(
        type = 'scatter',
        x = newTime,
        y = newRate,
        error_x = dict(
           type = 'data',
           array = newError_time,
           visible = True
        ),
        error_y = dict(
           type = 'data',
           array = newError_rate,
           visible = True
        )
    )

    layout1 = dict(
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
    trace2 = dict(
        type = 'scatter',
        x = newcolor1,
        y = newcolor2,
        error_x = dict(
           type = 'data',
           array = newError_color1,
           visible = True
        ),
        error_y = dict(
           type = 'data',
           array = newError_color2,
           visible = True
        )
    )

    layout2 = dict(
         title = '',
         xaxis = dict(
             title = 'Color1',
             range = [start_color1, end_color1],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title='Color2',
             range=[start_color2, end_color2],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         )
    )
    fig=[]
    fig1 = dict(data = [trace1], layout = layout1)
    fig2 = dict(data = [trace2], layout = layout2)
    fig.append(fig1);
    fig.append(fig2);

    return fig

@app.route('/')
def my_form():
    logging.debug("I am here")
    return render_template("welcome.html")



if __name__ == '__main__':
    app.run()