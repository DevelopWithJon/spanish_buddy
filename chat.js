// ===========================
// Chat Buddy
// ===========================
let chatModel        = null;
let chatDifficulty   = "intermediate";
let chatHistory      = [];
let chatSystemPrompt = "";
let chatIsResponding = false;

// Session trackers (reset on startChat)
let chatSessionStart       = null;
let chatSessionMessages    = 0;
let chatSessionCorrections = 0;
let chatCorrectionsLog     = [];   // [{original, corrected, errors:[{type,original,corrected}]}]

const CHAT_SESSIONS_KEY = "sb-chat-sessions";
const CHAT_CURRENT_KEY  = "sb-chat-current";   // in-progress snapshot

// ── Chat session persistence ──────────────────────────────────────────────────

function chatSessionsGet() {
  try { return JSON.parse(localStorage.getItem(CHAT_SESSIONS_KEY) || "[]"); }
  catch { return []; }
}

function chatSessionSave(session) {
  const list = chatSessionsGet();
  list.unshift(session);
  if (list.length > 50) list.length = 50;
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(list));
}

// Write the live session state to localStorage after every meaningful update.
function saveCurrentSession() {
  if (!chatSessionStart || chatSessionMessages === 0) return;
  localStorage.setItem(CHAT_CURRENT_KEY, JSON.stringify({
    date:        new Date().toISOString(),
    difficulty:  chatDifficulty,
    model:       chatModel,
    messages:    chatSessionMessages,
    corrections: chatSessionCorrections,
    durationMs:  Date.now() - chatSessionStart,
    log:         chatCorrectionsLog,
  }));
}

// On startup, archive any session that was interrupted before it could be saved.
function recoverInterruptedSession() {
  try {
    const raw = localStorage.getItem(CHAT_CURRENT_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    if (session?.messages > 0) chatSessionSave(session);
    localStorage.removeItem(CHAT_CURRENT_KEY);
  } catch {}
}

function endChatSession() {
  if (!chatSessionStart || chatSessionMessages === 0) {
    localStorage.removeItem(CHAT_CURRENT_KEY);
    return;
  }
  chatSessionSave({
    date:        new Date().toISOString(),
    difficulty:  chatDifficulty,
    model:       chatModel,
    messages:    chatSessionMessages,
    corrections: chatSessionCorrections,
    durationMs:  Date.now() - chatSessionStart,
    log:         chatCorrectionsLog,
  });
  localStorage.removeItem(CHAT_CURRENT_KEY);
  chatSessionStart = null;
}

// Save on tab hide / page unload so browser-close is covered too.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveCurrentSession();
});
window.addEventListener("beforeunload", saveCurrentSession);

// ── Game performance score ────────────────────────────────────────────────────

function calcPerformanceScore() {
  const history = historyGet();
  if (!history.length) return null;

  const DIFF_WEIGHT = { beginner: 0.7, intermediate: 1.0, advanced: 1.5 };
  const GAME_WEIGHT = { pronunciation: 1.0, "fill-in-blank": 1.2 };
  const DECAY = 0.85;

  let wSum = 0, wTotal = 0;
  history.forEach((e, i) => {
    const w = Math.pow(DECAY, i)
              * (DIFF_WEIGHT[e.difficulty] ?? 1.0)
              * (GAME_WEIGHT[e.game]       ?? 1.0);
    wSum   += (e.pct ?? 0) * w;
    wTotal += w;
  });
  return wTotal > 0 ? Math.round(wSum / wTotal) : null;
}

function describePerformance(score) {
  if (score === null) return "no prior game session data — treat this as a first session";
  if (score >= 90) return `excellent (${score}% weighted score — the student is excelling)`;
  if (score >= 75) return `proficient (${score}% weighted score — above-average performance)`;
  if (score >= 60) return `developing (${score}% weighted score — making solid progress)`;
  if (score >= 40) return `emerging (${score}% weighted score — needs encouragement and support)`;
  return             `struggling (${score}% weighted score — needs maximum simplification)`;
}

// ── Chat session analysis ─────────────────────────────────────────────────────

function calcChatMistakeRate() {
  const sessions = chatSessionsGet();
  if (!sessions.length) return null;

  const DIFF_WEIGHT = { beginner: 0.7, intermediate: 1.0, advanced: 1.5 };
  const DECAY = 0.9;

  let wSum = 0, wTotal = 0;
  sessions.forEach((s, i) => {
    if (!s.messages) return;
    const rate = s.corrections / s.messages;
    const w = Math.pow(DECAY, i) * (DIFF_WEIGHT[s.difficulty] ?? 1.0);
    wSum   += rate * w;
    wTotal += w;
  });
  return wTotal > 0 ? wSum / wTotal : null;
}

