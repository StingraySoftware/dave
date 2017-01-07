from astropy.io import fits
hdulist = fits.open('std1_ao9_01_01.lc')
tbdata = hdulist[1].data
print(tbdata.field(0))
print(tbdata.field(1))
print(tbdata.field(2))
print(tbdata.field(3))

