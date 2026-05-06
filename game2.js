// ===========================
// Game 2 — Fill in the Blank
// ===========================
const OLLAMA_URL = "http://localhost:11434/api/chat";

let g2Deck = [];
let g2Index = 0;
let g2Score = 0;
let g2Results = [];
let g2Log = [];
let g2Model = null;
let g2Difficulty = "intermediate";
let g2CurrentAnswer = null;
let g2CurrentLogEntry = null;
let g2Prefetch = null;   // Promise<{sentence, answer, raw}> for the next card

const g2el = {
  cardCounter:      document.getElementById("g2-card-counter"),
  progressFill:     document.getElementById("g2-progress-fill"),
  totalScore:       document.getElementById("g2-total-score"),
  difficultyBadge:  document.getElementById("g2-difficulty-badge"),
  sentenceCard:     document.getElementById("g2-sentence-card"),
  loading:       document.getElementById("g2-loading"),
  sentence:      document.getElementById("g2-sentence"),
  answerArea:    document.getElementById("g2-answer-area"),
  input:         document.getElementById("g2-input"),
  submitBtn:     document.getElementById("g2-submit-btn"),
  feedback:      document.getElementById("g2-feedback"),
  yourAnswer:    document.getElementById("g2-your-answer"),
  correctAnswer: document.getElementById("g2-correct-answer"),
  matchScore:    document.getElementById("g2-match-score"),
  pointsEarned:  document.getElementById("g2-points-earned"),
  nextBtn:       document.getElementById("g2-next-btn"),
  skipBtn:       document.getElementById("g2-skip-btn"),
  error:         document.getElementById("g2-error"),
  finalScore:    document.getElementById("g2-final-score"),
  finalScoreMax: document.getElementById("g2-final-score-max"),
  resultsMsg:    document.getElementById("g2-results-message"),
  resultsIcon:   document.getElementById("g2-results-icon"),
  breakdown:     document.getElementById("g2-results-breakdown"),
};

// ===========================
// Entry Point
// ===========================
function startGame2(model, difficulty, shuffled = false) {
  g2Model = model;
  g2Difficulty = difficulty;
  g2Deck = shuffle([...WORDS]);
  g2Index = 0;
  g2Score = 0;
  g2Results = [];
  g2Log = [];
  g2el.totalScore.textContent = "0";
  const labels = { beginner: "Beginner A1/A2", intermediate: "Intermediate B1/B2", advanced: "Advanced C1/C2" };
  g2el.difficultyBadge.textContent = labels[difficulty];
  showScreen("game2-screen");
  g2LoadCard();
}

// ===========================
// Card Management
// ===========================
function g2LoadCard() {
  const word = g2Deck[g2Index];

  // Reset UI
  g2el.sentence.textContent = "";
  g2el.sentence.classList.add("hidden");
  g2el.loading.classList.remove("hidden");
  g2el.answerArea.classList.add("hidden");
  g2el.feedback.classList.add("hidden");
  g2el.nextBtn.classList.add("hidden");
  g2el.skipBtn.classList.remove("hidden");
  g2el.error.classList.add("hidden");
  g2el.input.value = "";
  g2el.submitBtn.disabled = false;
  g2CurrentAnswer = null;

  g2el.cardCounter.textContent = `${g2Index + 1} / ${g2Deck.length}`;
  g2el.progressFill.style.width = `${(g2Index / g2Deck.length) * 100}%`;

  generateSentence(word.spanish);
  prefetchNext();  // start fetching the card after this one in background
}

// ===========================
// Prefetch next card
// ===========================
async function fetchSentence(spanishWord) {
  const messages = buildMessages(spanishWord);
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: g2Model,
      messages,
      stream: true,
      keep_alive: "10m",
      options: { temperature: 0.7, num_predict: 80 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const raw = await readStream(res, false); // false = no UI update during prefetch
  const parsed = extractBlank(raw, spanishWord);
  return { raw, parsed };
}

function prefetchNext() {
  const nextIndex = g2Index + 1;
  if (nextIndex >= g2Deck.length) return;
  const nextWord = g2Deck[nextIndex].spanish;
  g2Prefetch = fetchSentence(nextWord).catch(() => null);
}

// ===========================
// Stream Reader
// ===========================
async function readStream(res, showUI = true) {
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
        const token = obj.message?.content || "";
        full += token;
        if (showUI) {
          const preview = full.replace(/_{2,}/g, "___").slice(0, 60);
          const span = g2el.loading.querySelector("span");
          if (span) span.textContent = preview || "Generating...";
        }
      } catch { /* incomplete JSON chunk */ }
    }
  }
  return full.trim();
}

