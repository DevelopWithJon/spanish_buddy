// ===========================
// Settings
// ===========================
const SETTINGS_KEY = "spanishBuddy_settings";

const SETTINGS_DEFAULTS = {
  provider:           "ollama",
  apiKeys:            { openai: "", gemini: "", claude: "", openrouter: "" },
  cloudModel:         null,
  defaultModel:       null,
  ttsSpeed:           0.9,
  defaultDifficulty:  "intermediate",
  roundSize:          10,
  elevenLabsKey:      "",
  elevenLabsVoiceId:  "",
};

function settingsGet() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...SETTINGS_DEFAULTS, apiKeys: { ...SETTINGS_DEFAULTS.apiKeys } };
    const saved = JSON.parse(raw);
    // Deep-merge apiKeys so each provider key survives an incremental save.
    const apiKeys = { ...SETTINGS_DEFAULTS.apiKeys, ...(saved.apiKeys || {}) };
    return { ...SETTINGS_DEFAULTS, ...saved, apiKeys };
  } catch {
    return { ...SETTINGS_DEFAULTS, apiKeys: { ...SETTINGS_DEFAULTS.apiKeys } };
  }
}

function settingsSave(updates) {
  const current = settingsGet();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...updates }));
}
