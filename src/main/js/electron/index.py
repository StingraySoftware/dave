
from flask import Flask, jsonify, render_template, request
app = Flask(__name__)
import json
import plotly
import plotly.graph_objs as go

import pandas as pd
import numpy as np
import pkg_resources   

@app.route('/')
def my_form():
    return render_template("welcome.html")

@app.route('/', methods=['POST'])
def my_form_post():

    text = request.form['text']
    if not text:
      return render_template("welcome.html");

    light_curve = pkg_resources.resource_stream(__name__,text)
    data = np.loadtxt(light_curve)
    Time = data[0:len(data),0]
    Rate = data[0:len(data),1]
    Error= data[0:len(data),2 ]
    error = np.array(Rate) - np.array(Rate)+50
    Final_error = np.array(error).tolist();
    #print(Final_error)
    graphs = [     
      dict(     
          data=[
              go.Scatter(
               x=Time,
               y=Rate,
               error_y=dict(
               type='data',
               array=Error,
               visible=True
                )
               
             )
         ],
        layout=dict(
                title='',
                xaxis=dict(
                     title='Time',
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
                    color='#7f7f7f'

                  )
                 ),
          
                
            )
     )
    ]
    #print("yes")
    #print(plotly.__version__)
    ids = ['graph-{}'.format(i) for i, _ in enumerate(graphs)]
    graphJSON = json.dumps(graphs, cls=plotly.utils.PlotlyJSONEncoder)
    #print(graphJSON)
    return render_template('index.html',
                           ids=ids, 
                           graphJSON=graphJSON)


if __name__ == '__main__':
    app.run()