import RPi.GPIO as GPIO
from gpiozero import DigitalOutputDevice
from picamera2 import Picamera2
import cv2
import numpy as np
import time
import requests
import json

# ================= BACKEND =================
SERVER = "https://campus-delivery-bot.onrender.com"

active_order_id = None
active_token = None
last_fetch_time = 0
FETCH_INTERVAL = 3

# ================= MOTOR =================
left_in1 = DigitalOutputDevice(17)
left_in2 = DigitalOutputDevice(27)

right_in1 = DigitalOutputDevice(22)
right_in2 = DigitalOutputDevice(23)

def stop():
    left_in1.off()
    left_in2.off()
    right_in1.off()
    right_in2.off()

def forward():
    left_in1.on()
    left_in2.off()
    right_in1.on()
    right_in2.off()

def forward_slow():
    forward()
    time.sleep(0.06)
    stop()
    time.sleep(0.1)

def left():
    left_in1.off()
    left_in2.on()
    right_in1.on()
    right_in2.off()

def right():
    left_in1.on()
    left_in2.off()
    right_in1.off()
    right_in2.on()

def rotate_180():
    print("🔄 Rotating 180°")
    left_in1.on()
    left_in2.off()
    right_in1.off()
    right_in2.on()
    time.sleep(1.2)  # tune this
    stop()

# ================= SERVO =================
SERVO_PIN = 19

GPIO.setmode(GPIO.BCM)
GPIO.setup(SERVO_PIN, GPIO.OUT)

servo = GPIO.PWM(SERVO_PIN, 50)
servo.start(0)

def unlock():
    print("🔓 Unlocking box")
    servo.ChangeDutyCycle(7)
    time.sleep(1)
    servo.ChangeDutyCycle(0)

def lock():
    print("🔒 Locking box")
    servo.ChangeDutyCycle(2)
    time.sleep(1)
    servo.ChangeDutyCycle(0)

# ================= ULTRASONIC =================
TRIG = 20
ECHO = 21

GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)

def get_distance():
    GPIO.output(TRIG, False)
    time.sleep(0.01)

    GPIO.output(TRIG, True)
    time.sleep(0.00001)
    GPIO.output(TRIG, False)

    pulse_start = time.time()
    pulse_end = time.time()

    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()

    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()

    duration = pulse_end - pulse_start
    distance = duration * 17150
    return round(distance, 2)

# ================= CAMERA =================
picam2 = Picamera2()
picam2.configure(
    picam2.create_preview_configuration(
        main={"format": "RGB888", "size": (1280, 720)}
    )
)
picam2.start()
time.sleep(2)

qr_detector = cv2.QRCodeDetector()
last_qr = ""

# ================= FETCH ORDER =================
def fetch_active_order():
    global active_order_id, active_token

    try:
        res = requests.get(f"{SERVER}/active-order", timeout=2)

        if res.status_code == 200:
            data = res.json()
            active_order_id = data["id"]
            active_token = data["token"]
            print(f"📦 Active Order: {active_order_id}, Token: {active_token}")
        else:
            active_order_id = None
            active_token = None

    except Exception as e:
        print("⚠️ Server error:", e)

# ================= LINE FOLLOW =================
def follow_line(frame):
    roi = frame[480:720, :]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    lower_black = np.array([0, 0, 20])
    upper_black = np.array([179, 255, 100])
    mask = cv2.inRange(hsv, lower_black, upper_black)

    h, w = mask.shape
    left_pixels = cv2.countNonZero(mask[:, :w//2])
    right_pixels = cv2.countNonZero(mask[:, w//2:])

    if left_pixels > 300 and right_pixels > 300:
        forward_slow()

    elif left_pixels > right_pixels:
        print("⬅️ LEFT")
        left()
        time.sleep(0.05)

    elif right_pixels > left_pixels:
        print("➡️ RIGHT")
        right()
        time.sleep(0.05)

    else:
        stop()

# ================= RETURN TO SOURCE =================
def return_to_source():
    print("🏠 Returning to source...")
    start_time = time.time()

    while time.time() - start_time < 10:  # adjust duration
        frame = picam2.capture_array()
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        frame = cv2.resize(frame, (960, 720))

        distance = get_distance()

        if distance < 15:
            print("🚧 Obstacle while returning")
            stop()
            continue

        follow_line(frame)

    stop()
    print("🏁 Reached source")

# ================= MAIN LOOP =================
try:
    while True:

        # 🔁 Poll backend
        if time.time() - last_fetch_time > FETCH_INTERVAL:
            fetch_active_order()
            last_fetch_time = time.time()

        frame = picam2.capture_array()
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        frame = cv2.resize(frame, (960, 720))

        # ================= OBSTACLE =================
        if active_order_id is not None:
            distance = get_distance()
            if distance < 15:
                print("🚧 Obstacle detected!")
                stop()
                continue

            follow_line(frame)
        else:
            stop()

        # ================= QR DETECTION =================
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        data, bbox, _ = qr_detector.detectAndDecode(gray)

        if data and data != last_qr:
            print("\n📷 QR DETECTED:")
            print(data)

            stop()

            try:
                qr_data = json.loads(data)

                qr_order = qr_data.get("order_id")
                qr_token = qr_data.get("token")

                print("QR Order:", qr_order)
                print("QR Token:", qr_token)

                if qr_order == active_order_id and qr_token == active_token:
                    print("✅ VERIFIED → OPENING BOX")

                    unlock()
                    time.sleep(5)
                    lock()

                    # 🔥 UPDATE BACKEND
                    try:
                        requests.post(
                            f"{SERVER}/verify",
                            json={
                                "order_id": active_order_id,
                                "token": active_token
                            },
                            timeout=2
                        )
                    except:
                        print("⚠️ Backend update failed")

                    print("📦 Delivery Complete")

                    # 🔄 RETURN
                    rotate_180()
                    return_to_source()

                    active_order_id = None
                    active_token = None

                else:
                    print("❌ INVALID USER")

            except Exception as e:
                print("⚠️ Invalid QR:", e)

            last_qr = data
            time.sleep(3)

        # ================= DISPLAY =================
        if bbox is not None:
            for i in range(len(bbox)):
                pt1 = tuple(map(int, bbox[i][0]))
                pt2 = tuple(map(int, bbox[(i+1) % len(bbox)][0]))
                cv2.line(frame, pt1, pt2, (0,255,0), 2)

        cv2.imshow("Bot Vision", frame)

        if cv2.waitKey(1) == ord('q'):
            break

except KeyboardInterrupt:
    print("Stopped")

finally:
    stop()
    servo.stop()
    GPIO.cleanup()
    cv2.destroyAllWindows()