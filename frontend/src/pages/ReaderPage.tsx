/**
 * AI Blog Reader — main tool UI (routed at `/app`).
 * Features: multi-provider TTS, pipeline mode with SSE stepper,
 * provider health indicators, dynamic voices, conversion history.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageBackground } from "@/components/layout/PageBackground";
import { BackendDocLinks } from "@/components/layout/BackendDocLinks";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { apiUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";
import {
  Volume2,
  Download,
  Loader2,
  Link as LinkIcon,
  FileText,
  AlertCircle,
  Lightbulb,
  X,
  Clock,
  Type,
  Gauge,
  FileQuestion,
  Brain,
  BrainCircuit,
  Sparkles,
  Zap,
  ArrowLeft,
  ScrollText,
  Globe2,
  ScanLine,
  CircleDot,
  History,
  Play,
  CheckCircle2,
  XCircle,
  Info,
  Layers,
  ChevronDown,
} from "lucide-react";

const readerPageIconFrame =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-violet-500/55 bg-violet-500/10 text-violet-600 shadow-sm ring-1 ring-violet-400/30 dark:border-violet-400/50 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25 sm:h-14 sm:w-14";

const glassCardClass =
  "glow-card glow-card-hover rounded-3xl border border-white/40 bg-white/55 backdrop-blur-xs dark:border-slate-700/60 dark:bg-slate-900/60";

const fieldSurface =
  "glow-field border-2 border-slate-200/90 bg-white text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-slate-950/85 dark:text-slate-100";

const tabPanelSurface =
  "glow-panel glow-panel-hover mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/95 p-4 shadow-inner dark:border-white/10 dark:bg-slate-950/55";

interface TTSProvider {
  name: string;
  description: string;
  requires_api_key: boolean;
  voices: Record<string, string>;
  default_voice: string;
  max_chars: number;
  supports_speed: boolean;
  is_ai: boolean;
  status?: string;
  badge?: string;
  badge_color?: string;
  note?: string;
  models?: Record<string, string>;
}

interface Providers {
  [key: string]: TTSProvider;
}

interface APIError {
  error: boolean;
  title: string;
  message: string;
  suggestion: string;
  status_code?: number;
  provider?: string;
}

interface SampleText {
  title: string;
  text: string;
}

interface ProviderHealth {
  [key: string]: { status: string; label: string; detail: string };
}

interface PipelineEvent {
  event: string;
  agent?: string;
  time?: number;
  logs?: string[];
  audio_url?: string;
  timings?: Record<string, number>;
  metadata?: Record<string, unknown>;
  message?: string;
  title?: string;
  suggestion?: string;
  status_code?: number;
  provider?: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  provider: string;
  voice: string;
  textPreview: string;
  audioUrl?: string;
}

const SPEED_SLIDER_MIN = 0.5;
const SPEED_SLIDER_MAX = 2;
const SPEED_SCALE_TICKS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SPEED_SCALE_LABELS = [0.5, 1, 1.5, 2] as const;

function speedToPercent(value: number) {
  return (
    ((value - SPEED_SLIDER_MIN) / (SPEED_SLIDER_MAX - SPEED_SLIDER_MIN)) * 100
  );
}

const STATUS_DOT: Record<string, string> = {
  green: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]",
  yellow: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  red: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
  gray: "bg-slate-400",
};

const BADGE_COLORS: Record<string, string> = {
  green:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  orange:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
};

const PIPELINE_AGENTS = [
  "Extractor",
  "Analyzer",
  "Preprocessor",
  "Optimizer",
  "Synthesizer",
  "Validator",
  "Assembler",
];

/** Expanded “Read details” copy per provider id */
const PROVIDER_READ_DETAILS: Record<string, string> = {
  "edge-tts":
    "Working: yes — no API key. All voices in the dropdown are available. Simple and Pipeline modes both fully supported.",
  gtts: "Working: yes — no API key. All languages listed work for free (basic quality). Simple and Pipeline modes both supported.",
  elevenlabs:
    "Working: partial — needs API key; free tier has monthly credits. On many free accounts, Rachel, Domi, Elli, Josh, and Sam are blocked as library voices (402). Bella, Antoni, Arnold, and Adam often work; your account may vary. Use Voices API or try voices until one succeeds. Pipeline mode uses the same limits as simple mode (not a way around 402).",
  huggingface:
    "Working: no on hf-inference — TTS models are not routed there (404). Not fixed by a new HF token. Prefer Edge or gTTS for free TTS.",
  replicate:
    "Working: paid only — Replicate token plus billing. Per-run cost. Simple and Pipeline modes behave the same.",
  openai:
    "Working: paid — OpenAI key with quota/credits. All six voices work when your project is billed. Simple and Pipeline modes supported.",
};

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem("tts_history") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem("tts_history", JSON.stringify(items.slice(0, 20)));
}

