from flask import Flask, jsonify, render_template, request, send_from_directory,session
from flask import Markup

import json

import plotly
from plotly.offline import plot
import plotly.graph_objs as go

import pandas as pd
import numpy as np
import pkg_resources
import sys
import os
import uuid
import json
import numpy

import logging
from werkzeug import secure_filename
from astropy.io import fits

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

@app.route('/hello')
def hello():
    return render_template('basic__plot.html')
filename, file_extension = os.path.splitext('/path/to/somefile.ext')

@app.route('/uploader_welcome', methods = ['GET', 'POST'])
def request_upload_file_welcome():

    f = request.files['file']
    session['user']=f.filename

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

    fig = upload_file_from_welcome(f, start_time, end_time, start_count, end_count,start_color1,end_color1,start_color2,end_color2)

    plot_div1 = plot(fig[0], output_type='div')
    plot_div2 = plot(fig[1], output_type='div')
    plot_div3 = plot(fig[10], output_type='div')
    plot_div4 = plot(fig[0], output_type='div')

    filename_json=json.dumps(filename)
    start_time_slider_json = json.dumps(int(fig[2]))
    end_time_slider_json = json.dumps(int(fig[3]))
    start_count_slider_json = json.dumps(int(fig[4]))
    end_count_slider_json = json.dumps(int(fig[5]))
    start_color1_slider_json = json.dumps(int(fig[6]))
    end_color1_slider_json = json.dumps(int(fig[7]))
    start_color2_slider_json = json.dumps(int(fig[8]))
    end_color2_slider_json = json.dumps(int(fig[9]))
    return render_template('index.html',
        div_placeholder_fig1= Markup(plot_div1),
        div_placeholder_fig2= Markup(plot_div2),
        div_placeholder_fig3= Markup(plot_div3),
        div_placeholder_fig4= Markup(plot_div4),
        filename=filename_json,
        start_time_slider = start_time_slider_json,
        end_time_slider = end_time_slider_json,
        start_count_slider = start_count_slider_json,
        end_count_slider = end_count_slider_json,
        start_color1_slider = start_color1_slider_json,
        end_color1_slider = end_color1_slider_json,
        start_color2_slider = start_color2_slider_json,
        end_color2_slider = end_color2_slider_json,
    )



# upload_file_from_welcome: Upload a data file to the Flask server and generate a DIV with
# the plot inside
#
# @param: files_to_load: List of werkzeug.datastructures.FileStorage
#

