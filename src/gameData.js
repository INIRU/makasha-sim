export const CLICK_SOUNDS = [
  "/resources/이히힛1.mp3",
  "/resources/이히힛2.mp3",
  "/resources/이히힛3.mp3",
  "/resources/이히힛4.mp3",
];

export const FALL_IMAGES = [
  "/resources/scared.gif",
  "/resources/smile.gif",
  "/resources/sex.gif",
];

export const UPGRADE_1_SOUND = "/resources/아 여기서 더 강해지다니.mp3";
export const UPGRADE_2_SOUND = "/resources/새로운 이야기를 쓸때가 왔어.mp3";
export const BURST_SOUND = "/resources/나쁘지 않아 괜찮은 기분이야.mp3";

export const ESTATE_BLUEPRINTS = [
  {
    id: 0,
    name: "요정왕국 에르피엔",
    desc: "요정왕국 에르피엔이야!",
    basePrice: 200000,
    growth: 1000,
    reqLevel: 30,
    audio: "/resources/에르핀 우는 소리.mp3",
    isSpecial: false,
  },
  {
    id: 1,
    name: "마녀왕국 벨리티엔",
    desc: "어라? 이건 반역인가?",
    basePrice: 500000,
    growth: 4000,
    reqLevel: 60,
    audio: "/resources/말도 안되는 결과가.mp3",
    isSpecial: false,
  },
  {
    id: 2,
    name: "모나티엄",
    desc: "엘프들의 도시야!",
    basePrice: 1500000,
    growth: 10000,
    reqLevel: 90,
    audio: "/resources/예산이 부족했어.mp3",
    isSpecial: false,
  },
  {
    id: 3,
    name: "세계수 교단",
    desc: "내가 이제 대빵이다!",
    basePrice: 927000000,
    growth: 5521,
    reqLevel: 150,
    audio: "/resources/나쁘지 않아 괜찮은 기분이야.mp3",
    isSpecial: true,
  },
];

export const BALANCE = {
  maxRank: 5,
  tickMs: 1000,
  burstUnlockLevel: 70,
  burstFocusCost: 60,
  burstDurationMs: 12000,
  burstCooldownMs: 45000,
  burstMultiplier: 3,
  focusUnlockLevel: 40,
  focusPerClick: 5,
  focusDecayPerTick: 3,
  focusCap: 100,
  endgameBoostStartLevel: 90,
  endgameBoostPerLevel: 0.01,
  endgameBoostMax: 0.75,
  specialGrowthBoost: 5521,
  specialGrowthCycle: 10,
};

export const STORAGE = {
  gameKey: "makasha-sim.game-state",
  settingsKey: "makasha-sim.settings",
  version: 1,
};

export const DEFAULT_SETTINGS = {
  sfxVolume: 0.7,
  sfxMuted: false,
  effectMode: "webgl",
};

export function formatNumber(value) {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return Math.floor(value).toString();
}

export function createInitialEstates() {
  return ESTATE_BLUEPRINTS.map((estate) => ({
    ...estate,
    currentVal: estate.basePrice,
    owned: false,
  }));
}