// ===========================
// LLM Sentence Generation
// ===========================
async function generateSentence(spanishWord) {
  const word = g2Deck[g2Index];
  const messages = buildMessages(spanishWord);

  // Start log entry for this card
  g2CurrentLogEntry = {
    word: { english: word.english, spanish: spanishWord },
    model: g2Model,
    difficulty: g2Difficulty,
    prompt: messages,
    rawResponse: null,
    retryPrompt: null,
    retryRawResponse: null,
    parsedSentence: null,
    parsedAnswer: null,
    parseOk: false,
    userTyped: null,
    score: null,
    pts: null,
    skipped: false,
  };

  try {
    // Use prefetched result if ready
    const prefetched = g2Prefetch ? await g2Prefetch : null;
    g2Prefetch = null;

    if (prefetched?.parsed) {
      g2CurrentLogEntry.rawResponse = prefetched.raw;
      g2CurrentLogEntry.parsedSentence = prefetched.parsed.sentence;
      g2CurrentLogEntry.parsedAnswer = prefetched.parsed.answer;
      g2CurrentLogEntry.parseOk = true;
      showSentence(prefetched.parsed.sentence, prefetched.parsed.answer);
      return;
    }

    // No prefetch — stream live
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: g2Model, messages, stream: true, keep_alive: "10m",
        options: { temperature: 0.7, num_predict: 80 },
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const raw = await readStream(res, true);
    g2CurrentLogEntry.rawResponse = raw;

    const parsed = extractBlank(raw, spanishWord);
    if (!parsed) return retryGenerate(spanishWord);

    g2CurrentLogEntry.parsedSentence = parsed.sentence;
    g2CurrentLogEntry.parsedAnswer = parsed.answer;
    g2CurrentLogEntry.parseOk = true;
    showSentence(parsed.sentence, parsed.answer);

  } catch (err) {
    g2el.loading.classList.add("hidden");
    g2el.error.textContent = `Failed to generate sentence: ${err.message}`;
    g2el.error.classList.remove("hidden");
    g2el.skipBtn.classList.remove("hidden");
  }
}

async function retryGenerate(spanishWord) {
  const messages = buildMessages(spanishWord);
  g2CurrentLogEntry.retryPrompt = messages;

  try {
    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: g2Model,
        messages,
        stream: true,
        keep_alive: "10m",
        options: { temperature: 0.3, num_predict: 80 },
      }),
    });
    const raw = await readStream(res, true);
    g2CurrentLogEntry.retryRawResponse = raw;

    const parsed = extractBlank(raw, spanishWord);
    if (!parsed) {
      // Fallback: use raw sentence as-is, answer is the target word
      const fallbackSentence = raw.split("\n")[0].trim() || `Usa la palabra: ${spanishWord}`;
      g2CurrentLogEntry.parsedSentence = fallbackSentence + ` (respuesta: ${spanishWord})`;
      g2CurrentLogEntry.parsedAnswer = spanishWord;
      showSentence(g2CurrentLogEntry.parsedSentence, spanishWord);
      return;
    }
    g2CurrentLogEntry.parsedSentence = parsed.sentence;
    g2CurrentLogEntry.parsedAnswer = parsed.answer;
    showSentence(parsed.sentence, parsed.answer);
  } catch {
    showSentence(`Escribe la palabra: ___ (${spanishWord})`, spanishWord);
  }
}

const DIFFICULTY_INSTRUCTIONS = {
  beginner: {
    label: "Beginner (A1/A2)",
    rules: `- Simple Subject + Verb + Object sentence, under 8 words
- Present Indicative or Near Future (Voy a...) only
- Top 500 most common Spanish words only
- No idioms, no slang, no conjunctions like aunque/sin embargo`,
    example_word: "nadar",
    example_sentence: "Voy a ___ en la piscina hoy.",
    example_answer: "nadar",
  },
  intermediate: {
    label: "Intermediate (B1/B2)",
    rules: `- Use Preterite, Imperfect, or Present Subjunctive tense
- May use conjunctions: aunque, sin embargo, por lo tanto
- Can include object pronouns naturally (Se lo di)
- 10–18 words, varied structure`,
    example_word: "nadar",
    example_sentence: "Aunque hacía frío, decidió ___ en el lago antes del amanecer.",
    example_answer: "nadar",
  },
  advanced: {
    label: "Advanced (C1/C2)",
    rules: `- Use compound tenses, Past Subjunctive, Conditional, or Future Perfect
- Complex clauses, passive voice, or "se" impersonal structures
- Nuanced vocabulary; avoid the most basic synonyms
- Rhetorical sophistication; 15–25 words`,
    example_word: "nadar",
    example_sentence: "Habría preferido ___ en aguas abiertas, pero la corriente hacía imposible cualquier intento seguro.",
    example_answer: "nadar",
  },
};

