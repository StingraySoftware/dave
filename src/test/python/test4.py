from plotly.offline import plot
import plotly.graph_objs as go

class Test4:
    def runoit(self):
        plot([go.Scatter(x=[1, 2, 3], y=[3, 2, 6])], filename='my-graph.html')
        # We can also download an image of the plot by setting the image parameter
        # to the image format we want
        plot([go.Scatter(x=[1, 2, 3], y=[3, 2, 6])], filename='my-graph.html',image='jpeg')
