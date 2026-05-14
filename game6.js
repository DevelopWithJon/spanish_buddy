// ===========================
// Game 6 — Story Weaver
// ===========================

let g6Model        = null;
let g6Difficulty   = "intermediate";
let g6Deck         = [];
let g6Index        = 0;
let g6Score        = 0;
let g6Results      = [];
let g6Rounds       = [];
let g6CurrentRound = 0;

let g6CurrentSentence = null;
let g6CurrentWord     = null;

const g6el = {
  cardCounter:       document.getElementById("g6-card-counter"),
  progressFill:      document.getElementById("g6-progress-fill"),
  totalScore:        document.getElementById("g6-total-score"),
  loading:           document.getElementById("g6-loading"),
  sentenceCard:      document.getElementById("g6-sentence-card"),
  aiSentence:        document.getElementById("g6-ai-sentence"),
  targetWord:        document.getElementById("g6-target-word"),
  inputArea:         document.getElementById("g6-input-area"),
  textarea:          document.getElementById("g6-textarea"),
  submitBtn:         document.getElementById("g6-submit-btn"),
  skipBtn:           document.getElementById("g6-skip-btn"),
  evaluating:        document.getElementById("g6-evaluating"),
  feedback:          document.getElementById("g6-feedback"),
  scoreGrammar:      document.getElementById("g6-score-grammar"),
  scoreSyntax:       document.getElementById("g6-score-syntax"),
  scoreClarity:      document.getElementById("g6-score-clarity"),
  scoreTotal:        document.getElementById("g6-score-total"),
  wordBadge:         document.getElementById("g6-word-badge"),
  feedbackText:      document.getElementById("g6-feedback-text"),
  correctSection:    document.getElementById("g6-correct-section"),
  correctItems:      document.getElementById("g6-correct-items"),
  errorsSection:     document.getElementById("g6-errors-section"),
  errorItems:        document.getElementById("g6-error-items"),
  yourSentence:      document.getElementById("g6-your-sentence"),
  correctedRow:      document.getElementById("g6-corrected-row"),
  corrected:         document.getElementById("g6-corrected"),
  debugRaw:          document.getElementById("g6-debug-raw"),
  nextBtn:           document.getElementById("g6-next-btn"),
  error:             document.getElementById("g6-error"),
};

// ===========================
// Entry Point
// ===========================
function startGame6(model, difficulty) {
  g6Model      = model;
  g6Difficulty = difficulty;

  const allWords  = shuffle([...WORDS]);
  const roundSize = settingsGet().roundSize;
  g6Rounds = [];
  for (let i = 0; i < allWords.length; i += roundSize) {
    g6Rounds.push(allWords.slice(i, i + roundSize));
  }
  g6CurrentRound = 0;
  g6ShowPreRound();
}

function g6ShowPreRound() {
  const roundWords  = g6Rounds[g6CurrentRound];
  const totalRounds = g6Rounds.length;

  document.getElementById("g6-preround-round-label").textContent =
    totalRounds > 1 ? `Round ${g6CurrentRound + 1} of ${totalRounds}` : "Word Bank";

  const listEl = document.getElementById("g6-preround-word-list");
  listEl.innerHTML = "";
  roundWords.forEach(w => {
    const row   = document.createElement("div"); row.className = "preround-word-row";
    const eng   = document.createElement("span"); eng.className = "preround-english"; eng.textContent = w.english;
    const arrow = document.createElement("span"); arrow.className = "preround-arrow";   arrow.textContent = "→";
    const esp   = document.createElement("span"); esp.className = "preround-spanish";  esp.textContent = w.spanish;
    row.append(eng, arrow, esp);
    listEl.appendChild(row);
  });

  showScreen("g6-preround-screen");
}

function g6StartRound() {
  g6Deck    = [...g6Rounds[g6CurrentRound]];
  g6Index   = 0;
  g6Score   = 0;
  g6Results = [];
  g6el.totalScore.textContent = "0";
  const labels = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
  const badge = document.getElementById("g6-difficulty-badge");
  if (badge) badge.textContent = labels[g6Difficulty] || g6Difficulty;
  showScreen("game6-screen");
  g6LoadCard();
}

