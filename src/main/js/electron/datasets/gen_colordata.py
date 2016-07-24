import numpy as np
from math import sin,pi

filedata = np.loadtxt('Input_withcolor.txt')

npoints = 58
def gencolor1(x): return 1300 - x*500/npoints
def gencolor2(x): return 2800 - 500 * sin(x*pi/float(npoints))
    
newdata = [ [row[0],row[3],row[1],row[2],gencolor2(row[0]), 0,gencolor1(row[0]), 0] for row in filedata ]

np.savetxt('Input_funnycolor.txt', newdata, fmt="%.3f")