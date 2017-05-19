
import sys
import inspect

def print_full_stack():
    print ('Traceback (most recent call last):')
    for item in reversed(inspect.stack()[2:]):
        print (' File "{1}", line {2}, in {3}\n'.format(*item)),
    for line in item[4]:
        print (' ' + line.lstrip()),
    for item in inspect.trace():
        print (' File "{1}", line {2}, in {3}\n'.format(*item)),
    for line in item[4]:
        print (' ' + line.lstrip()),

def getException(method_name):
    exc_type, exc_obj, tb = sys.exc_info()
    f = tb.tb_frame
    lineno = tb.tb_lineno
    filename = f.f_code.co_filename

    print ('EXCEPTION {} IN ({}, LINE {}): {}'.format(method_name, filename, lineno, exc_obj))
    print_full_stack()

    return 'EXCEPTION {} IN ({}, LINE {}): {}'.format(method_name, filename, lineno, exc_obj)

def getWarnMsg():
    return str(sys.exc_info()[1])
