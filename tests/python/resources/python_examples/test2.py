import plotly.offline as plt

trace1 = {
    "type": "scatter",
    "x": [1, 2, 3, 4],
    "y": [5, 6, 7, 8],
}
layout = {
    "title": "",
    "xaxis": {
        "title": "Time",
        "titlefont": {"family": "Courier New, monospace", "size": 18, "color": "#7f7f7f"},
    },
    "yaxis": {
        "title": "Count Rate",
        "titlefont": {"family": "Courier New, monospace", "size": 18, "color": "#7f7f7f"},
    },
}
fig = {"data": [trace1], "layout": layout}
plt.plot(fig, filename="basic" + "__plot.html")
