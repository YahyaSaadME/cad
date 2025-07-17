import cv2
import mediapipe as mp
import pyautogui
import math
import time

# Initialize MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.7)
mp_draw = mp.solutions.drawing_utils

# Set screen size
screen_w, screen_h = pyautogui.size()

# Initialize smoothing variables
prev_x, prev_y = 0, 0
smoothening = 0.2  # lower = smoother

# Delay handling
left_clicked = False
right_clicked = False

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w, c = frame.shape

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)

    if results.multi_hand_landmarks:
        hand_landmarks = results.multi_hand_landmarks[0]
        lm = hand_landmarks.landmark

        # Index finger tip
        index = lm[8]
        x = int(index.x * w)
        y = int(index.y * h)

        screen_x = int(index.x * screen_w)
        screen_y = int(index.y * screen_h)

        # Smooth movement using interpolation
        curr_x = prev_x + (screen_x - prev_x) * smoothening
        curr_y = prev_y + (screen_y - prev_y) * smoothening
        pyautogui.moveTo(curr_x, curr_y)
        prev_x, prev_y = curr_x, curr_y

        # Draw index finger
        cv2.circle(frame, (x, y), 10, (255, 0, 0), -1)

        # Thumb tip
        thumb = lm[4]
        thumb_x = int(thumb.x * w)
        thumb_y = int(thumb.y * h)

        # Middle finger tip
        middle = lm[12]
        middle_x = int(middle.x * w)
        middle_y = int(middle.y * h)

        # Calculate distances
        dist_thumb = math.hypot(thumb_x - x, thumb_y - y)
        dist_middle = math.hypot(middle_x - x, middle_y - y)

        # Left Click: Index & Thumb
        if dist_thumb < 40:
            if not left_clicked:
                pyautogui.click(button='left')
                left_clicked = True
                cv2.putText(frame, 'Left Click', (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)
        else:
            left_clicked = False

        # Right Click: Index & Middle
        if dist_middle < 40:
            if not right_clicked:
                pyautogui.click(button='right')
                right_clicked = True
                cv2.putText(frame, 'Right Click', (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
        else:
            right_clicked = False

        # Draw connections
        mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

    cv2.imshow("Virtual Mouse", frame)
    if cv2.waitKey(1) == 27:  # ESC to exit
        break

cap.release()
cv2.destroyAllWindows()
