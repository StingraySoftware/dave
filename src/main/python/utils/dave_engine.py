
import os
import logging

import numpy as np
from astropy.io import fits

import utils.dave_reader as DaveReader
import utils.plotter as Plotter

# get_dataset_schema: Returns the schema of a dataset of given file
# the plot inside with a given file destination
#
# @param: destination: file destination
#
def get_dataset_schema(destination):
    dataset = DaveReader.get_file_dataset(destination)
    return dataset.get_schema()

# get_plot_html: Returns the html for a plot
#
# @param: destination: file destination
# @param: filters: array with the filters to apply
#         [{ table = "txt_table", column = "Time", from=0, to=10 }, ... ]
# @param: styles: dictionary with the plot style info
#           { type = "2d", labels=["Time", "Rate Count"]}
# @param: axis: array with the column names to use in ploting
#           [{ table = "txt_table", column = "Time" }, { table = "txt_table", column = "Rate" } ... ]
#
def get_plot_html(destination, filters, styles, axis):

    dataset = DaveReader.get_file_dataset(destination)
    filtered_dataset = dataset.apply_filters(filters)

    if not styles["type"]:
        return "No plot type specified on styles";

    if not styles["labels"]:
        return "No plot labels specified on styles";

    if len(styles["labels"]) < 2:
        return "Wrong number of labels specified on styles";

    if len(axis) < 2:
        return "Wrong number of axis";


    x_values = filtered_dataset.tables[axis[0]["table"]].columns[axis[0]["column"]]
    y_values = filtered_dataset.tables[axis[1]["table"]].columns[axis[1]["column"]]
    x_error_values = filtered_dataset.tables[axis[2]["table"]].columns[axis[2]["column"]]
    y_error_values = filtered_dataset.tables[axis[3]["table"]].columns[axis[3]["column"]]

    if styles["type"] == "2d":
        return Plotter.get_plotdiv_xy(x_values, y_values,
                                      x_error_values, y_error_values,
                                      styles["labels"][0], styles["labels"][1])

    elif styles["type"] == "3d":

        if len(styles["labels"]) < 3:
            return "Wrong number of labels specified on styles";

        if len(axis) < 3:
            return "Wrong number of axis";

        z_values = filtered_dataset.tables[axis[4]["table"]].columns[axis[4]["column"]]
        #z_error_values = filtered_dataset.tables[axis[5]["table"]].columns[axis[5]["column"]]
        colorArray = np.random.uniform(-5, 5, size=len(x_values))
        error = np.random.uniform(-8,8 , size=len(x_values))

        return Plotter.get_plotdiv_xyz(x_values, y_values, z_values,
                                        x_error_values, y_error_values, error, #z_error_values
                                        styles["labels"][0], styles["labels"][1],
                                        colorArray)

    elif styles["type"] == "scatter":

        newAmplitude = np.random.uniform(-5, 5, size=len(x_values))

        return Plotter.get_plotdiv_scatter( x_values, y_values, newAmplitude,
                                            styles["labels"][0], styles["labels"][1])

    else:
        return "Wrong plot type specified on styles";


# get_plotdivs: Generate a DIVs with
# the plot inside with a given file destination
#
# @param: destination: file destination
#
def get_plotdivs(destination,
    start_time=None, end_time=None,
    start_count=None, end_count=None,
    start_color1=None, end_color1=None,
    start_color2=None, end_color2=None):

    schema = DaveReader.get_file_dataset(destination)

    newTime=[]
    newRate=[]
    newError_time=[]
    newError_rate=[]
    newcolor1=[];
    newcolor2=[];
    newError_color1=[];
    newError_color2=[];

    if (not start_time) and (not end_time):
          start_time_float = min(schema["Time"])
          end_time_float = max(schema["Time"])
    else:
          start_time_float=float(start_time)
          end_time_float=float(end_time)

    if (not start_count) and (not end_count):
          start_count_float = min(schema["Rate"])
          end_count_float = max(schema["Rate"])
    else:
          start_count_float=float(start_count)
          end_count_float=float(end_count)

    if (not start_color1) and (not end_color1):
          start_color1_float = min(schema["color1"])
          end_color1_float = max(schema["color1"])
    else:
          start_color1_float=float(start_color1)
          end_color1_float=float(end_color1)

    if (not start_color2) and (not end_color2):
          start_color2_float = min(schema["color2"])
          end_color2_float = max(schema["color2"])
    else:
          start_color2_float=float(start_color2)
          end_color2_float=float(end_color2)

    for i in range(len(schema["Time"])):
          if ((schema["Time"][i] >= (start_time_float) and schema["Time"][i] <= (end_time_float))
          and (schema["Rate"][i] >= (start_count_float) and schema["Rate"][i] <= (end_count_float))
          and (schema["color1"][i] >= (start_color1_float) and schema["color1"][i] <= (end_color1_float))
          and (schema["color2"][i] >= (start_color2_float) and schema["color2"][i] <= (end_color2_float)) ):

            newTime.append(schema["Time"][i])
            newRate.append(schema["Rate"][i])
            newError_time.append(schema["Error_time"][i])
            newError_rate.append(schema["Error_rate"][i])
            newcolor1.append(schema["color1"][i])
            newcolor2.append(schema["color2"][i])
            newError_color1.append(schema["Error_color1"][i])
            newError_color2.append(schema["Error_color2"][i])


    newAmplitude = np.random.uniform(-5, 5, size=len(newTime))
    #index -> newAmplitude = np.random.uniform(-1, 1, size=len(newTime))

    error = np.random.uniform(-8,8 , size=len(schema["Time"]))

    fig={}
    fig["plot1"] = Plotter.get_plotdiv_xy(newTime, newRate, newError_time, newError_rate, 'Time', 'Count Rate')
    fig["plot2"] = Plotter.get_plotdiv_xy(newcolor1, newcolor2, newError_color1, newError_color2, 'Color1', 'Color2')
    fig["plot3"] = Plotter.get_plotdiv_xyz(newTime, newRate, newAmplitude, newError_time, newError_rate, error, "Dynamic Spectrum", "Amplitude<br>Map", newAmplitude)
    fig["plot4"] = Plotter.get_plotdiv_scatter(newTime, newRate, newAmplitude, 'Time', 'Frequency')

    fig["start_time_int"] = min(schema["Time"])
    fig["end_time_int"] = max(schema["Time"]) +1
    fig["start_count_int"] = min(schema["Rate"])
    fig["end_count_int"] = max(schema["Rate"]) +1
    fig["start_color1_int"] = min(schema["color1"])
    fig["end_color1_int"] = max(schema["color1"]) +1
    fig["start_color2_int"] = min(schema["color2"])
    fig["end_color2_int"] = max(schema["color2"]) +1

    return fig