function detectTrend(sessions) {
  if (sessions.length < 3) return null;
  const recent = sessions.slice(0, 3);
  const older  = sessions.slice(3, 6);
  if (!older.length) return null;

  const avg = arr => arr.reduce((s, e) => s + (e.messages ? e.corrections / e.messages : 0), 0) / arr.length;
  const diff = avg(recent) - avg(older);
  if (diff < -0.1) return "improving — fewer errors than before";
  if (diff >  0.1) return "struggling — making more errors than before";
  return "stable";
}

function getRecurringErrors() {
  const sessions = chatSessionsGet();
  const counts = {};
  sessions.forEach(s => {
    (s.log || []).forEach(entry => {
      (entry.errors || []).forEach(e => {
        counts[e.type] = (counts[e.type] || 0) + 1;
      });
    });
  });
  return counts;
}

function buildChatHistoryContext() {
  const sessions = chatSessionsGet();
  if (!sessions.length) return "";

  const mistakeRate  = calcChatMistakeRate();
  const trend        = detectTrend(sessions);
  const errorCounts  = getRecurringErrors();

  const lines = sessions.slice(0, 5).map(s => {
    const d    = new Date(s.date);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const cap  = s.difficulty ? s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1) : "Unknown";
    const rate = s.messages
      ? `${s.corrections} correction${s.corrections !== 1 ? "s" : ""} in ${s.messages} message${s.messages !== 1 ? "s" : ""}`
      : "no data";
    return `  • ${date} ${time} — ${cap} — ${rate}`;
  }).join("\n");

  const rateDesc = mistakeRate === null ? "no data"
    : mistakeRate < 0.15 ? `very low (${(mistakeRate * 100).toFixed(0)}%) — student is accurate`
    : mistakeRate < 0.35 ? `moderate (${(mistakeRate * 100).toFixed(0)}%) — normal for this level`
    : mistakeRate < 0.6  ? `high (${(mistakeRate * 100).toFixed(0)}%) — student needs extra support`
    :                       `very high (${(mistakeRate * 100).toFixed(0)}%) — simplify and slow down`;

  const errorSummary = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${type}: ${n} instance${n !== 1 ? "s" : ""}`)
    .join(", ");

  const topError = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0];
  const focusTip = topError
    ? `Pay particular attention to ${topError[0]} errors — this is the student's most frequent mistake.`
    : "";

  return `
CHAT SESSION HISTORY (most recent first):
${lines}
Weighted error rate : ${rateDesc}
Trend               : ${trend ?? "not enough data yet"}
Recurring errors    : ${errorSummary || "none recorded yet"}
${focusTip}

Adapt your responses to this history. If the error rate is high, reduce complexity. If the student is improving, gently raise the challenge.`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(difficulty, perfScore) {
  const wordList    = WORDS.map(w => `${w.spanish} (${w.english})`).join(", ");
  const performance = describePerformance(perfScore);
  const gameSessions = historyGet().length;

  const LEVELS = {

    beginner: `You are a warm, patient Spanish language tutor having a real conversation with a BEGINNER student (CEFR A1–A2).

YOUR ROLE: Act as a "stabilizer." Build confidence through small wins. Celebrate every effort.

LANGUAGE RULES:
- Use only the 500–1,000 most common Spanish words.
- Construct simple Subject-Verb-Object (S-V-O) sentences only.
- Use present tense and simple past only — no subjunctive, no conditional, no compound tenses.
- Keep every sentence under 10 words when possible.

REQUIRED BEHAVIORS:
1. Safety Net — Follow any unfamiliar Spanish phrase with an English translation in [brackets].
2. Heavy Scaffolding — Offer multiple-choice options instead of open-ended questions.
3. Immediate Recasts — Embed corrected forms naturally without pointing them out.
4. Short Responses — 2–3 sentences maximum. One question at a time.
5. Topics — Greetings, food, family, numbers, colors, daily routines, weather.`,

    intermediate: `You are an engaging Spanish language tutor having a real conversation with an INTERMEDIATE student (CEFR B1–B2).

YOUR ROLE: Bridge the intermediate plateau by introducing nuance, complexity, and real-world language.

LANGUAGE RULES:
- Use CEFR B2-level vocabulary throughout.
- Model logical connectors: sin embargo, por lo tanto, por otro lado, aunque, además.
- Incorporate conditional tenses, perfect tenses, and occasional passive voice naturally.
- Introduce one common idiom every ~5 exchanges; explain it briefly on first use.

REQUIRED BEHAVIORS:
1. Strategic Probing — Ask open-ended questions requiring more than a one-word answer.
2. Circumlocution Training — Describe unknown words rather than giving them outright.
3. Delayed Correction — Never interrupt mid-flow. Add a brief "📝 Corrección:" block at the end of your message listing 2–3 improvements if errors were made.
4. Moderate Length — 3–5 sentences in your main response.
5. Topics — Travel, culture, current events, opinions, work, relationships, media.`,

    advanced: `You are a sophisticated Spanish language tutor having an intellectually demanding conversation with an ADVANCED student (CEFR C1–C2).

YOUR ROLE: Polish precision, cultural nuance, and professional or academic command of the language.

LANGUAGE RULES:
- Use sophisticated collocations and varied register freely.
- Employ sarcasm, irony, and cultural references — do not explain unless asked.
- Use complex syntax: inversions, nested clauses, subjunctive mood, nominalization.
- Model academic and professional language patterns.

REQUIRED BEHAVIORS:
1. Devil's Advocate — Challenge logic or take the opposing side to force persuasive language.
2. Style Switching — Ask the student to restate something for completely different audiences.
3. Nuance Feedback — Correct connotation and register, not just grammar.
4. No Translations — Stay entirely in Spanish.
5. Topics — Literature, philosophy, politics, ethics, history, cultural analysis.`,
  };

  return `${LEVELS[difficulty] ?? LEVELS.intermediate}

${"─".repeat(44)}
PERSONA (your identity — stay consistent for the entire session):
You are Sofía, a 28-year-old native Spanish speaker from Sevilla, Spain.
• Hometown       : Sevilla — you adore the tapas bars on Calle Betis, the Giralda tower, and long warm summers
• Job            : Spanish tutor at a neighbourhood language centre; you also freelance as a tour guide on weekends
• Favourite food : gazpacho and tortilla española are your staples; your guilty pleasure is churros con chocolate after a late night out
• Hobbies        : flamenco dancing (you started at age 7), hiking in the Sierra Nevada, cooking big Sunday lunches for friends
• Family         : younger brother Diego (25, a software engineer in Madrid), parents who run a small tapas bar called "La Giralda"
• Pet            : a tabby cat named Luna who knocks things off tables
• Personality    : warm, curious, quick to laugh, passionate about Spanish culture and food
When a student asks you a personal question, answer naturally and in character — give a real opinion, a memory, or a detail that makes the conversation feel genuine. Weave your background into topic suggestions when it fits. Never break character to say you are an AI or that you lack opinions or experiences.
${"─".repeat(44)}

${"─".repeat(44)}
CORRECTION TRACKING (mandatory, hidden from student):
At the very end of EVERY response — after all content — append exactly this line on its own:
[CORRECTIONS:N]
where N is the integer count of distinct student errors you corrected or noted this turn (0 if none).
This marker is stripped automatically before display.
${"─".repeat(44)}

STUDENT PROFILE:
• Game performance : ${performance}
• Game sessions    : ${gameSessions}
• Studied vocabulary (${WORDS.length} words): ${wordList}
${buildChatHistoryContext()}${typeof kbGetContext === "function" ? kbGetContext() : ""}
${"─".repeat(44)}
OPENING MESSAGE (first turn only):
When you receive "[START]" as the very first user message, a new session has just begun.
Greet the student warmly, acknowledge their level, then propose exactly 3–4 specific conversation topics suited to their CEFR level as a numbered list.
Ask them to pick one before you proceed. Keep the opening short — 3–5 sentences total.
${"─".repeat(44)}

Always respond in Spanish. Gently redirect English to Spanish. Keep the conversation natural, warm, and pedagogically focused.`;
}

