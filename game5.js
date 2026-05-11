// ===========================
// Game 5 — Verb Conjugation Challenge
// ===========================

const G5_PRONOUNS = [
  { display: "yo",    key: "yo" },
  { display: "tú",    key: "tu" },
  { display: "él",    key: "el" },
  { display: "ella",  key: "el" },
  { display: "ellos", key: "ellos" },
  { display: "ellas", key: "ellos" },
];

let g5Model = null;
let g5SelectedModel = null;
let g5Deck = [];   // [{english, spanish, conjugations: {yo, tu, el, ellos}}]
let g5Index = 0;
let g5Score = 0;
let g5Results = [];
let g5CurrentAnswer = null;
let g5CurrentPronoun = null;

const g5el = {
  cardCounter:   document.getElementById("g5-card-counter"),
  progressFill:  document.getElementById("g5-progress-fill"),
  totalScore:    document.getElementById("g5-total-score"),
  pronounBadge:  document.getElementById("g5-pronoun-badge"),
  infinitive:    document.getElementById("g5-infinitive"),
  input:         document.getElementById("g5-input"),
  submitBtn:     document.getElementById("g5-submit-btn"),
  feedback:      document.getElementById("g5-feedback"),
  feedbackText:  document.getElementById("g5-feedback-text"),
  nextBtn:       document.getElementById("g5-next-btn"),
  filterStatus:  document.getElementById("g5-filter-status"),
  spinner:       document.getElementById("g5-spinner"),
  finalScore:    document.getElementById("g5-final-score"),
  finalScoreMax: document.getElementById("g5-final-score-max"),
  resultsMsg:    document.getElementById("g5-results-message"),
  resultsIcon:   document.getElementById("g5-results-icon"),
  breakdown:     document.getElementById("g5-results-breakdown"),
};

// ===========================
// Model Picker
// ===========================
async function openG5ModelPicker() {
  g5SelectedModel = null;
  document.getElementById("start-game5-btn").disabled = true;
  document.getElementById("g5-model-error").classList.add("hidden");

  const s = settingsGet();
  const provider = s.provider || "ollama";

  if (provider !== "ollama") {
    const model = aiActiveModel();
    if (!model || !s.apiKeys?.[provider]) {
      alert(`No API key configured for ${PROVIDER_LABELS[provider] || provider}. Add one in ⚙️ Settings.`);
      return;
    }
    startGame5(model);
    return;
  }

  document.getElementById("g5-model-list").innerHTML = '<div class="model-loading">Loading models from Ollama...</div>';
  document.getElementById("g5-model-picker-modal").classList.remove("hidden");

  try {
    await ollamaFetchModels();
    populateModelList(
      document.getElementById("g5-model-list"),
      document.getElementById("start-game5-btn"),
      (model) => { g5SelectedModel = model; }
    );
  } catch {
    document.getElementById("g5-model-error").textContent = "Could not connect to Ollama. Start it with: ollama serve";
    document.getElementById("g5-model-error").classList.remove("hidden");
    document.getElementById("g5-model-list").innerHTML = "";
  }
}

// ===========================
// Entry Point
// ===========================
async function startGame5(model) {
  g5Model = model;
  g5el.filterStatus.textContent = "Asking AI to find verbs and their conjugations…";
  g5el.spinner.style.display = "block";
  showScreen("g5-loading-screen");

  try {
    const verbs = await g5FetchVerbs();
    g5el.spinner.style.display = "none";

    if (!verbs.length) {
      g5el.filterStatus.textContent = "No verbs found in your word bank. Add some verbs (e.g. to swim→nadar, to eat→comer) and try again.";
      return;
    }

    g5Deck = shuffle([...verbs]);
    g5Index = 0;
    g5Score = 0;
    g5Results = [];
    g5el.totalScore.textContent = "0";
    showScreen("game5-screen");
    g5LoadCard();
  } catch (e) {
    g5el.spinner.style.display = "none";
    g5el.filterStatus.textContent = e.message || "Could not connect to AI. Check your settings.";
  }
}

// ===========================
// AI Verb Filtering
// ===========================
async function g5FetchVerbs() {
  const wordList = WORDS.map(w => `${w.spanish} (${w.english})`).join(", ");
  const messages = [
    {
      role: "system",
      content: `You are a Spanish grammar expert. From the given Spanish words, identify ONLY the verbs (infinitive forms).
For each verb, provide its present-tense indicative conjugations for yo, tú, él/ella, and ellos/ellas.

Respond ONLY with a valid JSON array — no explanation, no markdown, no code fences:
[{"spanish":"hablar","conjugations":{"yo":"hablo","tu":"hablas","el":"habla","ellos":"hablan"}},{"spanish":"comer","conjugations":{"yo":"como","tu":"comes","el":"come","ellos":"comen"}}]

Rules:
- Only include words that are clearly verbs in infinitive form
- Only include verbs where you are confident in all four conjugations
- Return an empty array [] if no verbs are found`
    },
    { role: "user", content: wordList }
  ];

  const systemMsg = messages[0].content;
  const raw = await aiGenerate(systemMsg, wordList, { model: g5Model, temperature: 0.1, maxTokens: 600 });
  return g5ParseVerbResponse(raw);
}