// ===========================
// Card Management
// ===========================
function g6LoadCard() {
  g6CurrentSentence = null;
  g6CurrentWord     = g6Deck[g6Index];

  g6el.loading.classList.remove("hidden");
  g6el.sentenceCard.classList.add("hidden");
  g6el.inputArea.classList.add("hidden");
  g6el.feedback.classList.add("hidden");
  g6el.evaluating.classList.add("hidden");
  g6el.nextBtn.classList.add("hidden");
  g6el.skipBtn.classList.remove("hidden");
  g6el.error.classList.add("hidden");
  g6el.wordBadge.classList.add("hidden");
  g6el.correctSection.classList.add("hidden");
  g6el.errorsSection.classList.add("hidden");
  g6el.correctedRow.classList.add("hidden");
  g6el.yourSentence.innerHTML = "";
  if (g6el.debugRaw) g6el.debugRaw.textContent = "";
  g6el.textarea.value = "";
  g6el.submitBtn.disabled = false;

  g6el.cardCounter.textContent = g6Rounds.length > 1
    ? `Rd ${g6CurrentRound + 1} · ${g6Index + 1} / ${g6Deck.length}`
    : `${g6Index + 1} / ${g6Deck.length}`;
  g6el.progressFill.style.width = `${(g6Index / g6Deck.length) * 100}%`;

  g6GenerateSentence(g6CurrentWord);
}

// ===========================
// Sentence Generation
// ===========================
const G6_GEN_RULES = {
  beginner: `- Keep the sentence short and clear: 6–10 words maximum
- Use only simple, concrete, everyday vocabulary
- Use present tense or simple past only — no subjunctive or compound tenses
- Focus on a single character or setting so the student has a clear direction
- Make the setup direct and obvious to continue`,

  intermediate: `- Use descriptive and emotional vocabulary: 10–18 words
- Compound or complex sentences are fine
- Include character motivation, setting detail, or an evolving situation
- Use imagery or sensory detail to make the scene vivid
- Multiple characters and varied tenses (preterite, imperfect, future) are encouraged`,

  advanced: `- Use nuanced, symbolic, or sophisticated vocabulary: 15–25 words
- Employ layered sentence structure — subordinate clauses, inversions, participial phrases
- Introduce thematic depth: character psychology, moral ambiguity, or subtext
- Foreshadowing, irony, or symbolic detail is strongly encouraged
- The sentence should demand a response with literary quality`,
};

function g6BuildGenPrompt(targetWord) {
  const rules = G6_GEN_RULES[g6Difficulty] || G6_GEN_RULES.intermediate;
  return `You are generating a Spanish story sentence for a language learning game.
Level: ${g6Difficulty.toUpperCase()}

${rules}
- Do NOT use the word "${targetWord.spanish}" or any of its conjugated forms — the student must introduce it
- Return ONLY the sentence. No quotes, no labels, no extra text.`;
}

