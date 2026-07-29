"""Tests for utils.plotter.

plotter converts DAVE datasets into the array-of-{values, error_values}
structures the GUI plots, and renders matplotlib figures to inline HTML.
"""

from matplotlib.figure import Figure

import utils.dave_reader as DaveReader
import utils.file_utils as FileUtils
import utils.plotter as Plotter
from test.fixture import TEST_RESOURCES


def _txt_dataset():
    destination = FileUtils.get_destination(TEST_RESOURCES, "Test_Input_1.txt")
    return DaveReader.get_txt_dataset(
        destination, "EVENTS", ["TIME", "PHA", "Color1", "Color2"]
    )


def _axis(*columns, table="EVENTS"):
    return [{"table": table, "column": column} for column in columns]


NUM_ROWS = 10  # Test_Input_1.txt has 10 data rows


def test_get_axis_with_gtis_appends_gti_columns_for_time_axis():
    """A TIME axis on EVENTS implies the GTI START/STOP columns for plotting."""
    axis = Plotter.get_axis_with_gtis(_axis("TIME", "PHA"))
    assert len(axis) == 4
    assert axis[2] == {"table": "GTI", "column": "START"}
    assert axis[3] == {"table": "GTI", "column": "STOP"}


def test_get_axis_with_gtis_keeps_non_time_axis_unchanged():
    """Axes without a TIME column are passed through untouched."""
    axis = Plotter.get_axis_with_gtis(_axis("PHA", "Color1"))
    assert len(axis) == 2


def test_build_data_list_extracts_values_and_errors_per_axis():
    """Each axis entry yields the column's values and error_values."""
    dataset = _txt_dataset()
    data = Plotter.build_data_list(dataset, _axis("PHA", "Color1"))
    assert len(data) == 2
    assert len(data[0]["values"]) == NUM_ROWS
    assert len(data[0]["error_values"]) == NUM_ROWS
    assert list(data[0]["values"]) == list(dataset.tables["EVENTS"].columns["PHA"].values)


def test_build_data_list_skips_unknown_table_and_column():
    """Unknown tables/columns are logged and skipped, not fabricated."""
    dataset = _txt_dataset()
    axis = _axis("PHA") + [
        {"table": "NOPE", "column": "PHA"},
        {"table": "EVENTS", "column": "MISSING"},
    ]
    data = Plotter.build_data_list(dataset, axis)
    assert len(data) == 1


def test_get_plotdiv_xy_returns_axis_data_with_gtis():
    """2D plot data: TIME+PHA axis plus the implied GTI START/STOP entries."""
    data = Plotter.get_plotdiv_xy(_txt_dataset(), _axis("TIME", "PHA"))
    assert len(data) == 4
    assert len(data[0]["values"]) == NUM_ROWS


def test_get_plotdiv_xyz_appends_random_color_channel():
    """3D plot data appends a color channel sized like the first axis and
    random error bars on the third entry."""
    data = Plotter.get_plotdiv_xyz(_txt_dataset(), _axis("PHA", "Color1"))
    assert len(data) == 3
    assert len(data[2]["values"]) == NUM_ROWS
    assert all(-5 <= value <= 5 for value in data[2]["values"])
    assert len(data[2]["error_values"]) == NUM_ROWS
    assert all(-8 <= value <= 8 for value in data[2]["error_values"])


def test_get_plotdiv_scatter_appends_amplitude_channel():
    """Scatter plot data appends one amplitude channel in the [-5, 5] range."""
    data = Plotter.get_plotdiv_scatter(_txt_dataset(), _axis("PHA", "Color1"))
    assert len(data) == 3
    assert len(data[2]["values"]) == NUM_ROWS
    assert all(-5 <= value <= 5 for value in data[2]["values"])


def test_convert_fig_to_html_embeds_png_as_base64_img_tag():
    """A real matplotlib figure is rendered to an inline base64 <img> tag."""
    fig = Figure()
    axes = fig.add_subplot()
    axes.plot([0, 1, 2], [1, 4, 9])
    html = Plotter.convert_fig_to_html(fig)
    assert html.startswith('<img src="data:image/png;base64,')
    assert html.endswith('">')
    assert len(html) > 100  # an actual PNG payload, not an empty string
