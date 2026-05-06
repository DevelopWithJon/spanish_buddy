// ===========================
// Shared Word List
// ===========================
let WORDS = [
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

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ===========================
// Home Screen
// ===========================
document.getElementById("pick-game1").addEventListener("click", () => {
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
let deck = [];
let currentIndex = 0;
let totalScore = 0;
let g1Results = [];
let recognition = null;
let isListening = false;
let resultHandled = false;
let bestTranscript = "";

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
};

// ===========================
// Speech Recognition
// ===========================
function initRecognition() {
  if (recognition) return true;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Speech recognition requires Chrome."); return false; }

  recognition = new SR();
  recognition.lang = "es-ES";
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
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
    if (final) bestTranscript = final.trim();
    else if (interim) bestTranscript = interim.trim();
    el.listeningStatus.textContent = bestTranscript || "🎤 Speak now...";
    if (final && !resultHandled) {
      resultHandled = true;
      recognition.abort();
      handleSpokenResult(bestTranscript);
    }
  };

  recognition.onerror = (event) => {
    stopListening();
    if (event.error === "aborted") return;
    if (event.error === "no-speech") el.listeningStatus.textContent = "No speech detected. Try again.";
    else if (event.error === "not-allowed") el.listeningStatus.textContent = "Microphone access denied.";
    else el.listeningStatus.textContent = `Error: ${event.error}`;
  };

  recognition.onend = () => {
    stopListening();
    if (!resultHandled && bestTranscript) {
      resultHandled = true;
      handleSpokenResult(bestTranscript);
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
  recognition.start();
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
// Game 1 Logic
// ===========================
function startGame1(shuffled = false) {
  deck = shuffle([...WORDS]);
  currentIndex = 0;
  totalScore = 0;
  g1Results = [];
  el.totalScore.textContent = "0";
  showScreen("game-screen");
  loadCard();
}

function loadCard() {
  abortListening();
  resultHandled = false;
  bestTranscript = "";

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

  el.cardCounter.textContent = `${currentIndex + 1} / ${deck.length}`;
  el.progressFill.style.width = `${(currentIndex / deck.length) * 100}%`;
}

function handleSpokenResult(spoken) {
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
  el.feedbackPanel.classList.remove("hidden");
  el.nextBtn.classList.remove("hidden");
  el.skipBtn.classList.add("hidden");
  el.speakBtn.disabled = true;
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
  if (isListening) { abortListening(); el.listeningStatus.textContent = "Stopped."; }
  else startListening();
});
el.nextBtn.addEventListener("click", g1NextCard);
el.skipBtn.addEventListener("click", g1SkipCard);
el.retryBtn.addEventListener("click", () => startGame1());
document.getElementById("g1-home-btn").addEventListener("click", () => { abortListening(); showScreen("home-screen"); });
document.getElementById("g1-home-results-btn").addEventListener("click", () => showScreen("home-screen"));

// ===========================
// Word Editor
// ===========================
function openWordEditor() {
  document.getElementById("word-input").value = WORDS.map(w => `${w.english},${w.spanish}`).join("\n");
  document.getElementById("word-editor-error").classList.add("hidden");
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
  updateHomeWordCount();
  document.getElementById("word-editor-modal").classList.add("hidden");
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

// Difficulty button wiring
document.querySelectorAll(".difficulty-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".difficulty-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedDifficulty = btn.dataset.level;
  });
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
