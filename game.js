// ===========================
// Shared Word List
// ===========================
const DEFAULT_WORDS = [
  { english: "house",    spanish: "casa" },
  { english: "dog",      spanish: "perro" },
  { english: "cat",      spanish: "gato" },
  { english: "water",    spanish: "agua" },
  { english: "food",     spanish: "comida" },
  { english: "to swim",  spanish: "nadar" },
  { english: "to play",  spanish: "jugar" },
  { english: "rice",     spanish: "arroz" },
  { english: "chicken",  spanish: "pollo" },
  { english: "hello",    spanish: "hola" },
];

function loadStoredWords() {
  try {
    const raw = localStorage.getItem("sb-words");
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_WORDS;
  } catch {
    return DEFAULT_WORDS;
  }
}

let WORDS = loadStoredWords();

// ===========================
// Word Bank (API with localStorage fallback)
// ===========================
const BANKS_API = "/api/wordbanks";
const BANKS_LS_KEY = "sb-saved-banks";

function lsGetBanks() {
  try { return JSON.parse(localStorage.getItem(BANKS_LS_KEY) || "{}"); }
  catch { return {}; }
}
function lsSetBanks(data) {
  localStorage.setItem(BANKS_LS_KEY, JSON.stringify(data));
}

async function banksList() {
  try {
    const r = await fetch(BANKS_API);
    if (r.ok) return r.json();
  } catch {}
  return Object.keys(lsGetBanks()).sort();
}

async function bankGet(name) {
  try {
    const r = await fetch(`${BANKS_API}/${encodeURIComponent(name)}`);
    if (r.ok) return r.json();
  } catch {}
  const banks = lsGetBanks();
  if (!banks[name]) throw new Error("Bank not found");
  return { name, words: banks[name] };
}

