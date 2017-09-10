from astropy.io import fits
import numpy as np

fits_file = '../std1_ao9_01_09.lc'
hdulist = fits.open(fits_file)
tbdata = hdulist['RATE'].data
tbdata['RATE'] = 20
hdulist.writeto('../src20.lc')