function buildSystemPrompt(difficulty) {
  const d = DIFFICULTY_INSTRUCTIONS[difficulty];
  return `Eres un profesor de español. Escribe UNA oración española natural usando la palabra dada.
Nivel ${d.label}: ${d.rules}
Responde SOLO con la oración. Sin etiquetas ni explicaciones.`;
}

function buildMessages(word) {
  return [
    { role: "system", content: buildSystemPrompt(g2Difficulty) },
    { role: "user",   content: word },
  ];
}


// ===========================
// Response Parsing
// ===========================
function extractBlank(raw, targetWord) {
  // Strip think blocks and clean up
  let sentence = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\*\*/g, "")
    .replace(/^(oración|sentence)[:\-\s]*/i, "")
    .split("\n")[0]  // take first line only
    .trim();

  if (!sentence) return null;

  // Try exact whole-word match (case-insensitive)
  const exactRegex = new RegExp(`\\b${targetWord}\\b`, "i");
  const exactMatch = sentence.match(exactRegex);
  if (exactMatch) {
    return {
      sentence: sentence.replace(exactRegex, "___"),
      answer: exactMatch[0].toLowerCase(),
    };
  }

  // Try stem match for conjugated verbs (first 4 chars)
  if (targetWord.length >= 4) {
    const stem = targetWord.slice(0, 4);
    const stemRegex = new RegExp(`\\b${stem}\\w*\\b`, "i");
    const stemMatch = sentence.match(stemRegex);
    if (stemMatch) {
      return {
        sentence: sentence.replace(stemRegex, "___"),
        answer: stemMatch[0].toLowerCase(),
      };
    }
  }

  return null;  // triggers retry
}

// ===========================
// Show Sentence & Handle Input
// ===========================
function showSentence(sentence, answer) {
  g2CurrentAnswer = answer;
  g2el.loading.classList.add("hidden");
  g2el.sentence.textContent = sentence;
  g2el.sentence.classList.remove("hidden");
  g2el.answerArea.classList.remove("hidden");
  g2el.input.focus();
}

function g2Submit() {
  const typed = g2el.input.value.trim();
  if (!typed || !g2CurrentAnswer) return;

  const pct = similarityScore(g2CurrentAnswer, typed);
  const grade = gradeScore(pct);
  const pts = POINTS[grade];

  g2Score += pts;
  g2Results.push({
    english: g2Deck[g2Index].english,
    spanish: g2Deck[g2Index].spanish,
    answer: g2CurrentAnswer,
    typed,
    score: pct,
    grade,
    pts,
  });

  if (g2CurrentLogEntry) {
    g2CurrentLogEntry.userTyped = typed;
    g2CurrentLogEntry.score = pct;
    g2CurrentLogEntry.pts = pts;
    g2Log.push(g2CurrentLogEntry);
    g2CurrentLogEntry = null;
  }

  g2el.totalScore.textContent = g2Score;
  animateScore(g2el.totalScore);

  g2el.yourAnswer.textContent = typed;
  g2el.correctAnswer.textContent = g2CurrentAnswer;
  g2el.matchScore.textContent = `${pct}%`;
  g2el.pointsEarned.textContent = pts === 0 ? "No points" : `+${pts} point${pts !== 1 ? "s" : ""}`;
  g2el.pointsEarned.style.color = ptColor(pts);

  g2el.submitBtn.disabled = true;
  g2el.feedback.classList.remove("hidden");
  g2el.nextBtn.classList.remove("hidden");
  g2el.skipBtn.classList.add("hidden");
}

function g2NextCard() {
  g2Index++;
  if (g2Index >= g2Deck.length) showG2Results();
  else g2LoadCard();
}

function g2SkipCard() {
  g2Results.push({
    english: g2Deck[g2Index].english,
    spanish: g2Deck[g2Index].spanish,
    answer: g2CurrentAnswer || "—",
    typed: "—",
    score: 0,
    grade: "poor",
    pts: 0,
  });

  if (g2CurrentLogEntry) {
    g2CurrentLogEntry.skipped = true;
    g2CurrentLogEntry.userTyped = "—";
    g2CurrentLogEntry.score = 0;
    g2CurrentLogEntry.pts = 0;
    g2Log.push(g2CurrentLogEntry);
    g2CurrentLogEntry = null;
  }

  g2Index++;
  if (g2Index >= g2Deck.length) showG2Results();
  else g2LoadCard();
}

