// ===========================
// Game 4 — Noun Gender Challenge
// ===========================

const G4_OLLAMA_URL = "http://localhost:11434/api/chat";

let g4Model = null;
let g4SelectedModel = null;
let g4Deck = [];
let g4Index = 0;
let g4Score = 0;
let g4Results = [];
let g4CurrentGender = null;
let g4IsPlural = false;

const g4el = {
  cardCounter:   document.getElementById("g4-card-counter"),
  progressFill:  document.getElementById("g4-progress-fill"),
  totalScore:    document.getElementById("g4-total-score"),
  wordDisplay:   document.getElementById("g4-word-display"),
  formLabel:     document.getElementById("g4-form-label"),
  mascBtn:       document.getElementById("g4-masc-btn"),
  femBtn:        document.getElementById("g4-fem-btn"),
  feedback:      document.getElementById("g4-feedback"),
  feedbackText:  document.getElementById("g4-feedback-text"),
  nextBtn:       document.getElementById("g4-next-btn"),
  filterStatus:  document.getElementById("g4-filter-status"),
  spinner:       document.getElementById("g4-spinner"),
  finalScore:    document.getElementById("g4-final-score"),
  finalScoreMax: document.getElementById("g4-final-score-max"),
  resultsMsg:    document.getElementById("g4-results-message"),
  resultsIcon:   document.getElementById("g4-results-icon"),
  breakdown:     document.getElementById("g4-results-breakdown"),
};

// ===========================
// Model Picker
// ===========================
async function openG4ModelPicker() {
  g4SelectedModel = null;
  document.getElementById("start-game4-btn").disabled = true;
  document.getElementById("g4-model-error").classList.add("hidden");
  document.getElementById("g4-model-list").innerHTML = '<div class="model-loading">Loading models from Ollama...</div>';
  document.getElementById("g4-model-picker-modal").classList.remove("hidden");

  try {
    await ollamaFetchModels();
    populateModelList(
      document.getElementById("g4-model-list"),
      document.getElementById("start-game4-btn"),
      (model) => { g4SelectedModel = model; }
    );
  } catch {
    document.getElementById("g4-model-error").textContent =
      "Could not connect to Ollama. Start it with: ollama serve";
    document.getElementById("g4-model-error").classList.remove("hidden");
    document.getElementById("g4-model-list").innerHTML = "";
  }
}

// ===========================
// Entry Point
// ===========================
async function startGame4(model) {
  g4Model = model;
  g4el.filterStatus.textContent = "Asking AI to identify nouns in your word bank…";
  g4el.spinner.style.display = "block";
  showScreen("g4-loading-screen");

  try {
    const nouns = await g4FetchNouns();
    g4el.spinner.style.display = "none";

    if (!nouns.length) {
      g4el.filterStatus.textContent = "No nouns with clear genders found. Add some nouns to your word bank (e.g. house→casa, dog→perro) and try again.";
      return;
    }

    g4Deck = shuffle([...nouns]);
    g4Index = 0;
    g4Score = 0;
    g4Results = [];
    g4el.totalScore.textContent = "0";
    showScreen("game4-screen");
    g4LoadCard();
  } catch (e) {
    g4el.spinner.style.display = "none";
    g4el.filterStatus.textContent = "Could not connect to Ollama. Start it with: ollama serve";
  }
}

// ===========================
// AI Noun Filtering
// ===========================
async function g4FetchNouns() {
  const wordList = WORDS.map(w => `${w.spanish} (${w.english})`).join(", ");
  const messages = [
    {
      role: "system",
      content: `You are a Spanish grammar expert. From the given Spanish words, identify ONLY the nouns.
For each noun, determine its grammatical gender and plural form.

Respond ONLY with a valid JSON array — no explanation, no markdown, no code fences:
[{"spanish":"casa","gender":"feminine","plural":"casas"},{"spanish":"perro","gender":"masculine","plural":"perros"}]

Rules:
- Only include words that are clearly nouns (not verbs, adjectives, adverbs, or interjections)
- Only include nouns with a clear, unambiguous gender ("masculine" or "feminine")
- The "spanish" and "plural" fields must contain ONLY the bare noun — never include an article (el, la, los, las, un, una, unos, unas). Write "perro" not "el perro", "mesa" not "la mesa"
- Return an empty array [] if no nouns are found`
    },
    { role: "user", content: wordList }
  ];

  const res = await fetch(G4_OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: g4Model,
      messages,
      stream: true,
      keep_alive: "10m",
      options: { temperature: 0.1, num_predict: 600 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);

  const raw = await g4ReadStream(res);
  return g4ParseNounResponse(raw);
}

async function g4ReadStream(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        full += obj.message?.content || "";
      } catch { /* incomplete chunk */ }
    }
  }
  return full.trim();
}

const G4_ARTICLE_RE = /^(el|la|los|las|un|una|unos|unas)\s+/i;

function g4StripArticle(word) {
  return word.toLowerCase().replace(G4_ARTICLE_RE, "").trim();
}

function g4ParseNounResponse(raw) {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return [];

  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];

    return arr
      .filter(item =>
        item.spanish && item.gender && item.plural &&
        (item.gender === "masculine" || item.gender === "feminine")
      )
      .map(item => {
        const match = WORDS.find(w =>
          w.spanish.toLowerCase() === item.spanish.toLowerCase()
        );
        return {
          spanish: g4StripArticle(item.spanish),
          english: match?.english || item.spanish,
          gender: item.gender,
          plural: g4StripArticle(item.plural),
        };
      });
  } catch {
    return [];
  }
}

