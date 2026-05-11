# Spanish Buddy

A browser-based Spanish learning app with AI-powered games and a conversational tutor. Play live at **[spanish-buddy-jade.vercel.app](https://spanish-buddy-jade.vercel.app)** or run locally in under a minute.

---

## Games

| Game | Description |
|---|---|
| **Pronunciation** | Speak the Spanish translation of an English word — scored on accuracy via the Web Speech API |
| **Flashcards** | Classic flip-card review of your word bank |
| **Fill in the Blank** | AI generates a Spanish sentence in real time; type the missing word at Beginner / Intermediate / Advanced level |
| **Noun Gender Challenge** | AI identifies the nouns in your word bank and quizzes you on masculine vs. feminine (el/la, los/las) |
| **Verb Conjugation** | AI finds the verbs in your word bank and tests present-tense conjugations across yo / tú / él / ellos |
| **Chat Buddy** | Open-ended Spanish conversation with Sofía, an AI tutor who auto-corrects your grammar, tracks your progress across sessions, and adapts difficulty to your level |
| **Knowledge Hub** | Upload images of Spanish text or flashcards and ask the AI questions about them |

---

## AI Providers

The app works with any of the following. Configure your choice in **⚙️ Settings** on the home screen.

| Provider | Free tier | Notes |
|---|---|---|
| **Ollama** (local) | Unlimited | Runs on your machine — no internet, no API key. Requires [ollama.com](https://ollama.com) |
| **Google Gemini** | ✅ 1,500 req/day | Recommended free cloud option. Get a key at [aistudio.google.com](https://aistudio.google.com) |
| **OpenRouter** | ✅ Free models | Pick any model ending in `:free`. Get a key at [openrouter.ai](https://openrouter.ai) |
| **OpenAI** | ❌ Paid | `gpt-4o-mini` is the most cost-effective option |
| **Anthropic Claude** | ❌ Paid | `claude-haiku` is the fastest and cheapest |

Each provider stores its API key independently — switching providers will not overwrite another provider's key.

---

## Quick Start (local)

### 1. Clone the repo

```bash
git clone https://github.com/DevelopWithJon/spanish_buddy.git
cd spanish_buddy
```

### 2. Start the server

The app must be served over HTTP — browsers block microphone access on `file://` URLs.

```bash
python3 -m http.server 8080
```

Then open **http://localhost:8080** in Chrome.

### 3. Configure AI

**Option A — Ollama (no internet required)**

```bash
# Install from https://ollama.com, then:
ollama pull llama3.2   # ~2 GB, good quality
ollama serve
```

**Option B — Google Gemini (free, no card needed)**

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com)
2. Open ⚙️ Settings → select **Google Gemini** → paste your key → Save

---

## Project Structure

```
spanish_buddy/
├── index.html        # App shell — all screens and modals
├── style.css         # Dark-theme stylesheet
├── settings.js       # Settings persistence (localStorage, per-provider API keys)
├── ai.js             # Unified AI layer — Ollama, OpenAI, Gemini, Claude, OpenRouter
├── game.js           # Pronunciation game + shared utilities (word editor, history, settings modal)
├── game2.js          # Fill in the Blank
├── game4.js          # Noun Gender Challenge
├── game5.js          # Verb Conjugation Challenge
├── chat.js           # Chat Buddy (streaming conversation + grammar correction + explain panel)
├── knowledge.js      # Knowledge Hub
├── wordbanks/        # Server-side word bank storage (JSON, gitignored)
├── server.py         # Flask server for word bank persistence API
└── spanish_game.py   # Original Python CLI version (optional)
```

---

## Word Bank

Click **Edit list** on the home screen. One pair per line:

```
english,spanish
to run,correr
sun,sol
house,casa
```

Changes apply immediately to all games. The AI games automatically identify which words in your bank are nouns or verbs.

---

## Settings

Open ⚙️ Settings from the home screen to configure:

- **AI Provider** — Ollama, Gemini, OpenAI, Claude, or OpenRouter
- **API Key** — stored per provider, never leaves your browser
- **Default Model** — choose from available models for the active provider
- **TTS Speed** — text-to-speech rate for Chat Buddy
- **Default Difficulty** — Beginner / Intermediate / Advanced
- **Round Size** — number of words per Fill in the Blank round

---

## Difficulty Levels (Fill in the Blank & Chat)

| Level | CEFR | Style |
|---|---|---|
| Beginner | A1/A2 | Short, present tense, top-500 vocabulary |
| Intermediate | B1/B2 | Preterite / imperfect / subjunctive, 10–18 words |
| Advanced | C1/C2 | Compound tenses, passive voice, 15–25 words |

Chat Buddy adapts its persona, vocabulary, and correction style to the selected level and uses your game history to calibrate further.

---

## Troubleshooting

**Microphone not working**
Open Chrome at `http://localhost:8080` (not `file://`). Allow mic access when prompted.

**429 Rate limit error**
You have hit your provider's rate limit. Switch to **Google Gemini** (free tier: 15 req/min, 1,500/day) or wait a moment and retry. OpenRouter `:free` models have very tight limits and may 429 frequently on a conversational app.

**Ollama not connecting**
Make sure `ollama serve` is running. Check `http://localhost:11434/api/tags` in your browser — it should return a JSON list of models.

**"No API key configured" message**
Open ⚙️ Settings, select your provider, paste your API key, and click Save.

**Web Speech API unavailable**
Use Chrome or a Chromium-based browser. Firefox and Safari do not support `webkitSpeechRecognition`.
