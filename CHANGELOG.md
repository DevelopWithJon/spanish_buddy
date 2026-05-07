# Changelog

All notable changes to Spanish Buddy are recorded here.

---

## [Unreleased]

### Game 3 — Flashcards
- New game mode: tap a card to flip between English and Spanish
- Cards are drawn from the active word bank in a random order
- Prev / Next navigation with a progress bar
- Shuffle button in the header to re-randomize at any time
- "Done ✓" on the last card returns to the home screen

### Pronunciation Game — Submit / Redo Flow
- After speaking, the result is no longer graded immediately
- A preview state shows what the speech recognition heard
- **Submit ✓** grades the answer; **↺ Redo** clears the recording and lets the user try again
- Playback and AI voice buttons are available during the preview so the user can compare before committing

### Pronunciation Game — Numeral Normalization
- Speech recognition sometimes transcribes spoken numbers as numerals (1, 2, 3) instead of words
- Transcripts are now normalized before grading: numerals 0–100 are converted to their Spanish word equivalents (e.g. "5" → "cinco", "21" → "veintiuno")

### Pronunciation Game — AI Voice Comparison
- After speaking, a **🔊 Hear it** button appears next to the user's own playback button
- Clicking it reads the correct Spanish word aloud using the browser's Spanish (es-ES) speech synthesis
- Button toggles to **⏹ Stop** while speaking; speech is cancelled when advancing to the next card

### Pronunciation Game — Recording & Playback
- The microphone is recorded while the user speaks
- A **▶ You** button appears after the result so the user can play back their own pronunciation
- Recording data is deleted when moving to the next card

### Word Bank UX Redesign
- Replaced the word bank dropdown with a cleaner two-button model on the home screen
- **Edit list** opens a textarea editor for the active word list
- **Saved Banks** opens a picker modal; tapping a bank name loads it instantly with no extra confirmation step
- Banks can be deleted directly from the picker modal

### Word Bank Persistence — Flask Server
- Added `server.py`: a lightweight Flask server that serves the frontend and exposes a REST API
- Word banks are saved as individual JSON files under `./wordbanks/`
- The frontend falls back to `localStorage` transparently when the server is not running
- Server runs on port 8000

### Game 2 — Rounds & Word Bank Modal
- Fill in the Blank is now divided into rounds of up to 10 words each
- A pre-round screen displays the word bank for the upcoming round before it starts
- An in-game **Word Bank** button opens a modal showing the words for the current round
- Results screen shows a **Next Round →** button when more rounds remain
- Card counter shows round context when multiple rounds are active (e.g. `Rd 2 · 3 / 10`)

### Word List Persistence
- The active word list is saved to `localStorage` so it survives page refreshes
- A default 10-word starter list is used when no saved list is found

### Safari / Unsupported Browser Detection
- Games that require the Web Speech API (Pronunciation, Fill in the Blank model picker) detect Safari and show a clear message directing the user to Chrome instead of silently failing

---

## [Initial Release]

### Game 1 — Pronunciation
- Flash a random English word and ask the user to say it in Spanish
- Web Speech API captures and transcribes speech in `es-ES`
- Levenshtein-based similarity score grades the answer (Excellent / Good / Okay / Poor)
- Points awarded per card (3 / 2 / 1 / 0); running total shown in the header
- Skip button for words the user wants to pass on
- Results screen with breakdown of every card after the round

### Game 2 — Fill in the Blank
- AI-generated Spanish sentences with one word blanked out
- User types the missing word; fuzzy match scores the answer
- Model picker modal to select the Ollama model and difficulty level (Beginner / Intermediate / Advanced)
- Session review modal with full prompt, raw model output, and user answers (exportable as JSON)

### Home Screen
- Word count badge showing how many words are loaded
- Game selection cards for each mode
