import { DEFAULT_SETTINGS, ESTATE_BLUEPRINTS, STORAGE } from "./gameData";
import { createInitialGameState } from "./gameLogic";

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJSON(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    return;
  }
}

function normalizeSettings(rawSettings) {
  if (!rawSettings || typeof rawSettings !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const rawMode = rawSettings.effectMode;
  const effectMode = rawMode === "off" || rawMode === "webgl" ? rawMode : DEFAULT_SETTINGS.effectMode;

  return {
    sfxVolume: clampNumber(rawSettings.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
    sfxMuted: Boolean(rawSettings.sfxMuted),
    effectMode,
  };
}

function normalizeEstates(rawEstates) {
  const source = Array.isArray(rawEstates) ? rawEstates : [];
  return ESTATE_BLUEPRINTS.map((blueprint) => {
    const found = source.find((estate) => estate?.id === blueprint.id);
    return {
      ...blueprint,
      owned: Boolean(found?.owned),
      currentVal: clampNumber(
        found?.currentVal,
        blueprint.basePrice,
        Number.MAX_SAFE_INTEGER,
        blueprint.basePrice,
      ),
      growth: clampNumber(found?.growth, blueprint.growth, Number.MAX_SAFE_INTEGER, blueprint.growth),
    };
  });
}

function normalizeGameState(rawGameState) {
  const base = createInitialGameState();
  if (!rawGameState || typeof rawGameState !== "object") {
    return base;
  }

  return {
    score: clampNumber(rawGameState.score, 0, Number.MAX_SAFE_INTEGER, base.score),
    up1Level: clampNumber(rawGameState.up1Level, 0, Number.MAX_SAFE_INTEGER, base.up1Level),
    up1Cost: clampNumber(rawGameState.up1Cost, 100, Number.MAX_SAFE_INTEGER, base.up1Cost),
    up2Level: clampNumber(rawGameState.up2Level, 0, Number.MAX_SAFE_INTEGER, base.up2Level),
    up2Cost: clampNumber(rawGameState.up2Cost, 100, Number.MAX_SAFE_INTEGER, base.up2Cost),
    up3Level: clampNumber(rawGameState.up3Level, 0, 5, base.up3Level),
    worldTreeTimer: clampNumber(rawGameState.worldTreeTimer, 0, 9, base.worldTreeTimer),
    estates: normalizeEstates(rawGameState.estates),
    focus: clampNumber(rawGameState.focus, 0, 100, base.focus),
    burstActiveUntil: clampNumber(
      rawGameState.burstActiveUntil,
      0,
      Number.MAX_SAFE_INTEGER,
      base.burstActiveUntil,
    ),
    burstCooldownUntil: clampNumber(
      rawGameState.burstCooldownUntil,
      0,
      Number.MAX_SAFE_INTEGER,
      base.burstCooldownUntil,
    ),
  };
}

export function loadSettings() {
  const payload = readJSON(STORAGE.settingsKey);
  if (!payload || payload.version !== STORAGE.version) {
    return { ...DEFAULT_SETTINGS };
  }
  return normalizeSettings(payload.settings);
}

export function saveSettings(settings) {
  writeJSON(STORAGE.settingsKey, {
    version: STORAGE.version,
    settings: normalizeSettings(settings),
  });
}

export function loadGameState() {
  const payload = readJSON(STORAGE.gameKey);
  if (!payload || payload.version !== STORAGE.version) {
    return createInitialGameState();
  }
  return normalizeGameState(payload.state);
}

export function saveGameState(gameState) {
  writeJSON(STORAGE.gameKey, {
    version: STORAGE.version,
    savedAt: Date.now(),
    state: normalizeGameState(gameState),
  });
}

export function resetSavedGameState() {
  localStorage.removeItem(STORAGE.gameKey);
}