async function g6GenerateSentence(targetWord) {
  const systemPrompt = g6BuildGenPrompt(targetWord);

  try {
    const raw = await aiGenerate(systemPrompt, "Generate the sentence now.", { model: g6Model });
    const sentence = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^["'«»]|["'«»]$/g, "")
      .split("\n")[0]
      .trim();

    if (!sentence) throw new Error("Empty response from AI");

    g6CurrentSentence = sentence;
    g6el.aiSentence.textContent = sentence;
    g6el.targetWord.textContent = targetWord.spanish;
    g6el.loading.classList.add("hidden");
    g6el.sentenceCard.classList.remove("hidden");
    g6el.inputArea.classList.remove("hidden");
    g6el.textarea.focus();

  } catch (err) {
    g6el.loading.classList.add("hidden");
    g6el.error.textContent = `Failed to generate sentence: ${err.message}`;
    g6el.error.classList.remove("hidden");
  }
}

// ===========================
// Evaluation
// ===========================
const G6_DIFFICULTY_GRADING = {
  beginner: `DIFFICULTY — BEGINNER: Be forgiving and encouraging. Prioritise meaning over perfection.
- If the message is clear, score grammar and syntax 7 or above unless errors obscure the meaning
- Accept basic vocabulary and simple structure; do not penalise lack of sophistication
- Be generous with wordUsage — reward any recognisable form
- Keep error notes very simple and supportive`,

  intermediate: `DIFFICULTY — INTERMEDIATE: Be moderately strict. Reward creativity and logical flow.
- Expect generally correct grammar and natural sentence structure; note clear mistakes
- Score 6–8 range for mostly correct work with minor issues
- Transitions and character continuity should feel natural`,

  advanced: `DIFFICULTY — ADVANCED: Be strict. Hold the student to a high literary standard.
- Reward subtlety, originality, and literary quality — penalise weak or generic expression
- Penalise contradictions, illogical narrative, and poor tone matching
- Expect strong thematic consistency; foreshadowing and symbolism raise the score`,
};

// Known top-level keys — also used by JSON repair logic
const G6_SCHEMA_KEYS = "grammar|syntax|clarity|wordUsage|wordFound|total|errors|correct|feedback|corrected";

function g6BuildEvalSystem() {
  const diffBlock = G6_DIFFICULTY_GRADING[g6Difficulty] || G6_DIFFICULTY_GRADING.intermediate;
  return `You are a beginner-friendly Spanish tutor grading a sentence continuation exercise. Return ONLY valid JSON — no markdown, no explanation outside the JSON.

TASK: A student was given a Spanish sentence and asked to write a continuation that uses a specific required word (or any conjugated/inflected form of it).

WHAT TO EVALUATE — identify ALL of the following mistake types if present:
- Grammar mistakes (wrong tense, wrong mood, missing articles)
- Verb conjugation mistakes (wrong ending for subject or tense)
- Gender/plural agreement issues (wrong article or adjective ending)
- Syntax or sentence structure problems (wrong word order, awkward construction)
- Incorrect word choice or preposition usage
- Missing accents only when they change meaning (e.g. sí vs si, él vs el)
- Spelling errors (wrong letters)

For EACH mistake, explain WHY it is wrong using simple beginner-friendly English. Also note what the learner did correctly — be honest but encouraging.

SCORING (each 0–10):

grammar (0–10): grammatical correctness
  10 = flawless  8–9 = one minor error  6–7 = a few errors but understandable  4–5 = several errors  0–3 = major issues

syntax (0–10): sentence structure and word order
  10 = natural and fluent  8–9 = mostly natural  6–7 = understandable but awkward  4–5 = confusing structure  0–3 = very hard to follow

clarity (0–10): overall clarity and naturalness of expression
  10 = sounds like a native speaker  8–9 = very clear  6–7 = clear with minor issues  4–5 = understandable with effort  0–3 = unclear

wordUsage (0–2): did the student use the required word?
  2 = the required word OR any conjugated/inflected form appears and is used correctly
      e.g. "hablar" → "habla", "hablé", "hablando", "hablamos" all earn 2 points
  1 = a recognisable form appears but used awkwardly
  0 = ONLY if no recognisable form appears anywhere — be generous, when in doubt award credit

${diffBlock}

Return this exact JSON format (no extra keys, no markdown):
{
  "grammar": 8,
  "syntax": 7,
  "clarity": 9,
  "wordUsage": 2,
  "wordFound": true,
  "correct": ["brief note on something done well", "another positive if genuinely warranted"],
  "errors": [
    {"type": "conjugation", "original": "exact wrong text", "corrected": "correct text", "note": "Beginner-friendly WHY explanation"}
  ],
  "feedback": "One encouraging overall sentence about the student's writing.",
  "corrected": "Full corrected Spanish sentence if there were errors, or empty string if perfect"
}

Error types must be one of: grammar, conjugation, agreement, syntax, word_choice, preposition, accent, spelling`;
}


// Robust JSON parser — handles trailing commas, unescaped control chars,
// surrounding prose, and unclosed arrays (AI forgot ] before a sibling key).
function g6ParseJSON(raw) {
  let s = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  // Extract outermost { } in case the model added surrounding text
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) s = objMatch[0];

  // Fix trailing commas before } or ] — very common LLM mistake
  s = s.replace(/,(\s*[}\]])/g, "$1");

  // Fix unescaped control chars inside string values (walk char-by-char)
  let out = "", inStr = false, escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped)       { out += ch; escaped = false; continue; }
    if (ch === "\\")   { escaped = true; out += ch; continue; }
    if (ch === '"')    { inStr = !inStr; out += ch; continue; }
    if (inStr) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  s = out;

  // Attempt 1: parse after basic cleanup
  try { return { parsed: JSON.parse(s), cleaned: s }; } catch {}

  // Attempt 2: fix unclosed arrays — AI put sibling keys inside an array.
  // Pattern: {...},"knownKey": inside an array where ] was missing.
  // e.g. "grammarErrors":[{...},"spellingErrors":[] → insert ] after {...}
  const s2 = s.replace(
    new RegExp(`\\}\\s*,\\s*("(?:${G6_SCHEMA_KEYS})"\\s*:)`, "g"),
    "}],$1"
  );
  console.log("[G6 JSON] Attempt 2 (fix unclosed array):", s2);
  try { return { parsed: JSON.parse(s2), cleaned: s2 }; } catch {}

  // Attempt 3: same fix but for string values inside a broken array
  // e.g. "someArr":["val","knownKey": → insert ] after "val"
  const s3 = s2.replace(
    new RegExp(`"\\s*,\\s*("(?:${G6_SCHEMA_KEYS})"\\s*:)`, "g"),
    '"],$1'
  );
  console.log("[G6 JSON] Attempt 3 (fix string in broken array):", s3);
  try { return { parsed: JSON.parse(s3), cleaned: s3 }; } catch (e) {
    throw new Error(e.message);
  }
}