async function bankSave(name, words) {
  try {
    const r = await fetch(`${BANKS_API}/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    });
    if (r.ok) {
      // Also mirror to localStorage so offline loads still work
      const banks = lsGetBanks(); banks[name] = words; lsSetBanks(banks);
      return;
    }
  } catch {}
  // Fall back to localStorage only
  const banks = lsGetBanks(); banks[name] = words; lsSetBanks(banks);
}

async function bankDelete(name) {
  try {
    await fetch(`${BANKS_API}/${encodeURIComponent(name)}`, { method: "DELETE" });
  } catch {}
  const banks = lsGetBanks(); delete banks[name]; lsSetBanks(banks);
}

// ===========================
// Performance History
// ===========================
const HISTORY_KEY = "sb-history";

function historyGet() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function historySave(entry) {
  const list = historyGet();
  list.unshift({ ...entry, date: new Date().toISOString() });
  if (list.length > 100) list.length = 100;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function historyFormatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function historyScoreColor(pct) {
  if (pct >= 80) return "#2ecc71";
  if (pct >= 50) return "#f39c12";
  return "#e74c3c";
}

function openHistoryModal() {
  const modal   = document.getElementById("history-modal");
  const listEl  = document.getElementById("history-list");
  const entries = historyGet();

  listEl.innerHTML = "";
  if (!entries.length) {
    listEl.innerHTML = '<p class="banks-empty">No sessions recorded yet.</p>';
    modal.classList.remove("hidden");
    return;
  }

  entries.forEach(e => {
    const isG1 = e.game === "pronunciation";
    const icon = isG1 ? "🎤" : "✏️";
    const name = isG1 ? "Pronunciation" : "Fill in the Blank";
    const pct  = e.pct ?? Math.round((e.score / e.max) * 100);
    const sub  = isG1
      ? `${e.words} words`
      : `${e.difficulty.charAt(0).toUpperCase() + e.difficulty.slice(1)} · ${e.words} words` +
        (e.totalRounds > 1 ? ` · Rd ${e.round}/${e.totalRounds}` : "");

    const row = document.createElement("div");
    row.className = "history-entry";
    row.innerHTML = `
      <div class="history-entry-left">
        <span class="history-icon">${icon}</span>
        <div class="history-info">
          <span class="history-game">${name}</span>
          <span class="history-sub">${sub}</span>
          <span class="history-date">${historyFormatDate(e.date)}</span>
        </div>
      </div>
      <div class="history-score" style="color:${historyScoreColor(pct)}">
        <span class="history-pts">${e.score}<span class="history-max">/${e.max}</span></span>
        <span class="history-pct">${pct}%</span>
      </div>`;
    listEl.appendChild(row);
  });

  modal.classList.remove("hidden");
}

async function openBanksModal() {
  const listEl = document.getElementById("banks-list");
  const modal  = document.getElementById("banks-modal");
  listEl.innerHTML = '<p class="banks-loading">Loading…</p>';
  modal.classList.remove("hidden");

  const names = await banksList();

  listEl.innerHTML = "";
  if (!names.length) {
    listEl.innerHTML = '<p class="banks-empty">No saved banks yet.<br>Edit your word list and use "Save Bank" to create one.</p>';
    return;
  }

  names.forEach(name => {
    const item = document.createElement("div");
    item.className = "bank-item";

    const nameBtn = document.createElement("button");
    nameBtn.className = "bank-name-btn";
    nameBtn.textContent = name;
    nameBtn.addEventListener("click", async () => {
      nameBtn.textContent = "Loading…";
      nameBtn.disabled = true;
      try {
        const data = await bankGet(name);
        WORDS = data.words;
        localStorage.setItem("sb-words", JSON.stringify(WORDS));
        updateHomeWordCount();
        modal.classList.add("hidden");
      } catch {
        nameBtn.textContent = name;
        nameBtn.disabled = false;
      }
    });

    const delBtn = document.createElement("button");
    delBtn.className = "bank-delete-btn";
    delBtn.textContent = "×";
    delBtn.title = "Delete bank";
    delBtn.addEventListener("click", async () => {
      await bankDelete(name);
      item.remove();
      if (!listEl.querySelector(".bank-item")) {
        listEl.innerHTML = '<p class="banks-empty">No saved banks yet.</p>';
      }
    });

    item.append(nameBtn, delBtn);
    listEl.appendChild(item);
  });
}

const POINTS = { excellent: 3, good: 2, okay: 1, poor: 0 };

// ===========================
// Shared Utilities
// ===========================
function normalize(text) {
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const SPANISH_DIGITS = {
  "100": "cien",
  "90": "noventa", "80": "ochenta", "70": "setenta", "60": "sesenta",
  "50": "cincuenta", "40": "cuarenta", "30": "treinta",
  "29": "veintinueve", "28": "veintiocho", "27": "veintisiete",
  "26": "veintis\u00e9is", "25": "veinticinco", "24": "veinticuatro",
  "23": "veintitr\u00e9s", "22": "veintid\u00f3s", "21": "veintiuno",
  "20": "veinte", "19": "diecinueve", "18": "dieciocho",
  "17": "diecisiete", "16": "diecis\u00e9is", "15": "quince",
  "14": "catorce", "13": "trece", "12": "doce", "11": "once",
  "10": "diez", "9": "nueve", "8": "ocho", "7": "siete",
  "6": "seis", "5": "cinco", "4": "cuatro", "3": "tres",
  "2": "dos", "1": "uno", "0": "cero",
};

// Sorted longest-first so "10" is replaced before "1"
const _digitKeys = Object.keys(SPANISH_DIGITS).sort((a, b) => b.length - a.length);

function normalizeSpokenDigits(text) {
  let out = text;
  for (const k of _digitKeys) {
    out = out.replace(new RegExp(`\\b${k}\\b`, "g"), SPANISH_DIGITS[k]);
  }
  return out;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function similarityScore(expected, spoken) {
  const a = normalize(expected), b = normalize(spoken);
  if (a === b) return 100;
  const dist = levenshtein(a, b);
  return Math.round((1 - dist / Math.max(a.length, b.length)) * 100);
}

function gradeScore(pct) {
  if (pct >= 90) return "excellent";
  if (pct >= 75) return "good";
  if (pct >= 50) return "okay";
  return "poor";
}

const GRADE_LABELS = {
  excellent: "🔥 Excellent!",
  good:      "✅ Pretty close!",
  okay:      "⚠ Keep practicing",
  poor:      "❌ Needs work",
};

function ptColor(pts) {
  return ["#e74c3c", "#f39c12", "#3498db", "#2ecc71"][pts];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Client-side router ────────────────────────────────────────────────────────

const SCREEN_ROUTES = {
  "home-screen":          "home",
  "g1-preround-screen":   "pronunciation/setup",
  "game-screen":          "pronunciation",
  "results-screen":       "pronunciation/results",
  "g2-preround-screen":   "fill-in-blank/setup",
  "game2-screen":         "fill-in-blank",
  "game2-results-screen": "fill-in-blank/results",
  "game3-screen":         "flashcards",
  "g4-loading-screen":    "noun-gender/loading",
  "game4-screen":         "noun-gender",
  "game4-results-screen": "noun-gender/results",
  "g5-loading-screen":      "verb-conjugation/loading",
  "game5-screen":           "verb-conjugation",
  "game5-results-screen":   "verb-conjugation/results",
  "knowledge-hub-screen":   "knowledge-hub",
  "chat-screen":            "chat",
};

const ROUTE_TO_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_ROUTES).map(([s, r]) => [r, s])
);

let _routerSuppressPush = false;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (!_routerSuppressPush) {
    const route = SCREEN_ROUTES[id] ?? "home";
    history.pushState({ screenId: id }, "", `#${route}`);
  }
}

window.addEventListener("popstate", (e) => {
  const id = e.state?.screenId ?? "home-screen";
  _routerSuppressPush = true;
  showScreen(id);
  _routerSuppressPush = false;
});

// Resolve initial URL hash after all scripts have loaded
document.addEventListener("DOMContentLoaded", () => {
  const hash = window.location.hash.slice(1);
  const screenId = ROUTE_TO_SCREEN[hash];

  if (screenId === "game3-screen") {
    // Flashcards requires no setup — can be deeplinkied directly
    startGame3();
  } else {
    // All other screens need setup modals or in-progress state —
    // fall back to home, which is already active in the HTML
    history.replaceState({ screenId: "home-screen" }, "", "#home");
  }
});

// ===========================
// Home Screen
// ===========================
document.getElementById("pick-game1").addEventListener("click", () => {
  if (isSafariBrowser()) {
    alert("The Pronunciation game requires Chrome — Safari doesn't support the Web Speech API.\n\nOpen this page in Chrome to use voice input.");
    return;
  }
  initRecognition();
  startGame1();
});

document.getElementById("pick-game2").addEventListener("click", () => {
  openModelPicker();
});

document.getElementById("home-edit-words-btn").addEventListener("click", openWordEditor);

function updateHomeWordCount() {
  document.getElementById("home-word-count").textContent = WORDS.length;
}

// ===========================
// Game 1 State
// ===========================
let g1Rounds = [];
let g1CurrentRound = 0;
let deck = [];
let currentIndex = 0;
let totalScore = 0;
let g1Results = [];
let recognition = null;
let isListening = false;
let resultHandled = false;
let bestTranscript = "";
let mediaRecorder = null;
let audioChunks = [];
let audioBlobURL = null;
let recordingId = 0;
let spanishVoice = null;
let ttsCurrent = null;
let pendingSpoken = "";

function loadSpanishVoice() {
  const pick = () => {
    const voices = speechSynthesis.getVoices();
    spanishVoice = voices.find(v => v.lang.startsWith("es")) || null;
  };
  pick();
  speechSynthesis.addEventListener("voiceschanged", pick);
}
loadSpanishVoice();

const el = {
  cardCounter:    document.getElementById("card-counter"),
  progressFill:   document.getElementById("progress-fill"),
  totalScore:     document.getElementById("total-score"),
  flashcard:      document.getElementById("flashcard"),
  englishWord:    document.getElementById("english-word"),
  spanishWord:    document.getElementById("spanish-word"),
  resultBadge:    document.getElementById("result-badge"),
  feedbackPanel:  document.getElementById("feedback-panel"),
  spokenText:     document.getElementById("spoken-text"),
  matchScore:     document.getElementById("match-score"),
  pointsEarned:   document.getElementById("points-earned"),
  speakBtn:       document.getElementById("speak-btn"),
  speakLabel:     document.getElementById("speak-label"),
  nextBtn:        document.getElementById("next-btn"),
  skipBtn:        document.getElementById("skip-btn"),
  listeningStatus:document.getElementById("listening-status"),
  finalScore:     document.getElementById("final-score"),
  finalScoreMax:  document.getElementById("final-score-max"),
  resultsMessage: document.getElementById("results-message"),
  resultsBreakdown: document.getElementById("results-breakdown"),
  resultsIcon:    document.getElementById("results-icon"),
  retryBtn:       document.getElementById("retry-btn"),
  playbackBtn:    document.getElementById("playback-btn"),
  ttsBtn:         document.getElementById("tts-btn"),
  submitBtn:      document.getElementById("submit-btn"),
  redoBtn:        document.getElementById("redo-btn"),
};

// ===========================
// Speech Recognition
// ===========================
function isSafariBrowser() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function initRecognition() {
  if (recognition) return true;

  if (isSafariBrowser()) {
    el.listeningStatus.textContent = "Safari doesn't support voice input. Please open this app in Chrome.";
    el.speakBtn.disabled = true;
    return false;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    el.listeningStatus.textContent = "Voice input requires Chrome.";
    el.speakBtn.disabled = true;
    return false;
  }

  recognition = new SR();
  recognition.lang = "es-ES";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    console.log("[SR] started");
    isListening = true;
    el.speakBtn.classList.add("listening");
    el.speakLabel.textContent = "Stop";
    el.listeningStatus.textContent = "🎤 Speak now...";
  };

  recognition.onresult = (event) => {
    let interim = "", final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }
    console.log("[SR] result — interim:", interim, "| final:", final);
    if (final) bestTranscript = final.trim();
    else if (interim) bestTranscript = interim.trim();
    el.listeningStatus.textContent = bestTranscript || "🎤 Speak now...";
    if (final && !resultHandled) {
      resultHandled = true;
      recognition.abort();
      showPreview(bestTranscript);
    }
  };

  recognition.onerror = (event) => {
    console.error("[SR] error:", event.error, event);
    if (event.error === "aborted") return;
    if (event.error === "no-speech") {
      el.listeningStatus.textContent = "🎤 Speak now...";
      return;
    }
    stopListening();
    const msgs = {
      "not-allowed":      "Microphone access denied. Allow it in your browser settings.",
      "network":          "Network error — Speech API needs an internet connection.",
      "service-not-allowed": "Speech service blocked. Use Chrome and allow mic access.",
      "audio-capture":    "No microphone found.",
    };
    el.listeningStatus.textContent = msgs[event.error] || `Speech error: ${event.error}`;
  };

  recognition.onend = () => {
    console.log("[SR] ended — resultHandled:", resultHandled, "| bestTranscript:", bestTranscript);
    if (isListening && !resultHandled) {
      try { recognition.start(); } catch {}
      return;
    }
    stopListening();
    if (!resultHandled && bestTranscript) {
      resultHandled = true;
      showPreview(bestTranscript);
    } else if (!resultHandled) {
      el.listeningStatus.textContent = "No speech detected. Try again.";
    }
  };

  return true;
}

