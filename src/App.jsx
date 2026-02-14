import { useEffect, useMemo, useRef, useState } from "react";
import {
  BALANCE,
  BURST_SOUND,
  CLICK_SOUNDS,
  ESTATE_BLUEPRINTS,
  FALL_IMAGES,
  UPGRADE_1_SOUND,
  UPGRADE_2_SOUND,
  formatNumber,
} from "./gameData";
import {
  activateBurst,
  applyBufferedMainClicks,
  buyEstate,
  calculateDynamicMultiplier,
  canBuyEstate,
  createInitialGameState,
  getAutoPower,
  getClickPower,
  getNextAutoIncrement,
  getNextRankTarget,
  getRankMultiplier,
  purchaseUpgrade1,
  purchaseUpgrade2,
  runTick,
  sellEstate,
} from "./gameLogic";
import { loadGameState, loadSettings, resetSavedGameState, saveGameState, saveSettings } from "./storage";
import ResetConfirmModal from "./ResetConfirmModal";
import { useGameAudio } from "./useGameAudio";
import WebGLFallingLayer from "./WebGLFallingLayer";

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function toSeconds(ms) {
  return Math.ceil(ms / 1000);
}

const ALL_SFX_PATHS = [
  ...CLICK_SOUNDS,
  UPGRADE_1_SOUND,
  UPGRADE_2_SOUND,
  BURST_SOUND,
  ...ESTATE_BLUEPRINTS.map((estate) => estate.audio).filter(Boolean),
];

const CLICK_FLUSH_INTERVAL_MS = 34;
const CLICK_SFX_MIN_INTERVAL_MS = 85;
const CLICK_SFX_MAX_CONCURRENT = 3;
const CLICK_EFFECT_MIN_INTERVAL_MS = 80;

function resolveClickRatio(event) {
  if (typeof event?.clientX !== "number" || window.innerWidth <= 0) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, event.clientX / window.innerWidth));
}