// ===========================
// Card Loading
// ===========================
function g4LoadCard() {
  const noun = g4Deck[g4Index];
  g4IsPlural = Math.random() < 0.5;
  g4CurrentGender = noun.gender;

  g4el.cardCounter.textContent = `${g4Index + 1} / ${g4Deck.length}`;
  g4el.progressFill.style.width = `${(g4Index / g4Deck.length) * 100}%`;

  g4el.wordDisplay.textContent = g4IsPlural ? noun.plural : noun.spanish;
  g4el.formLabel.textContent = g4IsPlural ? "plural form" : "singular form";

  if (g4IsPlural) {
    g4el.mascBtn.innerHTML = '<span class="g4-article">los</span><span class="g4-gender-label">Masculine</span>';
    g4el.femBtn.innerHTML  = '<span class="g4-article">las</span><span class="g4-gender-label">Feminine</span>';
  } else {
    g4el.mascBtn.innerHTML = '<span class="g4-article">el</span><span class="g4-gender-label">Masculine</span>';
    g4el.femBtn.innerHTML  = '<span class="g4-article">la</span><span class="g4-gender-label">Feminine</span>';
  }

  g4el.feedback.classList.add("hidden");
  g4el.nextBtn.classList.add("hidden");
  g4el.mascBtn.disabled = false;
  g4el.femBtn.disabled = false;
  g4el.mascBtn.classList.remove("correct", "incorrect", "highlight");
  g4el.femBtn.classList.remove("correct", "incorrect", "highlight");
}

// ===========================
// Answer Handling
// ===========================
function g4Answer(chosen) {
  const noun = g4Deck[g4Index];
  const correct = noun.gender === chosen;

  if (correct) {
    g4Score++;
    g4el.totalScore.textContent = g4Score;
    animateScore(g4el.totalScore);
  }

  const chosenBtn = chosen === "masculine" ? g4el.mascBtn : g4el.femBtn;
  const otherBtn  = chosen === "masculine" ? g4el.femBtn  : g4el.mascBtn;

  chosenBtn.classList.add(correct ? "correct" : "incorrect");
  if (!correct) otherBtn.classList.add("highlight");

  g4el.mascBtn.disabled = true;
  g4el.femBtn.disabled  = true;

  const word    = g4IsPlural ? noun.plural : noun.spanish;
  const article = noun.gender === "masculine"
    ? (g4IsPlural ? "los" : "el")
    : (g4IsPlural ? "las" : "la");

  g4el.feedbackText.innerHTML = correct
    ? `<span class="g4-correct-msg">✓ Correct!</span> It's <strong>${article} ${word}</strong>`
    : `<span class="g4-incorrect-msg">✗ Incorrect.</span> It's <strong>${article} ${word}</strong>`;

  g4el.feedback.classList.remove("hidden");
  g4el.nextBtn.classList.remove("hidden");

  g4Results.push({
    english:   noun.english,
    spanish:   noun.spanish,
    plural:    noun.plural,
    gender:    noun.gender,
    chosen,
    correct,
    wasPlural: g4IsPlural,
  });
}

function g4Next() {
  g4Index++;
  if (g4Index >= g4Deck.length) {
    g4ShowResults();
  } else {
    g4LoadCard();
  }
}

// ===========================
// Results
// ===========================
function g4ShowResults() {
  const total = g4Deck.length;
  const pct   = Math.round((g4Score / total) * 100);

  let icon, msg;
  if (pct >= 90)      { icon = "🏆"; msg = "Outstanding!"; }
  else if (pct >= 70) { icon = "🌟"; msg = "Great work!"; }
  else if (pct >= 50) { icon = "👍"; msg = "Good effort!"; }
  else                { icon = "📚"; msg = "Keep practicing!"; }

  g4el.resultsIcon.textContent = icon;
  document.getElementById("g4-results-title").textContent = "Game Over!";
  g4el.resultsMsg.textContent  = msg;
  g4el.finalScore.textContent  = g4Score;
  g4el.finalScoreMax.textContent = `/ ${total}`;

  g4el.breakdown.innerHTML = g4Results.map(r => {
    const article = r.gender === "masculine"
      ? (r.wasPlural ? "los" : "el")
      : (r.wasPlural ? "las" : "la");
    const word  = r.wasPlural ? r.plural : r.spanish;
    const color = r.correct ? "var(--green)" : "var(--red)";
    return `
      <div class="breakdown-row">
        <span class="breakdown-english">${r.english}</span>
        <span class="breakdown-spanish">${article} ${word}</span>
        <span class="breakdown-pts" style="color:${color}">${r.correct ? "✓" : "✗"}</span>
      </div>
    `;
  }).join("");

  historySave({ game: "noun-gender", score: g4Score, max: total, pct, words: total });

  showScreen("game4-results-screen");
}

// ===========================
// Event Listeners
// ===========================
g4el.mascBtn.addEventListener("click", () => g4Answer("masculine"));
g4el.femBtn.addEventListener("click",  () => g4Answer("feminine"));
g4el.nextBtn.addEventListener("click", g4Next);

document.getElementById("g4-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g4-loading-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g4-retry-btn").addEventListener("click", () => startGame4(g4Model));
document.getElementById("g4-home-results-btn").addEventListener("click", () => showScreen("home-screen"));

document.getElementById("pick-game4").addEventListener("click", openG4ModelPicker);

document.getElementById("start-game4-btn").addEventListener("click", () => {
  if (!g4SelectedModel) return;
  document.getElementById("g4-model-picker-modal").classList.add("hidden");
  startGame4(g4SelectedModel);
});

document.getElementById("cancel-g4-btn").addEventListener("click", () => {
  document.getElementById("g4-model-picker-modal").classList.add("hidden");
});

document.getElementById("g4-model-picker-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("g4-model-picker-modal"))
    document.getElementById("g4-model-picker-modal").classList.add("hidden");
});
