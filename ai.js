// ===========================
// AI Abstraction Layer
// ===========================

const CLOUD_MODELS = {
  openai:      ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  gemini:      ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
  claude:      ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"],
  openrouter:  [
    // Free models (no credits needed — marked :free)
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free",
    "qwen/qwen3-8b:free",
    // Paid models
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "deepseek/deepseek-r1",
  ],
};

const PROVIDER_LABELS = {
  ollama:     "Ollama (Local)",
  openai:     "OpenAI",
  gemini:     "Google Gemini",
  claude:     "Anthropic Claude",
  openrouter: "OpenRouter",
};

const PROVIDER_ICONS = {
  ollama:     "🖥",
  openai:     "🤖",
  gemini:     "💎",
  claude:     "🟣",
  openrouter: "🔀",
};

// Returns the model that should be used for AI calls.
// Callers can override by passing model in opts.
function aiActiveModel(overrideModel) {
  if (overrideModel) return overrideModel;
  const s = settingsGet();
  const provider = s.provider || "ollama";
  if (provider === "ollama") return s.defaultModel || null;
  return s.cloudModel || CLOUD_MODELS[provider]?.[0] || null;
}

// ── Message format conversion ─────────────────────────────────────────────────

// Gemini uses a different content schema: {role, parts:[{text}]} and
// system messages go in a separate system_instruction field.
function aiMessagesToGemini(messages) {
  let systemInstruction = null;
  const contents = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemInstruction = { parts: [{ text: m.content }] };
    } else {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }
  return { contents, systemInstruction };
}

// ── Build provider-specific fetch params ──────────────────────────────────────

function aiBuildFetch(provider, model, apiKey, messages, opts = {}) {
  const { temperature = 0.7, maxTokens = 1024 } = opts;

  switch (provider) {

    case "openai":
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature,
          max_tokens: maxTokens,
        }),
      };

    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:8000",
          "X-Title": "Spanish Buddy",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature,
          max_tokens: maxTokens,
        }),
      };

    case "gemini": {
      const { contents, systemInstruction } = aiMessagesToGemini(messages);
      const reqBody = {
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      };
      if (systemInstruction) reqBody.system_instruction = systemInstruction;
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      };
    }

    case "claude": {
      // Claude separates the system message from the turn array.
      const system = messages.find(m => m.role === "system")?.content;
      const msgs   = messages.filter(m => m.role !== "system");
      const reqBody = { model, messages: msgs, stream: true, max_tokens: maxTokens };
      if (system) reqBody.system = system;
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // Required for direct browser access (key is stored client-side).
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(reqBody),
      };
    }

    default: // ollama
      return {
        url: "http://localhost:11434/api/chat",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          keep_alive: "10m",
          options: { temperature, num_predict: maxTokens },
        }),
      };
  }
}

// ── Token extraction ──────────────────────────────────────────────────────────
// Each provider has a different streaming wire format:
//   Ollama      — newline-delimited JSON  {"message":{"content":"token"}}
//   OpenAI      — SSE  data: {"choices":[{"delta":{"content":"token"}}]}
//   OpenRouter  — SSE  same as OpenAI
//   Gemini      — SSE  data: {"candidates":[{"content":{"parts":[{"text":"token"}]}}]}
//   Claude      — SSE  data: {"type":"content_block_delta","delta":{"text":"token"}}

function aiExtractToken(provider, line) {
  if (!line.trim()) return "";

  switch (provider) {

    case "openai":
    case "openrouter":
    case "gemini": {
      if (!line.startsWith("data: ")) return "";
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return "";
      try {
        const obj = JSON.parse(raw);
        if (provider === "gemini")
          return obj.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        // OpenAI / OpenRouter
        return obj.choices?.[0]?.delta?.content ?? "";
      } catch { return ""; }
    }

    case "claude": {
      if (!line.startsWith("data: ")) return "";
      try {
        const obj = JSON.parse(line.slice(6));
        if (obj.type === "content_block_delta" && obj.delta?.type === "text_delta")
          return obj.delta.text ?? "";
      } catch {}
      return "";
    }

    default: // ollama — newline-delimited JSON
      try { return JSON.parse(line).message?.content ?? ""; }
      catch { return ""; }
  }
}

// ── Main unified API ──────────────────────────────────────────────────────────

/**
 * aiChat(messages, opts)
 *
 * messages : [{role:"system"|"user"|"assistant", content:"..."}]
 * opts     : { model, onChunk(token, accumulated), temperature, maxTokens }
 *
 * Returns Promise<string> — full accumulated response text.
 * Streams internally regardless of provider; onChunk fires for each token.
 */
async function aiChat(messages, opts = {}) {
  const s        = settingsGet();
  const provider = s.provider || "ollama";
  const apiKey   = s.apiKeys?.[provider] || "";
  const model    = aiActiveModel(opts.model);
  const { onChunk, temperature, maxTokens } = opts;

  if (!model) {
    throw new Error(
      "No model configured. Open ⚙️ Settings and select a model."
    );
  }
  if (provider !== "ollama" && !apiKey) {
    throw new Error(
      `No API key set for ${PROVIDER_LABELS[provider] ?? provider}. Add one in ⚙️ Settings.`
    );
  }

  const { url, headers, body } = aiBuildFetch(
    provider, model, apiKey, messages, { temperature, maxTokens }
  );

  const res = await fetch(url, { method: "POST", headers, body });

  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    if (res.status === 429) {
      throw new Error("Rate limit exceeded (429). Wait a moment and try again, or upgrade your API plan.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Invalid or missing API key (${res.status}). Check your settings.`);
    }
    throw new Error(
      `${PROVIDER_LABELS[provider] ?? provider} error ${res.status}` +
      (detail ? ": " + detail.slice(0, 200) : "")
    );
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const token = aiExtractToken(provider, line);
      if (token) {
        accumulated += token;
        onChunk?.(token, accumulated);
      }
    }
  }

  return accumulated;
}

/**
 * aiGenerate(systemPrompt, userPrompt, opts)
 *
 * Convenience wrapper for single-turn generation.
 * Same opts as aiChat.
 */
async function aiGenerate(systemPrompt, userPrompt, opts = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });
  return aiChat(messages, opts);
}