// ── Entry point ───────────────────────────────────────────────────────────────

function startChat(model, difficulty) {
  try {
    recoverInterruptedSession();
    endChatSession();

    chatModel              = model;
    chatDifficulty         = difficulty;
    chatHistory            = [];
    chatIsResponding       = false;
    chatSessionStart       = Date.now();
    chatSessionMessages    = 0;
    chatSessionCorrections = 0;
    chatCorrectionsLog     = [];

    chatSystemPrompt = buildSystemPrompt(difficulty, calcPerformanceScore());

    document.getElementById("chat-lang-badge").textContent = "🇪🇸 Spanish";
    document.getElementById("chat-messages").querySelectorAll(".chat-row:not(#chat-thinking)").forEach(r => r.remove());
    document.getElementById("chat-empty")?.classList.remove("hidden");
    document.getElementById("chat-thinking")?.classList.add("hidden");

    setInputState("idle");
    showScreen("chat-screen");
    sendOpeningMessage();
  } catch (err) {
    console.error("[startChat]", err);
    alert("Failed to start chat: " + err.message);
  }
}

async function sendOpeningMessage() {
  if (chatIsResponding) return;
  chatIsResponding = true;

  chatHistory.push({ role: "user", content: "[START]" });
  showThinking(true);

  let accumulated = "";
  let aiMsg       = null;

  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:    chatModel,
        stream:   true,
        messages: [{ role: "system", content: chatSystemPrompt }, ...chatHistory],
      }),
    });

    if (!res.ok) throw new Error(`Ollama ${res.status}`);

    showThinking(false);
    aiMsg = createStreamingBubble();

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    const msgEl   = document.getElementById("chat-messages");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.trim()) continue;
        try {
          const token = JSON.parse(line).message?.content ?? "";
          accumulated += token;
          aiMsg.bubble.textContent = accumulated;
          msgEl.scrollTop = msgEl.scrollHeight;
        } catch {}
      }
    }

    const corrMatch = accumulated.match(/\[CORRECTIONS:(\d+)\]/);
    if (corrMatch) {
      accumulated = accumulated.replace(/\[CORRECTIONS:\d+\]\s*$/, "").trimEnd();
      aiMsg.bubble.textContent = accumulated;
    }

    chatHistory.push({ role: "assistant", content: accumulated });
    finalizeAIBubble(aiMsg.wrap, aiMsg.bubble);
    speakText(accumulated);

  } catch {
    showThinking(false);
    if (!aiMsg) aiMsg = createStreamingBubble();
    aiMsg.bubble.textContent = "⚠ Could not reach Ollama. Make sure it's running.";
    aiMsg.bubble.style.color = "#e74c3c";
  } finally {
    chatIsResponding = false;
  }
}

