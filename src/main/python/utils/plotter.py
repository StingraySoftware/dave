
import plotly.graph_objs as go
from plotly.offline import plot

def get_plotdiv_xy(x_values, y_values, x_error_values, y_error_values, x_label, y_label):

    trace = dict(
        type = 'scatter',
        hoverinfo = 'none',
        x = x_values,
        y = y_values,
        error_x = dict(
           type = 'data',
           array = x_error_values,
           visible = True
        ),
        error_y = dict(
           type = 'data',
           array = y_error_values,
           visible = True
        )
    )

    layout = dict(
         title = '',
         hovermode= 'closest',
         xaxis = dict(
             title = x_label,
             #range = [start_time, end_time],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title = y_label,
             #range=[start_count, end_count],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         ),
        dragmode='select'
    )

    fig = dict(data = [ trace ], layout = layout)
    return plot(fig, output_type='div')


def get_plotdiv_xyz(x_values, y_values, z_values, x_error_values, y_error_values, z_error_values, title_label, title_colobar, colorArray):

    trace = go.Scatter3d(
        x=x_values,
        y=y_values,
        z=z_values,
        mode='markers',
        error_x = dict(
               type = 'data',
               array = x_error_values,
               visible = True
            ),
        error_y = dict(
               type = 'data',
               array = y_error_values,
               visible = True
            ),
        error_z = dict(
               type = 'data',
               array = z_error_values,
               visible = True
            ),
        marker=dict(
            size=5,
            color=colorArray,     # set color to an array/list of desired values
            colorscale='Viridis',   # choose a colorscale
            colorbar = dict(title = title_colobar, thickness=20, len=1),
            opacity=0.8
            )
        )

    layout = go.Layout(
        title=title_label,     # more about "layout's" "title": /python/reference/#layout-title
    )

    data = [trace]

    fig = go.Figure(data=data, layout=layout)
    return plot(fig, output_type='div')


def get_plotdiv_scatter(x_values, y_values, color_array, x_label, y_label):

    trace = dict(
        type = 'scatter',
        x = x_values,
        y = y_values,
        mode="markers",
        marker=dict(
        size=6,
        color=color_array,                # set color to an array/list of desired values
        colorscale='Viridis',   # choose a colorscale
        colorbar = dict(title = 'Amplitude<br>Map',thickness=20,len=1),
        opacity=0.8
        )
    )

    layout = dict(
         title = '',
         hovermode= 'closest',
         xaxis = dict(
             title = x_label,
             #range = [start_time, end_time],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
            )
         ),
         yaxis=dict(
             title=y_label,
             #range=[start_count, end_count],
             titlefont = dict(
                 family = 'Courier New, monospace',
                 size = 18,
                 color = '#7f7f7f'
             )
         ),
    )

    fig = dict(data = [ trace ], layout = layout)
    return plot(fig, output_type='div')
