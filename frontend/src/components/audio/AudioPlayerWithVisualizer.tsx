import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { RippleButton } from "@/components/ui/RippleButton";

type Props = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  src: string;
  reducedMotion: boolean;
  className?: string;
};

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function AudioPlayerWithVisualizer({
  audioRef,
  src,
  reducedMotion,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const wiredForElRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const wireAudio = useCallback(() => {
    const el = audioRef.current;
    if (!el || reducedMotion) return;
    if (wiredForElRef.current === el && sourceRef.current) return;
    if (wiredForElRef.current && wiredForElRef.current !== el) {
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
    }
    wiredForElRef.current = el;
    try {
      const Ctx =
        window.AudioContext ||
        (
          window as unknown as {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const source = ctx.createMediaElementSource(el);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.65;
      analyserRef.current = analyser;
      source.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      /* element may already be wired in this session */
    }
  }, [audioRef, reducedMotion]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || reducedMotion) return;
    const onPlay = () => {
      wireAudio();
      void ctxRef.current?.resume().catch(() => {});
    };
    el.addEventListener("play", onPlay);
    return () => el.removeEventListener("play", onPlay);
  }, [audioRef, reducedMotion, src, wireAudio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
    };
  }, [audioRef, src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const data = new Uint8Array(64);

    const drawStatic = () => {
      const c = canvas.getContext("2d");
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      c.clearRect(0, 0, w, h);
      const bars = 40;
      const gap = 2;
      const bw = (w - (bars - 1) * gap) / bars;
      for (let i = 0; i < bars; i++) {
        const bh = 6 + (i % 5) * 3;
        const x = i * (bw + gap);
        const y = h - bh;
        const g = c.createLinearGradient(0, y, 0, h);
        g.addColorStop(0, "rgba(224, 242, 254, 0.92)");
        g.addColorStop(0.45, "rgba(45, 212, 191, 0.55)");
        g.addColorStop(1, "rgba(15, 23, 42, 0.92)");
        c.fillStyle = g;
        c.fillRect(x, y, bw, bh);
      }
    };

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      if (reducedMotion) drawStatic();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reducedMotion) {
      return () => ro.disconnect();
    }

    const draw = () => {
      const c = canvas.getContext("2d");
      if (!c) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      c.clearRect(0, 0, w, h);
      const analyser = analyserRef.current;
      if (analyser && playing) {
        analyser.getByteFrequencyData(data);
      } else {
        for (let i = 0; i < data.length; i++) {
          data[i] = 12 + ((i * 7) % 50);
        }
      }
      const bars = 40;
      const gap = 2;
      const bw = (w - (bars - 1) * gap) / bars;
      const mid = Math.max(1, Math.floor(data.length / bars));
      for (let i = 0; i < bars; i++) {
        let v = 0;
        for (let j = 0; j < mid; j++) v += data[i * mid + j] || 0;
        v = v / mid / 255;
        const bh = Math.max(4, v * h * 0.92);
        const x = i * (bw + gap);
        const y = h - bh;
        const g = c.createLinearGradient(0, y, 0, h);
        g.addColorStop(0, "rgba(236, 254, 255, 0.98)");
        g.addColorStop(0.4, "rgba(94, 234, 212, 0.65)");
        g.addColorStop(1, "rgba(6, 78, 59, 0.88)");
        c.fillStyle = g;
        c.fillRect(x, y, bw, bh);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [audioRef, playing, reducedMotion, src]);

  useEffect(() => {
    return () => {
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
      sourceRef.current = null;
      analyserRef.current = null;
      wiredForElRef.current = null;
    };
  }, []);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    wireAudio();
    try {
      if (ctxRef.current?.state === "suspended") await ctxRef.current.resume();
    } catch {
      /* ignore */
    }
    if (el.paused) void el.play();
    else el.pause();
  };

  const onSeek = (t: number) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = Math.min(duration, Math.max(0, t));
    setCurrent(el.currentTime);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-emerald-500/30 bg-white/90 shadow-inner dark:border-emerald-600/35 dark:bg-slate-950/85 glow-card glow-card-hover backdrop-blur-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <RippleButton
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="h-9 w-9 shrink-0 self-center rounded-full border-2 border-emerald-500/45 bg-transparent p-0 text-emerald-700 shadow-sm hover:bg-emerald-500/15 dark:border-emerald-400/50 dark:text-emerald-100"
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 pl-0.5" />
          )}
        </RippleButton>
        <div className="flex min-h-[4.25rem] min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="h-11 min-h-[2.75rem] overflow-hidden rounded-xl border border-emerald-600/25 bg-linear-to-b from-slate-950/95 via-slate-900/95 to-emerald-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-emerald-500/20 dark:from-black dark:via-emerald-950/50 dark:to-slate-950/90">
            <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-[4.75rem] shrink-0 text-[11px] tabular-nums text-slate-600 dark:text-slate-400">
              {formatTime(current)} / {formatTime(duration)}
            </span>
            <div className="relative flex h-2.5 min-w-0 flex-1 items-center">
              <div
                className="pointer-events-none absolute inset-0 rounded-full bg-linear-to-r from-slate-950 via-emerald-900 to-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] dark:from-emerald-400 dark:via-emerald-800 dark:to-emerald-400"
                aria-hidden
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.05}
                value={duration ? current : 0}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="relative z-10 h-2.5 w-full min-w-0 cursor-pointer appearance-none bg-transparent accent-emerald-400 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-md dark:accent-emerald-300 dark:[&::-webkit-slider-thumb]:border-emerald-950"
                aria-label="Seek"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