function startListening() {
  if (!recognition) return;
  resultHandled = false;
  bestTranscript = "";
  el.listeningStatus.textContent = "";

  el.speakBtn.disabled = true;
  el.speakBtn.classList.add("ready");
  el.speakLabel.textContent = "Get ready…";

  setTimeout(() => {
    el.speakBtn.disabled = false;
    el.speakBtn.classList.remove("ready");
    recognition.start();
    startRecording();
  }, 250);
}

function abortListening() {
  if (isListening) recognition.abort();
  stopListening();
}

function stopListening() {
  isListening = false;
  el.speakBtn.classList.remove("listening");
  el.speakLabel.textContent = "Speak";
}

// ===========================
// Audio Recording (playback)
// ===========================
async function startRecording() {
  const id = ++recordingId;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (recordingId !== id) { stream.getTracks().forEach(t => t.stop()); return; }
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (recordingId !== id) return;
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      if (audioBlobURL) URL.revokeObjectURL(audioBlobURL);
      audioBlobURL = URL.createObjectURL(blob);
      el.playbackBtn.classList.remove("hidden");
    };
    mediaRecorder.start();
    console.log("[Recorder] started");
  } catch (err) {
    console.warn("[Recorder] could not start:", err.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    console.log("[Recorder] stopped");
  }
}