function g5ParseVerbResponse(raw) {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = text.indexOf("[");
  const end   = text.lastIndexOf("]");
  if (start === -1 || end === -1) return [];

  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];

    return arr
      .filter(item =>
        item.spanish &&
        item.conjugations?.yo &&
        item.conjugations?.tu &&
        item.conjugations?.el &&
        item.conjugations?.ellos
      )
      .map(item => {
        const match = WORDS.find(w =>
          w.spanish.toLowerCase() === item.spanish.toLowerCase()
        );
        return {
          spanish: item.spanish.toLowerCase(),
          english: match?.english || item.spanish,
          conjugations: {
            yo:    item.conjugations.yo.toLowerCase(),
            tu:    item.conjugations.tu.toLowerCase(),
            el:    item.conjugations.el.toLowerCase(),
            ellos: item.conjugations.ellos.toLowerCase(),
          },
        };
      });
  } catch {
    return [];
  }
}

// ===========================
// Card Loading
// ===========================
function g5LoadCard() {
  const verb = g5Deck[g5Index];
  g5CurrentPronoun = G5_PRONOUNS[Math.floor(Math.random() * G5_PRONOUNS.length)];
  g5CurrentAnswer  = verb.conjugations[g5CurrentPronoun.key];

  g5el.cardCounter.textContent  = `${g5Index + 1} / ${g5Deck.length}`;
  g5el.progressFill.style.width = `${(g5Index / g5Deck.length) * 100}%`;

  g5el.pronounBadge.textContent = g5CurrentPronoun.display;
  g5el.infinitive.textContent   = verb.spanish;

  g5el.input.value = "";
  g5el.input.disabled    = false;
  g5el.submitBtn.disabled = false;
  g5el.feedback.classList.add("hidden");
  g5el.nextBtn.classList.add("hidden");
  g5el.input.focus();
}

// ===========================
// Answer Handling
// ===========================
function g5Submit() {
  const typed = g5el.input.value.trim();
  if (!typed || !g5CurrentAnswer) return;

  const correct = normalize(typed) === normalize(g5CurrentAnswer);

  if (correct) {
    g5Score++;
    g5el.totalScore.textContent = g5Score;
    animateScore(g5el.totalScore);
  }

  g5el.input.disabled     = true;
  g5el.submitBtn.disabled = true;

  const pronoun = g5CurrentPronoun.display;

  g5el.feedbackText.innerHTML = correct
    ? `<span class="g5-correct-msg">✓ Correct!</span> <strong>${pronoun} ${g5CurrentAnswer}</strong>`
    : `<span class="g5-incorrect-msg">✗ Incorrect.</span> You typed <em>${typed}</em> — the answer is <strong>${pronoun} ${g5CurrentAnswer}</strong>`;

  g5el.feedback.classList.remove("hidden");
  g5el.nextBtn.classList.remove("hidden");

  g5Results.push({
    english: g5Deck[g5Index].english,
    spanish: g5Deck[g5Index].spanish,
    pronoun,
    answer:  g5CurrentAnswer,
    typed,
    correct,
  });
}

function g5Next() {
  g5Index++;
  if (g5Index >= g5Deck.length) {
    g5ShowResults();
  } else {
    g5LoadCard();
  }
}

// ===========================
// Results
// ===========================
function g5ShowResults() {
  const total = g5Deck.length;
  const pct   = Math.round((g5Score / total) * 100);

  let icon, msg;
  if (pct >= 90)      { icon = "🏆"; msg = "Outstanding!"; }
  else if (pct >= 70) { icon = "🌟"; msg = "Great work!"; }
  else if (pct >= 50) { icon = "👍"; msg = "Good effort!"; }
  else                { icon = "📚"; msg = "Keep practicing!"; }

  g5el.resultsIcon.textContent       = icon;
  document.getElementById("g5-results-title").textContent = "Game Over!";
  g5el.resultsMsg.textContent        = msg;
  g5el.finalScore.textContent        = g5Score;
  g5el.finalScoreMax.textContent     = `/ ${total}`;

  g5el.breakdown.innerHTML = g5Results.map(r => {
    const color = r.correct ? "var(--green)" : "var(--red)";
    return `
      <div class="breakdown-row">
        <span class="breakdown-english">${r.english} (${r.pronoun})</span>
        <span class="breakdown-spanish">${r.answer}</span>
        <span class="breakdown-pts" style="color:${color}">${r.correct ? "✓" : "✗"}</span>
      </div>
    `;
  }).join("");

  historySave({ game: "verb-conjugation", score: g5Score, max: total, pct, words: total });

  showScreen("game5-results-screen");
}

// ===========================
// Event Listeners
// ===========================
g5el.submitBtn.addEventListener("click", g5Submit);
g5el.input.addEventListener("keydown", e => { if (e.key === "Enter") g5Submit(); });
g5el.nextBtn.addEventListener("click", g5Next);

document.getElementById("g5-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g5-loading-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g5-retry-btn").addEventListener("click", () => startGame5(g5Model));
document.getElementById("g5-home-results-btn").addEventListener("click", () => showScreen("home-screen"));

document.getElementById("pick-game5").addEventListener("click", openG5ModelPicker);

document.getElementById("start-game5-btn").addEventListener("click", () => {
  if (!g5SelectedModel) return;
  document.getElementById("g5-model-picker-modal").classList.add("hidden");
  startGame5(g5SelectedModel);
});

document.getElementById("cancel-g5-btn").addEventListener("click", () => {
  document.getElementById("g5-model-picker-modal").classList.add("hidden");
});

document.getElementById("g5-model-picker-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("g5-model-picker-modal"))
    document.getElementById("g5-model-picker-modal").classList.add("hidden");
});
