'use client';

/**
 * LATENT VAULT custom player.
 * Native <video> element, 100% custom UI. No third-party player code.
 * Streams bytes directly from the source via /api/play (307) — the app
 * server only authorises, it never proxies media.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatClock } from '@/lib/format';
import { loadProgress, saveProgress } from './progress';
import { PlaybackMetrics, type PlaybackReport } from './metrics';

export type PlayerState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'buffering'
  | 'ended'
  | 'error';

export interface PlayerError {
  title: string;
  detail: string;
  retryable: boolean;
}

interface LatentPlayerProps {
  contentId: string;
  title: string;
  poster?: string;
  /** e.g. "1080p" — shown honestly in settings, from probed data. */
  qualityLabel?: string;
  /** e.g. "MKV · AVC + AAC" — container/codec honesty note. */
  formatLabel?: string;
  sourceNote?: string;
  autoPlay?: boolean;
  onTheaterChange?: (theater: boolean) => void;
  onReport?: (report: PlaybackReport) => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const CONTROLS_HIDE_MS = 2800;
const STALL_TIMEOUT_MS = 20000;

/** Viewer preferences that should survive navigation and reloads. */
const PREF_KEY = 'lv.player.prefs';

interface PlayerPrefs { volume: number; rate: number }

export function readPrefs(): PlayerPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PlayerPrefs>;
    return {
      volume: typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1 ? p.volume : 1,
      rate: typeof p.rate === 'number' && p.rate >= 0.25 && p.rate <= 3 ? p.rate : 1,
    };
  } catch {
    return null;
  }
}

