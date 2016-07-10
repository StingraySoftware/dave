from plotly.offline.offline import _plot_html

class Test3:
    def runit(self):
        data_or_figure = [{"x": [1, 2, 3], "y": [3, 1, 6]}]
        plot_html, plotdivid, width, height = _plot_html(
            data_or_figure, False, "", True, '100%', 525,True)
        print(plot_html)
