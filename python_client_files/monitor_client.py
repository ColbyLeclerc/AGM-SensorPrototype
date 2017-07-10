import requests
import serial
import sys

'''
Raw DHT22 sensor
ser = serial.Serial('/dev/ttyACMO',9600)
'''
ser = serial.Serial('/dev/ttyACM0', 9600)
s = [0,1]

while True:
	read_serial=ser.readline()
	s[0] = str((ser.readline(),16))
	print s[0]
	print read_serial
	try:
	    if len(read_serial) > 0:
	        r = requests.post("http://192.168.1.2:3000/api/readings", data={'temperature': read_serial.split('|')[0], 'humidity': read_serial.split('|')[1], 'temperature_unit': 'fahrenheit', 'humidity_unit': 'percent'})
	except:
	    e = sys.exc_info()[0]
	    print 