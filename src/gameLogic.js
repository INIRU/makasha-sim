import { BALANCE, createInitialEstates } from "./gameData";

export function createInitialGameState() {
  return {
    score: 0,
    up1Level: 0,
    up1Cost: 100,
    up2Level: 0,
    up2Cost: 100,
    up3Level: 0,
    worldTreeTimer: 0,
    estates: createInitialEstates(),
    focus: 0,
    burstActiveUntil: 0,
    burstCooldownUntil: 0,
  };
}

export function computeRank(up1Level) {
  if (up1Level < 100) return Math.floor(up1Level / 25);
  if (up1Level >= 150) return 5;
  return 4;
}

export function getRankMultiplier(rank) {
  let multiplier = 1;
  for (let i = 1; i <= rank; i += 1) {
    multiplier *= 2 ** i;
  }
  return multiplier;
}

export function getClickPower(up1Level, rank) {
  return (1 + up1Level) * getRankMultiplier(rank);
}

export function getAutoPower(up2Level) {
  let total = 0;
  for (let i = 1; i <= up2Level; i += 1) {
    if (i >= 90) total += 1000;
    else if (i >= 60) total += 200;
    else if (i >= 30) total += 50;
    else total += 10;
  }
  return total;
}

export function getNextAutoIncrement(up2Level) {
  if (up2Level >= 89) return 1000;
  if (up2Level >= 59) return 200;
  if (up2Level >= 29) return 50;
  return 10;
}

export function getNextRankTarget(rank) {
  if (rank >= BALANCE.maxRank) return null;
  if (rank < 4) return (rank + 1) * 25;
  return 150;
}

export function getEndgameBoost(up2Level) {
  if (up2Level < BALANCE.endgameBoostStartLevel) return 1;
  const boostedLevels = up2Level - BALANCE.endgameBoostStartLevel + 1;
  const bonus = Math.min(
    boostedLevels * BALANCE.endgameBoostPerLevel,
    BALANCE.endgameBoostMax,
  );
  return 1 + bonus;
}

export function calculateDynamicMultiplier(gameState, nowMs) {
  const focusMultiplier =
    gameState.up2Level >= BALANCE.focusUnlockLevel
      ? 1 + gameState.focus / BALANCE.focusCap
      : 1;
  const burstMultiplier =
    nowMs < gameState.burstActiveUntil ? BALANCE.burstMultiplier : 1;
  const endgameBoost = getEndgameBoost(gameState.up2Level);
  return focusMultiplier * burstMultiplier * endgameBoost;
}

export function runTick(gameState, nowMs) {
  const multiplier = calculateDynamicMultiplier(gameState, nowMs);
  const autoGain = getAutoPower(gameState.up2Level) * multiplier;
  const nextTimerRaw = gameState.worldTreeTimer + 1;
  const shouldBoostWorldTree = nextTimerRaw >= BALANCE.specialGrowthCycle;
  const nextEstates = gameState.estates.map((estate) => {
    if (!estate.owned) return estate;

    const appliedGrowth = estate.growth;
    const nextGrowth =
      estate.isSpecial && shouldBoostWorldTree
        ? estate.growth + BALANCE.specialGrowthBoost
        : estate.growth;

    return {
      ...estate,
      growth: nextGrowth,
      currentVal: estate.currentVal + appliedGrowth,
    };
  });

  const nextFocus =
    gameState.up2Level >= BALANCE.focusUnlockLevel
      ? Math.max(0, gameState.focus - BALANCE.focusDecayPerTick)
      : 0;

  return {
    ...gameState,
    score: gameState.score + autoGain,
    estates: nextEstates,
    worldTreeTimer: shouldBoostWorldTree ? 0 : nextTimerRaw,
    focus: nextFocus,
  };
}

export function purchaseUpgrade1(gameState) {
  if (gameState.score < gameState.up1Cost) {
    return { purchased: false, rankIncreased: false, nextState: gameState };
  }

  const nextUp1Level = gameState.up1Level + 1;
  const nextRank = computeRank(nextUp1Level);
  const rankIncreased = nextRank > gameState.up3Level;

  return {
    purchased: true,
    rankIncreased,
    nextState: {
      ...gameState,
      score: gameState.score - gameState.up1Cost,
      up1Level: nextUp1Level,
      up1Cost: Math.ceil(gameState.up1Cost * 1.1),
      up3Level: nextRank,
    },
  };
}

