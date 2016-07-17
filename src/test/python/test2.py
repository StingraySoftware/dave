import plotly.offline as plt

class Test2:
    def runit(self):
        trace1 = dict(
                    type = 'scatter',
                    x=[1,2,3,4],
                    y=[5,6,7,8],

            )
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
        fig = dict(data = [trace1], layout = layout)
        plt.plot(fig, filename='basic' + '__plot.html')