function clearRecording() {
  recordingId++;
  if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
  mediaRecorder = null;
  audioChunks = [];
  if (audioBlobURL) { URL.revokeObjectURL(audioBlobURL); audioBlobURL = null; }
  el.playbackBtn.classList.add("hidden");
  el.playbackBtn.textContent = "▶ You";
  speechSynthesis.cancel();
  ttsCurrent = null;
  el.ttsBtn.classList.add("hidden");
  el.ttsBtn.textContent = "🔊 Hear it";
}

function speakSpanish(text) {
  if (!text) return;
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    el.ttsBtn.textContent = "🔊 Hear it";
    return;
  }
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "es-ES";
  if (spanishVoice) utt.voice = spanishVoice;
  utt.rate = 0.9;
  utt.onstart = () => { el.ttsBtn.textContent = "⏹ Stop"; };
  utt.onend = utt.onerror = () => { el.ttsBtn.textContent = "🔊 Hear it"; };
  speechSynthesis.speak(utt);
}

// ===========================
// Game 1 Logic
// ===========================
function startGame1() {
  const allWords = shuffle([...WORDS]);
  g1Rounds = [];
  for (let i = 0; i < allWords.length; i += 10) g1Rounds.push(allWords.slice(i, i + 10));
  g1CurrentRound = 0;
  showG1PreRound();
}

