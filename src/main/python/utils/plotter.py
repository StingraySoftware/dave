import numpy as np

def get_plotdiv_xy(dataset, axis):
    data = []
    for i in range(len(axis)):
        column = dataset.tables[axis[i]["table"]].columns[axis[i]["column"]]
        column_data = dict()
        column_data["values"] = column.values.tolist()
        column_data["error_values"] = column.error_values.tolist()
        data = np.append(data, [column_data])

    return data.tolist()


def get_plotdiv_xyz(dataset, axis):
    data = []
    for i in range(len(axis)):
        column = dataset.tables[axis[i]["table"]].columns[axis[i]["column"]]
        column_data = dict()
        column_data["values"] = column.values.tolist()
        column_data["error_values"] = column.error_values.tolist()
        data = np.append(data, [column_data])

    color_array = np.random.uniform(-5, 5, size=len(data[0]["values"]))
    color_data = dict()
    color_data["values"] = color_array.tolist()
    data = np.append(data, [color_data])

    ramdom_values = np.random.uniform(-8, 8, size=len(data[0]["values"]))
    data[2]["error_values"] = ramdom_values.tolist()

    return data.tolist()


def get_plotdiv_scatter(dataset, axis):
    data = []
    for i in range(len(axis)):
        column = dataset.tables[axis[i]["table"]].columns[axis[i]["column"]]
        column_data = dict()
        column_data["values"] = column.values.tolist()
        column_data["error_values"] = column.error_values.tolist()
        data = np.append(data, [column_data])

    amplitude_array = np.random.uniform(-5, 5, size=len(data[0]["values"]))
    amplitude_data = dict()
    amplitude_data["values"] = amplitude_array.tolist()
    data = np.append(data, [amplitude_data])

    return data.tolist()
