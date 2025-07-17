import cv2
import mediapipe as mp
import pyautogui
import math

# Initialize MediaPipe
mp_drawing = mp.solutions.drawing_utils
mp_hands = mp.solutions.hands

# Set screen size
screen_width, screen_height = pyautogui.size()

# Start webcam
cap = cv2.VideoCapture(0)

# Use MediaPipe Hands
with mp_hands.Hands(min_detection_confidence=0.7, min_tracking_confidence=0.7) as hands:
    while cap.isOpened():
        success, image = cap.read()
        if not success:
            continue

        # Flip image for mirror effect and convert color
        image = cv2.flip(image, 1)
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Process with MediaPipe
        results = hands.process(img_rgb)

        # Get hand landmarks
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:

                # Get landmark positions
                landmarks = hand_landmarks.landmark

                # Get index finger tip (8)
                index_tip = landmarks[8]
                index_x = int(index_tip.x * image.shape[1])
                index_y = int(index_tip.y * image.shape[0])

                # Map to screen coordinates
                screen_x = int(index_tip.x * screen_width)
                screen_y = int(index_tip.y * screen_height)
                pyautogui.moveTo(screen_x, screen_y)

                # Draw index tip
                cv2.circle(image, (index_x, index_y), 10, (255, 0, 0), -1)

                # Distance between index (8) and thumb (4)
                thumb_tip = landmarks[4]
                thumb_x = int(thumb_tip.x * image.shape[1])
                thumb_y = int(thumb_tip.y * image.shape[0])
                thumb_dist = math.hypot(index_x - thumb_x, index_y - thumb_y)

                # Distance between index (8) and middle (12)
                middle_tip = landmarks[12]
                middle_x = int(middle_tip.x * image.shape[1])
                middle_y = int(middle_tip.y * image.shape[0])
                middle_dist = math.hypot(index_x - middle_x, index_y - middle_y)

                # Left click if thumb and index are close
                if thumb_dist < 40:
                    pyautogui.click(button='left')
                    cv2.putText(image, 'Left Click', (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)

                # Right click if index and middle are close
                elif middle_dist < 40:
                    pyautogui.click(button='right')
                    cv2.putText(image, 'Right Click', (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)

        # Show webcam output
        cv2.imshow('Virtual Mouse', image)
        if cv2.waitKey(5) & 0xFF == 27:
            break

cap.release()
cv2.destroyAllWindows()