def upload_file_from_welcome(f, start_time=None, end_time=None, start_count=None, end_count=None,start_color1=None,end_color1=None,start_color2=None,end_color2=None):

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
            Amplitude = numpy.random.uniform(-1, 1, size=len(data))

            logging.debug(file_extension)
            logging.debug("Read txt file successfully for time ")

    else :
            hdulist = fits.open(destination)
            tbdata = hdulist[1].data
            Time = tbdata.field(0)
            Rate = tbdata.field(1)
            Error_rate = tbdata.field(2)
            Error_time = tbdata.field(3)
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
          start_time_float = min(Time)
          end_time_float = max(Time)
    else:
          start_time_float=float(start_time)
          end_time_float=float(end_time)

    if (not start_count) and (not end_count):
          start_count_float = min(Rate)
          end_count_float = max(Rate)
    else:
          start_count_float=float(start_count)
          end_count_float=float(end_count)

    if (not start_color1) and (not end_color1):
          start_color1_float = min(color1)
          end_color1_float = max(color1)
    else:
          start_color1_float=float(start_color1)
          end_color1_float=float(end_color1)

    if (not start_color2) and (not end_color2):
          start_color2_float = min(color2)
          end_color2_float = max(color2)
    else:
          start_color2_float=float(start_color2)
          end_color2_float=float(end_color2)

    for i in range(len(Time)):
          if ((Time[i] >= (start_time_float) and Time[i] <= (end_time_float)) and (Rate[i] >= (start_count_float) and Rate[i] <= (end_count_float)) and (color1[i] >= (start_color1_float) and color1[i] <= (end_color1_float)) and (color2[i] >= (start_color2_float) and color2[i] <= (end_color2_float)) ) :
            newTime.append(Time[i])
            newRate.append(Rate[i])
            newError_time.append(Error_time[i])
            newError_rate.append(Error_rate[i])
            newcolor1.append(color1[i])
            newcolor2.append(color2[i])
            newError_color1.append(Error_color1[i])
            newError_color2.append(Error_color2[i])


    newAmplitude = numpy.random.uniform(-5, 5, size=len(newTime))

    trace1 = dict(
        type = 'scatter',
        hoverinfo = 'none',
        x = newTime,
        y = newRate,
        mode="markers",
        error_x = dict(
           type = 'data',
           array = newError_time,
           visible = True
        ),
        error_y = dict(
           type = 'data',
           array = newError_rate,
           visible = True
        ),
        marker=dict(
        size=5,
        color=newAmplitude,                # set color to an array/list of desired values
        colorscale='Viridis',   # choose a colorscale
        colorbar = dict(title = 'Amplitude<br>Map',thickness=20,len=1),
        opacity=0.8
        )
    )

    layout1 = dict(
         title = '',
         hovermode= 'closest',
         xaxis = dict(
             title = 'Time',
             #range = [start_time, end_time],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title='Count Rate',
             #range=[start_count, end_count],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         ),
        dragmode='select'

    )
    trace2 = dict(
        type = 'scatter',
        hoverinfo = 'none',
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
         hovermode= 'closest',
         xaxis = dict(
             title = 'Color1',
             #range = [start_color1, end_color1],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title='Color2',
             #range=[start_color2, end_color2],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         ),
         dragmode='select',
    )

    error = numpy.random.uniform(-8,8 , size=len(Time))

    trace3 = go.Scatter3d(
    x=newTime,
    y=newRate,
    z=newAmplitude,
    mode='markers',
    error_x = dict(
           type = 'data',
           array = newError_time,
           visible = True
        ),
    error_y = dict(
           type = 'data',
           array = newError_rate,
           visible = True
        ),
    error_z = dict(
           type = 'data',
           array = error,
           visible = True
        ),
    marker=dict(
        size=5,
        color=newAmplitude,                # set color to an array/list of desired values
        colorscale='Viridis',   # choose a colorscale
        colorbar = dict(title = 'Amplitude<br>Map',thickness=20,len=1),
        opacity=0.8
        )
    )

    data3 = [trace3]

    layout3 = go.Layout(
        title="Dynamic Spectrum",     # more about "layout's" "title": /python/reference/#layout-title
          
    )


    start_time_int = min(Time)
    end_time_int = max(Time) +1
    start_count_int = min(Rate)
    end_count_int = max(Rate) +1
    start_color1_int = min(color1)
    end_color1_int = max(color1) +1
    start_color2_int = min(color2)
    end_color2_int = max(color2) +1


    fig=[]
    fig1 = dict(data = [trace1], layout = layout1)
    fig2 = dict(data = [trace2], layout = layout2)
    fig3 = go.Figure(data=data3, layout=layout3)

    fig.append(fig1);
    fig.append(fig2);
    

    fig.append(start_time_int);
    fig.append(end_time_int);
    fig.append(start_count_int);
    fig.append(end_count_int);
    fig.append(start_color1_int);
    fig.append(end_color1_int);
    fig.append(start_color2_int);
    fig.append(end_color2_int);
    fig.append(fig3);

    return fig

@app.route('/uploader_index', methods = ['GET', 'POST'])
def request_upload_file_index():

    if 'user' in session:
     filename=session['user']

    start_time = request.form['from_time']
    end_time = request.form['to_time']
    start_count = request.form['from_count']
    end_count = request.form['to_count']

    start_color1 = request.form['from_color1']
    end_color1 = request.form['to_color1']
    start_color2 = request.form['from_color2']
    end_color2 = request.form['to_color2']

    if not filename:
      return render_template("welcome.html");

    fig = upload_file_from_index(filename, start_time, end_time, start_count, end_count,start_color1,end_color1,start_color2,end_color2)

    plot_div1 = plot(fig[0], output_type='div')
    plot_div2 = plot(fig[1], output_type='div')
    plot_div3 = plot(fig[10], output_type='div')
    plot_div4 = plot(fig[0], output_type='div')

    filename_json=json.dumps(filename)
    start_time_slider_json = json.dumps(int(fig[2]))
    end_time_slider_json = json.dumps(int(fig[3]))
    start_count_slider_json = json.dumps(int(fig[4]))
    end_count_slider_json = json.dumps(int(fig[5]))
    start_color1_slider_json = json.dumps(int(fig[6]))
    end_color1_slider_json = json.dumps(int(fig[7]))
    start_color2_slider_json = json.dumps(int(fig[8]))
    end_color2_slider_json = json.dumps(int(fig[9]))

    return render_template('index.html',
        div_placeholder_fig1= Markup(plot_div1),
        div_placeholder_fig2= Markup(plot_div2),
        div_placeholder_fig3= Markup(plot_div3),
        div_placeholder_fig4= Markup(plot_div4),
        filename=filename_json,
        start_time_slider = start_time_slider_json,
        end_time_slider = end_time_slider_json,
        start_count_slider = start_count_slider_json,
        end_count_slider = end_count_slider_json,
        start_color1_slider = start_color1_slider_json,
        end_color1_slider = end_color1_slider_json,
        start_color2_slider = start_color2_slider_json,
        end_color2_slider = end_color2_slider_json,
    )

def upload_file_from_index(filename=None, start_time=None, end_time=None, start_count=None, end_count=None,start_color1=None,end_color1=None,start_color2=None,end_color2=None):


    target = os.path.join(APP_ROOT, 'uploadeddataset')

    ext = os.path.splitext(filename)[1]

    if (ext == ".txt") or (ext == ".lc"):
        logging.debug("File supported moving on...")
    else:
        render_template("error.html", message="Files uploaded are not supported...")
    destination = "/".join([target, secure_filename(filename)])


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

            Amplitude = numpy.random.uniform(-1, 1, size=len(data))
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
          start_time_float = min(Time)
          end_time_float = max(Time)
    else:
          start_time_float=float(start_time)
          end_time_float=float(end_time)

    if (not start_count) and (not end_count):
          start_count_float = min(Rate)
          end_count_float = max(Rate)
    else:
          start_count_float=float(start_count)
          end_count_float=float(end_count)

    if (not start_color1) and (not end_color1):
          start_color1_float = min(color1)
          end_color1_float = max(color1)
    else:
          start_color1_float=float(start_color1)
          end_color1_float=float(end_color1)

    if (not start_color2) and (not end_color2):
          start_color2_float = min(color2)
          end_color2_float = max(color2)
    else:
          start_color2_float=float(start_color2)
          end_color2_float=float(end_color2)

    for i in range(len(Time)):
          if ((Time[i] >= (start_time_float) and Time[i] <= (end_time_float)) and (Rate[i] >= (start_count_float) and Rate[i] <= (end_count_float)) and (color1[i] >= (start_color1_float) and color1[i] <= (end_color1_float)) and (color2[i] >= (start_color2_float) and color2[i] <= (end_color2_float)) ) :
            newTime.append(Time[i])
            newRate.append(Rate[i])
            newError_time.append(Error_time[i])
            newError_rate.append(Error_rate[i])
            newcolor1.append(color1[i])
            newcolor2.append(color2[i])
            newError_color1.append(Error_color1[i])
            newError_color2.append(Error_color2[i])


    newAmplitude = numpy.random.uniform(-1, 1, size=len(newTime))

    trace1 = dict(
        type = 'scatter',
        hoverinfo = 'none',
        x = newTime,
        y = newRate,
        mode="markers",
        error_x = dict(
           type = 'data',
           array = newError_time,
           visible = True
        ),
        error_y = dict(
           type = 'data',
           array = newError_rate,
           visible = True
        ),
        marker=dict(
        size=5,
        color=newAmplitude,                # set color to an array/list of desired values
        colorscale='Viridis',   # choose a colorscale
        colorbar = dict(title = 'Amplitude<br>Map',thickness=20,len=1),
        opacity=0.8
        )
    )

    layout1 = dict(
         title = '',
         hovermode= 'closest',
         xaxis = dict(
             title = 'Time',
             #range = [start_time, end_time],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title='Count Rate',
             #range=[start_count, end_count],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         ),
        dragmode='select'

    )
    trace2 = dict(
        type = 'scatter',
        hoverinfo = 'none',
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
        ),

    )

    layout2 = dict(
         title = '',
         hovermode= 'closest',
         xaxis = dict(
             title = 'Color1',
             #range = [start_color1, end_color1],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title='Color2',
             #range=[start_color2, end_color2],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         ),
         dragmode='select'
    )

    error = numpy.random.uniform(-8,8 , size=len(Time))

    trace3 = go.Scatter3d(
    x=newTime,
    y=newRate,
    z=newAmplitude,
    mode='markers',
    error_x = dict(
           type = 'data',
           array = newError_time,
           visible = True
        ),
    error_y = dict(
           type = 'data',
           array = newError_rate,
           visible = True
        ),
    error_z = dict(
           type = 'data',
           array = error,
           visible = True
        ),
    marker=dict(
        size=5,
        color=newAmplitude,                # set color to an array/list of desired values
        colorscale='Viridis',   # choose a colorscale
        colorbar = dict(title = 'Amplitude<br>Map',thickness=20,len=1),
        opacity=0.8
        )
    )

    data3 = [trace3]

    layout3 = go.Layout(
        title= "Dymanic Spectrutm",
    )
    start_time_int = min(Time)
    end_time_int = max(Time)+1
    start_count_int = min(Rate)
    end_count_int = max(Rate)+1
    start_color1_int = min(color1)
    end_color1_int = max(color1)+1
    start_color2_int = min(color2)
    end_color2_int = max(color2)+1


    fig=[]
    fig1 = dict(data = [trace1], layout = layout1)
    fig2 = dict(data = [trace2], layout = layout2)
    fig3 = go.Figure(data=data3, layout=layout3)

    fig.append(fig1);
    fig.append(fig2);
    fig.append(start_time_int);
    fig.append(end_time_int);
    fig.append(start_count_int);
    fig.append(end_count_int);
    fig.append(start_color1_int);
    fig.append(end_color1_int);
    fig.append(start_color2_int);
    fig.append(end_color2_int);
    fig.append(fig3);

    return fig

@app.route('/')
def my_form():
    logging.debug("I am here")
    return render_template("welcome.html")



if __name__ == '__main__':
    app.run()