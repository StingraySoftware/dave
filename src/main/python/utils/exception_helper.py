
import sys

def getException(method_name):
    exc_type, exc_obj, tb = sys.exc_info()
    f = tb.tb_frame
    lineno = tb.tb_lineno
    filename = f.f_code.co_filename
    #print ('EXCEPTION {} IN ({}, LINE {}): {}'.format(method_name, filename, lineno, exc_obj))
    return 'EXCEPTION {} IN ({}, LINE {}): {}'.format(method_name, filename, lineno, exc_obj)

def getWarnMsg():
    return str(sys.exc_info()[1])