// Highlight specific words in a sentence. Returns an HTML string.
// words: array of strings to mark; cls: CSS class for <mark>
function g6Highlight(sentence, words, cls) {
  let html = sentence
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  words.forEach(word => {
    if (!word) return;
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`(${esc})`, "gi"), `<mark class="${cls}">$1</mark>`);
  });
  return html;
}

// Returns true if targetWord or its stem (first 4 chars) appears in the text
function g6StemMatch(targetWord, text) {
  const target = targetWord.toLowerCase();
  const haystack = text.toLowerCase();
  if (haystack.includes(target)) return true;
  if (target.length >= 5) {
    return haystack.includes(target.slice(0, 4));
  }
  return false;
}

async function g6Submit() {
  const typed = g6el.textarea.value.trim();
  if (!typed || !g6CurrentSentence) return;

  g6el.submitBtn.disabled = true;
  g6el.skipBtn.classList.add("hidden");
  g6el.inputArea.classList.add("hidden");
  g6el.evaluating.classList.remove("hidden");

  const userPrompt = `Context sentence (AI-generated): "${g6CurrentSentence}"
Required word the student must use: "${g6CurrentWord.spanish}"
Student's continuation sentence: "${typed}"`;

  console.log("[G6 Eval] Sending to AI:", { sentence: g6CurrentSentence, word: g6CurrentWord.spanish, typed });

  let raw     = "";
  let cleaned = "";

  try {
    raw = await aiGenerate(g6BuildEvalSystem(), userPrompt, { model: g6Model });
    console.log("[G6 Eval] Raw AI response:", raw);

    const parseResult = g6ParseJSON(raw);
    cleaned = parseResult.cleaned;
    const result = parseResult.parsed;
    if (g6el.debugRaw) g6el.debugRaw.textContent = cleaned;
    console.log("[G6 Eval] Parsed result:", result);

    let grammar   = Math.min(10, Math.max(0, result.grammar   ?? 0));
    let syntax    = Math.min(10, Math.max(0, result.syntax    ?? 0));
    let clarity   = Math.min(10, Math.max(0, result.clarity   ?? 0));
    let wordUsage = Math.min(2,  Math.max(0, result.wordUsage ?? 0));

    // JS fallback: if AI scored wordUsage=0 but stem is present, override to 1
    const stemFound = g6StemMatch(g6CurrentWord.spanish, typed);
    if (wordUsage === 0 && stemFound) {
      console.warn(`[G6 Eval] wordUsage override: stem of "${g6CurrentWord.spanish}" found in typed text despite AI score of 0 — bumping to 1`);
      wordUsage = 1;
    }

    // pts: scale the 3 main scores to /8 then add word usage /2 → max 10
    const pts = Math.round(((grammar + syntax + clarity) / 30) * 8) + wordUsage;

    g6Score += pts;
    g6Results.push({
      english: g6CurrentWord.english, spanish: g6CurrentWord.spanish,
      sentence: g6CurrentSentence, typed,
      grammar, syntax, clarity, wordUsage, pts,
      errors:    result.errors   || [],
      correct:   result.correct  || [],
      wordFound: result.wordFound ?? stemFound,
      feedback:  result.feedback  || "",
      corrected: result.corrected || "",
    });

    g6el.totalScore.textContent   = g6Score;
    animateScore(g6el.totalScore);
    g6el.scoreGrammar.textContent = `${grammar}/10`;
    g6el.scoreSyntax.textContent  = `${syntax}/10`;
    g6el.scoreClarity.textContent = `${clarity}/10`;
    g6el.scoreTotal.textContent   = `${pts}/10`;
    g6el.scoreTotal.style.color   = pts >= 8 ? "var(--green)" : pts >= 5 ? "var(--yellow)" : "var(--red)";

    // Word usage badge
    const wordFound = result.wordFound ?? stemFound;
    g6el.wordBadge.textContent  = wordFound ? `✓ Word used (${wordUsage}/2)` : `✗ Target word not found (0/2)`;
    g6el.wordBadge.style.color  = wordFound ? "var(--green)" : "var(--red)";
    g6el.wordBadge.classList.remove("hidden");

    g6el.feedbackText.textContent = result.feedback || "";

    const errors    = result.errors || [];
    const wrongWords = errors.map(e => e.original).filter(Boolean);
    const rightWords = errors.map(e => e.corrected).filter(Boolean);

    // Show typed sentence with error words underlined in red
    g6el.yourSentence.innerHTML = g6Highlight(typed, wrongWords, "g6-mark-wrong");

    // Show corrected sentence with fixed words highlighted in green (only if different)
    if (result.corrected && result.corrected.trim() !== typed.trim()) {
      g6el.corrected.innerHTML = g6Highlight(result.corrected, rightWords, "g6-mark-right");
      g6el.correctedRow.classList.remove("hidden");
    } else {
      g6el.correctedRow.classList.add("hidden");
    }

    // "What you did well" section
    const correctList = result.correct || [];
    if (correctList.length) {
      g6el.correctItems.innerHTML = correctList.map(c =>
        `<div class="g6-correct-item">✔ ${c}</div>`
      ).join("");
      g6el.correctSection.classList.remove("hidden");
    } else {
      g6el.correctSection.classList.add("hidden");
    }

    // Error type label map
    const TYPE_LABELS = {
      grammar: "Grammar", conjugation: "Conjugation", agreement: "Agreement",
      syntax: "Syntax", word_choice: "Word choice", preposition: "Preposition",
      accent: "Accent", spelling: "Spelling",
    };

    // Corrections list
    if (errors.length) {
      g6el.errorItems.innerHTML = errors.map(e => `
        <div class="g6-error-item">
          ${e.type ? `<span class="g6-err-type">${TYPE_LABELS[e.type] || e.type}</span>` : ""}
          <mark class="g6-mark-wrong">${e.original}</mark>
          <span class="g6-err-arrow">→</span>
          <mark class="g6-mark-right">${e.corrected}</mark>
          ${e.note ? `<span class="g6-err-note">${e.note}</span>` : ""}
        </div>`).join("");
      g6el.errorsSection.classList.remove("hidden");
    } else {
      g6el.errorsSection.classList.add("hidden");
    }

    g6el.evaluating.classList.add("hidden");
    g6el.feedback.classList.remove("hidden");
    g6el.nextBtn.classList.remove("hidden");

  } catch (err) {
    console.error("[G6 Eval] Failed:", err, "\nCleaned:", cleaned, "\nRaw:", raw);
    if (g6el.debugRaw) {
      g6el.debugRaw.textContent =
        `ERROR: ${err.message}\n\n— Cleaned attempt —\n${cleaned || "(empty)"}\n\n— Raw response —\n${raw || "(empty)"}`;
    }
    g6el.evaluating.classList.add("hidden");
    g6Results.push({
      english: g6CurrentWord.english, spanish: g6CurrentWord.spanish,
      sentence: g6CurrentSentence, typed,
      grammar: 0, syntax: 0, clarity: 0, wordUsage: 0, pts: 0,
      errors: [], correct: [], wordFound: false,
      feedback: "Could not evaluate.", corrected: "",
    });
    g6el.scoreGrammar.textContent  = "—";
    g6el.scoreSyntax.textContent   = "—";
    g6el.scoreClarity.textContent  = "—";
    g6el.scoreTotal.textContent    = "0/10";
    g6el.scoreTotal.style.color    = "var(--red)";
    g6el.wordBadge.classList.add("hidden");
    g6el.feedbackText.textContent  = `⚠ Evaluation failed — expand Debug below to see what the AI returned`;
    g6el.correctSection.classList.add("hidden");
    g6el.errorsSection.classList.add("hidden");
    g6el.correctedRow.classList.add("hidden");
    g6el.feedback.classList.remove("hidden");
    g6el.nextBtn.classList.remove("hidden");
  }
}

