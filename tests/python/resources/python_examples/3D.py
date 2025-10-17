import numpy as np
import plotly.graph_objs as go
from plotly.offline import plot

rng = np.random.default_rng()
x, y, z = rng.multivariate_normal(np.array([0, 0, 0]), np.eye(3), 400).transpose()
error = rng.uniform(-1, 1, size=len(x))
trace1 = go.Scatter3d(
    x=x,
    y=y,
    z=z,
    mode="markers",
    error_x={"type": "data", "array": error, "visible": True},
    error_y={"type": "data", "array": error, "visible": True},
    error_z={"type": "data", "array": error, "visible": True},
    marker={
        "size": 12,
        "color": z,  # set color to an array/list of desired values
        "colorscale": "Viridis",  # choose a colorscale
        "opacity": 0.8,
    },
)

data = [trace1]
layout = go.Layout(
    title="simple example",  # more about "layout's" "title": /python/reference/#layout-title
    xaxis={  # all "layout's" "xaxis" attributes: /python/reference/#layout-xaxis
        "title": "time"  # more about "layout's" "xaxis's" "title": /python/reference/#layout-xaxis-title
    },
)

fig = go.Figure(data=data, layout=layout)
plot(fig, filename="my-graph.html")
