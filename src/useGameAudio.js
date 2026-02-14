import { useCallback, useEffect, useRef } from "react";

function clampVolume(volume) {
  return Math.min(1, Math.max(0, Number(volume)));
}

function normalizePath(path) {
  return encodeURI(path);
}

export function useGameAudio(settings, options = {}) {
  const contextRef = useRef(null);
  const decodedBufferMapRef = useRef(new Map());
  const pendingLoadMapRef = useRef(new Map());
  const lastPlayAtRef = useRef(new Map());
  const activeCountByKeyRef = useRef(new Map());
  const mutedRef = useRef(Boolean(settings.sfxMuted));
  const volumeRef = useRef(clampVolume(settings.sfxVolume));

  const preloadPaths = options.preloadPaths ?? [];
  const defaultMaxConcurrent = options.defaultMaxConcurrent ?? 4;

  useEffect(() => {
    mutedRef.current = Boolean(settings.sfxMuted);
    volumeRef.current = clampVolume(settings.sfxVolume);
  }, [settings.sfxMuted, settings.sfxVolume]);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;

    if (!contextRef.current) {
      const ContextConstructor =
        typeof window.AudioContext === "function"
          ? window.AudioContext
          : typeof window["webkitAudioContext"] === "function"
            ? window["webkitAudioContext"]
            : null;
      if (!ContextConstructor) return null;
      contextRef.current = new ContextConstructor({ latencyHint: "interactive" });
    }

    return contextRef.current;
  }, []);

  const loadBuffer = useCallback(
    async (soundPath) => {
      if (!soundPath) return null;

      const safePath = normalizePath(soundPath);
      const cached = decodedBufferMapRef.current.get(safePath);
      if (cached) {
        return cached;
      }

      const pending = pendingLoadMapRef.current.get(safePath);
      if (pending) {
        return pending;
      }

      const context = getAudioContext();
      if (!context) return null;

      const request = fetch(safePath, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load sound: ${safePath}`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)))
        .then((audioBuffer) => {
          decodedBufferMapRef.current.set(safePath, audioBuffer);
          return audioBuffer;
        })
        .catch(() => null)
        .finally(() => {
          pendingLoadMapRef.current.delete(safePath);
        });

      pendingLoadMapRef.current.set(safePath, request);
      return request;
    },
    [getAudioContext],
  );

  useEffect(() => {
    preloadPaths.forEach((path) => {
      if (!path) return;
      void loadBuffer(path);
    });
  }, [loadBuffer, preloadPaths]);

  useEffect(
    () => () => {
      lastPlayAtRef.current.clear();
      activeCountByKeyRef.current.clear();
      pendingLoadMapRef.current.clear();
      decodedBufferMapRef.current.clear();

      if (contextRef.current) {
        contextRef.current.close().catch(() => {
          return;
        });
      }
      contextRef.current = null;
    },
    [],
  );

  const playSound = useCallback(
    (soundPath, playOptions = {}) => {
      if (!soundPath || mutedRef.current) return;

      const volume = volumeRef.current;
      if (volume <= 0) return;

      const throttleKey = playOptions.throttleKey ?? soundPath;
      const minIntervalMs = Math.max(0, playOptions.minIntervalMs ?? 0);
      if (minIntervalMs > 0) {
        const now = performance.now();
        const previous = lastPlayAtRef.current.get(throttleKey) ?? -Infinity;
        if (now - previous < minIntervalMs) {
          return;
        }
        lastPlayAtRef.current.set(throttleKey, now);
      }

      const concurrencyKey = playOptions.concurrencyKey ?? throttleKey;
      const maxConcurrent = Math.max(1, playOptions.maxConcurrent ?? defaultMaxConcurrent);
      const activeCount = activeCountByKeyRef.current.get(concurrencyKey) ?? 0;
      if (activeCount >= maxConcurrent) {
        if (playOptions.skipIfBusy ?? true) {
          return;
        }
      }

      void loadBuffer(soundPath).then((buffer) => {
        if (!buffer) return;

        const context = getAudioContext();
        if (!context) return;

        if (context.state === "suspended") {
          void context.resume();
        }

        const nextCount = (activeCountByKeyRef.current.get(concurrencyKey) ?? 0) + 1;
        activeCountByKeyRef.current.set(concurrencyKey, nextCount);

        const source = context.createBufferSource();
        const gainNode = context.createGain();
        source.buffer = buffer;
        gainNode.gain.value = volume;
        source.connect(gainNode);
        gainNode.connect(context.destination);

        source.onended = () => {
          const current = activeCountByKeyRef.current.get(concurrencyKey) ?? 1;
          activeCountByKeyRef.current.set(concurrencyKey, Math.max(0, current - 1));
          source.disconnect();
          gainNode.disconnect();
        };

        try {
          source.start(0);
        } catch {
          const current = activeCountByKeyRef.current.get(concurrencyKey) ?? 1;
          activeCountByKeyRef.current.set(concurrencyKey, Math.max(0, current - 1));
          source.disconnect();
          gainNode.disconnect();
        }
      });
    },
    [defaultMaxConcurrent, getAudioContext, loadBuffer],
  );

  return { playSound };
}
