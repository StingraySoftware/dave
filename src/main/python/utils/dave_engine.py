
import os
import logging

import numpy as np

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

    logging.debug("get_plot_html apply_filters: %d" % len(dataset.tables[axis[0]["table"]].columns[axis[0]["column"]].values))

    filtered_dataset = dataset.apply_filters(filters)

    logging.debug("get_plot_html res apply_filters: %d" % len(filtered_dataset.tables[axis[0]["table"]].columns[axis[0]["column"]].values))

    if not "type" in styles:
        return "No plot type specified on styles";

    if not "labels" in styles:
        return "No plot labels specified on styles";

    if len(styles["labels"]) < 2:
        return "Wrong number of labels specified on styles";

    if len(axis) < 2:
        return "Wrong number of axis";


    x_values = filtered_dataset.tables[axis[0]["table"]].columns[axis[0]["column"]].values
    y_values = filtered_dataset.tables[axis[1]["table"]].columns[axis[1]["column"]].values
    x_error_values = filtered_dataset.tables[axis[2]["table"]].columns[axis[2]["column"]].values
    y_error_values = filtered_dataset.tables[axis[3]["table"]].columns[axis[3]["column"]].values

    if styles["type"] == "2d":
        return Plotter.get_plotdiv_xy(x_values, y_values,
                                      x_error_values, y_error_values,
                                      styles["labels"][0], styles["labels"][1])

    elif styles["type"] == "3d":

        if len(styles["labels"]) < 3:
            return "Wrong number of labels specified on styles";

        if len(axis) < 3:
            return "Wrong number of axis";

        z_values = filtered_dataset.tables[axis[4]["table"]].columns[axis[4]["column"]].values
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