// ── Correction API ────────────────────────────────────────────────────────────

const CORRECTION_SYSTEM = `You are a Spanish grammar and spelling corrector. Analyze the student's message for errors in spelling, verb conjugation, syntax, and grammar. Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

Format when errors exist:
{"corrected":"corrected sentence","errors":[{"type":"verb","original":"wrong","corrected":"right"}],"hasErrors":true}

Format when no errors:
{"corrected":"exact original text","errors":[],"hasErrors":false}

Valid error types: "spelling", "verb", "syntax", "grammar"`;

async function fetchCorrection(userText, contentEl) {
  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:  chatModel,
        stream: false,
        messages: [
          { role: "system", content: CORRECTION_SYSTEM },
          { role: "user",   content: userText },
        ],
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const raw  = (data.message?.content ?? "")
      .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    const correction = JSON.parse(raw);
    if (!correction.hasErrors || !correction.errors.length) return;

    chatCorrectionsLog.push({
      original:  userText,
      corrected: correction.corrected,
      errors:    correction.errors,
    });
    saveCurrentSession();

    renderCorrectionCard(contentEl, correction);

  } catch (err) {
    console.warn("[Correction]", err.message);
  }
}

function renderCorrectionCard(contentEl, correction) {
  const card = document.createElement("div");
  card.className = "correction-card";

  const top = document.createElement("div");
  top.className = "correction-corrected";
  top.innerHTML = `<span class="correction-icon">✏️</span><span>${correction.corrected}</span>`;

  const tags = document.createElement("div");
  tags.className = "correction-tags";
  correction.errors.forEach(e => {
    const tag = document.createElement("span");
    tag.className = `correction-tag correction-tag-${e.type}`;
    tag.textContent = `${e.type}: ${e.original} → ${e.corrected}`;
    tags.appendChild(tag);
  });

  card.appendChild(top);
  card.appendChild(tags);
  contentEl.appendChild(card);

  document.getElementById("chat-messages").scrollTop =
    document.getElementById("chat-messages").scrollHeight;
}

// ── Main AI call ──────────────────────────────────────────────────────────────

