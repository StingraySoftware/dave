
from flask import Flask, jsonify, render_template, request
app = Flask(__name__)
import json
import plotly

import pandas as pd
import numpy as np
import pkg_resources   
@app.route('/_add_numbers')
def add_numbers():
    filename = request.args.get('filename')
    light_curve = pkg_resources.resource_stream(__name__,filename)
    data = np.loadtxt(light_curve)
    Time = data[0:len(data),0]
    Rate = data[0:len(data),1]
    print(Time)
    graphs = [
        dict(
            data=[
                dict(
                    x=Time,
                    y=Rate,
                    type='scatter'
                ),
            ],
            layout=dict(
                title='first graph'
            )
        )
    ]
    ids = ['graph-{}'.format(i) for i, _ in enumerate(graphs)]
    graphJSON = json.dumps(graphs, cls=plotly.utils.PlotlyJSONEncoder)
    print("danish");
    return render_template('index.html',
                           ids=ids,
                           graphJSON=graphJSON)

@app.route('/')
def my_form():
    return render_template("welcome.html")

@app.route('/', methods=['POST'])
def my_form_post():

    text = request.form['text']
    light_curve = pkg_resources.resource_stream(__name__,text)
    data = np.loadtxt(light_curve)
    Time = data[0:len(data),0]
    Rate = data[0:len(data),1]
    graphs = [
        dict(
            data=[
                dict(
                    x=Time,
                    y=Rate,
                    type='scatter'
                ),
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
                 )
                
            )
        )
    ]

    ids = ['graph-{}'.format(i) for i, _ in enumerate(graphs)]
    graphJSON = json.dumps(graphs, cls=plotly.utils.PlotlyJSONEncoder)
    return render_template('index.html',
                           ids=ids, 
                           graphJSON=graphJSON)


if __name__ == '__main__':
    app.run()