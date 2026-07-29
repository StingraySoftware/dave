from datetime import datetime

import pandas.io.data as web
import plotly.graph_objs as go
import plotly.offline as plt

df = web.DataReader("aapl", "yahoo", datetime(2007, 10, 1), datetime(2009, 4, 1))

trace = go.Scatter(
    x=[1, 2, 3, 4, 5, 6, 7, 8, 9],
    y=[2, 3, 4, 5, 9, 0, 9, 9, 1],
    error_y={"type": "data", "array": [1, 2, 1, 2, 1, 2, 1, 2, 3], "visible": True},
)

data = [trace]
layout = {
    "title": "Time series with range slider and selectors",
    "xaxis": {
        "rangeslider": {},
    },
    "yaxis": {"range": [2, 5]},
}

fig = {"data": data, "layout": layout}
plt.plot(fig)
