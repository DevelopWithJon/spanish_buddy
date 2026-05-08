# Changelog

All notable changes to Spanish Buddy are recorded here.

---

## [Unreleased]

### Chat Buddy — New Game Mode
- Conversational Spanish practice with a local Ollama LLM
- Model picker modal to select the Ollama model and difficulty level (Beginner / Intermediate / Advanced)
- AI persona: Sofía, a 28-year-old tutor from Sevilla with a consistent backstory (food, family, hobbies, cat) — personal questions get real in-character answers
- AI sends an opening greeting on session start, offering 3–4 topic choices tailored to the student's CEFR level
- Difficulty can be changed mid-session via the hamburger menu; a notice is inserted into the chat thread
- Inline correction tracking: a `[CORRECTIONS:N]` marker is stripped from every AI response and tallied silently

### Chat Buddy — Voice Input
- 🎤 mic button opens a recording layer with live transcript preview
- `SpeechRecognition` runs in continuous mode; recording auto-stops after 3 seconds of silence
- Manual stop button ends recording immediately
- Review layer shows the transcribed text before sending; ↺ Redo discards and re-records

### Chat Buddy — AI Voice (TTS)
- Every AI response is read aloud in Spanish (`es-ES`) using the Web Speech Synthesis API
- Spanish voice is selected automatically from the browser's available voices
- 🔊 / 🔇 toggle in the chat header mutes/unmutes for the session; speech stops immediately on mute or leaving chat

### Chat Buddy — Explain Feature
- After each AI message a **💡 Explain** button appears
- Clicking it enters highlight mode; selecting any text in the bubble fetches a structured explanation from Ollama
- Explanation panel slides in with: translation, type badge (word / phrase / sentence), explanation, word breakdown, and example sentences
- Fixed: `innerHTML = ""` was destroying the loading indicator element before the panel could open

### Chat Buddy — Session History
- Sessions are persisted to `localStorage` (up to 50 most recent)
- **💬 Chat History** in the hamburger menu shows past sessions with difficulty, message count, corrections, duration, and error-rate percentage (colour-coded green / yellow / red)
- Interrupted sessions (tab close, crash) are recovered and saved on the next launch
- Chat history context is injected into the system prompt so the AI adapts to the student's past error rate and trends

### Pronunciation Game — Rounds of 10
- Words are now split into rounds of up to 10, matching the Fill-in-Blank game
- A pre-round screen displays the word bank before each round starts
- Results screen shows a **Next Round →** button when more rounds remain; title reflects current round (e.g. "Round 2 of 3 Complete!")
- Card counter shows round context when multiple rounds are active (e.g. `Rd 2 · 3 / 10`)

### Pronunciation Game — Speak Button Loading State
- Pressing **Speak** now shows a 250 ms orange "Get ready…" loading state before the microphone activates
- Gives users a clear visual cue to wait before speaking, reducing missed first words

### Client-Side Router
- Every screen now has a URL hash: `#home`, `#pronunciation`, `#pronunciation/setup`, `#pronunciation/results`, `#fill-in-blank`, `#fill-in-blank/setup`, `#fill-in-blank/results`, `#flashcards`, `#chat`
- Browser back / forward buttons navigate between screens correctly via the History API
- Deeplink to `#flashcards` auto-starts the game; all other game deeplinks fall back to `#home` since they require setup

### Bug Fixes
- Fixed `buildSystemPrompt` name collision between `game2.js` and `chat.js` — Game 2's function renamed to `g2BuildSystemPrompt` so the AI persona and chat prompts no longer bleed into sentence generation

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