function g6NextCard() {
  g6Index++;
  if (g6Index >= g6Deck.length) g6ShowResults();
  else g6LoadCard();
}

function g6SkipCard() {
  g6Results.push({
    english: g6CurrentWord?.english || "—", spanish: g6CurrentWord?.spanish || "—",
    sentence: g6CurrentSentence || "—", typed: "—",
    grammar: 0, syntax: 0, clarity: 0, wordUsage: 0, pts: 0, errors: [], correct: [], feedback: "Skipped", corrected: "",
  });
  g6Index++;
  if (g6Index >= g6Deck.length) g6ShowResults();
  else g6LoadCard();
}

// ===========================
// Results
// ===========================
function g6ShowResults() {
  const max = g6Deck.length * 10;
  const pct = Math.round((g6Score / max) * 100);

  document.getElementById("g6-final-score").textContent     = g6Score;
  document.getElementById("g6-final-score-max").textContent = `/ ${max}`;

  const totalRounds = g6Rounds.length;
  document.getElementById("g6-results-title").textContent =
    totalRounds > 1 ? `Round ${g6CurrentRound + 1} Complete!` : "Round Complete!";

  const icon = document.getElementById("g6-results-icon");
  const msg  = document.getElementById("g6-results-message");
  if      (pct >= 90) { icon.textContent = "🏆"; msg.textContent = "Excellent! You write like a native!"; }
  else if (pct >= 70) { icon.textContent = "🌟"; msg.textContent = "Great work — your Spanish is really flowing."; }
  else if (pct >= 50) { icon.textContent = "📚"; msg.textContent = "Good effort! Keep practising grammar and spelling."; }
  else                { icon.textContent = "💪"; msg.textContent = "Keep going — writing gets easier with practice!"; }

  const breakdown = document.getElementById("g6-results-breakdown");
  breakdown.innerHTML = g6Results.map(r => `
    <div class="breakdown-row">
      <span class="breakdown-english">${r.english}</span>
      <span class="breakdown-spanish">${r.spanish}</span>
      <span class="breakdown-pts" style="color:${r.pts >= 7 ? "var(--green)" : r.pts >= 4 ? "var(--yellow)" : "var(--red)"}">${r.pts}/10</span>
    </div>`).join("");

  g6el.progressFill.style.width = "100%";
  historySave({ game: "story-weaver", score: g6Score, max, pct, words: g6Deck.length,
    difficulty: g6Difficulty, round: g6CurrentRound + 1, totalRounds: g6Rounds.length });

  const nextRoundBtn = document.getElementById("g6-next-round-btn");
  const retryBtn     = document.getElementById("g6-retry-btn");
  if (g6CurrentRound + 1 < totalRounds) {
    nextRoundBtn.textContent = `Next Round ${g6CurrentRound + 2} →`;
    nextRoundBtn.classList.remove("hidden");
    retryBtn.textContent = "Restart Game";
  } else {
    nextRoundBtn.classList.add("hidden");
    retryBtn.textContent = "Play Again";
  }

  showScreen("game6-results-screen");
}

