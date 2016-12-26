from flask import session
from flask import Markup

import json
import logging
import urllib

import utils.file_utils as FileUtils
import utils.dave_engine as DaveEngine


#UPLOADS THE FILE AND STORES IT ON SESSION
def upload_and_store_file(file, target):
    if not file.filename:
        return common_error("No sent file")

    if not FileUtils.is_valid_file(file.filename):
        return common_error("File extension is not supported...")

    destination = FileUtils.save_file (file, target)

    if not destination:
        return common_error("Error uploading file...")

    logging.debug("Uploaded filename: %s" % destination)
    session['uploaded_filename'] = file.filename

    return json.dumps( dict( filename = file.filename ) )


def get_dataset_schema (filename, target):
    if not filename:
        return common_error(error = "No filename setted" )

    if not session['uploaded_filename'] or session['uploaded_filename'] != filename:
        return common_error("Filename not uploaded" )

    destination = FileUtils.get_destination(target, filename)
    if not destination:
        return common_error("Error opening file")

    schema = DaveEngine.get_dataset_schema(destination)
    return json.dumps( schema )

def common_error (error):
    return json.dumps( dict( error = error ) )


def get_plot_html (filename, target, filters, styles, axis):
    if not filename:
        return "No filename setted"

    if not session['uploaded_filename'] or session['uploaded_filename'] != filename:
        return "Filename not uploaded"

    destination = FileUtils.get_destination(target, filename)
    if not destination:
        return "Error opening file"

    plot_html = DaveEngine.get_plot_html(destination,
                                        json.loads(urllib.parse.unquote(filters)),
                                        json.loads(urllib.parse.unquote(styles)),
                                        json.loads(urllib.parse.unquote(axis)))

    return Markup(plot_html)


def get_file_dataset_shema (file):
    start_time = request.form['from_time']
    end_time = request.form['to_time']
    start_count = request.form['from_count']
    end_count = request.form['to_count']

    start_color1 = request.form['from_color1']
    end_color1 = request.form['to_color1']
    start_color2 = request.form['from_color2']
    end_color2 = request.form['to_color2']

    destination = FileUtils.get_destination(target, filename)

    fig = DaveEngine.get_plotdivs(destination,
        start_time, end_time,
        start_count, end_count,
        start_color1, end_color1,
        start_color2, end_color2)

    return render_template('master_page.html',
        div_placeholder_fig1 = Markup(fig["plot1"]),
        div_placeholder_fig2 = Markup(fig["plot2"]),
        div_placeholder_fig3 = Markup(fig["plot3"]),
        div_placeholder_fig4 = Markup(fig["plot4"]),
        filename = json.dumps(filename),
        start_time_slider = json.dumps(int(fig["start_time_int"])),
        end_time_slider = json.dumps(int(fig["end_time_int"])),
        start_count_slider = json.dumps(int(fig["start_count_int"])),
        end_count_slider = json.dumps(int(fig["end_count_int"])),
        start_color1_slider = json.dumps(int(fig["start_color1_int"])),
        end_color1_slider = json.dumps(int(fig["end_color1_int"])),
        start_color2_slider = json.dumps(int(fig["start_color2_int"])),
        end_color2_slider = json.dumps(int(fig["end_color2_int"])),
    )
