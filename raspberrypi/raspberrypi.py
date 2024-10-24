from gpiozero import DistanceSensor, PWMOutputDevice
from time import sleep, time
import requests

DISTANCE_THRESHOLD = 10
RFID_TIMEOUT = 30
ALIVE_TIMEOUT = 30

TRIG_PIN = 23
ECHO_PIN = 24
BUZZER_PIN = 18

sensor = DistanceSensor(echo=ECHO_PIN, trigger=TRIG_PIN)
buzzer = PWMOutputDevice(BUZZER_PIN)

last_alive_signal_time = time()

def success_tone():
    play_tone(523, 0.2) # C5
    sleep(0.25)
    play_tone(659, 0.2) # E5
    sleep(0.25)
    play_tone(784, 0.3) # G5
    sleep(0.3)

def failure_tone():
    play_tone(784, 0.15) # G5
    sleep(0.05)
    play_tone(659, 0.15) # E5
    sleep(0.05)
    play_tone(523, 0.3) # C5
    sleep(0.1)

def play_tone(frequency, duration):
    buzzer.frequency = frequency
    buzzer.value = 0.5  # 50% duty cycle
    sleep(duration)
    buzzer.off()

def http_request(endpoint):
    try:
        url = f"http://localhost:3000/{endpoint}?user=user&pass=pass"
        response = requests.get(url)

        if response.status_code == 200:
            print(f"{endpoint} finished")
        else:
            print(f"Failed to send {endpoint} request. Status code: {response.status_code}")

    except Exception as e:
        print(f"Error sending {endpoint} request: {e}")

def get_distance():
    return sensor.distance * 100  # convert to cm

http_request("alive")
success_tone()

try:
    while True:
        current_time = time()
        if current_time - last_alive_signal_time > ALIVE_TIMEOUT:
            http_request("alive")
            last_alive_signal_time = current_time

        distance = get_distance()
        print(f"Distance: {distance:.2f} cm")

        if distance > DISTANCE_THRESHOLD:
            failure_tone()
            http_request("alert")
            print("Alert triggered!")

            while get_distance() > DISTANCE_THRESHOLD:
                print("Waiting for door to get closed")
                sleep(1)

        sleep(0.1)

except KeyboardInterrupt:
    print("Program terminated by user")
    buzzer.off()