function showG1PreRound() {
  const roundWords = g1Rounds[g1CurrentRound];
  const totalRounds = g1Rounds.length;

  document.getElementById("g1-preround-round-label").textContent =
    totalRounds > 1 ? `Round ${g1CurrentRound + 1} of ${totalRounds}` : "Word Bank";

  const listEl = document.getElementById("g1-preround-word-list");
  listEl.innerHTML = "";
  roundWords.forEach(w => {
    const row = document.createElement("div");
    row.className = "preround-word-row";
    const eng = document.createElement("span"); eng.className = "preround-english"; eng.textContent = w.english;
    const arrow = document.createElement("span"); arrow.className = "preround-arrow"; arrow.textContent = "→";
    const esp = document.createElement("span"); esp.className = "preround-spanish"; esp.textContent = w.spanish;
    row.append(eng, arrow, esp);
    listEl.appendChild(row);
  });

  showScreen("g1-preround-screen");
}

function startG1Round() {
  deck = [...g1Rounds[g1CurrentRound]];
  currentIndex = 0;
  totalScore = 0;
  g1Results = [];
  el.totalScore.textContent = "0";
  showScreen("game-screen");
  loadCard();
}

function loadCard() {
  abortListening();
  clearRecording();
  resultHandled = false;
  bestTranscript = "";
  pendingSpoken = "";
  el.submitBtn.classList.add("hidden");
  el.redoBtn.classList.add("hidden");

  const word = deck[currentIndex];
  el.flashcard.classList.remove("flipped");
  el.feedbackPanel.classList.add("hidden");
  el.nextBtn.classList.add("hidden");
  el.skipBtn.classList.remove("hidden");
  el.speakBtn.disabled = false;
  el.listeningStatus.textContent = "";
  el.englishWord.textContent = word.english;
  el.spanishWord.textContent = word.spanish;
  el.resultBadge.textContent = "";
  el.resultBadge.className = "result-badge";

  el.cardCounter.textContent = g1Rounds.length > 1
    ? `Rd ${g1CurrentRound + 1} · ${currentIndex + 1} / ${deck.length}`
    : `${currentIndex + 1} / ${deck.length}`;
  el.progressFill.style.width = `${(currentIndex / deck.length) * 100}%`;
}

function showPreview(spoken) {
  stopRecording();
  pendingSpoken = normalizeSpokenDigits(spoken);
  el.listeningStatus.textContent = `You said: "${pendingSpoken}"`;
  el.speakBtn.disabled = true;
  el.skipBtn.classList.add("hidden");
  el.submitBtn.classList.remove("hidden");
  el.redoBtn.classList.remove("hidden");
}

function gradeSpoken() {
  const spoken = pendingSpoken;
  const word = deck[currentIndex];
  const pct = similarityScore(word.spanish, spoken);
  const grade = gradeScore(pct);
  const pts = POINTS[grade];

  totalScore += pts;
  g1Results.push({ ...word, spoken, score: pct, grade, pts });

  el.totalScore.textContent = totalScore;
  animateScore(el.totalScore);

  el.flashcard.classList.add("flipped");
  el.resultBadge.textContent = GRADE_LABELS[grade];
  el.resultBadge.className = `result-badge ${grade}`;

  el.spokenText.textContent = spoken;
  el.matchScore.textContent = `${pct}%`;
  el.pointsEarned.textContent = pts === 0 ? "No points" : `+${pts} point${pts !== 1 ? "s" : ""}`;
  el.pointsEarned.style.color = ptColor(pts);
  ttsCurrent = word.spanish;
  el.ttsBtn.classList.remove("hidden");
  el.feedbackPanel.classList.remove("hidden");
  el.nextBtn.classList.remove("hidden");
  el.submitBtn.classList.add("hidden");
  el.redoBtn.classList.add("hidden");
  el.listeningStatus.textContent = "";
}

