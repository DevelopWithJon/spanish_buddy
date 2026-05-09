// ===========================
// Knowledge Hub
// ===========================

const KB_KEY     = "spanishBuddy_knowledge";
const KB_MAX     = 10;
const KB_OLLAMA  = "http://localhost:11434/api/chat";
const KB_MODEL   = "llava";

// Wire up PDF.js worker (loaded via CDN in index.html)
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

let kbProcessing = false;

const kbel = {
  uploadArea:  document.getElementById("kb-upload-area"),
  uploadInput: document.getElementById("kb-upload-input"),
  status:      document.getElementById("kb-status"),
  statusText:  document.getElementById("kb-status-text"),
  docList:     document.getElementById("kb-doc-list"),
  empty:       document.getElementById("kb-empty"),
  count:       document.getElementById("kb-count"),
};

// ===========================
// Storage
// ===========================
function kbGetAll() {
  try { return JSON.parse(localStorage.getItem(KB_KEY) || "[]"); }
  catch { return []; }
}

function kbSaveAll(entries) {
  localStorage.setItem(KB_KEY, JSON.stringify(entries));
}

function kbAddEntry(entry) {
  const entries = kbGetAll();
  entries.unshift(entry);
  if (entries.length > KB_MAX) entries.length = KB_MAX;
  kbSaveAll(entries);
}

function kbDeleteEntry(id) {
  kbSaveAll(kbGetAll().filter(e => e.id !== id));
  kbRender();
}

// Called by chat.js to inject knowledge into Sofía's system prompt
function kbGetContext() {
  const entries = kbGetAll();
  if (!entries.length) return "";
  const content = entries.map(e => `[${e.name}]\n${e.text}`).join("\n\n");
  return `
${"─".repeat(44)}
CURRENT STUDY MATERIAL (extracted from uploaded documents):
The student is currently studying the following material. Reference this when relevant — quiz them on vocabulary from it, use examples drawn from it, and tailor corrections to what they're learning.

${content}
${"─".repeat(44)}`;
}

// ===========================
// Render
// ===========================
function kbRender() {
  const entries = kbGetAll();
  const count   = entries.length;
  kbel.count.textContent = count === 0 ? "No documents" : `${count} document${count !== 1 ? "s" : ""}`;

  if (!count) {
    kbel.empty.classList.remove("hidden");
    kbel.docList.innerHTML = "";
    return;
  }

  kbel.empty.classList.add("hidden");
  kbel.docList.innerHTML = entries.map(e => {
    const preview = e.text.slice(0, 180) + (e.text.length > 180 ? "…" : "");
    const date    = new Date(e.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const icon    = e.name.toLowerCase().endsWith(".pdf") ? "📑" : "🖼️";
    return `
      <div class="kb-doc-card">
        <div class="kb-doc-icon">${icon}</div>
        <div class="kb-doc-info">
          <div class="kb-doc-name">${escapeHtml(e.name)}</div>
          <div class="kb-doc-date">${date}</div>
          <div class="kb-doc-preview">${escapeHtml(preview)}</div>
        </div>
        <button class="kb-delete-btn" data-id="${e.id}" title="Remove">✕</button>
      </div>`;
  }).join("");

  kbel.docList.querySelectorAll(".kb-delete-btn").forEach(btn => {
    btn.addEventListener("click", () => kbDeleteEntry(btn.dataset.id));
  });
}

// ===========================
// Status
// ===========================
function kbSetStatus(msg, isError = false) {
  if (!msg) {
    kbel.status.classList.add("hidden");
    return;
  }
  kbel.statusText.textContent = msg;
  kbel.status.classList.remove("hidden");
  kbel.status.classList.toggle("kb-status-error", isError);
  kbel.status.classList.toggle("kb-status-working", !isError);
}

// ===========================
// File handling
// ===========================
async function kbHandleFiles(files) {
  if (kbProcessing) return;
  kbProcessing = true;
  kbel.uploadArea.classList.add("kb-uploading");

  try {
    for (const file of Array.from(files)) {
      if (file.type === "application/pdf") {
        await kbProcessPDF(file);
      } else if (file.type.startsWith("image/")) {
        await kbProcessImage(file);
      }
    }
  } finally {
    kbProcessing = false;
    kbel.uploadArea.classList.remove("kb-uploading");
    kbSetStatus("");
  }
}

async function kbProcessImage(file) {
  kbSetStatus(`Analyzing ${file.name}…`);
  const base64 = await kbFileToBase64(file);
  const text   = await kbCallLlava(base64);
  kbAddEntry({ id: Date.now().toString(), name: file.name, text, addedAt: new Date().toISOString() });
  kbRender();
}

async function kbProcessPDF(file) {
  if (typeof pdfjsLib === "undefined") {
    throw new Error("PDF.js not loaded — refresh the page and try again.");
  }
  const buf      = await file.arrayBuffer();
  const pdf      = await pdfjsLib.getDocument({ data: buf }).promise;
  const total    = pdf.numPages;
  const pageTexts = [];

  for (let p = 1; p <= total; p++) {
    kbSetStatus(`Analyzing ${file.name} — page ${p} of ${total}…`);
    const page     = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas   = document.createElement("canvas");
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const base64   = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    const text     = await kbCallLlava(base64);
    pageTexts.push(`[Page ${p}]\n${text}`);
  }

  kbAddEntry({
    id:       Date.now().toString(),
    name:     file.name,
    text:     pageTexts.join("\n\n"),
    addedAt:  new Date().toISOString(),
  });
  kbRender();
}

// ===========================
// llava API
// ===========================
async function kbCallLlava(base64) {
  const res = await fetch(KB_OLLAMA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KB_MODEL,
      messages: [{
        role: "user",
        content: "This is a Spanish language learning document. Extract and describe all Spanish vocabulary, phrases, grammar rules, and any learning content you can see. Be thorough and structured.",
        images: [base64],
      }],
      stream: true,
      keep_alive: "10m",
      options: { temperature: 0.2, num_predict: 1024 },
    }),
  });

  if (!res.ok) throw new Error(`llava returned ${res.status} — is it installed? Run: ollama pull llava`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value, { stream: true }).split("\n")) {
      if (!line.trim()) continue;
      try { full += JSON.parse(line).message?.content || ""; }
      catch { /* partial chunk */ }
    }
  }
  return full.trim();
}

function kbFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===========================
// Event Listeners
// ===========================
kbel.uploadInput.addEventListener("change", e => {
  if (e.target.files?.length) {
    kbHandleFiles(e.target.files).catch(err => kbSetStatus(err.message, true));
    e.target.value = "";
  }
});

kbel.uploadArea.addEventListener("dragover", e => {
  e.preventDefault();
  kbel.uploadArea.classList.add("kb-drag-over");
});

kbel.uploadArea.addEventListener("dragleave", () => {
  kbel.uploadArea.classList.remove("kb-drag-over");
});

kbel.uploadArea.addEventListener("drop", e => {
  e.preventDefault();
  kbel.uploadArea.classList.remove("kb-drag-over");
  const files = e.dataTransfer?.files;
  if (files?.length) {
    kbHandleFiles(files).catch(err => kbSetStatus(err.message, true));
  }
});

document.getElementById("kb-home-btn").addEventListener("click", () => showScreen("home-screen"));

document.getElementById("home-knowledge-btn").addEventListener("click", () => {
  kbRender();
  showScreen("knowledge-hub-screen");
});

// Initial render when DOM is ready
kbRender();
