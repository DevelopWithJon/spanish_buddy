// ===========================
// Settings
// ===========================
const SETTINGS_KEY = "spanishBuddy_settings";

const SETTINGS_DEFAULTS = {
  provider:           "ollama",
  apiKey:             "",
  cloudModel:         null,
  defaultModel:       null,
  ttsSpeed:           0.9,
  defaultDifficulty:  "intermediate",
  roundSize:          10,
};

function settingsGet() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) } : { ...SETTINGS_DEFAULTS };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

function settingsSave(updates) {
  const current = settingsGet();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...updates }));
}
