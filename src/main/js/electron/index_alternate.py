
from flask import Flask, jsonify, render_template, request
app = Flask(__name__)
import json
import plotly

import pandas as pd
import numpy as np
import pkg_resources   

@app.route('/hello')
def hello():
    return render_template('test.html')

@app.route('/', methods=['POST'])
def my_form_post():
    print("Hi ")
    text = request.form['text']
    if not text:
      return render_template("welcome.html");

    light_curve = pkg_resources.resource_stream(__name__,text)
    data = np.loadtxt(light_curve)
    Time = data[0:len(data),0]
    Rate = data[0:len(data),1]
    error = np.array(Rate) - np.array(Rate)+50
    Final_error = np.array(error).tolist();

    import sys
    import os
    from plotly import session, tools, utils
    import uuid
    import json


    def get_plotlyjs():
        path = os.path.join('offline', 'plotly.min.js')
        plotlyjs = resource_string('plotly', path).decode('utf-8')
        return plotlyjs


    def js_convert(figure_or_data,outfilename, show_link=False, link_text='Export to plot.ly',
              validate=True):

        figure = tools.return_figure_from_figure_or_data(figure_or_data, validate)

        width = figure.get('layout', {}).get('width', '100%')
        height = figure.get('layout', {}).get('height', 525)
        try:
            float(width)
        except (ValueError, TypeError):
            pass
        else:
            width = str(width) + 'px'

        try:
            float(width)
        except (ValueError, TypeError):
            pass
        else:
            width = str(width) + 'px'

        plotdivid = uuid.uuid4()
        jdata = json.dumps(figure.get('data', []), cls=utils.PlotlyJSONEncoder)
        jlayout = json.dumps(figure.get('layout', {}), cls=utils.PlotlyJSONEncoder)

        config = {}
        config['showLink'] = show_link
        config['linkText'] = link_text
        config["displaylogo"]=False
        config["modeBarButtonsToRemove"]= ['sendDataToCloud']
        jconfig = json.dumps(config)

        plotly_platform_url = session.get_session_config().get('plotly_domain',
                                                               'https://plot.ly')
        if (plotly_platform_url != 'https://plot.ly' and
                link_text == 'Export to plot.ly'):

            link_domain = plotly_platform_url\
                .replace('https://', '')\
                .replace('http://', '')
            link_text = link_text.replace('plot.ly', link_domain)


        script = '\n'.join([
            'Plotly.plot("{id}", {data}, {layout}, {config}).then(function() {{',
            '    $(".{id}.loading").remove();',
            '}})'
        ]).format(id=plotdivid,
                  data=jdata,
                  layout=jlayout,
                  config=jconfig)

        html="""<div class="{id} loading" style="color: rgb(50,50,50);">
                     Drawing...</div>
                     <div id="{id}" style="height: {height}; width: {width};" 
                     class="plotly-graph-div">
                     </div>
                     <script type="text/javascript">
                     {script}
                     </script>
                     """.format(id=plotdivid, script=script,
                               height=height, width=width)

        #html =  html.replace('\n', '')
        with open(outfilename, 'w') as out:
            print(outfilename)
            out.write('<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>')
            for line in html.split('\n'):
                 out.write(line)

            out.close()
        print ('JS Conversion Complete')

    print("Here i am before")
    trace1 = dict(
            type = 'scatter',
            x=Time,
            y=Rate,
            error_y=dict(
               type='data',
               array=Final_error,
               visible=True
                )

    )
    print("Here i am before")
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
    print("Here i am before")

    fig = dict(data = [trace1], layout = layout)
    print("Here i am after")
    js_convert(fig, 'templates/test.html')

    return render_template('index.html')





@app.route('/')
def my_form():
    print("I am here")
    return render_template("welcome.html")



if __name__ == '__main__':
    app.run()