export function writePrefs(p: PlayerPrefs): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
const LOAD_TIMEOUT_MS = 25000;
const MAX_AUTO_RETRIES = 1;
const VOLUME_KEY = 'igl_volume';
const MUTED_KEY = 'igl_muted';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export default function LatentPlayer({
  contentId,
  title,
  poster,
  qualityLabel,
  formatLabel,
  sourceNote,
  autoPlay = false,
  onTheaterChange,
  onReport,
}: LatentPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | null>(null);
  const stallTimer = useRef<number | null>(null);
  const loadTimer = useRef<number | null>(null);
  const metricsRef = useRef<PlaybackMetrics | null>(null);
  const autoRetries = useRef(0);
  const resumedRef = useRef(false);
  const lastSave = useRef(0);
  const tapState = useRef<{ t: number; side: 'left' | 'right' | 'mid' }>({ t: 0, side: 'mid' });
  const seekDrag = useRef<{ active: boolean; ratio: number } | null>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [error, setError] = useState<PlayerError | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [pip, setPip] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; n: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const boostTimer = useRef<number | null>(null);
  const boostPrevRate = useRef<number | null>(null);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [report, setReport] = useState<PlaybackReport | null>(null);
  const [pipSupported, setPipSupported] = useState(false);

  const playUrl = useMemo(() => `/api/play/${encodeURIComponent(contentId)}`, [contentId]);

  const video = () => videoRef.current;

  const clearTimers = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (stallTimer.current) window.clearTimeout(stallTimer.current);
    if (loadTimer.current) window.clearTimeout(loadTimer.current);
    hideTimer.current = stallTimer.current = loadTimer.current = null;
  }, []);

  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      // Keep controls up while paused, in settings, or in an end/error state.
      setState((s) => {
        if (s === 'playing' || s === 'buffering' || s === 'seeking') setControlsVisible(false);
        return s;
      });
    }, CONTROLS_HIDE_MS);
  }, []);

  const armStallTimer = useCallback(() => {
    if (stallTimer.current) window.clearTimeout(stallTimer.current);
    stallTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      metricsRef.current?.error('stall-timeout');
      if (autoRetries.current < MAX_AUTO_RETRIES) {
        autoRetries.current++;
        try {
          v?.load();
        } catch {
          /* fall through to error */
        }
        setError({
          title: 'Stream stalled — retrying',
          detail: 'The source stopped sending data. Trying once more automatically.',
          retryable: true,
        });
        setState('error');
      } else {
        setError({
          title: 'Stream stalled',
          detail:
            'The source stopped sending data for a while. Check your connection and retry — your position is saved.',
          retryable: true,
        });
        setState('error');
      }
    }, STALL_TIMEOUT_MS);
  }, []);

  const disarmStallTimer = useCallback(() => {
    if (stallTimer.current) window.clearTimeout(stallTimer.current);
    stallTimer.current = null;
  }, []);

  /* ---------------- source authorisation (tiny preflight, no media) ---------------- */

  /**
   * Attach the source and start loading.
   *
   * The media request itself IS the authorization: `v.src = /api/play/<id>`
   * receives the 307 and the browser follows it straight to the source. The
   * previous HEAD preflight to the same URL added a whole extra authorization
   * round trip before a single media byte could be requested (and the browser
   * then repeated the request as a GET). It is removed; failures are
   * classified from the media `error` event.
   */
  const attachSrc = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    resumedRef.current = false;
    disarmStallTimer();
    if (loadTimer.current) window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => {
      setState((s) => {
        if (s === 'loading') {
          metricsRef.current?.error('metadata-timeout');
          setError({
            title: 'Media is taking too long',
            detail:
              'The source accepted the request but sent no playable data in time. Retry, or try again later.',
            retryable: true,
          });
          return 'error';
        }
        return s;
      });
    }, LOAD_TIMEOUT_MS);
    v.src = playUrl;
    if (autoPlay) {
      v.play().catch(() => {
        /* autoplay blocked: user presses play */
      });
    }
  }, [playUrl, autoPlay, disarmStallTimer]);

  /** Single boot path: no preflight, no duplicate authorization. */
  const boot = useCallback(() => {
    autoRetries.current = 0;
    metricsRef.current = new PlaybackMetrics(contentId);
    attachSrc();
  }, [attachSrc, contentId]);

  const retry = useCallback(() => {
    setError(null);
    setState('loading');
    boot();
  }, [boot]);

  // Restore remembered volume/mute/speed, then keep them saved.
  useEffect(() => {
    const v = videoRef.current;
    const prefs = readPrefs();
    if (v && prefs) {
      v.volume = prefs.volume;
      v.playbackRate = prefs.rate;
      setVolumeState(prefs.volume);
      setRate(prefs.rate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writePrefs({ volume, rate });
  }, [volume, rate]);

  useEffect(() => {
    boot();
    return () => {
      clearTimers();
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute('src');
        v.load();
      }
      if (metricsRef.current && onReport) onReport(metricsRef.current.report());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  /* ---------------- volume persistence ---------------- */

  useEffect(() => {
    try {
      const sv = window.localStorage.getItem(VOLUME_KEY);
      const sm = window.localStorage.getItem(MUTED_KEY);
      const v = videoRef.current;
      if (sv !== null && v) {
        const n = clamp(Number(sv), 0, 1);
        v.volume = n;
        setVolumeState(n);
      }
      if (sm === '1' && v) {
        v.muted = true;
        setMutedState(true);
      }
    } catch {
      /* ignore */
    }
    setPipSupported(
      typeof document !== 'undefined' &&
        'pictureInPictureEnabled' in document &&
        !!document.pictureInPictureEnabled,
    );
    const params = new URLSearchParams(window.location.search);
    if (params.get('lv-debug') === '1') setShowStats(true);
  }, []);

  /* ---------------- video events ---------------- */

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const el: HTMLVideoElement = v;

    const updateBuffered = () => {
      try {
        const b = el.buffered;
        if (b.length > 0) setBufferedEnd(b.end(b.length - 1));
      } catch {
        /* ignore */
      }
    };
    const persistProgress = () => {
      if (Number.isFinite(el.duration) && el.duration > 0 && el.currentTime > 0) {
        saveProgress(contentId, el.currentTime, el.duration);
      }
    };

    const onLoadStart = () => {
      // The browser has issued the media request: authorization is under way.
      metricsRef.current?.markAuthDone();
      setState((s) => (s === 'error' ? s : 'loading'));
      pokeControls();
    };
    const onLoadedMetadata = () => {
      if (loadTimer.current) window.clearTimeout(loadTimer.current);
      loadTimer.current = null;
      metricsRef.current?.markMetadata();
      // First time the real network breakdown is complete enough to read.
      metricsRef.current?.recordNetwork();
      setDuration(el.duration || NaN);
      setState((s) => (s === 'error' ? s : 'ready'));
      // Resume exactly once, only after metadata exists.
      if (!resumedRef.current) {
        resumedRef.current = true;
        const saved = loadProgress(contentId);
        if (
          saved &&
          !saved.completed &&
          Number.isFinite(el.duration) &&
          saved.position > 10 &&
          saved.position < el.duration - 30
        ) {
          try {
            el.currentTime = saved.position;
          } catch {
            /* ignore */
          }
          setResumeToast(`Resumed from ${formatClock(saved.position)}`);
          window.setTimeout(() => setResumeToast(null), 4000);
        }
      }
    };
    const onCanPlay = () => {
      setState((s) => (s === 'playing' || s === 'seeking' || s === 'buffering' ? s : 'ready'));
    };
    const onPlaying = () => {
      disarmStallTimer();
      metricsRef.current?.recordNetwork();
      metricsRef.current?.markFirstFrame();
      setReport(metricsRef.current?.report() ?? null);
      setState('playing');
      pokeControls();
    };
    const onPause = () => {
      persistProgress();
      setState((s) => (s === 'ended' || s === 'error' ? s : 'paused'));
      setControlsVisible(true);
    };
    const onWaiting = () => {
      metricsRef.current?.rebuffer();
      setState('buffering');
      armStallTimer();
    };
    const onSeeking = () => {
      metricsRef.current?.seekStart(el.currentTime);
      setState('seeking');
    };
    const onSeeked = () => {
      metricsRef.current?.seekEnd(el.currentTime);
      setReport(metricsRef.current?.report() ?? null);
      setState(el.paused ? 'paused' : el.readyState >= 3 ? 'playing' : 'buffering');
    };
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      updateBuffered();
      if (Date.now() - lastSave.current > 5000) {
        lastSave.current = Date.now();
        persistProgress();
      }
    };
    const onProgress = () => updateBuffered();
    const onDurationChange = () => setDuration(el.duration || NaN);
    const onEnded = () => {
      disarmStallTimer();
      metricsRef.current?.complete();
      setReport(metricsRef.current?.report() ?? null);
      saveProgress(contentId, el.duration || 0, el.duration || 0);
      setState('ended');
      setControlsVisible(true);
    };
    const onError = () => {
      disarmStallTimer();
      const code = el.error?.code;
      metricsRef.current?.error(`video:${code ?? 'unknown'}`);
      setError({
        title: 'This file would not play',
        detail:
          code === 4
            ? 'The browser fetched the media but could not decode it (unsupported container or codec for this browser). The file itself is intact on the source — try a desktop Chromium browser, which supports the widest set of formats.'
            : 'Playback failed. Your position is saved — retry, or try again later.',
        retryable: true,
      });
      setState('error');
    };
    const onVolumeChange = () => {
      setVolumeState(el.volume);
      setMutedState(el.muted);
      try {
        window.localStorage.setItem(VOLUME_KEY, String(el.volume));
        window.localStorage.setItem(MUTED_KEY, el.muted ? '1' : '0');
      } catch {
        /* ignore */
      }
    };
    const onRateChange = () => setRate(el.playbackRate);
    const onEnterPip = () => setPip(true);
    const onLeavePip = () => setPip(false);
    const onPageHide = () => persistProgress();

    el.addEventListener('loadstart', onLoadStart);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('seeking', onSeeking);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('progress', onProgress);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('volumechange', onVolumeChange);
    el.addEventListener('ratechange', onRateChange);
    el.addEventListener('enterpictureinpicture', onEnterPip);
    el.addEventListener('leavepictureinpicture', onLeavePip);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      el.removeEventListener('loadstart', onLoadStart);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('seeking', onSeeking);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('progress', onProgress);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('volumechange', onVolumeChange);
      el.removeEventListener('ratechange', onRateChange);
      el.removeEventListener('enterpictureinpicture', onEnterPip);
      el.removeEventListener('leavepictureinpicture', onLeavePip);
      window.removeEventListener('pagehide', onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  /* ---------------- actions ---------------- */

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || state === 'error') return;
    if (state === 'ended') {
      v.currentTime = 0;
      v.play().catch(() => undefined);
      return;
    }
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, [state]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = clamp(v.currentTime + delta, 0, Math.max(0, v.duration - 0.25));
      pokeControls();
    },
    [pokeControls],
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = clamp(ratio, 0, 0.9999) * v.duration;
      pokeControls();
    },
    [pokeControls],
  );

  const cycleRate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const idx = SPEEDS.indexOf(v.playbackRate);
    const next = SPEEDS[(idx + 1 + SPEEDS.length) % SPEEDS.length] ?? 1;
    v.playbackRate = next;
    pokeControls();
  }, [pokeControls]);

  const nudgeRate = useCallback(
    (dir: 1 | -1) => {
      const v = videoRef.current;
      if (!v) return;
      let best = SPEEDS[0];
      for (const s of SPEEDS) {
        if (dir === 1 && s > v.playbackRate + 1e-6) {
          best = s;
          break;
        }
        if (dir === -1 && s < v.playbackRate - 1e-6) best = s;
      }
      v.playbackRate = best;
      pokeControls();
    },
    [pokeControls],
  );

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
    pokeControls();
  }, [pokeControls]);

  const setVolume = useCallback(
    (nv: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.volume = clamp(nv, 0, 1);
      if (nv > 0) v.muted = false;
      pokeControls();
    },
    [pokeControls],
  );

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (el?.requestFullscreen) {
        void el.requestFullscreen();
      } else if (v?.webkitEnterFullscreen) {
        v.webkitEnterFullscreen();
      }
    } catch {
      /* ignore */
    }
    pokeControls();
  }, [pokeControls]);

  const toggleTheater = useCallback(() => {
    setTheater((t) => {
      onTheaterChange?.(!t);
      return !t;
    });
    pokeControls();
  }, [onTheaterChange, pokeControls]);

  const togglePip = useCallback(async () => {
    const v = videoRef.current as
      | (HTMLVideoElement & { webkitSetPresentationMode?: (m: string) => void })
      | null;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (v.requestPictureInPicture) {
        await v.requestPictureInPicture();
      } else if (v.webkitSetPresentationMode) {
        v.webkitSetPresentationMode(pip ? 'inline' : 'picture-in-picture');
      }
    } catch {
      /* user-gesture / platform rejection: stay inline */
    }
    pokeControls();
  }, [pip, pokeControls]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /** Step a single frame (~1/30 s). Pauses first so the step is deterministic. */
  const frameStep = useCallback(
    (dir: 1 | -1) => {
      const v = videoRef.current;
      if (!v) return;
      if (!v.paused) v.pause();
      v.currentTime = Math.max(0, (v.currentTime || 0) + dir * (1 / 30));
      pokeControls();
    },
    [pokeControls],
  );

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable) return;
      if (state === 'error' || state === 'idle' || state === 'loading') {
        if (e.key !== ' ' && e.key !== 'Enter') return;
      }
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(e.shiftKey ? -30 : -5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(e.shiftKey ? 30 : 5);
          break;
        case 'Home': {
          e.preventDefault();
          const v = videoRef.current;
          if (v) v.currentTime = 0;
          pokeControls();
          break;
        }
        case 'End': {
          e.preventDefault();
          const v = videoRef.current;
          if (v && Number.isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 1);
          pokeControls();
          break;
        }
        case '<':
          nudgeRate(-1);
          break;
        case '>':
          nudgeRate(1);
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case ',':
          frameStep(-1);
          break;
        case '.':
          frameStep(1);
          break;
        case '?':
          setShowHelp((v) => !v);
          break;
        case 'Escape':
          setShowHelp(false);
          break;
        default: {
          if (/^[0-9]$/.test(e.key)) {
            seekToRatio(Number(e.key) / 10);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, togglePlay, seekBy, seekToRatio, nudgeRate, toggleMute, toggleFullscreen, pokeControls, frameStep]);

  /** Touch long-press plays at 2x while held, then restores the prior rate. */
  const startBoost = useCallback(() => {
    if (boostTimer.current) window.clearTimeout(boostTimer.current);
    boostTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      boostPrevRate.current = v.playbackRate;
      v.playbackRate = 2;
      setBoosting(true);
      pokeControls();
    }, 380);
  }, [pokeControls]);

  const endBoost = useCallback(() => {
    if (boostTimer.current) { window.clearTimeout(boostTimer.current); boostTimer.current = null; }
    const v = videoRef.current;
    if (v && boostPrevRate.current !== null) { v.playbackRate = boostPrevRate.current; boostPrevRate.current = null; }
    setBoosting(false);
  }, []);

  /* ---------------- tap / double-tap (touch-first) ---------------- */

  const onSurfaceTap = useCallback(
    (e: React.PointerEvent, side: 'left' | 'right' | 'mid') => {
      if (e.pointerType === 'mouse') {
        if (state === 'playing' || state === 'paused' || state === 'ready' || state === 'ended') {
          togglePlay();
        }
        return;
      }
      const nowT = Date.now();
      const last = tapState.current;
      if (nowT - last.t < 320 && last.side === side && (side === 'left' || side === 'right')) {
        tapState.current = { t: 0, side: 'mid' };
        seekBy(side === 'left' ? -10 : 10);
        setSeekFlash({ side, n: Date.now() });
        window.setTimeout(() => setSeekFlash(null), 650);
        pokeControls();
        return;
      }
      tapState.current = { t: nowT, side };
      if (controlsVisible) {
        if (side === 'mid' && (state === 'playing' || state === 'paused')) togglePlay();
        else setControlsVisible(false);
      } else {
        pokeControls();
      }
    },
    [controlsVisible, pokeControls, seekBy, state, togglePlay],
  );

  /* ---------------- seek bar drag ---------------- */

  const ratioFromClientX = (clientX: number, el: HTMLElement): number => {
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
  };

  const onSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!Number.isFinite(duration)) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekDrag.current = { active: true, ratio: ratioFromClientX(e.clientX, e.currentTarget) };
    setDragRatio(seekDrag.current.ratio);
  };
  const onSeekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekDrag.current?.active) return;
    const ratio = ratioFromClientX(e.clientX, e.currentTarget);
    seekDrag.current.ratio = ratio;
    setDragRatio(ratio);
  };
  const onSeekPointerUp = () => {
    if (!seekDrag.current?.active) return;
    seekToRatio(seekDrag.current.ratio);
    seekDrag.current = null;
    setDragRatio(null);
  };

  /* ---------------- derived ---------------- */

  const playedRatio = Number.isFinite(duration) && duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;
  const bufferedRatio =
    Number.isFinite(duration) && duration > 0 ? clamp(bufferedEnd / duration, 0, 1) : 0;
  const shownRatio = dragRatio ?? playedRatio;
  const busy = state === 'loading' || state === 'buffering' || state === 'seeking';
  const canInteract = state !== 'error' && state !== 'idle';

  return (
    <div
      ref={containerRef}
      className={`lv-player${theater ? ' is-theater' : ''}${controlsVisible ? ' show-controls' : ''}${isFullscreen ? ' is-fullscreen' : ''}`}
      data-state={state}
      onMouseMove={pokeControls}
      onPointerDown={pokeControls}
      role="region"
      aria-label={`Video player: ${title}`}
    >
      <div className="lv-screen">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- source has no web-accessible captions; honest note in settings */}
        <video
          ref={videoRef}
          className="lv-video"
          playsInline
          preload="metadata"
          poster={poster}
          aria-label={title}
          onClick={() => {
            if (state === 'playing' || state === 'paused' || state === 'ready' || state === 'ended') {
              togglePlay();
            }
          }}
        />
        {/* touch zones: double-tap left/right seeks, single tap toggles UI */}
        <div
          className="lv-tap lv-tap-left"
          onPointerDown={(e) => e.pointerType !== 'mouse' && startBoost()}
          onPointerUp={(e) => { if (e.pointerType === 'mouse') return; endBoost(); onSurfaceTap(e, 'left'); }}
          onPointerCancel={endBoost}
          onPointerLeave={endBoost}
          aria-hidden="true"
        />
        <div
          className="lv-tap lv-tap-right"
          onPointerDown={(e) => e.pointerType !== 'mouse' && startBoost()}
          onPointerUp={(e) => { if (e.pointerType === 'mouse') return; endBoost(); onSurfaceTap(e, 'right'); }}
          onPointerCancel={endBoost}
          onPointerLeave={endBoost}
          aria-hidden="true"
        />

        {boosting && (
          <div className="lv-boost" aria-hidden="true">
            2× · hold
          </div>
        )}

        {showHelp && (
          <div className="lv-help" role="dialog" aria-label="Keyboard shortcuts">
            <div className="lv-help-title">Shortcuts</div>
            <ul>
              <li><kbd>Space</kbd> play / pause</li>
              <li><kbd>←</kbd> <kbd>→</kbd> 5 s · <kbd>Shift</kbd>+ arrow 30 s</li>
              <li><kbd>,</kbd> <kbd>.</kbd> step one frame</li>
              <li><kbd>0</kbd>–<kbd>9</kbd> jump to 0–90%</li>
              <li><kbd>M</kbd> mute · <kbd>F</kbd> fullscreen</li>
              <li><kbd>&lt;</kbd> <kbd>&gt;</kbd> speed · <kbd>?</kbd> this panel</li>
            </ul>
            <button type="button" className="lv-help-close" onClick={() => setShowHelp(false)}>
              Close
            </button>
          </div>
        )}

        {seekFlash && (
          <div key={seekFlash.n} className={`lv-seekflash ${seekFlash.side}`} aria-hidden="true">
            {seekFlash.side === 'left' ? '−10s' : '+10s'}
          </div>
        )}

        {busy && (
          <div className="lv-center" aria-hidden="true">
            <div className="lv-spinner" />
            <div className="lv-busy-label">
              {state === 'seeking' ? 'Seeking…' : state === 'loading' ? 'Loading…' : 'Buffering…'}
            </div>
          </div>
        )}

        {(state === 'paused' || state === 'ready') && (
          <button type="button" className="lv-bigplay" onClick={togglePlay} aria-label={`Play ${title}`}>
            <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
          </button>
        )}

        {state === 'ended' && (
          <div className="lv-center">
            <button type="button" className="lv-bigplay" onClick={togglePlay} aria-label="Replay">
              <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
                <path
                  d="M12 5V1.8L6.8 6 12 10.2V7a5 5 0 1 1-5 5H4.5A7.5 7.5 0 1 0 12 5z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <div className="lv-ended-label">Finished — replay?</div>
          </div>
        )}

        {state === 'error' && error && (
          <div className="lv-error" role="alert">
            <div className="lv-error-card">
              <div className="lv-error-kicker">Playback issue</div>
              <h3 className="lv-error-title">{error.title}</h3>
              <p className="lv-error-detail">{error.detail}</p>
              {sourceNote && <p className="lv-error-note">Source note: {sourceNote}</p>}
              <div className="lv-error-actions">
                {error.retryable && (
                  <button type="button" className="lv-btn lv-btn-gold" onClick={retry}>
                    Retry
                  </button>
                )}
                <a className="lv-btn lv-btn-ghost" href="/">
                  Back to archive
                </a>
              </div>
            </div>
          </div>
        )}

        {resumeToast && (
          <div className="lv-toast" role="status">
            {resumeToast}
          </div>
        )}

        {showStats && (
          <div className="lv-stats" aria-hidden="true">
            <div>state={state}</div>
            <div>
              t={currentTime.toFixed(1)}s / {Number.isFinite(duration) ? duration.toFixed(1) : '?'}s ·
              buf={bufferedEnd.toFixed(1)}s · {rate}×
            </div>
            {report && (
              <div>
                auth={report.authMs ?? '?'}ms meta={report.metadataMs ?? '?'}ms first=
                {report.firstFrameMs ?? '?'}ms rebuf={report.rebuffers}
              </div>
            )}
            {report && (
              <div>
                net: auth={report.net.authMs ?? '?'} redir={report.net.redirectMs ?? '?'} ttfb=
                {report.net.sourceTtfbMs ?? '?'} total={report.net.sourceTotalMs ?? '?'} host=
                {report.net.mediaHost ?? '?'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- control bar ---------- */}
      <div
        className={`lv-controls${controlsVisible ? '' : ' is-hidden'}`}
        aria-hidden={!controlsVisible && state === 'playing'}
      >
        <div
          className="lv-seek"
          role="slider"
          tabIndex={canInteract ? 0 : -1}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Number.isFinite(duration) ? Math.round(duration) : 0}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatClock(currentTime)} of ${formatClock(duration)}`}
          onPointerDown={onSeekPointerDown}
          onPointerMove={onSeekPointerMove}
          onPointerUp={onSeekPointerUp}
          onPointerCancel={() => {
            seekDrag.current = null;
            setDragRatio(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              seekBy(-5);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              e.stopPropagation();
              seekBy(5);
            }
          }}
        >
          <div className="lv-seek-track">
            <div className="lv-seek-buffered" style={{ width: `${bufferedRatio * 100}%` }} />
            <div className="lv-seek-played" style={{ width: `${shownRatio * 100}%` }} />
            <div className="lv-seek-knob" style={{ left: `${shownRatio * 100}%` }} />
          </div>
          {dragRatio !== null && Number.isFinite(duration) && (
            <div className="lv-seek-bubble" style={{ left: `${shownRatio * 100}%` }}>
              {formatClock(shownRatio * duration)}
            </div>
          )}
        </div>

        <div className="lv-bar">
          <button
            type="button"
            className="lv-iconbtn"
            onClick={togglePlay}
            aria-label={state === 'playing' ? 'Pause' : 'Play'}
            disabled={!canInteract}
          >
            {state === 'playing' ? <IconPause /> : <IconPlay />}
          </button>

          <button
            type="button"
            className="lv-iconbtn lv-only-touch"
            onClick={() => seekBy(-10)}
            aria-label="Back 10 seconds"
            disabled={!canInteract}
          >
            <IconBack10 />
          </button>
          <button
            type="button"
            className="lv-iconbtn lv-only-touch"
            onClick={() => seekBy(10)}
            aria-label="Forward 10 seconds"
            disabled={!canInteract}
          >
            <IconFwd10 />
          </button>

          <div className="lv-time" aria-live="off">
            <span>{formatClock(currentTime)}</span>
            <span className="lv-time-sep">/</span>
            <span>{formatClock(duration)}</span>
          </div>

          <div className="lv-spacer" />

          <div className="lv-volume">
            <button
              type="button"
              className="lv-iconbtn"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              disabled={!canInteract}
            >
              {muted || volume === 0 ? <IconMuted /> : <IconVolume />}
            </button>
            <input
              className="lv-volslider lv-hover-only"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              disabled={!canInteract}
            />
          </div>

          <button
            type="button"
            className="lv-textbtn"
            onClick={cycleRate}
            aria-label={`Playback speed ${rate}x, activate to change`}
            title="Playback speed"
            disabled={!canInteract}
          >
            {rate}×
          </button>

          <button
            type="button"
            className="lv-iconbtn lv-hover-only"
            onClick={toggleTheater}
            aria-label={theater ? 'Exit theater mode' : 'Enter theater mode'}
            aria-pressed={theater}
            title="Theater mode"
            disabled={!canInteract}
          >
            <IconTheater />
          </button>

          {pipSupported && (
            <button
              type="button"
              className="lv-iconbtn lv-hover-only"
              onClick={() => void togglePip()}
              aria-label={pip ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
              aria-pressed={pip}
              title="Picture in picture"
              disabled={!canInteract}
            >
              <IconPip />
            </button>
          )}

          <button
            type="button"
            className="lv-iconbtn"
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Player settings"
            aria-expanded={settingsOpen}
            disabled={!canInteract}
          >
            <IconGear />
          </button>

          <button
            type="button"
            className="lv-iconbtn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Fullscreen"
            disabled={!canInteract}
          >
            {isFullscreen ? <IconExitFull /> : <IconFull />}
          </button>
        </div>

        {settingsOpen && (
          <div className="lv-settings" role="dialog" aria-label="Player settings">
            <div className="lv-settings-row lv-settings-head">
              <span>Settings</span>
              <button
                type="button"
                className="lv-iconbtn lv-small"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>
            <div className="lv-settings-row">
              <span className="lv-settings-label">Speed</span>
              <div className="lv-speeds">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`lv-chip${rate === s ? ' is-active' : ''}`}
                    aria-pressed={rate === s}
                    onClick={() => {
                      const v = videoRef.current;
                      if (v) v.playbackRate = s;
                    }}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <div className="lv-settings-row">
              <span className="lv-settings-label">Quality</span>
              <span className="lv-settings-val">
                {qualityLabel ?? 'Unknown'}
                {formatLabel ? ` · ${formatLabel}` : ''}
              </span>
            </div>
            <div className="lv-settings-row">
              <span className="lv-settings-label">Subtitles</span>
              <span className="lv-settings-val">None available for web playback</span>
            </div>
            <div className="lv-settings-row">
              <span className="lv-settings-label">Stats</span>
              <button
                type="button"
                className={`lv-chip${showStats ? ' is-active' : ''}`}
                aria-pressed={showStats}
                onClick={() => setShowStats((s) => !s)}
              >
                {showStats ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="lv-settings-keys">
              <span>
                Space play/pause · ←/→ 5s · Shift+←/→ 30s · 0–9 jump · &lt;/&gt; speed · F fullscreen ·
                M mute
              </span>
            </div>
          </div>
        )}
      </div>

      <span className="lv-sr" role="status" aria-live="polite">
        {state === 'playing'
          ? 'Playing'
          : state === 'paused'
            ? 'Paused'
            : state === 'buffering'
              ? 'Buffering'
              : state === 'error'
                ? 'Playback error'
                : ''}
      </span>
    </div>
  );
}

/* ---------------- inline icons (no icon library needed) ---------------- */

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
    </svg>
  );
}
function IconBack10() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M11 4.5A8 8 0 1 0 19.5 12" strokeLinecap="round" />
      <path d="M11 8V4.5L7.5 7l3.5 3.5z" fill="currentColor" stroke="none" />
      <text
        x="12"
        y="15.2"
        fontSize="7"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="inherit"
      >
        10
      </text>
    </svg>
  );
}
function IconFwd10() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M13 4.5A8 8 0 1 1 4.5 12" strokeLinecap="round" />
      <path d="M13 8V4.5l3.5 2.5L13 10.5z" fill="currentColor" stroke="none" />
      <text
        x="12"
        y="15.2"
        fontSize="7"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="inherit"
      >
        10
      </text>
    </svg>
  );
}
function IconVolume() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" stroke="none" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" strokeLinecap="round" />
    </svg>
  );
}
function IconMuted() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" stroke="none" />
      <path d="M15.5 9.5l5 5m0-5l-5 5" strokeLinecap="round" />
    </svg>
  );
}
function IconTheater() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M3 10.5h18" />
    </svg>
  );
}
function IconPip() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <rect x="12.5" y="11.5" width="6" height="4.5" rx="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 2.8v2.6m0 13.2v2.6M4.2 12H6.8m10.4 0h2.6M6.6 6.6l1.8 1.8m7.2 7.2l1.8 1.8m0-10.8l-1.8 1.8M8.4 15.6l-1.8 1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconFull() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconExitFull() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