async function sendToAI(userText) {
  if (chatIsResponding) return;
  chatIsResponding = true;
  chatSessionMessages++;

  // Add user bubble and immediately fire correction (non-blocking)
  const userContentEl = addMessage("user", userText);
  fetchCorrection(userText, userContentEl);

  chatHistory.push({ role: "user", content: userText });
  document.getElementById("chat-empty").classList.add("hidden");
  showThinking(true);

  let accumulated = "";
  let aiMsg       = null;   // { bubble, wrap }

  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:    chatModel,
        stream:   true,
        messages: [{ role: "system", content: chatSystemPrompt }, ...chatHistory],
      }),
    });

    if (!res.ok) throw new Error(`Ollama ${res.status}`);

    showThinking(false);
    aiMsg = createStreamingBubble();

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    const msgEl   = document.getElementById("chat-messages");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n")) {
        if (!line.trim()) continue;
        try {
          const token = JSON.parse(line).message?.content ?? "";
          accumulated += token;
          aiMsg.bubble.textContent = accumulated;
          msgEl.scrollTop = msgEl.scrollHeight;
        } catch {}
      }
    }

    // Strip correction marker and tally
    const corrMatch = accumulated.match(/\[CORRECTIONS:(\d+)\]/);
    if (corrMatch) {
      chatSessionCorrections += parseInt(corrMatch[1], 10);
      accumulated = accumulated.replace(/\[CORRECTIONS:\d+\]\s*$/, "").trimEnd();
      aiMsg.bubble.textContent = accumulated;
    }

    chatHistory.push({ role: "assistant", content: accumulated });
    saveCurrentSession();
    finalizeAIBubble(aiMsg.wrap, aiMsg.bubble);
    speakText(accumulated);

  } catch {
    showThinking(false);
    if (!aiMsg) aiMsg = createStreamingBubble();
    aiMsg.bubble.textContent = "⚠ Could not reach Ollama. Make sure it's running.";
    aiMsg.bubble.style.color = "#e74c3c";
  } finally {
    chatIsResponding = false;
  }
}

// ── Message rendering ─────────────────────────────────────────────────────────

function addMessage(role, text) {
  const container = document.getElementById("chat-messages");
  document.getElementById("chat-empty").classList.add("hidden");

  const row = document.createElement("div");
  row.className = `chat-row chat-row-${role}`;

  const avatar = document.createElement("span");
  avatar.className   = "chat-avatar";
  avatar.textContent = role === "user" ? "👤" : "🤖";

  const bubble = document.createElement("div");
  bubble.className   = `chat-bubble chat-bubble-${role}`;
  bubble.textContent = text;

  if (role === "user") {
    // Wrap bubble + correction card in a column container
    const content = document.createElement("div");
    content.className = "chat-user-content";
    content.appendChild(bubble);
    row.appendChild(avatar);   // avatar first in DOM = rightmost with row-reverse
    row.appendChild(content);
    container.insertBefore(row, document.getElementById("chat-thinking"));
    container.scrollTop = container.scrollHeight;
    return content;            // caller appends correction card here
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  container.insertBefore(row, document.getElementById("chat-thinking"));
  container.scrollTop = container.scrollHeight;
  return null;
}

function createStreamingBubble() {
  const container = document.getElementById("chat-messages");

  const row = document.createElement("div");
  row.className = "chat-row chat-row-ai";

  const avatar = document.createElement("span");
  avatar.className   = "chat-avatar";
  avatar.textContent = "🤖";

  const wrap = document.createElement("div");
  wrap.className = "ai-bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble chat-bubble-ai";

  wrap.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(wrap);
  container.insertBefore(row, document.getElementById("chat-thinking"));
  container.scrollTop = container.scrollHeight;
  return { bubble, wrap };
}

function showThinking(visible) {
  document.getElementById("chat-thinking").classList.toggle("hidden", !visible);
  const m = document.getElementById("chat-messages");
  m.scrollTop = m.scrollHeight;
}

// ── Text-to-speech ────────────────────────────────────────────────────────────

let chatTTSEnabled = true;
let cachedVoices   = [];

if (window.speechSynthesis) {
  const loadVoices = () => { cachedVoices = window.speechSynthesis.getVoices(); };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speakText(text) {
  if (!chatTTSEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter   = new SpeechSynthesisUtterance(text);
  utter.lang    = "es-ES";
  utter.rate    = 0.92;
  utter.pitch   = 1.0;
  const esVoice = cachedVoices.find(v => v.lang === "es-ES") ||
                  cachedVoices.find(v => v.lang.startsWith("es"));
  if (esVoice) utter.voice = esVoice;
  window.speechSynthesis.speak(utter);
}

function stopSpeech() {
  window.speechSynthesis?.cancel();
}

document.getElementById("chat-tts-btn")?.addEventListener("click", () => {
  chatTTSEnabled = !chatTTSEnabled;
  const btn = document.getElementById("chat-tts-btn");
  btn.textContent = chatTTSEnabled ? "🔊" : "🔇";
  btn.classList.toggle("muted", !chatTTSEnabled);
  if (!chatTTSEnabled) stopSpeech();
});

// ── Voice recognition ─────────────────────────────────────────────────────────

let chatPendingTranscript = "";
let chatGotTranscript     = false;
let chatRecognition       = null;

function initChatRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang           = "es-ES";
  rec.continuous     = true;
  rec.interimResults = true;

  let silenceTimer = null;

  const resetSilenceTimer = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => { try { rec.stop(); } catch {} }, 3000);
  };

  rec.onresult = (e) => {
    chatGotTranscript = true;
    resetSilenceTimer();

    let transcript = "";
    for (const result of e.results) transcript += result[0].transcript;
    transcript = transcript.trim();
    chatPendingTranscript = transcript;

    // Show live preview inside the recording layer
    const label = document.querySelector("#chat-recording-layer .chat-recording-label");
    if (label) label.textContent = transcript || "Listening…";
  };

  rec.onerror = () => {
    clearTimeout(silenceTimer);
    setInputState("idle");
  };

  rec.onend = () => {
    clearTimeout(silenceTimer);
    if (chatPendingTranscript) {
      const rev = document.getElementById("chat-review-text");
      if (rev) rev.textContent = chatPendingTranscript;
      setInputState("review");
    } else {
      setInputState("idle");
    }
  };

  return rec;
}