function doRedo() {
  clearRecording();
  pendingSpoken = "";
  resultHandled = false;
  bestTranscript = "";
  el.submitBtn.classList.add("hidden");
  el.redoBtn.classList.add("hidden");
  el.skipBtn.classList.remove("hidden");
  el.speakBtn.disabled = false;
  el.listeningStatus.textContent = "";
}

function g1NextCard() {
  currentIndex++;
  if (currentIndex >= deck.length) showG1Results();
  else loadCard();
}

function g1SkipCard() {
  g1Results.push({ ...deck[currentIndex], spoken: "—", score: 0, grade: "poor", pts: 0 });
  currentIndex++;
  if (currentIndex >= deck.length) showG1Results();
  else loadCard();
}

function showG1Results() {
  clearRecording();
  const max = deck.length * 3;
  const pct = Math.round((totalScore / max) * 100);
  el.finalScore.textContent = totalScore;
  el.finalScoreMax.textContent = `/ ${max}`;
  if (pct >= 90)      { el.resultsIcon.textContent = "🏆"; el.resultsMessage.textContent = "Outstanding! You're a Spanish star!"; }
  else if (pct >= 70) { el.resultsIcon.textContent = "🌟"; el.resultsMessage.textContent = "Great job! Keep it up!"; }
  else if (pct >= 50) { el.resultsIcon.textContent = "📚"; el.resultsMessage.textContent = "Good effort — a little more practice!"; }
  else                { el.resultsIcon.textContent = "💪"; el.resultsMessage.textContent = "Keep practicing — you'll get there!"; }

  el.resultsBreakdown.innerHTML = g1Results.map(r => `
    <div class="breakdown-row">
      <span class="breakdown-english">${r.english}</span>
      <span class="breakdown-spanish">${r.spanish}</span>
      <span class="breakdown-pts" style="color:${ptColor(r.pts)}">+${r.pts}pt</span>
    </div>
  `).join("");

  el.progressFill.style.width = "100%";
  historySave({ game: "pronunciation", score: totalScore, max, pct, words: deck.length,
    round: g1CurrentRound + 1, totalRounds: g1Rounds.length });

  const totalRounds = g1Rounds.length;
  const nextRoundBtn = document.getElementById("g1-next-round-btn");
  document.getElementById("g1-results-title").textContent =
    totalRounds > 1 ? `Round ${g1CurrentRound + 1} of ${totalRounds} Complete!` : "Round Complete!";

  if (g1CurrentRound + 1 < totalRounds) {
    nextRoundBtn.textContent = `Next Round ${g1CurrentRound + 2} →`;
    nextRoundBtn.classList.remove("hidden");
    el.retryBtn.textContent = "Restart Game";
  } else {
    nextRoundBtn.classList.add("hidden");
    el.retryBtn.textContent = "Play Again";
  }

  showScreen("results-screen");
}

function animateScore(scoreEl) {
  scoreEl.style.transform = "scale(1.4)";
  scoreEl.style.color = "#2ecc71";
  setTimeout(() => {
    scoreEl.style.transform = "scale(1)";
    scoreEl.style.color = "#f39c12";
  }, 280);
}

// Game 1 event listeners
el.speakBtn.addEventListener("click", () => {
  if (isListening) { abortListening(); stopRecording(); el.listeningStatus.textContent = "Stopped."; }
  else startListening();
});
el.nextBtn.addEventListener("click", g1NextCard);
el.skipBtn.addEventListener("click", g1SkipCard);
el.submitBtn.addEventListener("click", gradeSpoken);
el.redoBtn.addEventListener("click", doRedo);
document.getElementById("g1-start-round-btn").addEventListener("click", startG1Round);
document.getElementById("g1-preround-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g1-next-round-btn").addEventListener("click", () => { g1CurrentRound++; showG1PreRound(); });
el.retryBtn.addEventListener("click", () => { initRecognition(); startGame1(); });
document.getElementById("g1-home-btn").addEventListener("click", () => { abortListening(); clearRecording(); showScreen("home-screen"); });

el.playbackBtn.addEventListener("click", () => {
  if (!audioBlobURL) return;
  const audio = new Audio(audioBlobURL);
  el.playbackBtn.textContent = "⏹ Playing...";
  el.playbackBtn.disabled = true;
  audio.play();
  audio.onended = () => {
    el.playbackBtn.textContent = "▶ You";
    el.playbackBtn.disabled = false;
  };
});