// ===========================
// Results
// ===========================
function showG2Results() {
  const max = g2Deck.length * 3;
  const pct = Math.round((g2Score / max) * 100);
  g2el.finalScore.textContent = g2Score;
  g2el.finalScoreMax.textContent = `/ ${max}`;

  if (pct >= 90)      { g2el.resultsIcon.textContent = "🏆"; g2el.resultsMsg.textContent = "Outstanding! Grammar master!"; }
  else if (pct >= 70) { g2el.resultsIcon.textContent = "🌟"; g2el.resultsMsg.textContent = "Great job! Keep it up!"; }
  else if (pct >= 50) { g2el.resultsIcon.textContent = "📚"; g2el.resultsMsg.textContent = "Good effort — practice makes perfect!"; }
  else                { g2el.resultsIcon.textContent = "💪"; g2el.resultsMsg.textContent = "Keep going — you'll get there!"; }

  g2el.breakdown.innerHTML = g2Results.map(r => `
    <div class="breakdown-row">
      <span class="breakdown-english">${r.english}</span>
      <span class="breakdown-spanish">${r.answer}</span>
      <span class="breakdown-pts" style="color:${ptColor(r.pts)}">+${r.pts}pt</span>
    </div>
  `).join("");

  g2el.progressFill.style.width = "100%";
  showScreen("game2-results-screen");
}

// ===========================
// Session Review
// ===========================
function openSessionReview() {
  const modal = document.getElementById("session-review-modal");
  const container = document.getElementById("review-entries");

  container.innerHTML = g2Log.map((entry, i) => {
    const parseStatus = entry.parseOk
      ? `<span class="review-tag tag-ok">parsed ok</span>`
      : entry.retryRawResponse !== null
        ? `<span class="review-tag tag-retry">needed retry</span>`
        : `<span class="review-tag tag-fallback">fallback used</span>`;

    const retryBlock = entry.retryPrompt ? `
      <div class="review-block">
        <div class="review-block-label">Retry Prompt</div>
        <pre>${escapeHtml(entry.retryPrompt)}</pre>
      </div>
      <div class="review-block">
        <div class="review-block-label">Retry Raw Response</div>
        <pre>${escapeHtml(entry.retryRawResponse || "—")}</pre>
      </div>` : "";

    return `
      <div class="review-entry">
        <div class="review-entry-header">
          <span class="review-num">#${i + 1}</span>
          <span class="review-word">${entry.word.english} → ${entry.word.spanish}</span>
          ${parseStatus}
          <span class="review-tag" style="background:rgba(243,156,18,0.15);color:#f39c12">${entry.difficulty}</span>
        </div>

        <div class="review-row">
          <span class="review-label">Sentence shown:</span>
          <span class="review-val">${escapeHtml(entry.parsedSentence || "—")}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Expected answer:</span>
          <span class="review-val" style="color:#2ecc71">${escapeHtml(entry.parsedAnswer || "—")}</span>
        </div>
        <div class="review-row">
          <span class="review-label">User typed:</span>
          <span class="review-val" style="color:${entry.skipped ? "#888" : "#3498db"}">${escapeHtml(entry.userTyped || "—")}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Score:</span>
          <span class="review-val">${entry.score !== null ? entry.score + "%" : "—"} — ${entry.pts !== null ? "+" + entry.pts + "pt" : ""}</span>
        </div>

        <details class="review-details">
          <summary>Raw LLM output</summary>
          <div class="review-block">
            <div class="review-block-label">Prompt sent</div>
            <pre>${escapeHtml(entry.prompt)}</pre>
          </div>
          <div class="review-block">
            <div class="review-block-label">Raw response</div>
            <pre>${escapeHtml(entry.rawResponse || "—")}</pre>
          </div>
          ${retryBlock}
        </details>
      </div>`;
  }).join("");

  modal.classList.remove("hidden");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function copyLogAsJson() {
  const json = JSON.stringify(g2Log, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    const btn = document.getElementById("copy-log-btn");
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy as JSON", 2000);
  });
}

// ===========================
// Event Listeners
// ===========================
g2el.submitBtn.addEventListener("click", g2Submit);

g2el.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") g2Submit();
});

g2el.nextBtn.addEventListener("click", g2NextCard);
g2el.skipBtn.addEventListener("click", g2SkipCard);

document.getElementById("g2-retry-btn").addEventListener("click", () => startGame2(g2Model, g2Difficulty, false));
document.getElementById("g2-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g2-home-results-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g2-review-btn").addEventListener("click", openSessionReview);
document.getElementById("copy-log-btn").addEventListener("click", copyLogAsJson);
document.getElementById("close-review-btn").addEventListener("click", () => {
  document.getElementById("session-review-modal").classList.add("hidden");
});
document.getElementById("session-review-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("session-review-modal"))
    document.getElementById("session-review-modal").classList.add("hidden");
});