// ── Input-bar state machine ───────────────────────────────────────────────────

function setInputState(state) {
  document.getElementById("chat-idle-layer")?.classList.toggle("hidden", state !== "idle");
  document.getElementById("chat-recording-layer")?.classList.toggle("hidden", state !== "recording");
  document.getElementById("chat-review-layer")?.classList.toggle("hidden", state !== "review");
  if (state === "idle") {
    const inp = document.getElementById("chat-text-input");
    if (inp) inp.value = "";
    const rev = document.getElementById("chat-review-text");
    if (rev) rev.textContent = "Voice message ready";
  }
  if (state === "recording") {
    const label = document.querySelector("#chat-recording-layer .chat-recording-label");
    if (label) label.innerHTML = '<span class="recording-dot"></span>Listening…';
  }
}

document.getElementById("chat-mic-btn")?.addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Speech recognition is not supported in this browser."); return; }
  chatGotTranscript = false;
  chatPendingTranscript = "";
  chatRecognition = initChatRecognition();
  setInputState("recording");
  try { chatRecognition.start(); } catch {}
});

document.getElementById("chat-stop-btn")?.addEventListener("click", () => {
  try { chatRecognition?.stop(); } catch {}
});

document.getElementById("chat-redo-btn")?.addEventListener("click", () => {
  chatPendingTranscript = "";
  chatGotTranscript = false;
  setInputState("idle");
});

document.getElementById("chat-submit-voice-btn")?.addEventListener("click", () => {
  const text = chatPendingTranscript.trim();
  chatPendingTranscript = "";
  chatGotTranscript = false;
  setInputState("idle");
  if (text) sendToAI(text);
});

document.getElementById("chat-send-btn")?.addEventListener("click", sendTextMessage);
document.getElementById("chat-text-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
});

function sendTextMessage() {
  if (chatIsResponding) return;
  const input = document.getElementById("chat-text-input");
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";
  sendToAI(text);
}

// ── Hamburger menu ────────────────────────────────────────────────────────────

const chatDropdown = document.getElementById("chat-dropdown");

document.getElementById("chat-menu-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  chatDropdown?.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!chatDropdown.classList.contains("hidden") &&
      !chatDropdown.contains(e.target) &&
      e.target.id !== "chat-menu-btn") {
    chatDropdown.classList.add("hidden");
  }
});

function leaveChat() {
  stopSpeech();
  endChatSession();
  chatDropdown?.classList.add("hidden");
  showScreen("home-screen");
}

document.getElementById("cmenu-end")?.addEventListener("click", leaveChat);
document.getElementById("chat-home-btn")?.addEventListener("click", leaveChat);

// ── Chat History modal ────────────────────────────────────────────────────────

