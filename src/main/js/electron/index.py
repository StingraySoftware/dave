from flask import Flask, jsonify, render_template, request
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

@app.route('/hello')
def hello():
    return render_template('basic__plot.html')
filename, file_extension = os.path.splitext('/path/to/somefile.ext')

@app.route('/uploader', methods = ['GET', 'POST'])
def upload_file():

    logging.debug("I reached here")
    f = request.files['file']
    text=f.filename

    #text = request.form['text']
    f = request.files['file']
    mode= request.form['select_mode']
    logging.debug("select")
    logging.debug(secure_filename(f.filename))
    start_time = request.form['from_time']
    end_time =request.form['to_time']
    start_count = request.form['from_count']
    end_count =request.form['to_count']

    if not text:
      return render_template("welcome.html");

    text="datasets/"+text

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

   ## mode="Deselect"


    if(mode=="Deselect"):

        if (not start_time) and (not end_time):
          start_time_int = max(Time)
          end_time_int = min(Time)
        else:
          start_time_int=int(start_time)
          end_time_int=int(end_time)


        if (not start_count) and (not end_count):
          start_count_int = max(Rate)
          end_count_int = min(Rate)
        else:
          start_count_int=int(start_count)
          end_count_int=int(end_count)

        
        
        newTime=[]
        newRate=[]
        newError_y=[]
        newError_x=[]
        
        for i in range(len(Time)):
          if (Time[i] <= (start_time_int) or Time[i] >= (end_time_int)) and (Rate[i] <= (start_count_int) or Rate[i] >= (end_count_int)) :
            newTime.append(Time[i])
            newRate.append(Rate[i])
            newError_y.append(Error_y[i])
            newError_x.append(Error_x[i])


        trace1 = dict(
                type = 'scatter',
                x=newTime,
                y=newRate,
                error_x=dict(
                   type='data',
                   array=newError_x,
                   visible=True
                    ),
                error_y=dict(
                   type='data',
                   array=newError_y,
                   visible=True
                    )
        )

        layout=dict(
                     title='',
                     xaxis=dict(
                         title='Time',
                         rangeslider=dict(),
                         titlefont=dict(
                         family='Courier New, monospace',
                         size=18,
                         color='#7f7f7f'
                            )
                     ),
                     yaxis=dict(
                         title='Count Rate',
                         titlefont=dict(
                         family='Courier New, monospace',
                         size=18,
                         #range=[int(start), int(end)],
                         #range=[10,20],
                         color='#7f7f7f'
                          )
                     )
            )

    else:
        
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
