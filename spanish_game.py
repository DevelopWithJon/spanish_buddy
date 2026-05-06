# Spanish Pronunciation & Memorization Trainer
# Requires:
# pip install speechrecognition pyaudio rapidfuzz

import speech_recognition as sr
from rapidfuzz import fuzz
import unicodedata
import random
import time

# =========================
# YOUR WORD LIST
# =========================
words = {
    "house": "casa",
    "dog": "perro",
    "cat": "gato",
    "water": "agua",
    "food": "comida",
    "to swim": "nadar",
    "to play": "jugar",
    "rice": "arroz",
    "chicken": "pollo",
    "hello": "hola"
}

# =========================
# NORMALIZATION
# =========================
def normalize_text(text):
    text = text.lower()

    # Remove accents
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

    return text.strip()

# =========================
# SPEECH RECOGNITION
# =========================
recognizer = sr.Recognizer()

def listen_for_word():
    with sr.Microphone() as source:
        print("\n🎤 Speak now...")
        recognizer.adjust_for_ambient_noise(source, duration=1)

        audio = recognizer.listen(source)

    try:
        spoken_text = recognizer.recognize_google(audio, language="es-ES")
        return spoken_text

    except sr.UnknownValueError:
        return None

    except sr.RequestError:
        print("Speech recognition service error.")
        return None

# =========================
# SCORE PRONUNCIATION
# =========================
def score_pronunciation(expected, spoken):
    expected_clean = normalize_text(expected)
    spoken_clean = normalize_text(spoken)

    score = fuzz.ratio(expected_clean, spoken_clean)

    return score

# =========================
# MAIN LOOP
# =========================
print("===================================")
print("🇪🇸 Spanish Pronunciation Trainer")
print("===================================")

while True:

    english, spanish = random.choice(list(words.items()))

    print(f"\nTranslate and pronounce:")
    print(f"➡ English Word: {english}")

    input("\nPress ENTER when ready to speak...")

    spoken = listen_for_word()

    if spoken is None:
        print("❌ Could not understand your speech.")
        continue

    print(f"\nYou said: {spoken}")
    print(f"Correct word: {spanish}")

    score = score_pronunciation(spanish, spoken)

    print(f"\nPronunciation Match Score: {score}%")

    if score >= 90:
        print("🔥 Excellent pronunciation!")

    elif score >= 75:
        print("✅ Pretty close!")

    elif score >= 50:
        print("⚠ Some pronunciation mistakes.")

    else:
        print("❌ Needs more practice.")

    again = input("\nContinue? (y/n): ").lower()

    if again != "y":
        break

print("\nGoodbye!")