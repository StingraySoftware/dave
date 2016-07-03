from  tkinter import *
from tkinter import filedialog

from tkinter.filedialog import askopenfilename
root = Tk()
root.filename =  filedialog.askopenfilename(title = "choose your file",filetypes = (("jpeg files","*.jpg"),("all files","*.*")))
print (root.filename)
root.withdraw()