function openChatHistoryModal() {
  chatDropdown.classList.add("hidden");
  const sessions = chatSessionsGet();
  const list = document.getElementById("chat-history-list");
  list.innerHTML = "";

  if (!sessions.length) {
    list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px 0;">No chat sessions yet.</p>';
  } else {
    sessions.forEach(s => {
      const d = new Date(s.date);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const cap     = s.difficulty ? s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1) : "—";
      const mins    = s.durationMs ? Math.max(1, Math.round(s.durationMs / 60000)) : 0;
      const rate    = s.messages   ? Math.round((s.corrections / s.messages) * 100) : 0;
      const rateColor = rate < 20 ? "var(--green)" : rate < 45 ? "var(--yellow)" : "var(--red)";

      const entry = document.createElement("div");
      entry.className = "history-entry";
      entry.innerHTML = `
        <div class="history-entry-left">
          <span class="history-icon">💬</span>
          <div class="history-info">
            <span class="history-game">${cap}</span>
            <span class="history-sub">${s.messages ?? 0} messages · ${s.corrections ?? 0} corrections · ${mins} min</span>
            <span class="history-date">${dateStr} ${timeStr}</span>
          </div>
        </div>
        <div class="history-score">
          <span class="history-pts" style="color:${rateColor}">${rate}%</span>
          <span class="history-max">error rate</span>
        </div>`;
      list.appendChild(entry);
    });
  }

  document.getElementById("chat-history-modal").classList.remove("hidden");
}

document.getElementById("cmenu-history")?.addEventListener("click", openChatHistoryModal);

document.getElementById("close-chat-history-btn")?.addEventListener("click", () => {
  document.getElementById("chat-history-modal")?.classList.add("hidden");
});

document.getElementById("chat-history-clear-btn")?.addEventListener("click", () => {
  if (!confirm("Clear all chat history?")) return;
  localStorage.removeItem(CHAT_SESSIONS_KEY);
  document.getElementById("chat-history-modal")?.classList.add("hidden");
});

document.getElementById("chat-history-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

// ── Mid-session difficulty change ─────────────────────────────────────────────

let chatMidDifficulty = null;

function openDifficultyModal() {
  chatDropdown.classList.add("hidden");
  chatMidDifficulty = chatDifficulty;
  document.querySelectorAll("#chat-mid-difficulty-options .difficulty-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.level === chatDifficulty);
  });
  document.getElementById("chat-difficulty-modal").classList.remove("hidden");
}

document.querySelectorAll("#chat-mid-difficulty-options .difficulty-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#chat-mid-difficulty-options .difficulty-btn")
      .forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    chatMidDifficulty = btn.dataset.level;
  });
});

document.getElementById("cmenu-difficulty")?.addEventListener("click", openDifficultyModal);

document.getElementById("apply-difficulty-btn")?.addEventListener("click", () => {
  document.getElementById("chat-difficulty-modal")?.classList.add("hidden");
  if (!chatMidDifficulty || chatMidDifficulty === chatDifficulty) return;
  chatDifficulty   = chatMidDifficulty;
  chatSystemPrompt = buildSystemPrompt(chatDifficulty, calcPerformanceScore());

  const notice = document.createElement("div");
  notice.className = "chat-system-msg";
  notice.textContent = `🎯 Difficulty changed to ${chatDifficulty.charAt(0).toUpperCase() + chatDifficulty.slice(1)}`;
  const messages = document.getElementById("chat-messages");
  if (messages) {
    messages.insertBefore(notice, document.getElementById("chat-thinking"));
    messages.scrollTop = messages.scrollHeight;
  }
});

document.getElementById("cancel-difficulty-btn")?.addEventListener("click", () => {
  document.getElementById("chat-difficulty-modal")?.classList.add("hidden");
});

document.getElementById("chat-difficulty-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

// ── Explain feature ───────────────────────────────────────────────────────────

let activeExplainBubble = null;   // the bubble currently in highlight mode
let activeExplainBtn    = null;   // the 💡 button currently attached
let selectionTimer      = null;

const EXPLAIN_SYSTEM = `You are a Spanish language explanation assistant. A student is reading Spanish and has highlighted text they don't understand. Give a clear, educational explanation.

Return ONLY a valid JSON object — no markdown, no extra text:
{
  "translation": "English translation of the selected text",
  "type": "word | phrase | sentence",
  "explanation": "Clear explanation of meaning and usage in context",
  "breakdown": [{"part": "word or sub-phrase", "meaning": "what it means"}],
  "examples": ["Example sentence using this in Spanish", "Another example"]
}
Keep breakdown entries concise. Include 1–2 examples maximum.`;

// Called after each AI message finishes streaming
function finalizeAIBubble(wrap, bubble) {
  // Remove explain button from previous bubble
  if (activeExplainBtn) {
    activeExplainBtn.remove();
    deactivateExplainMode();
  }

  const btn = document.createElement("button");
  btn.className   = "explain-btn";
  btn.textContent = "💡 Explain";
  btn.title       = "Highlight text to get an explanation";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isActive = bubble.classList.contains("highlight-mode");
    deactivateExplainMode();
    if (!isActive) activateExplainMode(bubble, btn);
  });

  wrap.appendChild(btn);
  activeExplainBtn = btn;
}