export function ReaderPage() {
  const [providers, setProviders] = useState<Providers>({});
  const [health, setHealth] = useState<ProviderHealth>({});
  const [selectedProvider, setSelectedProvider] = useState("edge-tts");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [selectedModel, setSelectedModel] = useState("tts-1");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<APIError | null>(null);
  const [inputMode, setInputMode] = useState<"url" | "text">("text");
  const [sampleTexts, setSampleTexts] = useState<SampleText[]>([]);
  const [showSamples, setShowSamples] = useState(false);
  const [pipelineMode, setPipelineMode] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<
    Record<string, { status: string; time?: number; logs?: string[] }>
  >({});
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [providerReadDetailsOpen, setProviderReadDetailsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const reduced = usePrefersReducedMotion();

  const voiceAvailabilityNote = useMemo(() => {
    switch (selectedProvider) {
      case "edge-tts":
        return "Free tier: all Edge voices in the list work. Simple and Pipeline modes.";
      case "gtts":
        return "Free tier: every language option works. Simple and Pipeline modes.";
      case "elevenlabs":
        return "Free tier: Bella, Antoni, Arnold, and Adam often work via API; Rachel, Domi, Elli, Josh, and Sam are often blocked (library voice / 402). Pipeline mode has the same rules — not a bypass. Add your API key.";
      case "huggingface":
        return "TTS on hf-inference is not available for this app (404). A key does not change that.";
      case "replicate":
        return "Requires a token and Replicate billing. Same behavior in Pipeline or simple mode.";
      case "openai":
        return "Requires an API key with credits. All listed voices work when your account allows TTS. Simple and Pipeline modes.";
      default:
        return "";
    }
  }, [selectedProvider]);

  const stairItem = useMemo(() => {
    const ease = [0.22, 1, 0.36, 1] as const;
    return {
      hidden: () => ({
        opacity: 0,
        y: reduced ? 0 : 20,
        x: reduced ? 0 : -14,
      }),
      show: (i: number) => ({
        opacity: 1,
        y: 0,
        x: 0,
        transition: {
          duration: reduced ? 0 : 0.5,
          ease,
          delay: reduced ? 0 : i * 0.1,
        },
      }),
    };
  }, [reduced]);

  const panelStagger = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: {
          staggerChildren: reduced ? 0 : 0.09,
          delayChildren: reduced ? 0 : 0.03,
        },
      },
    }),
    [reduced],
  );

  const panelItem = useMemo(() => {
    const ease = [0.22, 1, 0.36, 1] as const;
    return {
      hidden: { opacity: 0, y: reduced ? 0 : 14, x: reduced ? 0 : -10 },
      show: {
        opacity: 1,
        y: 0,
        x: 0,
        transition: { duration: reduced ? 0 : 0.45, ease },
      },
    };
  }, [reduced]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/providers"))
      .then((res) => res.json())
      .then((data) => {
        setProviders(data);
        if (data["edge-tts"]) setSelectedVoice(data["edge-tts"].default_voice);
      })
      .catch((err) => console.error("Failed to fetch providers:", err));

    fetch(apiUrl("/api/sample-texts"))
      .then((res) => res.json())
      .then((data) => setSampleTexts(data.samples || []))
      .catch((err) => console.error("Failed to fetch samples:", err));

    fetch(apiUrl("/api/provider-health"))
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (providers[selectedProvider]) {
      setSelectedVoice(providers[selectedProvider].default_voice);
    }
  }, [selectedProvider, providers]);

  const clearError = () => setError(null);

  const parseErrorResponse = async (response: Response): Promise<APIError> => {
    try {
      const data = await response.json();
      if (data.detail && typeof data.detail === "object") return data.detail;
      return {
        error: true,
        title: "Error",
        message: data.detail || data.message || "An error occurred",
        suggestion: "Please try again.",
      };
    } catch {
      return {
        error: true,
        title: "Connection Error",
        message: "Could not connect to the server.",
        suggestion: "Check your internet connection.",
      };
    }
  };

  const addToHistory = useCallback(
    (audioUrl: string) => {
      const item: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        provider: selectedProvider,
        voice: selectedVoice,
        textPreview: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
        audioUrl,
      };
      const updated = [item, ...history].slice(0, 20);
      setHistory(updated);
      saveHistory(updated);
    },
    [history, selectedProvider, selectedVoice, text],
  );

  const extractTextFromUrl = async () => {
    if (!url.trim()) {
      setError({
        error: true,
        title: "No URL",
        message: "Please enter a blog URL.",
        suggestion: "Paste a valid URL above.",
      });
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("url", url);
      const response = await fetch(apiUrl("/api/extract-text"), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        setError(await parseErrorResponse(response));
        return;
      }
      const data = await response.json();
      setText(data.text);
      setInputMode("text");
    } catch {
      setError({
        error: true,
        title: "Network Error",
        message: "Failed to connect.",
        suggestion: "Check your connection.",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleConvert = async () => {
    if (!text.trim()) {
      setError({
        error: true,
        title: "No Text",
        message: "Please enter text to convert.",
        suggestion: "Paste text or extract from URL.",
      });
      return;
    }
    setLoading(true);
    setError(null);
    setAudioUrl(null);

    if (pipelineMode) {
      await handlePipelineConvert();
    } else {
      await handleSimpleConvert();
    }
  };

  const handleSimpleConvert = async () => {
    try {
      const formData = new FormData();
      formData.append("text", text);
      formData.append("provider", selectedProvider);
      formData.append("voice", selectedVoice);
      formData.append("speed", String(speed));
      if (apiKey) formData.append("api_key", apiKey);
      if (selectedProvider === "openai")
        formData.append("tts_model", selectedModel);

      const response = await fetch(apiUrl("/api/convert"), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        setError(await parseErrorResponse(response));
        return;
      }
      const blob = await response.blob();
      const urlBlob = URL.createObjectURL(blob);
      setAudioUrl(urlBlob);
      addToHistory(urlBlob);
    } catch {
      setError({
        error: true,
        title: "Connection Failed",
        message: "Could not reach the server.",
        suggestion: "Check your connection.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePipelineConvert = async () => {
    const initSteps: Record<
      string,
      { status: string; time?: number; logs?: string[] }
    > = {};
    PIPELINE_AGENTS.forEach((a) => (initSteps[a] = { status: "pending" }));
    setPipelineSteps(initSteps);

    try {
      const formData = new FormData();
      formData.append("text", text);
      if (url) formData.append("url", url);
      formData.append("provider", selectedProvider);
      formData.append("voice", selectedVoice);
      formData.append("speed", String(speed));
      if (apiKey) formData.append("api_key", apiKey);
      if (selectedProvider === "openai")
        formData.append("tts_model", selectedModel);

      const response = await fetch(apiUrl("/api/convert-pipeline"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setError(await parseErrorResponse(response));
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setError({
          error: true,
          title: "Stream Error",
          message: "Could not read pipeline stream.",
          suggestion: "Try simple mode.",
        });
        setLoading(false);
        return;
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const evt: PipelineEvent = JSON.parse(payload);
            if (evt.event === "agent_start" && evt.agent) {
              setPipelineSteps((prev) => ({
                ...prev,
                [evt.agent!]: { status: "running" },
              }));
            } else if (evt.event === "agent_done" && evt.agent) {
              setPipelineSteps((prev) => ({
                ...prev,
                [evt.agent!]: {
                  status: "done",
                  time: evt.time,
                  logs: evt.logs,
                },
              }));
            } else if (evt.event === "complete" && evt.audio_url) {
              const audioResp = await fetch(apiUrl(evt.audio_url));
              const blob = await audioResp.blob();
              const urlBlob = URL.createObjectURL(blob);
              setAudioUrl(urlBlob);
              addToHistory(urlBlob);
            } else if (evt.event === "agent_error" && evt.agent) {
              setPipelineSteps((prev) => ({
                ...prev,
                [evt.agent!]: { status: "error", logs: evt.logs },
              }));
            } else if (evt.event === "error") {
              setPipelineSteps((prev) => {
                const next = { ...prev };
                const running = Object.entries(next).find(
                  ([, v]) => v.status === "running",
                );
                if (running) {
                  next[running[0]] = { ...next[running[0]], status: "error" };
                }
                return next;
              });
              setError({
                error: true,
                title: evt.title || "Pipeline Error",
                message: evt.message || "An error occurred in the pipeline.",
                suggestion: evt.suggestion || "Try simple mode or Edge TTS.",
                status_code: evt.status_code,
                provider: evt.provider,
              });
              setLoading(false);
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch {
      setError({
        error: true,
        title: "Connection Failed",
        message: "Pipeline stream disconnected.",
        suggestion: "Check connection or try simple mode.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = `ai_audio_${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const loadSampleText = (sample: SampleText) => {
    setText(sample.text);
    setShowSamples(false);
    setInputMode("text");
  };

  const currentProvider = providers[selectedProvider];
  const audioReadyMeta = useMemo(() => {
    const providerLabel = currentProvider?.name ?? selectedProvider;
    const voiceLabel =
      currentProvider && selectedVoice
        ? (currentProvider.voices[selectedVoice] ?? selectedVoice)
        : selectedVoice || "your selected voice";
    const genMode = pipelineMode ? "Pipeline" : "Simple";
    return {
      detail: `Playback uses ${providerLabel}, voice "${voiceLabel}".`,
      modeLabel: `${genMode} mode`,
    };
  }, [currentProvider, pipelineMode, selectedProvider, selectedVoice]);
  const maxChars = currentProvider?.max_chars || 10000;
  const charCount = text.length;
  const isOverLimit = charCount > maxChars;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedDuration = Math.ceil((wordCount / 150) * (1 / speed));
  const estimatedMinutes = Math.floor(estimatedDuration / 60);
  const estimatedSeconds = estimatedDuration % 60;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PageBackground
        orbitClassName="reader-orbit"
        orbitOpacity="opacity-[0.14] dark:opacity-[0.11]"
      />
      <motion.div
        className="relative z-10 flex flex-1 flex-col py-8 sm:py-10"
        initial={{ opacity: 0, y: reduced ? 0 : 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mx-auto w-full max-w-[96rem] px-0 sm:px-1">
          <div className="mx-auto w-full space-y-6">
            {/* Header */}
            <motion.div
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              variants={{ hidden: {}, show: {} }}
              initial="hidden"
              animate="show"
            >
              <motion.div
                custom={0}
                variants={stairItem}
                className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4"
              >
                <div className={readerPageIconFrame} aria-hidden>
                  <BrainCircuit
                    className="h-6 w-6 sm:h-7 sm:w-7"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
                    <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent">
                      AI Blog Reader
                    </span>
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    Convert text to speech with AI voices
                  </p>
                </div>
              </motion.div>
              <motion.div
                custom={1}
                variants={stairItem}
                className="flex shrink-0 flex-wrap items-center gap-2 justify-end sm:justify-start"
              >
                <BackendDocLinks className="w-full justify-end sm:w-auto" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="gap-1.5 rounded-full border-violet-500/25 bg-white/60 px-3 shadow-sm backdrop-blur-xs dark:border-violet-400/30 dark:bg-slate-900/70 cursor-pointer"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                  {history.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-violet-500/20 px-1.5 text-[10px] font-bold text-violet-300">
                      {history.length}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2 rounded-full border-violet-500/25 bg-white/60 px-4 shadow-sm backdrop-blur-xs dark:border-violet-400/30 dark:bg-slate-900/70"
                >
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Provider status banner */}
            <motion.div
              custom={2}
              variants={stairItem}
              initial="hidden"
              animate="show"
              className="rounded-xl border border-violet-400/30 bg-violet-950/20 p-3 backdrop-blur-xs dark:border-violet-500/30 dark:bg-violet-950/40"
            >
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-violet-200">
                      Provider Status
                    </p>
                    <button
                      type="button"
                      onClick={() => setProviderReadDetailsOpen((o) => !o)}
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-violet-200 hover:text-violet-100 cursor-pointer"
                    >
                      <Info className="h-3.5 w-3.5 shrink-0 text-violet-200" />
                      Read details about AI models, free tier, and limits
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          providerReadDetailsOpen && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-violet-300/90">
                    {Object.entries(providers).map(([key, p]) => {
                      const h = health[key];
                      const dotColor = h?.status || "gray";
                      return (
                        <span key={key} className="flex items-center gap-1">
                          <span
                            className={cn(
                              "inline-block h-2 w-2 rounded-full",
                              STATUS_DOT[dotColor] || STATUS_DOT.gray,
                            )}
                          />
                          {p.name}
                        </span>
                      );
                    })}
                  </div>
                  {/* CSS grid row collapse: avoids FM exit where opacity finishes before layout (hollow box). */}
                  <div
                    className={cn(
                      "grid min-h-0",
                      providerReadDetailsOpen
                        ? "grid-rows-[1fr]"
                        : "grid-rows-[0fr]",
                      reduced
                        ? undefined
                        : "transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    )}
                  >
                    <div
                      className={cn(
                        "min-h-0 overflow-hidden",
                        !providerReadDetailsOpen && "pointer-events-none",
                      )}
                      aria-hidden={!providerReadDetailsOpen}
                    >
                      <div className="space-y-3 rounded-lg border border-violet-500/25 bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-400">
                        {Object.entries(providers).map(([key, p]) => (
                          <div
                            key={key}
                            className="border-t border-white/10 pt-2 first:border-0 first:pt-0"
                          >
                            <p className="font-semibold text-violet-200">
                              {p.name}
                            </p>
                            <p className="mt-1">
                              {PROVIDER_READ_DETAILS[key] ??
                                "See provider documentation for limits and keys."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* History panel */}
            <AnimatePresence initial={false}>
              {showHistory && history.length > 0 && (
                <motion.div
                  key="history-panel"
                  initial={
                    reduced ? false : { opacity: 0, y: -12, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduced
                      ? undefined
                      : {
                          opacity: 0,
                          y: -8,
                          scale: 0.985,
                          transition: {
                            duration: 0.2,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }
                  }
                  transition={{
                    duration: reduced ? 0 : 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="overflow-hidden rounded-xl border border-violet-400/30 bg-slate-950/40 p-3 backdrop-blur-xs"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-violet-200">
                      Recent Conversions
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setHistory([]);
                        saveHistory([]);
                      }}
                      className="text-[10px] text-violet-400 hover:text-violet-200"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto scrollbar-themed">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg bg-slate-900/50 px-3 py-2 text-xs"
                      >
                        <span className="shrink-0 text-violet-400">
                          {providers[item.provider]?.name || item.provider}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-400">
                          {item.textPreview}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        {item.audioUrl && (
                          <button
                            type="button"
                            onClick={() => setAudioUrl(item.audioUrl!)}
                            className="shrink-0 text-violet-400 hover:text-violet-200"
                          >
                            <Play className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main card */}
            <motion.div
              variants={{ hidden: {}, show: {} }}
              initial="hidden"
              animate="show"
              transition={{ delayChildren: reduced ? 0 : 0.28 }}
            >
              <Card className={glassCardClass}>
                <CardHeader className="space-y-4 pb-2">
                  <motion.div
                    custom={0}
                    variants={stairItem}
                    className="flex items-stretch gap-3 sm:gap-4"
                  >
                    <div
                      className="flex min-h-0 shrink-0 items-stretch py-0.5"
                      aria-hidden
                    >
                      <img
                        src="/logo.svg"
                        alt=""
                        className="h-full min-h-0 w-auto object-contain object-left"
                        width={24}
                        height={24}
                        decoding="async"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="font-display text-xl text-slate-900 sm:text-2xl dark:text-slate-50">
                        AI Text-to-Speech
                      </CardTitle>
                      <CardDescription className="mt-1 text-slate-600 dark:text-slate-300">
                        6 providers: Edge TTS, gTTS (free) + ElevenLabs, Hugging
                        Face, Replicate, OpenAI
                      </CardDescription>
                    </div>
                  </motion.div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  {/* Tabs */}
                  <Tabs
                    value={inputMode}
                    onValueChange={(v) => setInputMode(v as "url" | "text")}
                  >
                    <motion.div
                      custom={2}
                      variants={stairItem}
                      className="w-full"
                    >
                      <TabsList className="glow-tabs-shell grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl bg-slate-900/[0.06] p-1.5 dark:bg-white/[0.06]">
                        <TabsTrigger
                          value="text"
                          className={cn(
                            "gap-2 rounded-xl border-2 py-2.5 text-sm transition-all duration-200",
                            "data-[state=inactive]:border-violet-400/40 data-[state=inactive]:bg-slate-900/[0.12] data-[state=inactive]:text-muted-foreground dark:data-[state=inactive]:border-violet-500/45 dark:data-[state=inactive]:bg-white/[0.06]",
                            "data-[state=inactive]:hover:border-violet-400/55 data-[state=inactive]:hover:bg-violet-500/12 data-[state=inactive]:hover:text-slate-800 dark:data-[state=inactive]:hover:text-slate-100",
                            "data-[state=active]:border-violet-400/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-[0_12px_32px_rgba(124,58,237,0.45)]",
                          )}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          Paste or type
                        </TabsTrigger>
                        <TabsTrigger
                          value="url"
                          className={cn(
                            "gap-2 rounded-xl border-2 py-2.5 text-sm transition-all duration-200",
                            "data-[state=inactive]:border-violet-400/40 data-[state=inactive]:bg-slate-900/[0.12] data-[state=inactive]:text-muted-foreground dark:data-[state=inactive]:border-violet-500/45 dark:data-[state=inactive]:bg-white/[0.06]",
                            "data-[state=inactive]:hover:border-violet-400/55 data-[state=inactive]:hover:bg-violet-500/12 data-[state=inactive]:hover:text-slate-800 dark:data-[state=inactive]:hover:text-slate-100",
                            "data-[state=active]:border-violet-400/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-[0_12px_32px_rgba(124,58,237,0.45)]",
                          )}
                        >
                          <LinkIcon className="h-4 w-4 shrink-0" />
                          From the web
                        </TabsTrigger>
                      </TabsList>
                    </motion.div>

                    <TabsContent
                      value="url"
                      className={`${tabPanelSurface} space-y-4 focus-visible:outline-none`}
                    >
                      <motion.div
                        className="space-y-4"
                        variants={panelStagger}
                        initial="hidden"
                        animate="show"
                      >
                        <motion.div variants={panelItem} className="space-y-2">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span
                              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/15 text-violet-100 shadow-sm ring-1 ring-violet-400/20 dark:border-violet-400/45 dark:bg-violet-500/20 dark:ring-violet-500/25"
                              aria-hidden
                            >
                              <Globe2 className="h-4 w-4" strokeWidth={2} />
                            </span>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                <Label
                                  htmlFor="url"
                                  className="min-w-0 flex-1 cursor-pointer text-base font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100"
                                >
                                  Paste a public article or blog URL
                                </Label>
                                <button
                                  type="button"
                                  onClick={() => setUrl("")}
                                  disabled={url.trim() === ""}
                                  tabIndex={url.trim() === "" ? -1 : 0}
                                  aria-hidden={url.trim() === ""}
                                  className={cn(
                                    "inline-flex shrink-0 items-center gap-1 rounded-2xl border border-violet-400/50 px-2.5 py-1.5 text-xs font-medium text-violet-300 hover:border-violet-300/60 hover:text-violet-100 cursor-pointer disabled:cursor-default",
                                    url.trim() === "" &&
                                      "invisible pointer-events-none",
                                  )}
                                >
                                  <X className="h-3 w-3" />
                                  Clear texts
                                </button>
                              </div>
                              <p className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                                We pull the main readable content then you can
                                edit it.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                        <motion.div
                          variants={panelItem}
                          className="flex flex-col gap-2 sm:flex-row"
                        >
                          <Input
                            id="url"
                            type="url"
                            placeholder="https://example.com/blog-post"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className={`flex-1 ${fieldSurface}`}
                          />
                          <Button
                            onClick={extractTextFromUrl}
                            disabled={extracting}
                            className="shrink-0 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md hover:from-violet-500 hover:to-purple-500 sm:px-6 cursor-pointer"
                          >
                            {extracting ? (
                              <>
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                Fetching…
                              </>
                            ) : (
                              <>
                                <ScanLine className="h-4 w-4 shrink-0" />
                                Fetch article text
                              </>
                            )}
                          </Button>
                        </motion.div>
                      </motion.div>
                    </TabsContent>

                    <TabsContent
                      value="text"
                      className={`${tabPanelSurface} space-y-4 focus-visible:outline-none`}
                    >
                      <motion.div
                        className="space-y-2"
                        variants={panelStagger}
                        initial="hidden"
                        animate="show"
                      >
                        <motion.div
                          variants={panelItem}
                          className="flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/15 text-violet-100 shadow-sm ring-1 ring-violet-400/20 dark:border-violet-400/45 dark:bg-violet-500/20 dark:ring-violet-500/25"
                              aria-hidden
                            >
                              <ScrollText className="h-4 w-4" strokeWidth={2} />
                            </span>
                            <Label
                              htmlFor="text"
                              className="cursor-pointer text-base font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100"
                            >
                              {"What we'll read aloud"}
                            </Label>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            {text.trim() !== "" && (
                              <button
                                type="button"
                                onClick={() => setText("")}
                                className="text-xs font-medium text-violet-300 hover:text-violet-100 cursor-pointer border border-violet-400/50 hover:border-violet-300/60 rounded-2xl px-2.5 py-1.5 gap-1 items-center inline-flex"
                              >
                                <X className="h-3 w-3" />
                                Clear texts
                              </button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowSamples(!showSamples)}
                              className="h-8 shrink-0 rounded-full border-violet-400/35 bg-slate-950/30 text-xs font-medium text-violet-100 shadow-sm backdrop-blur-xs hover:border-violet-300/60 hover:bg-violet-500/25 dark:border-violet-400/40 dark:hover:bg-violet-500/20 cursor-pointer"
                            >
                              <FileQuestion className="mr-1 h-3 w-3" />
                              {showSamples ? "Hide" : "Samples"}
                            </Button>
                          </div>
                        </motion.div>

                        {showSamples && (
                          <motion.div
                            variants={panelItem}
                            initial="hidden"
                            animate="show"
                            className="flex flex-wrap gap-2 rounded-xl border border-violet-400/30 bg-violet-950/25 p-3 shadow-inner backdrop-blur-xs dark:border-violet-400/35 dark:bg-violet-950/40"
                          >
                            {sampleTexts.map((sample, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => loadSampleText(sample)}
                                className={cn(
                                  "rounded-lg border-2 border-violet-400/45 bg-slate-950/50 px-3 py-2 text-left text-xs font-semibold text-violet-100",
                                  "shadow-sm transition-all duration-200",
                                  "hover:-translate-y-0.5 hover:border-fuchsia-400/70 hover:bg-violet-600/25 hover:text-white",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
                                )}
                              >
                                {sample.title}
                              </button>
                            ))}
                          </motion.div>
                        )}

                        <motion.div variants={panelItem}>
                          <Textarea
                            id="text"
                            placeholder="Write or paste your text here..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className={`min-h-[220px] resize-y ${fieldSurface} ${isOverLimit ? "border-red-500 dark:border-red-500" : ""}`}
                          />
                        </motion.div>

                        <motion.div variants={panelItem}>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex flex-wrap items-center gap-4">
                              <span
                                className={
                                  isOverLimit ? "font-medium text-red-500" : ""
                                }
                              >
                                <Type className="mr-1 inline h-3 w-3" />
                                {charCount.toLocaleString()} /{" "}
                                {maxChars.toLocaleString()}
                              </span>
                              <span>
                                <FileText className="mr-1 inline h-3 w-3" />
                                {wordCount} words
                              </span>
                            </div>
                            <span>
                              <Clock className="mr-1 inline h-3 w-3" />~
                              {estimatedMinutes}:
                              {estimatedSeconds.toString().padStart(2, "0")}
                            </span>
                          </div>
                        </motion.div>
                      </motion.div>
                    </TabsContent>
                  </Tabs>

                  {/* Provider + Voice */}
                  <motion.div
                    custom={3}
                    variants={stairItem}
                    className="space-y-4"
                  >
                    <motion.div
                      className="grid gap-4 md:grid-cols-2"
                      variants={panelStagger}
                      initial="hidden"
                      animate="show"
                    >
                      <motion.div variants={panelItem} className="space-y-2">
                        <Label
                          htmlFor="provider"
                          className="text-slate-700 dark:text-slate-200"
                        >
                          Select AI Model Provider
                        </Label>
                        <Select
                          value={selectedProvider}
                          onValueChange={setSelectedProvider}
                        >
                          <SelectTrigger
                            id="provider"
                            className={cn(fieldSurface, "h-11")}
                          >
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(providers).map(
                              ([key, provider]) => {
                                const h = health[key];
                                const dotColor = h?.status || "gray";
                                return (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "inline-block h-2 w-2 rounded-full",
                                          STATUS_DOT[dotColor] ||
                                            STATUS_DOT.gray,
                                        )}
                                      />
                                      {provider.is_ai ? (
                                        <Brain className="h-3.5 w-3.5 text-violet-500" />
                                      ) : (
                                        <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                      )}
                                      <span>{provider.name}</span>
                                      {provider.badge && (
                                        <span
                                          className={cn(
                                            "rounded px-1 py-0.5 text-[9px] font-bold leading-none",
                                            BADGE_COLORS[
                                              provider.badge_color || "gray"
                                            ] || "",
                                          )}
                                        >
                                          {provider.badge}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              },
                            )}
                          </SelectContent>
                        </Select>
                        {/* Provider note */}
                        {currentProvider?.note && (
                          <div className="flex items-start gap-1.5 rounded-lg border border-slate-700/40 bg-slate-950/30 px-2.5 py-2 text-[11px] leading-relaxed text-slate-400">
                            <Info className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                            <span>{currentProvider.note}</span>
                          </div>
                        )}
                      </motion.div>

                      <motion.div variants={panelItem} className="space-y-2">
                        <Label
                          htmlFor="voice"
                          className="text-slate-700 dark:text-slate-200"
                        >
                          Choose Voice To Generate Audio
                        </Label>
                        <Select
                          value={selectedVoice}
                          onValueChange={setSelectedVoice}
                        >
                          <SelectTrigger
                            id="voice"
                            className={cn(fieldSurface, "h-11")}
                          >
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentProvider &&
                              Object.entries(currentProvider.voices).map(
                                ([key, name]) => (
                                  <SelectItem key={key} value={key}>
                                    {name as string}
                                  </SelectItem>
                                ),
                              )}
                          </SelectContent>
                        </Select>
                        {voiceAvailabilityNote && (
                          <div className="flex items-start gap-1.5 rounded-lg border border-slate-700/40 bg-slate-950/30 px-2.5 py-2 text-[11px] leading-relaxed text-slate-400">
                            <Info className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                            <span>{voiceAvailabilityNote}</span>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>

                    {/* OpenAI model selector */}
                    {selectedProvider === "openai" &&
                      currentProvider?.models && (
                        <motion.div variants={panelItem} className="space-y-2">
                          <Label className="text-slate-700 dark:text-slate-200">
                            OpenAI Model
                          </Label>
                          <Select
                            value={selectedModel}
                            onValueChange={setSelectedModel}
                          >
                            <SelectTrigger className={cn(fieldSurface, "h-11")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(currentProvider.models).map(
                                ([key, label]) => (
                                  <SelectItem key={key} value={key}>
                                    {label as string}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </motion.div>
                      )}
                  </motion.div>

                  {/* Speed */}
                  {currentProvider?.supports_speed && (
                    <motion.div
                      custom={4}
                      variants={stairItem}
                      initial={false}
                      animate="show"
                      className="space-y-3"
                    >
                      <motion.div
                        className="space-y-3"
                        variants={panelStagger}
                        initial="hidden"
                        animate="show"
                      >
                        <motion.div variants={panelItem}>
                          <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                            <Label className="flex shrink-0 items-center gap-1.5 text-slate-700 sm:pt-0 dark:text-slate-200">
                              <Gauge className="h-3.5 w-3.5 shrink-0" />
                              Speed
                            </Label>
                            <span className="min-w-0 flex-1 text-pretty leading-relaxed text-slate-600 text-xs dark:text-violet-200/70">
                              <span className="font-semibold text-violet-700 dark:text-violet-200/90">
                                1×
                              </span>{" "}
                              is normal speech. Values{" "}
                              <span className="whitespace-nowrap">
                                under 1×
                              </span>{" "}
                              slow it down (
                              <span className="tabular-nums">0.5×</span> ≈ half
                              speed);{" "}
                              <span className="whitespace-nowrap">over 1×</span>{" "}
                              speed it up (up to{" "}
                              <span className="tabular-nums">2×</span>).
                            </span>
                            <span className="shrink-0 rounded-md border border-violet-400/35 bg-violet-500/20 px-2 py-1 text-sm font-semibold tabular-nums text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.25)]">
                              {speed.toFixed(1)}x
                            </span>
                          </div>
                        </motion.div>
                        <motion.div variants={panelItem} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium text-violet-200/90">
                            <span>Slow</span>
                            <span>Fast</span>
                          </div>
                          <div className="relative px-0.5 pt-0.5">
                            <div
                              className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-2.5 -translate-y-1/2 rounded-full"
                              style={{
                                background:
                                  "linear-gradient(90deg, rgb(124 58 237) 0%, rgb(192 38 211) 42%, rgb(251 207 232) 100%)",
                                boxShadow:
                                  "0 0 22px rgba(167, 139, 250, 0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
                              }}
                              aria-hidden
                            />
                            <div
                              className="pointer-events-none absolute inset-x-1 top-1/2 z-[1] h-2.5 -translate-y-1/2"
                              aria-hidden
                            >
                              {SPEED_SCALE_TICKS.map((v) => {
                                const major =
                                  v === 0.5 || v === 1 || v === 1.5 || v === 2;
                                return (
                                  <div
                                    key={v}
                                    className={cn(
                                      "absolute bottom-0 w-px rounded-full bg-white/50",
                                      major ? "h-2" : "h-1",
                                    )}
                                    style={{
                                      left: `${speedToPercent(v)}%`,
                                      transform: "translateX(-50%)",
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <Slider
                              min={SPEED_SLIDER_MIN}
                              max={SPEED_SLIDER_MAX}
                              step={0.1}
                              value={speed}
                              onValueChange={setSpeed}
                              className="speed-range w-full"
                            />
                            <div
                              className="relative mt-1 h-4 text-xs tabular-nums text-violet-200/90"
                              aria-hidden
                            >
                              {SPEED_SCALE_LABELS.map((v) => (
                                <span
                                  key={v}
                                  className="absolute -translate-x-1/2"
                                  style={{
                                    left: `${speedToPercent(v)}%`,
                                  }}
                                >
                                  {Number.isInteger(v) ? v : v.toFixed(1)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* API Key */}
                  {currentProvider?.requires_api_key && (
                    <motion.div
                      custom={5}
                      variants={stairItem}
                      initial={false}
                      animate="show"
                      className="space-y-2"
                    >
                      <Label
                        htmlFor="apiKey"
                        className="text-slate-700 dark:text-slate-200"
                      >
                        API Key <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder={`Enter your ${currentProvider.name} API key`}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className={fieldSurface}
                      />
                      <p className="text-xs text-muted-foreground">
                        {selectedProvider === "openai" &&
                          "Get key from platform.openai.com ($5 free credits for new accounts)"}
                        {selectedProvider === "elevenlabs" &&
                          "Get key from elevenlabs.io (free tier: 10k credits/month)"}
                        {selectedProvider === "replicate" &&
                          "Get token from replicate.com (requires billing)"}
                      </p>
                    </motion.div>
                  )}

                  {/* Pipeline toggle */}
                  <motion.div
                    custom={5}
                    variants={stairItem}
                    className="flex items-center gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => setPipelineMode(!pipelineMode)}
                      className={cn(
                        "flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                        pipelineMode
                          ? "border-violet-400/60 bg-violet-500/20 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                          : "border-slate-600/40 bg-slate-900/30 text-slate-400 hover:border-violet-400/40 hover:text-slate-300",
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Pipeline Mode
                      {pipelineMode ? " ON" : " OFF"}
                    </button>
                    <span className="text-xs text-white/70">
                      {pipelineMode
                        ? "Multi-agent: Extract → Analyze → Preprocess → Optimize → Synthesize → Validate → Assemble"
                        : "Simple: direct text-to-speech conversion"}
                    </span>
                  </motion.div>

                  {/* Pipeline stepper */}
                  {pipelineMode && Object.keys(pipelineSteps).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1 rounded-3xl border border-violet-400/30 bg-slate-950/40 p-4 sm:p-6"
                    >
                      <h4 className="mb-2 text-xs font-semibold text-violet-300">
                        Pipeline Progress
                      </h4>
                      {PIPELINE_AGENTS.map((agent) => {
                        const step = pipelineSteps[agent];
                        if (!step) return null;
                        return (
                          <div
                            key={agent}
                            className="flex items-center gap-2 py-1 text-xs"
                          >
                            {step.status === "done" && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            {step.status === "running" && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                            )}
                            {step.status === "pending" && (
                              <CircleDot className="h-3.5 w-3.5 text-slate-600" />
                            )}
                            {step.status === "error" && (
                              <XCircle className="h-3.5 w-3.5 text-red-400" />
                            )}
                            <span
                              className={cn(
                                "font-medium",
                                step.status === "done"
                                  ? "text-emerald-300"
                                  : step.status === "running"
                                    ? "text-violet-300"
                                    : "text-slate-500",
                              )}
                            >
                              {agent}
                            </span>
                            {step.time !== undefined && (
                              <span className="text-[10px] text-slate-500">
                                {step.time}s
                              </span>
                            )}
                            {step.logs && step.logs.length > 0 && (
                              <span className="truncate text-[10px] text-slate-600">
                                {step.logs[step.logs.length - 1]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Error */}
                  {error && (
                    <motion.div
                      key={error.title + (error.message ?? "")}
                      initial={{
                        opacity: 0,
                        y: reduced ? 0 : 14,
                        x: reduced ? 0 : -8,
                      }}
                      animate={{ opacity: 1, y: 0, x: 0 }}
                      transition={{
                        duration: reduced ? 0 : 0.42,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="relative rounded-lg border border-red-200 bg-red-50 p-4 shadow-[0_16px_44px_rgba(225,29,72,0.2)] dark:border-red-900/50 dark:bg-red-950/30"
                    >
                      <button
                        type="button"
                        onClick={clearError}
                        className="absolute right-3 top-3 text-red-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="flex items-start gap-3 pr-6">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
                        <div className="space-y-1">
                          <h4 className="font-semibold text-red-800 dark:text-red-200">
                            {error.title}
                            {error.status_code && (
                              <span className="ml-2 text-xs opacity-70">
                                ({error.status_code})
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {error.message}
                          </p>
                          {error.suggestion && (
                            <p className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300">
                              <Lightbulb className="h-3 w-3" />
                              {error.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Generate button */}
                  <motion.div
                    custom={6}
                    variants={stairItem}
                    className="w-full"
                  >
                    <Button
                      onClick={handleConvert}
                      disabled={loading || !text.trim() || isOverLimit}
                      className="h-12 w-full bg-gradient-to-r from-violet-600 to-purple-600 text-base font-semibold text-white shadow-lg ring-1 ring-white/25 hover:from-violet-500 hover:to-purple-500 cursor-pointer"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {pipelineMode
                            ? "Running Pipeline..."
                            : "Generating with AI..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5" />
                          {pipelineMode ? "Run Pipeline" : "Generate Audio"}
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {/* Audio result */}
                  {audioUrl && (
                    <motion.div
                      custom={7}
                      variants={stairItem}
                      initial={false}
                      animate="show"
                      className="space-y-4 rounded-3xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 sm:p-6 shadow-[0_18px_48px_rgba(16,185,129,0.18)] dark:border-green-800 dark:from-green-950/30 dark:to-emerald-950/30 glow-card glow-card-hover"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <h3 className="flex items-center gap-2 font-medium text-green-800 dark:text-green-200">
                            <Volume2 className="h-4 w-4 shrink-0" />
                            Your Audio is Ready!
                          </h3>
                          <div className="space-y-0.5 pl-0 sm:pl-6">
                            <p className="text-xs leading-relaxed text-white/80">
                              {audioReadyMeta.detail} and use the{" "}
                              {audioReadyMeta.modeLabel}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          className="shrink-0 self-start border-green-300 text-green-500 cursor-pointer sm:mt-0.5"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                      <audio
                        ref={audioRef}
                        controls
                        src={audioUrl}
                        className="w-full"
                      />
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Provider info cards */}
            <motion.section
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              variants={{ hidden: {}, show: {} }}
              initial="hidden"
              animate="show"
              transition={{ delayChildren: reduced ? 0 : 0.52 }}
            >
              {Object.entries(providers).map(([key, p], idx) => {
                const h = health[key];
                const dotColor = h?.status || "gray";
                return (
                  <motion.div key={key} custom={idx} variants={stairItem}>
                    <Card className="glow-card-sm glow-card-sm-hover border-slate-200 bg-white/70 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70 rounded-3xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                          <span
                            className={cn(
                              "inline-block h-2.5 w-2.5 rounded-full",
                              STATUS_DOT[dotColor] || STATUS_DOT.gray,
                            )}
                          />
                          {p.is_ai ? (
                            <Brain className="h-4 w-4 text-violet-500" />
                          ) : (
                            <Zap className="h-4 w-4 text-yellow-500" />
                          )}
                          {p.name}
                          {p.badge && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                BADGE_COLORS[p.badge_color || "gray"] || "",
                              )}
                            >
                              {p.badge}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.section>

            <motion.p
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0 : 0.45,
                ease: [0.22, 1, 0.36, 1],
                delay: reduced ? 0 : 0.7,
              }}
              className="text-center text-sm text-muted-foreground"
            >
              Powered by Edge TTS • gTTS • ElevenLabs • Hugging Face • Replicate
              • OpenAI
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
