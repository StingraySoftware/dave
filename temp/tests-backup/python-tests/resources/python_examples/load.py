import pandas as pd
import numpy as np
import pkg_resources

light_curve = pkg_resources.resource_stream(__name__,"datasets/Input1.txt")
data = np.loadtxt(light_curve)
Time = data[0:len(data),0]
Rate = data[0:len(data),1]
Error_y= data[0:len(data),2]
Error_x= data[0:len(data),3]

start_time=10
end_time=50
start_count=3600
end_count=3700
if (not start_time) and (not end_time):
  start_time = max(Time)
  end_time = min(Time)

if (not start_count) and (not end_count):
  start_rate = max(Rate)
  end_rate = min(Rate)
newTime=[]
newRate=[]
newError_y=[]
newError_x=[]

for i in range(len(Time)):
  if (Time[i] <= int(start_time) or Time[i] >= int(end_time)) and (Rate[i] <= int(start_count) or Rate[i] >= int(end_count)) :
    newTime.append(Time[i])
    newRate.append(Rate[i])
    newError_y.append(Error_y[i])
    newError_x.append(Error_x[i])

print(newRate)


