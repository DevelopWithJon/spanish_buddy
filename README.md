# Spanish Trainer

A browser-based Spanish vocabulary trainer with two game modes:

- **Pronunciation** — speak the Spanish translation of an English word and get scored on accuracy using the Web Speech API
- **Fill in the Blank** — a locally-running LLM (via Ollama) generates Spanish sentences in real time; type the missing word

No internet connection required during play. Voice recognition routes audio to Google's servers via the Web Speech API (Chrome only). Everything else runs locally.

---

## Requirements

| Requirement | Notes |
|---|---|
| **Chrome** (or Chromium) | Web Speech API is Chrome-only |
| **Python 3** | Only used to serve the files locally (enables mic permissions) |
| **Ollama** | Required for the Fill in the Blank game only |

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/your-username/spanish-trainer.git
cd spanish-trainer
```

### 2. Start the local server

The app must be served over HTTP — browsers block microphone access on `file://` URLs.

```bash
python3 -m http.server 8080
```

Then open **http://localhost:8080** in Chrome.

### 3. Set up Ollama (for Fill in the Blank)

Install Ollama from [ollama.com](https://ollama.com), then pull a model:

```bash
# Recommended — good quality, 2 GB
ollama pull llama3.2

# Lighter alternatives
ollama pull qwen3:0.6b   # ~500 MB, fastest
ollama pull gemma:2b     # ~1.5 GB
```

Make sure Ollama is running before starting the game:

```bash
ollama serve
```

Ollama must be reachable at `http://localhost:11434`. The model picker in the app lists all models you have pulled.

---

## Optional: Python CLI version

`spanish_game.py` is a terminal-based pronunciation trainer that predates the web app.

### Dependencies

```bash
pip install -r requirements.txt
```

> **macOS**: PyAudio requires PortAudio. Install it first:
> ```bash
> brew install portaudio
> pip install --global-option=build_ext \
>   -I$(brew --prefix portaudio)/include \
>   -L$(brew --prefix portaudio)/lib \
>   pyaudio
> ```

### Run

```bash
python3 spanish_game.py
```

---

## Project Structure

```
spanish-trainer/
├── index.html          # App shell — all screens and modals
├── style.css           # Dark-theme stylesheet
├── game.js             # Game 1 (Pronunciation) + shared utilities + word editor
├── game2.js            # Game 2 (Fill in the Blank) + Ollama integration
├── spanish_game.py     # Original Python CLI version (optional)
└── requirements.txt    # Python dependencies for spanish_game.py
```

---

## Customizing Your Word List

Click **Edit list** on the home screen. One pair per line:

```
english,spanish
to run,correr
sun,sol
```

Changes apply immediately to both games.

---

## Difficulty Levels (Fill in the Blank)

| Level | CEFR | Sentence style |
|---|---|---|
| Beginner | A1/A2 | Short, present tense, top-500 vocabulary |
| Intermediate | B1/B2 | Preterite/imperfect/subjunctive, 10–18 words |
| Advanced | C1/C2 | Compound tenses, passive voice, 15–25 words |

---

## Scoring

| Match | Grade | Points |
|---|---|---|
| ≥ 90% | Excellent | 3 |
| ≥ 75% | Pretty close | 2 |
| ≥ 50% | Keep practicing | 1 |
| < 50% | Needs work | 0 |

Matching uses Levenshtein distance normalized by word length, with accent marks stripped before comparison.

---

## Troubleshooting

**Microphone not working**
Open Chrome at `http://localhost:8080` (not `file://`). On first use Chrome will ask for mic permission — allow it.

**Ollama not connecting**
Make sure `ollama serve` is running and the model is pulled. Check `http://localhost:11434/api/tags` in your browser — it should return a JSON list of models.

**Slow sentence generation**
The first card of a session loads the model into VRAM (~2–5 s). Subsequent cards use a prefetch system — generation for the next card starts in the background while you answer the current one, so wait times drop to near-zero from card 2 onward.

**Web Speech API not available**
Use Chrome or a Chromium-based browser. Firefox and Safari do not support `webkitSpeechRecognition`.