export function purchaseUpgrade2(gameState) {
  if (gameState.score < gameState.up2Cost) {
    return { purchased: false, nextState: gameState };
  }

  return {
    purchased: true,
    nextState: {
      ...gameState,
      score: gameState.score - gameState.up2Cost,
      up2Level: gameState.up2Level + 1,
      up2Cost: Math.ceil(gameState.up2Cost * 1.1),
    },
  };
}

export function applyMainClick(gameState, nowMs) {
  const multiplier = calculateDynamicMultiplier(gameState, nowMs);
  const clickGain = getClickPower(gameState.up1Level, gameState.up3Level) * multiplier;
  const focusGain =
    gameState.up2Level >= BALANCE.focusUnlockLevel ? BALANCE.focusPerClick : 0;

  return {
    clickGain,
    nextState: {
      ...gameState,
      score: gameState.score + clickGain,
      focus: Math.min(BALANCE.focusCap, gameState.focus + focusGain),
    },
  };
}

export function applyBufferedMainClicks(gameState, nowMs, clickCount) {
  const safeCount = Math.max(0, Math.floor(clickCount));
  if (safeCount === 0) {
    return {
      clickGain: 0,
      nextState: gameState,
    };
  }

  const baseClickPower = getClickPower(gameState.up1Level, gameState.up3Level);
  const burstMultiplier = nowMs < gameState.burstActiveUntil ? BALANCE.burstMultiplier : 1;
  const endgameBoost = getEndgameBoost(gameState.up2Level);
  const commonMultiplier = baseClickPower * burstMultiplier * endgameBoost;
  const focusEnabled = gameState.up2Level >= BALANCE.focusUnlockLevel;

  if (!focusEnabled) {
    const clickGain = commonMultiplier * safeCount;
    return {
      clickGain,
      nextState: {
        ...gameState,
        score: gameState.score + clickGain,
      },
    };
  }

  let runningFocus = gameState.focus;
  let totalGain = 0;

  for (let index = 0; index < safeCount; index += 1) {
    const focusMultiplier = 1 + runningFocus / BALANCE.focusCap;
    totalGain += commonMultiplier * focusMultiplier;
    runningFocus = Math.min(BALANCE.focusCap, runningFocus + BALANCE.focusPerClick);
  }

  return {
    clickGain: totalGain,
    nextState: {
      ...gameState,
      score: gameState.score + totalGain,
      focus: runningFocus,
    },
  };
}

export function canBuyEstate(gameState, estateId) {
  const estate = gameState.estates[estateId];
  if (!estate || estate.owned) return false;
  if (gameState.score < estate.basePrice) return false;
  if (gameState.up2Level < estate.reqLevel) return false;

  if (estate.isSpecial) {
    const allOthersOwned = gameState.estates
      .filter((item) => !item.isSpecial)
      .every((item) => item.owned);

    if (!allOthersOwned) return false;
  }

  return true;
}

export function buyEstate(gameState, estateId) {
  if (!canBuyEstate(gameState, estateId)) {
    return { purchased: false, nextState: gameState };
  }

  const target = gameState.estates[estateId];
  const nextEstates = gameState.estates.map((estate) =>
    estate.id === target.id
      ? {
          ...estate,
          owned: true,
          currentVal: estate.basePrice,
        }
      : estate,
  );

  return {
    purchased: true,
    nextState: {
      ...gameState,
      score: gameState.score - target.basePrice,
      estates: nextEstates,
    },
  };
}

export function sellEstate(gameState, estateId) {
  const target = gameState.estates[estateId];
  if (!target || !target.owned) {
    return { sold: false, nextState: gameState };
  }

  const nextEstates = gameState.estates.map((estate) =>
    estate.id === target.id
      ? {
          ...estate,
          owned: false,
          growth: createInitialEstates()[estate.id].growth,
          currentVal: estate.basePrice,
        }
      : estate,
  );

  return {
    sold: true,
    nextState: {
      ...gameState,
      score: gameState.score + target.currentVal,
      estates: nextEstates,
    },
  };
}

export function activateBurst(gameState, nowMs) {
  if (gameState.up2Level < BALANCE.burstUnlockLevel) {
    return { activated: false, nextState: gameState };
  }

  if (gameState.focus < BALANCE.burstFocusCost) {
    return { activated: false, nextState: gameState };
  }

  if (nowMs < gameState.burstCooldownUntil) {
    return { activated: false, nextState: gameState };
  }

  return {
    activated: true,
    nextState: {
      ...gameState,
      focus: gameState.focus - BALANCE.burstFocusCost,
      burstActiveUntil: nowMs + BALANCE.burstDurationMs,
      burstCooldownUntil: nowMs + BALANCE.burstCooldownMs,
    },
  };
}