// ===========================
// Model Picker
// ===========================
let g6SelectedModel      = null;
let g6SelectedDifficulty = "intermediate";

async function openG6ModelPicker() {
  g6SelectedModel = null;
  document.getElementById("start-game6-btn").disabled = true;
  document.getElementById("g6-model-error").classList.add("hidden");

  // Init difficulty buttons from settings
  const savedDiff = settingsGet().defaultDifficulty || "intermediate";
  g6SelectedDifficulty = savedDiff;
  document.querySelectorAll("#g6-difficulty-options .difficulty-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.level === savedDiff);
  });

  const s          = settingsGet();
  const provider   = s.provider || "ollama";
  const loadingMsg = provider === "ollama"
    ? "Loading models from Ollama..."
    : `Using ${PROVIDER_LABELS[provider] || provider}`;
  document.getElementById("g6-model-list").innerHTML = `<div class="model-loading">${loadingMsg}</div>`;
  document.getElementById("g6-model-picker-modal").classList.remove("hidden");

  if (provider === "ollama") {
    try {
      await ollamaFetchModels();
    } catch {
      document.getElementById("g6-model-error").textContent = "Could not connect to Ollama. Start it with: ollama serve";
      document.getElementById("g6-model-error").classList.remove("hidden");
      document.getElementById("g6-model-list").innerHTML = "";
      return;
    }
  }
  populateModelList(
    document.getElementById("g6-model-list"),
    document.getElementById("start-game6-btn"),
    (model) => { g6SelectedModel = model; }
  );
}