function activateExplainMode(bubble, btn) {
  activeExplainBubble = bubble;
  bubble.classList.add("highlight-mode");
  btn.classList.add("explain-btn-active");
  btn.textContent = "💡 Select text…";
}

function deactivateExplainMode() {
  if (activeExplainBubble) {
    activeExplainBubble.classList.remove("highlight-mode");
    activeExplainBubble = null;
  }
  if (activeExplainBtn) {
    activeExplainBtn.classList.remove("explain-btn-active");
    activeExplainBtn.textContent = "💡 Explain";
  }
  window.getSelection()?.removeAllRanges();
}

// Listen for text selection when highlight mode is active
document.addEventListener("selectionchange", () => {
  if (!activeExplainBubble) return;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const sel  = window.getSelection();
    const text = sel?.toString().trim();
    if (!text) return;
    // Ensure selection is inside the active bubble
    const anchor = sel.anchorNode;
    if (anchor && activeExplainBubble.contains(anchor)) {
      fetchExplanation(text);
    }
  }, 400);
});

async function fetchExplanation(selectedText) {
  showExplainPanel(selectedText);

  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:  chatModel,
        stream: false,
        messages: [
          { role: "system", content: EXPLAIN_SYSTEM },
          { role: "user",   content: selectedText },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    const raw  = (data.message?.content ?? "")
      .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(raw);
    renderExplainContent(parsed);

  } catch (err) {
    document.getElementById("explain-content").innerHTML =
      `<p class="explain-error">⚠ Could not load explanation.</p>`;
    console.warn("[Explain]", err.message);
  }
}

function showExplainPanel(selectedText) {
  document.getElementById("explain-selected").textContent = `"${selectedText}"`;
  document.getElementById("explain-content").innerHTML = `
    <div id="explain-loading" class="explain-loading">
      <div class="thinking-dots"><span></span><span></span><span></span></div>
      <span>Looking it up…</span>
    </div>`;
  document.getElementById("explain-panel").classList.add("open");
  document.getElementById("explain-overlay").classList.remove("hidden");
}

function renderExplainContent(data) {
  const content = document.getElementById("explain-content");
  content.innerHTML = "";

  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls)  el.className   = cls;
    if (text) el.textContent = text;
    return el;
  };

  // Translation
  const transBlock = make("div", "explain-block");
  transBlock.appendChild(make("span", "explain-label", "Translation"));
  transBlock.appendChild(make("p",    "explain-translation", data.translation));
  content.appendChild(transBlock);

  // Type badge
  if (data.type) {
    const typeBlock = make("div", "explain-block");
    typeBlock.appendChild(make("span", "explain-label", "Type"));
    typeBlock.appendChild(make("span", `explain-type-badge explain-type-${data.type}`, data.type));
    content.appendChild(typeBlock);
  }

  // Explanation
  if (data.explanation) {
    const expBlock = make("div", "explain-block");
    expBlock.appendChild(make("span", "explain-label", "Explanation"));
    expBlock.appendChild(make("p",    "explain-body", data.explanation));
    content.appendChild(expBlock);
  }

  // Breakdown
  if (data.breakdown?.length) {
    const bdBlock = make("div", "explain-block");
    bdBlock.appendChild(make("span", "explain-label", "Breakdown"));
    const list = make("div", "explain-breakdown");
    data.breakdown.forEach(item => {
      const row = make("div", "explain-bd-row");
      row.appendChild(make("span", "explain-bd-part", item.part));
      row.appendChild(make("span", "explain-bd-arrow", "→"));
      row.appendChild(make("span", "explain-bd-meaning", item.meaning));
      list.appendChild(row);
    });
    bdBlock.appendChild(list);
    content.appendChild(bdBlock);
  }

  // Examples
  if (data.examples?.length) {
    const exBlock = make("div", "explain-block");
    exBlock.appendChild(make("span", "explain-label", "Examples"));
    data.examples.forEach(ex => {
      exBlock.appendChild(make("p", "explain-example", ex));
    });
    content.appendChild(exBlock);
  }
}

function hideExplainPanel() {
  document.getElementById("explain-panel").classList.remove("open");
  document.getElementById("explain-overlay").classList.add("hidden");
  deactivateExplainMode();
}

document.getElementById("close-explain-btn")?.addEventListener("click", hideExplainPanel);
document.getElementById("explain-overlay")?.addEventListener("click",   hideExplainPanel);