export default function App() {
  const [gameState, setGameState] = useState(loadGameState);
  const [settings, setSettings] = useState(loadSettings);
  const [nowMs, setNowMs] = useState(Date.now());
  const [helpOpen, setHelpOpen] = useState(false);
  const [estateOpen, setEstateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const fallingLayerRef = useRef(null);
  const pendingClicksRef = useRef(0);
  const clickFlushTimerRef = useRef(0);
  const lastClickRatioRef = useRef(0.5);
  const lastEffectAtRef = useRef(0);
  const { playSound } = useGameAudio(settings, {
    preloadPaths: ALL_SFX_PATHS,
    defaultMaxConcurrent: 3,
  });

  const dynamicMultiplier = useMemo(
    () => calculateDynamicMultiplier(gameState, nowMs),
    [gameState, nowMs],
  );

  const clickPower = useMemo(
    () => getClickPower(gameState.up1Level, gameState.up3Level) * dynamicMultiplier,
    [gameState.up1Level, gameState.up3Level, dynamicMultiplier],
  );

  const autoPower = useMemo(
    () => getAutoPower(gameState.up2Level) * dynamicMultiplier,
    [gameState.up2Level, dynamicMultiplier],
  );

  const nextRankTarget = getNextRankTarget(gameState.up3Level);
  const rankRemain = nextRankTarget === null ? 0 : Math.max(0, nextRankTarget - gameState.up1Level);
  const nextAutoIncrement = getNextAutoIncrement(gameState.up2Level);

  const burstRemainMs = Math.max(0, gameState.burstActiveUntil - nowMs);
  const burstCooldownRemainMs = Math.max(0, gameState.burstCooldownUntil - nowMs);
  const canUseBurst =
    gameState.up2Level >= BALANCE.burstUnlockLevel &&
    gameState.focus >= BALANCE.burstFocusCost &&
    burstCooldownRemainMs === 0;

  useEffect(() => {
    const tickId = setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      setGameState((previous) => runTick(previous, currentNow));
    }, BALANCE.tickMs);

    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    const clockId = setInterval(() => {
      setNowMs(Date.now());
    }, 240);

    return () => clearInterval(clockId);
  }, []);

  useEffect(() => {
    let timeoutId = 0;
    let idleId = 0;

    const persist = () => {
      saveGameState(gameState);
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(persist, { timeout: 450 });
      return () => window.cancelIdleCallback(idleId);
    }

    timeoutId = window.setTimeout(persist, 220);
    return () => window.clearTimeout(timeoutId);
  }, [gameState]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!toastMessage) return undefined;

    const timeoutId = setTimeout(() => {
      setToastMessage("");
    }, 2800);

    return () => clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    const preventContextMenu = (event) => event.preventDefault();
    const preventDragStart = (event) => event.preventDefault();

    window.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("dragstart", preventDragStart);

    return () => {
      window.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("dragstart", preventDragStart);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setHelpOpen(false);
      setSettingsOpen(false);
      setResetModalOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(
    () => () => {
      if (clickFlushTimerRef.current) {
        window.clearTimeout(clickFlushTimerRef.current);
        clickFlushTimerRef.current = 0;
      }
    },
    [],
  );

  const flushBufferedClicks = () => {
    clickFlushTimerRef.current = 0;

    const clickCount = pendingClicksRef.current;
    if (clickCount <= 0) return;
    pendingClicksRef.current = 0;

    const currentNow = Date.now();
    setGameState((previous) => applyBufferedMainClicks(previous, currentNow, clickCount).nextState);

    playSound(pickRandom(CLICK_SOUNDS), {
      minIntervalMs: CLICK_SFX_MIN_INTERVAL_MS,
      throttleKey: "main-click-sfx",
      concurrencyKey: "main-click-sfx",
      maxConcurrent: CLICK_SFX_MAX_CONCURRENT,
      skipIfBusy: true,
    });

    if (settings.effectMode !== "webgl") {
      return;
    }

    if (currentNow - lastEffectAtRef.current < CLICK_EFFECT_MIN_INTERVAL_MS) {
      return;
    }

    lastEffectAtRef.current = currentNow;
    fallingLayerRef.current?.spawnBurst({
      amount: Math.min(4, 1 + Math.floor(clickCount / 2)),
      originRatioX: lastClickRatioRef.current,
      scatter: 0.42,
    });
  };

  const enqueueMainClick = (originRatioX) => {
    pendingClicksRef.current += 1;
    lastClickRatioRef.current = originRatioX;

    if (clickFlushTimerRef.current) return;
    clickFlushTimerRef.current = window.setTimeout(flushBufferedClicks, CLICK_FLUSH_INTERVAL_MS);
  };

  const onMainClick = (event) => {
    event.preventDefault();

    enqueueMainClick(resolveClickRatio(event));
  };

  const onUpgrade1 = () => {
    let result = null;

    setGameState((previous) => {
      result = purchaseUpgrade1(previous);
      return result.nextState;
    });

    if (!result?.purchased) return;

    playSound(UPGRADE_1_SOUND);

    if (result.rankIncreased) {
      const rankPower = getRankMultiplier(result.nextState.up3Level);
      setToastMessage(`랭크 업! ${formatNumber(rankPower)}배 더 강해졌다구!`);
    }
  };

  const onUpgrade2 = () => {
    let result = null;
    let previousLevel = 0;

    setGameState((previous) => {
      previousLevel = previous.up2Level;
      result = purchaseUpgrade2(previous);
      return result.nextState;
    });

    if (!result?.purchased) return;

    playSound(UPGRADE_2_SOUND);

    if (previousLevel < BALANCE.focusUnlockLevel && result.nextState.up2Level >= BALANCE.focusUnlockLevel) {
      setToastMessage("집중 게이지 해금! 클릭 유지 시 배율이 올라갑니다.");
    }

    if (previousLevel < BALANCE.burstUnlockLevel && result.nextState.up2Level >= BALANCE.burstUnlockLevel) {
      setToastMessage("각성 모드 해금! 후반에 수동 가속이 가능합니다.");
    }
  };

  const onBuyEstate = (estateId) => {
    let result = null;

    setGameState((previous) => {
      result = buyEstate(previous, estateId);
      return result.nextState;
    });

    if (!result?.purchased) return;

    const estateData = ESTATE_BLUEPRINTS.find((estate) => estate.id === estateId);
    if (estateData?.audio) {
      playSound(estateData.audio);
    }
  };

  const onSellEstate = (estateId) => {
    setGameState((previous) => sellEstate(previous, estateId).nextState);
  };

  const onActivateBurst = () => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    let activated = false;

    setGameState((previous) => {
      const result = activateBurst(previous, currentNow);
      activated = result.activated;
      return result.nextState;
    });

    if (!activated) return;

    playSound(BURST_SOUND);
    setToastMessage("각성 모드 발동! 잠시 동안 자동/클릭 수익이 크게 증가합니다.");
  };

  const onResetProgressConfirm = () => {
    resetSavedGameState();
    setGameState(createInitialGameState());
    setNowMs(Date.now());
    setResetModalOpen(false);
    setToastMessage("진행상황을 초기화했습니다.");
  };

  const openResetModal = () => {
    setSettingsOpen(false);
    setResetModalOpen(true);
  };

  return (
    <div className="game-root">
      {settings.effectMode === "webgl" && <WebGLFallingLayer ref={fallingLayerRef} texturePaths={FALL_IMAGES} />}

      <button
        className={`settings-fab ${settingsOpen ? "open" : ""}`}
        type="button"
        aria-label="설정 패널 열기"
        onClick={() => setSettingsOpen((previous) => !previous)}
      >
        <span className="settings-fab__icon">⚙</span>
        <span>설정</span>
      </button>

      <div
        className={`settings-backdrop ${settingsOpen ? "open" : ""}`}
        role="presentation"
        onClick={() => setSettingsOpen(false)}
      />

      <aside className={`settings-drawer ${settingsOpen ? "open" : ""}`}>
        <div className="settings-drawer__header">
          <strong className="settings-drawer__title">게임 설정</strong>
          <button className="settings-button" type="button" onClick={() => setSettingsOpen(false)}>
            닫기
          </button>
        </div>

        <div className="settings-drawer__subtitle">효과음과 저장 데이터를 관리합니다.</div>

        <label className={`settings-volume ${settings.sfxMuted ? "muted" : ""}`} htmlFor="sfx-volume">
          <div className="settings-volume__label">
            <span>효과음 볼륨</span>
            <strong>{Math.round(settings.sfxVolume * 100)}%</strong>
          </div>

          <input
            id="sfx-volume"
            className="settings-volume__slider"
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.sfxVolume * 100)}
            style={{ accentColor: settings.sfxMuted ? "#d45858" : "#67ab9b" }}
            onChange={(event) => {
              const volumeValue = Number(event.target.value) / 100;
              setSettings((previous) => ({ ...previous, sfxVolume: volumeValue }));
            }}
          />

          <div className={`settings-volume__bar ${settings.sfxMuted ? "muted" : ""}`}>
            <div style={{ width: `${Math.round(settings.sfxVolume * 100)}%` }} />
          </div>
        </label>

        <button
          className={`settings-button ${settings.sfxMuted ? "muted" : ""}`}
          type="button"
          onClick={() => setSettings((previous) => ({ ...previous, sfxMuted: !previous.sfxMuted }))}
        >
          <span className="settings-button__icon" aria-hidden="true">
            {settings.sfxMuted ? "🔇" : "🔊"}
          </span>
          <span>{settings.sfxMuted ? "음소거 중" : "사운드 켜짐"}</span>
        </button>

        <div className="settings-mode">
          <div className="settings-mode__title">클릭 이펙트</div>
          <div className="settings-mode__buttons">
            <button
              className={`settings-mode__button ${settings.effectMode === "webgl" ? "active" : ""}`}
              type="button"
              onClick={() => setSettings((previous) => ({ ...previous, effectMode: "webgl" }))}
            >
              WebGL
            </button>
            <button
              className={`settings-mode__button ${settings.effectMode === "off" ? "active" : ""}`}
              type="button"
              onClick={() => setSettings((previous) => ({ ...previous, effectMode: "off" }))}
            >
              끔 (저사양)
            </button>
          </div>
        </div>

        <button className="settings-button settings-button--danger" type="button" onClick={openResetModal}>
          진행상황 초기화
        </button>
      </aside>

      <ResetConfirmModal
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        onConfirm={onResetProgressConfirm}
      />

      <div className={`rank-toast ${toastMessage ? "show" : ""}`}>{toastMessage || "랭크 업!"}</div>

      <div className={`help-modal-overlay ${helpOpen ? "open" : ""}`} onClick={() => setHelpOpen(false)} role="presentation">
        <div className="help-modal-body" onClick={(event) => event.stopPropagation()}>
          <button className="help-modal-close" onClick={() => setHelpOpen(false)} type="button">
            ×
          </button>
          <h2>도움말</h2>
          <p>
            춤추는 나를 누르면 포인트가 올라간다구!
            <br />
            근력을 강화하면 자동으로 랭크가 올라서 클릭 파워가 증폭돼!
            <br />
            후반에는 집중/각성 시스템으로 성장 템포를 직접 끌어올릴 수 있어!
            <br />
            마지막 목표는 세계수 교단을 차지하는 거야!
          </p>
        </div>
      </div>

      <aside className={`estate-tab ${estateOpen ? "open" : ""}`}>
        <button className="estate-tab-toggle" onClick={() => setEstateOpen((previous) => !previous)} type="button">
          부동산
        </button>

        <h2>부동산 매물</h2>

        <div className="estate-list">
          {gameState.estates.map((estate) => {
            const allOthersOwned = gameState.estates
              .filter((item) => !item.isSpecial)
              .every((item) => item.owned);
            const levelMet = gameState.up2Level >= estate.reqLevel;
            const specialMet = !estate.isSpecial || allOthersOwned;
            const purchasable = canBuyEstate(gameState, estate.id);

            return (
              <article key={estate.id} className={`estate-item ${estate.owned ? "owned" : ""}`}>
                <div className="estate-name">{estate.name}</div>
                <div className="estate-desc">{estate.desc}</div>
                <div className="estate-growth">상승률: +{formatNumber(estate.growth)} / s</div>
                <div className={`estate-req ${levelMet ? "ok" : ""}`}>요구 새로운 결말 Lv.{estate.reqLevel}</div>
                {estate.isSpecial && (
                  <div className={`estate-req ${specialMet ? "ok" : ""}`}>선행 부동산 3개 보유 필요</div>
                )}

                {estate.owned && <div className="estate-value">현재 가치: {formatNumber(estate.currentVal)}P</div>}

                {estate.owned ? (
                  <button className="upgrade-btn" onClick={() => onSellEstate(estate.id)} type="button">
                    판매 ({formatNumber(estate.currentVal)}P)
                  </button>
                ) : (
                  <button
                    className="upgrade-btn"
                    disabled={!purchasable}
                    onClick={() => onBuyEstate(estate.id)}
                    type="button"
                  >
                    구매 ({formatNumber(estate.basePrice)}P)
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </aside>

      <div className="ui-layer">
        <section className="score-container">
          <div className="score-title">이-히힛! 포인트</div>
          <div className="score-value">{formatNumber(gameState.score)}</div>
          <div className="score-stats">
            <span>클릭: +{formatNumber(clickPower)}</span>
            <span>초당: +{formatNumber(autoPower)}</span>
          </div>
          <div className="rank-label">현재 랭크: {gameState.up3Level} / 5</div>
          <div className="focus-label">동적 배율: x{dynamicMultiplier.toFixed(2)}</div>
        </section>

        <h1>마카샤 시뮬레이터</h1>

        <div className="main-center">
          <div className="dance-button-wrap">
            <img
              className="click-target"
              src="/resources/dancing.gif"
              alt="dancing"
              onClick={onMainClick}
              onDragStart={(event) => event.preventDefault()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onMainClick(event);
                }
              }}
            />
          </div>

          <div className="upgrade-list">
            <button className="upgrade-btn" disabled={gameState.score < gameState.up1Cost} onClick={onUpgrade1} type="button">
              <div>근력 강화! (Lv.{gameState.up1Level})</div>
              <div className={`upgrade-info ${nextRankTarget === null ? "danger" : ""}`}>
                {nextRankTarget === null ? "최대 랭크 도달!" : `다음 랭크까지: ${rankRemain} Lv`}
              </div>
              <div>비용: {formatNumber(gameState.up1Cost)}P</div>
            </button>

            <button className="upgrade-btn" disabled={gameState.score < gameState.up2Cost} onClick={onUpgrade2} type="button">
              <div>새로운 결말! (Lv.{gameState.up2Level})</div>
              <div className="upgrade-info success">강화당 초당 +{formatNumber(nextAutoIncrement)}P</div>
              <div>비용: {formatNumber(gameState.up2Cost)}P</div>
            </button>

            <button className="upgrade-btn" disabled={!canUseBurst} onClick={onActivateBurst} type="button">
              <div>각성 모드</div>
              <div className="upgrade-info success">
                {gameState.up2Level < BALANCE.burstUnlockLevel
                  ? `새로운 결말 Lv.${BALANCE.burstUnlockLevel} 해금`
                  : burstRemainMs > 0
                    ? `발동 중 (${toSeconds(burstRemainMs)}초)`
                    : burstCooldownRemainMs > 0
                      ? `쿨다운 (${toSeconds(burstCooldownRemainMs)}초)`
                      : `집중 ${BALANCE.burstFocusCost} 소모, ${toSeconds(BALANCE.burstDurationMs)}초 x${BALANCE.burstMultiplier}`}
              </div>
              <div>후반 루즈함 완화용 액티브</div>
            </button>

            <div className="focus-box">
              집중: {Math.round(gameState.focus)} / {BALANCE.focusCap}
            </div>

            <button className="help-open-btn" onClick={() => setHelpOpen(true)} type="button">
              설명 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