el.ttsBtn.addEventListener("click", () => {
  speakSpanish(ttsCurrent);
});

document.getElementById("g1-home-results-btn").addEventListener("click", () => showScreen("home-screen"));

// ===========================
// Word Editor
// ===========================
function openWordEditor() {
  document.getElementById("word-input").value = WORDS.map(w => `${w.english},${w.spanish}`).join("\n");
  document.getElementById("word-editor-error").classList.add("hidden");
  document.getElementById("save-as-name").value = "";
  document.getElementById("word-editor-modal").classList.remove("hidden");
  document.getElementById("word-input").focus();
}

function parseWords(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed = [], errors = [];
  lines.forEach((line, i) => {
    const parts = line.split(",").map(p => p.trim());
    if (parts.length < 2 || !parts[0] || !parts[1])
      errors.push(`Line ${i + 1}: "${line}" — expected english,spanish`);
    else
      parsed.push({ english: parts[0], spanish: parts[1] });
  });
  return { parsed, errors };
}

document.getElementById("save-words-btn").addEventListener("click", () => {
  const { parsed, errors } = parseWords(document.getElementById("word-input").value);
  const errEl = document.getElementById("word-editor-error");
  if (errors.length) { errEl.textContent = errors[0]; errEl.classList.remove("hidden"); return; }
  if (!parsed.length) { errEl.textContent = "Add at least one word pair."; errEl.classList.remove("hidden"); return; }
  WORDS = parsed;
  localStorage.setItem("sb-words", JSON.stringify(WORDS));
  updateHomeWordCount();
  document.getElementById("word-editor-modal").classList.add("hidden");
});

document.getElementById("save-as-btn").addEventListener("click", async () => {
  const name = document.getElementById("save-as-name").value.trim();
  const errEl = document.getElementById("word-editor-error");
  if (!name) { errEl.textContent = "Enter a name for the bank."; errEl.classList.remove("hidden"); return; }

  const { parsed, errors } = parseWords(document.getElementById("word-input").value);
  if (errors.length) { errEl.textContent = errors[0]; errEl.classList.remove("hidden"); return; }
  if (!parsed.length) { errEl.textContent = "Add at least one word pair."; errEl.classList.remove("hidden"); return; }

  const btn = document.getElementById("save-as-btn");
  btn.textContent = "Saving…";
  btn.disabled = true;
  await bankSave(name, parsed);
  document.getElementById("save-as-name").value = "";
  btn.textContent = "Saved!";
  errEl.classList.add("hidden");
  setTimeout(() => { btn.textContent = "Save Bank"; btn.disabled = false; }, 1500);
});

document.getElementById("home-banks-btn").addEventListener("click", openBanksModal);
document.getElementById("home-history-btn").addEventListener("click", openHistoryModal);
document.getElementById("close-history-btn").addEventListener("click", () => {
  document.getElementById("history-modal").classList.add("hidden");
});
document.getElementById("history-clear-btn").addEventListener("click", () => {
  if (!confirm("Clear all performance history?")) return;
  localStorage.removeItem(HISTORY_KEY);
  document.getElementById("history-list").innerHTML = '<p class="banks-empty">No sessions recorded yet.</p>';
});
document.getElementById("history-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("history-modal"))
    document.getElementById("history-modal").classList.add("hidden");
});

document.getElementById("close-banks-btn").addEventListener("click", () => {
  document.getElementById("banks-modal").classList.add("hidden");
});

document.getElementById("banks-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("banks-modal"))
    document.getElementById("banks-modal").classList.add("hidden");
});

document.getElementById("cancel-words-btn").addEventListener("click", () => {
  document.getElementById("word-editor-modal").classList.add("hidden");
});

document.getElementById("word-editor-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("word-editor-modal"))
    document.getElementById("word-editor-modal").classList.add("hidden");
});

// ===========================
// Model Picker
// ===========================
let selectedModel = null;
let selectedDifficulty = "intermediate";

// Difficulty button wiring — scoped to Game 2 picker
document.querySelectorAll("#model-picker-modal .difficulty-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#model-picker-modal .difficulty-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedDifficulty = btn.dataset.level;
  });
});

// ===========================
// Chat Buddy Picker
// ===========================
let chatSelectedModel = null;
let chatSelectedDifficulty = "intermediate";