// ===========================
// Event Listeners
// ===========================
document.getElementById("pick-game6").addEventListener("click", openG6ModelPicker);

document.querySelectorAll("#g6-difficulty-options .difficulty-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#g6-difficulty-options .difficulty-btn")
      .forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    g6SelectedDifficulty = btn.dataset.level;
  });
});

document.getElementById("start-game6-btn").addEventListener("click", () => {
  if (!g6SelectedModel) return;
  document.getElementById("g6-model-picker-modal").classList.add("hidden");
  startGame6(g6SelectedModel, g6SelectedDifficulty);
});

document.getElementById("cancel-g6-btn").addEventListener("click", () => {
  document.getElementById("g6-model-picker-modal").classList.add("hidden");
});

document.getElementById("g6-model-picker-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("g6-model-picker-modal"))
    document.getElementById("g6-model-picker-modal").classList.add("hidden");
});

document.getElementById("g6-start-round-btn").addEventListener("click", g6StartRound);
document.getElementById("g6-preround-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g6-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("g6-home-results-btn").addEventListener("click", () => showScreen("home-screen"));

g6el.submitBtn.addEventListener("click", g6Submit);
g6el.textarea.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); g6Submit(); }
});
g6el.nextBtn.addEventListener("click", g6NextCard);
g6el.skipBtn.addEventListener("click", g6SkipCard);

document.getElementById("g6-next-round-btn").addEventListener("click", () => {
  g6CurrentRound++;
  g6ShowPreRound();
});
document.getElementById("g6-retry-btn").addEventListener("click", () => startGame6(g6Model, g6Difficulty));
