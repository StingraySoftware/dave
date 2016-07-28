import util

import index
import json
import logging
import unittest
import tempfile

from werkzeug.datastructures import FileStorage
def generate_figure_data_json():
        datadir = util.TEST_ROOT + '../resources/lightcurves/'
        filename = 'std1_ao9_01_01.lc'
        with open( datadir+filename, 'rb') as fp:
            storage = FileStorage(fp)
            figure_data = index.upload_file(storage)

            dump = json.dumps(figure_data, separators=(',', ':'), sort_keys=True, indent=4, cls=util.NumpyEncoder)
            f = open("./figure_data_fits.json","w")
            f.write(dump)

class UploadFileTest(unittest.TestCase):

    datadir = util.TEST_ROOT + '../resources/lightcurves/'

    # Test the file Input1.txt which is txt format and has errors in x
    def test_txt_x_errors(self):

        filename = 'Input1.txt'
        with open(self.datadir + filename, 'rb') as fp:
            storage = FileStorage(fp)
            figure_data = index.upload_file(storage)
            file_path = "figure_data.json"

            # Use this to write a new JSON file:
            #with open(file_path, 'w', encoding='utf-8') as dump_file:
            #    dump_file = json.dump(figure_data, dump_file, separators=(',', ':'), sort_keys=True, indent=4, cls=util.NumpyEncoder)

            # Create new JSON string from current data
            dump = json.dumps(figure_data, separators=(',', ':'), sort_keys=True, indent=4, cls=util.NumpyEncoder)

            # Read the reference JSON data
            with open(file_path, 'r', encoding='utf-8') as jsonfile:
                expected = jsonfile.read()

            # print the figure_data in 100 char lines
            #step = 100
            #for x in range(len(figure_data)//step):
            #    logging.info(figure_data[x*step:(x+1)*step])
            #logging.info(figure_data[step*(len(figure_data)//step):])
           # generate_figure_data_json();
            self.assertEquals(dump, expected)
    


    def test_fits_x_errors(self):

        filename = 'std1_ao9_01_01.lc'
        with open(self.datadir + filename, 'rb') as fp:
            storage = FileStorage(fp)
            figure_data = index.upload_file(storage)
            file_path = "figure_data_fits.json"

            # Use this to write a new JSON file:
            #with open(file_path, 'w', encoding='utf-8') as dump_file:
            #    dump_file = json.dump(figure_data, dump_file, separators=(',', ':'), sort_keys=True, indent=4, cls=util.NumpyEncoder)

            # Create new JSON string from current data
            dump_fits = json.dumps(figure_data, separators=(',', ':'), sort_keys=True, indent=4, cls=util.NumpyEncoder)

            # Read the reference JSON data
            with open(file_path, 'r', encoding='utf-8') as jsonfile:
                expected_fits = jsonfile.read()

            # print the figure_data in 100 char lines
            #step = 100
            #for x in range(len(figure_data)//step):
            #    logging.info(figure_data[x*step:(x+1)*step])
            #logging.info(figure_data[step*(len(figure_data)//step):])

            self.assertEquals(dump_fits, expected_fits)


    


unittest.main()