document.querySelectorAll("#chat-difficulty-options .difficulty-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#chat-difficulty-options .difficulty-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    chatSelectedDifficulty = btn.dataset.level;
  });
});

async function openChatPicker() {
  chatSelectedModel = null;
  document.getElementById("start-chat-btn").disabled = true;
  document.getElementById("chat-model-error").classList.add("hidden");
  document.getElementById("chat-model-list").innerHTML = '<div class="model-loading">Loading models from Ollama...</div>';
  document.getElementById("chat-picker-modal").classList.remove("hidden");

  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (!res.ok) throw new Error();
    const data = await res.json();
    const models = data.models || [];

    if (!models.length) {
      document.getElementById("chat-model-list").innerHTML = '<div class="model-loading">No models found. Run: ollama pull llama3.2</div>';
      return;
    }

    const listEl = document.getElementById("chat-model-list");
    listEl.innerHTML = models.map(m => `
      <button class="model-option" data-model="${m.name}">
        <span style="font-size:1.4rem">🤖</span>
        <div>
          <div class="model-name">${m.name}</div>
          <div class="model-size">${(m.size / 1e9).toFixed(1)} GB</div>
        </div>
      </button>
    `).join("");

    listEl.querySelectorAll(".model-option").forEach(btn => {
      btn.addEventListener("click", () => {
        listEl.querySelectorAll(".model-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        chatSelectedModel = btn.dataset.model;
        document.getElementById("start-chat-btn").disabled = false;
      });
    });

    const preferred = listEl.querySelector('[data-model^="llama3.2"]');
    if (preferred) preferred.click();

  } catch {
    document.getElementById("chat-model-error").textContent = "Could not connect to Ollama. Make sure it's running.";
    document.getElementById("chat-model-error").classList.remove("hidden");
    document.getElementById("chat-model-list").innerHTML = "";
  }
}

document.getElementById("pick-chat").addEventListener("click", openChatPicker);

document.getElementById("start-chat-btn").addEventListener("click", () => {
  if (!chatSelectedModel) return;
  document.getElementById("chat-picker-modal").classList.add("hidden");
  startChat(chatSelectedModel, chatSelectedDifficulty);
});

document.getElementById("cancel-chat-btn").addEventListener("click", () => {
  document.getElementById("chat-picker-modal").classList.add("hidden");
});

document.getElementById("chat-picker-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("chat-picker-modal"))
    document.getElementById("chat-picker-modal").classList.add("hidden");
});

async function openModelPicker() {
  selectedModel = null;
  document.getElementById("start-game2-btn").disabled = true;
  document.getElementById("model-error").classList.add("hidden");
  document.getElementById("model-list").innerHTML = '<div class="model-loading">Loading models from Ollama...</div>';
  document.getElementById("model-picker-modal").classList.remove("hidden");

  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (!res.ok) throw new Error("Ollama not reachable");
    const data = await res.json();
    const models = data.models || [];

    if (!models.length) {
      document.getElementById("model-list").innerHTML = '<div class="model-loading">No models found. Run: ollama pull llama3.2</div>';
      return;
    }

    document.getElementById("model-list").innerHTML = models.map(m => `
      <button class="model-option" data-model="${m.name}">
        <span style="font-size:1.4rem">🤖</span>
        <div>
          <div class="model-name">${m.name}</div>
          <div class="model-size">${(m.size / 1e9).toFixed(1)} GB</div>
        </div>
      </button>
    `).join("");

    document.querySelectorAll(".model-option").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".model-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedModel = btn.dataset.model;
        document.getElementById("start-game2-btn").disabled = false;
      });
    });

    // Auto-select llama3.2 if available
    const preferred = document.querySelector('[data-model^="llama3.2"]');
    if (preferred) preferred.click();

  } catch {
    document.getElementById("model-error").textContent = "Could not connect to Ollama. Make sure it's running.";
    document.getElementById("model-error").classList.remove("hidden");
    document.getElementById("model-list").innerHTML = "";
  }
}

document.getElementById("start-game2-btn").addEventListener("click", () => {
  if (!selectedModel) return;
  document.getElementById("model-picker-modal").classList.add("hidden");
  startGame2(selectedModel, selectedDifficulty);
});

document.getElementById("cancel-model-btn").addEventListener("click", () => {
  document.getElementById("model-picker-modal").classList.add("hidden");
});

document.getElementById("model-picker-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("model-picker-modal"))
    document.getElementById("model-picker-modal").classList.add("hidden");
});
