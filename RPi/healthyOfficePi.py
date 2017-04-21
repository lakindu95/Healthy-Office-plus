import time
import datetime
import imp
import json
import paho.mqtt.client as paho

try:
    imp.find_module('RPi')
    import RPi.GPIO as GPIO  # imports module as local name GPIO

    RPi = True
except ImportError:
    RPi = False
    DEBUG_PULSE_START = 0
    DEBUG_PULSE_END = 25

if RPi:
    print("Running code in PROD mode in RPi")
else:
    print("Running code in DEBUG mode in computer")

# MQTT setup
MQTT_CHANNEL = "healthyoffice/rpi"
client = paho.Client()
client.connect("iot.eclipse.org", 1883, 60)

# Object declaration for getting current date and time
current = datetime.datetime.now()

# Alert
Rasptrigger = 21

# Limitation defined according to the distance
threshold = 24

# Ultrasonic sensor 1
TRIG1 = 23
ECHO1 = 24

# Ultrasonic sensor 2
TRIG2 = 4
ECHO2 = 5

if RPi:
    GPIO.setmode(GPIO.BCM)  # Setting BCM Pin numbering scheme

    # Setting Pin Mode
    # Sensor 1 setup
    GPIO.setup(TRIG1, GPIO.OUT)
    GPIO.setup(ECHO1, GPIO.IN)

    # Sensor 2 setup
    GPIO.setup(TRIG2, GPIO.OUT)
    GPIO.setup(ECHO2, GPIO.IN)
    GPIO.setup(Rasptrigger, GPIO.OUT)
else:
    print("GPIO not configured")

# Global variable declaration for sonar function
pulse_start = 0
pulse_end = 0


# Function to fetch precise distance of obstacle
def sonar(trigger, echo):
    global pulse_start, pulse_end

    if RPi:
        # Small pulse transmitter from trigger
        GPIO.output(trigger, False)
        time.sleep(1)
        GPIO.output(trigger, True)
        time.sleep(1)
        GPIO.output(trigger, False)

        # Small pulse receiver on echo pin
        while GPIO.input(echo) == 0:
            pulse_start = time.time()
        while GPIO.input(echo) == 1:
            pulse_end = time.time()
    else:
        pulse_start = time.time() + DEBUG_PULSE_START
        pulse_end = time.time() + DEBUG_PULSE_END

    # Difference between transmission and reception of pulse
    pulse_duration = pulse_end - pulse_start
    # Formulate time into distance
    distance = pulse_duration * 171500
    # Round the distance into readable format in cm
    distance = round(distance, 2)

    return distance


try:
    while True:
        timerEnd = time.time() + 60 * 20  # will run for current time + 1200 seconds
        isBreakTaken = False
        while time.time() < timerEnd:
            distance1 = sonar(TRIG1, ECHO1)
            distance2 = sonar(TRIG2, ECHO2)
            # data = {"distance1": distance1, "distance2": distance2}
            if (distance1 > threshold) and (distance2 > threshold):
                isBreakTaken = True
                break_start = time.time() # timer to calculate how long the break lasted
                print("You just moved from your seat!")
                while (distance1 > threshold) or (distance2 > threshold):
                    time.sleep(3)
                break_end = time.time()
                break_period = break_end - break_start
                data = "You took a break for: " + str(datetime.timedelta(seconds=break_period))
                print(data)
            else :
                time.sleep(1)
        if isBreakTaken != True:
            data = "You Need a Break!"
            print(data)
        payload = json.dumps(data)
        client.publish(MQTT_CHANNEL, payload)

except BaseException as e:
    # Print on getting ctrl+c command for safe termination of program
    print(e)

finally:
    # Safe termination and clear the state of GPIO
    client.disconnect()
    if RPi:
        GPIO.cleanup()
