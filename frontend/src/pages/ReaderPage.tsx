/**
 * AI Blog Reader — main tool UI (routed at `/app`).
 * Tabs: paste text or blog URL. Fetches TTS providers/voices from API, sends convert request,
 * shows audio player and download. Sample texts, character limit, estimated duration.
 * Shares PageBackground + max-w shell with Intro for a consistent portfolio look.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageBackground } from "@/components/layout/PageBackground";
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
} from "lucide-react";

/** Page title — aligned with intro `BrainCircuit` frame */
const readerPageIconFrame =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-violet-500/55 bg-violet-500/10 text-violet-600 shadow-sm ring-1 ring-violet-400/30 dark:border-violet-400/50 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25 sm:h-14 sm:w-14";

const glassCardClass =
  "glow-card glow-card-hover rounded-3xl border border-white/40 bg-white/55 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/60";

const fieldSurface =
  "glow-field border-2 border-slate-200/90 bg-white text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-slate-950/85 dark:text-slate-100";

const tabPanelSurface =
  "glow-panel glow-panel-hover mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/95 p-4 shadow-inner dark:border-white/10 dark:bg-slate-950/55";

/** Matches backend TTS_PROVIDERS[provider] shape from /api/providers */
interface TTSProvider {
  name: string;
  description: string;
  requires_api_key: boolean;
  voices: Record<string, string>;
  default_voice: string;
  max_chars: number;
  supports_speed: boolean;
  is_ai: boolean;
}

interface Providers {
  [key: string]: TTSProvider;
}

/** Error payload returned by backend (title, message, suggestion, status_code) */
interface APIError {
  error: boolean;
  title: string;
  message: string;
  suggestion: string;
  status_code?: number;
  provider?: string;
  details?: string;
}

interface SampleText {
  title: string;
  text: string;
}

const SPEED_SLIDER_MIN = 0.5;
const SPEED_SLIDER_MAX = 2;
/** Major numeric labels + minor ticks every 0.25 between min and max */
const SPEED_SCALE_TICKS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SPEED_SCALE_LABELS = [0.5, 1, 1.5, 2] as const;

function speedToPercent(value: number) {
  return (
    ((value - SPEED_SLIDER_MIN) / (SPEED_SLIDER_MAX - SPEED_SLIDER_MIN)) * 100
  );
}

export function ReaderPage() {
  const [providers, setProviders] = useState<Providers>({});
  const [selectedProvider, setSelectedProvider] = useState("edge-tts");
  const [selectedVoice, setSelectedVoice] = useState("");
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const reduced = usePrefersReducedMotion();

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

  /** Staggered steps inside each tab panel (Paste / URL) */
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
      hidden: {
        opacity: 0,
        y: reduced ? 0 : 14,
        x: reduced ? 0 : -10,
      },
      show: {
        opacity: 1,
        y: 0,
        x: 0,
        transition: {
          duration: reduced ? 0 : 0.45,
          ease,
        },
      },
    };
  }, [reduced]);

  useEffect(() => {
    fetch(apiUrl("/api/providers"))
      .then((res) => res.json())
      .then((data) => {
        setProviders(data);
        if (data["edge-tts"]) {
          setSelectedVoice(data["edge-tts"].default_voice);
        }
      })
      .catch((err) => console.error("Failed to fetch providers:", err));

    fetch(apiUrl("/api/sample-texts"))
      .then((res) => res.json())
      .then((data) => setSampleTexts(data.samples || []))
      .catch((err) => console.error("Failed to fetch samples:", err));
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
      if (data.detail && typeof data.detail === "object") {
        return data.detail as APIError;
      }
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
        const errorData = await parseErrorResponse(response);
        setError(errorData);
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

    try {
      const formData = new FormData();
      formData.append("text", text);
      formData.append("provider", selectedProvider);
      formData.append("voice", selectedVoice);
      formData.append("speed", String(speed));
      if (apiKey) {
        formData.append("api_key", apiKey);
      }

      const response = await fetch(apiUrl("/api/convert"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await parseErrorResponse(response);
        setError(errorData);
        return;
      }

      const blob = await response.blob();
      const urlBlob = URL.createObjectURL(blob);
      setAudioUrl(urlBlob);
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
  const maxChars = currentProvider?.max_chars || 10000;
  const charCount = text.length;
  const isOverLimit = charCount > maxChars;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedDuration = Math.ceil((wordCount / 150) * (1 / speed));
  const estimatedMinutes = Math.floor(estimatedDuration / 60);
  const estimatedSeconds = estimatedDuration % 60;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PageBackground orbitOpacity="opacity-[0.14] dark:opacity-[0.11]" />
      <div className="relative z-10 flex flex-1 flex-col py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[96rem] px-0 sm:px-1">
          {/* Full width inside the RootLayout max-w-[96rem] shell; inner max-w-5xl was narrowing the card */}
          <div className="mx-auto w-full space-y-6">
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
                className="flex shrink-0 items-center justify-end sm:justify-start"
              >
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2 rounded-full border-violet-500/25 bg-white/60 px-4 shadow-sm backdrop-blur-sm dark:border-violet-400/30 dark:bg-slate-900/70"
                >
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              variants={{ hidden: {}, show: {} }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.08 }}
            >
              <Card className={glassCardClass}>
                <CardHeader className="space-y-4 pb-2">
                  <motion.div
                    custom={0}
                    variants={stairItem}
                    className="flex items-stretch gap-3 sm:gap-4"
                  >
                    {/* Logo height matches title + description: stretch row; SVG must not set huge intrinsic width/height */}
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
                        Use AI models from OpenAI, ElevenLabs, or Replicate
                      </CardDescription>
                    </div>
                  </motion.div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
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
                            "data-[state=inactive]:hover:border-violet-400/55 data-[state=inactive]:hover:bg-violet-500/12 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:shadow-[0_8px_26px_rgba(139,92,246,0.2)] dark:data-[state=inactive]:hover:text-slate-100",
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
                            "data-[state=inactive]:hover:border-violet-400/55 data-[state=inactive]:hover:bg-violet-500/12 data-[state=inactive]:hover:text-slate-800 data-[state=inactive]:hover:shadow-[0_8px_26px_rgba(139,92,246,0.2)] dark:data-[state=inactive]:hover:text-slate-100",
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
                            <div className="min-w-0 space-y-0.5">
                              <Label
                                htmlFor="url"
                                className="block cursor-pointer text-base font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100"
                              >
                                {"Paste a public article or blog URL"}
                              </Label>
                              <p className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                                We open the page and pull the main readable
                                content—then you can tweak it on the Paste or
                                type tab.
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
                                <span>Fetching…</span>
                              </>
                            ) : (
                              <>
                                <ScanLine
                                  className="h-4 w-4 shrink-0"
                                  strokeWidth={2}
                                />
                                <span>Fetch article text</span>
                              </>
                            )}
                          </Button>
                        </motion.div>
                        <motion.div variants={panelItem}>
                          <p className="text-xs text-muted-foreground">
                            Works best on public posts; some sites block
                            automated access.
                          </p>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSamples(!showSamples)}
                            className="h-8 shrink-0 rounded-full border-violet-400/35 bg-slate-950/30 text-xs font-medium text-violet-100 shadow-sm backdrop-blur-sm transition-colors hover:border-violet-300/60 hover:bg-violet-500/25 dark:border-violet-400/40 dark:hover:bg-violet-500/20 cursor-pointer"
                          >
                            <FileQuestion className="mr-1 h-3 w-3" />
                            {showSamples ? "Hide" : "Samples"}
                          </Button>
                        </motion.div>

                        {showSamples && (
                          <motion.div
                            variants={panelItem}
                            initial="hidden"
                            animate="show"
                            className="flex flex-wrap gap-2 rounded-xl border border-violet-400/30 bg-violet-950/25 p-3 shadow-inner backdrop-blur-sm dark:border-violet-400/35 dark:bg-violet-950/40"
                            role="group"
                            aria-label="Sample texts"
                          >
                            {sampleTexts.map((sample, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => loadSampleText(sample)}
                                className={cn(
                                  "rounded-lg border-2 border-violet-400/45 bg-slate-950/50 px-3 py-2 text-left text-xs font-semibold text-violet-100",
                                  "shadow-sm transition-all duration-200",
                                  "hover:-translate-y-0.5 hover:border-fuchsia-400/70 hover:bg-violet-600/25 hover:text-white hover:shadow-[0_0_18px_rgba(192,38,211,0.35)]",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                                  "active:translate-y-0 active:scale-[0.99]",
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
                            placeholder="Paste your text here..."
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
                          AI Provider
                        </Label>
                        <Select
                          value={selectedProvider}
                          onValueChange={setSelectedProvider}
                        >
                          <SelectTrigger
                            id="provider"
                            className={cn(fieldSurface, "h-11")}
                          >
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(providers).map(
                              ([key, provider]) => (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    {provider.is_ai ? (
                                      <Brain className="h-4 w-4 text-violet-500" />
                                    ) : (
                                      <Zap className="h-4 w-4 text-yellow-500" />
                                    )}
                                    {provider.name}
                                  </div>
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        {currentProvider && (
                          <p className="text-xs text-muted-foreground">
                            {currentProvider.description}
                          </p>
                        )}
                      </motion.div>

                      <motion.div variants={panelItem} className="space-y-2">
                        <Label
                          htmlFor="voice"
                          className="text-slate-700 dark:text-slate-200"
                        >
                          Voice
                        </Label>
                        <Select
                          value={selectedVoice}
                          onValueChange={setSelectedVoice}
                        >
                          <SelectTrigger
                            id="voice"
                            className={cn(fieldSurface, "h-11")}
                          >
                            <SelectValue placeholder="Select voice" />
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
                      </motion.div>
                    </motion.div>
                  </motion.div>

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
                        <motion.div
                          variants={panelItem}
                          className="flex items-center justify-between"
                        >
                          <Label className="flex items-center gap-1">
                            <Gauge className="h-3 w-3" />
                            Speed
                          </Label>
                          <span className="rounded-md border border-violet-400/35 bg-violet-500/20 px-2 py-1 text-sm font-semibold tabular-nums text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.25)]">
                            {speed.toFixed(1)}x
                          </span>
                        </motion.div>
                        <motion.div variants={panelItem} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-violet-200/90">
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
                              className="relative mt-1 h-4 text-[10px] tabular-nums text-violet-200/90"
                              aria-hidden
                            >
                              {SPEED_SCALE_LABELS.map((v) => (
                                <span
                                  key={v}
                                  className="absolute -translate-x-1/2"
                                  style={{ left: `${speedToPercent(v)}%` }}
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
                          "Get key from platform.openai.com"}
                        {selectedProvider === "elevenlabs" &&
                          "Get key from elevenlabs.io (free tier available)"}
                        {selectedProvider === "replicate" &&
                          "Get token from replicate.com"}
                      </p>
                    </motion.div>
                  )}

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
                      className="relative rounded-lg border border-red-200 bg-red-50 p-4 shadow-[0_16px_44px_rgba(225,29,72,0.2)] transition-shadow duration-300 dark:border-red-900/50 dark:bg-red-950/30 dark:shadow-[0_18px_50px_rgba(248,113,113,0.22)]"
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
                          Generating with AI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5" />
                          Generate Audio
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {audioUrl && (
                    <motion.div
                      custom={7}
                      variants={stairItem}
                      initial={false}
                      animate="show"
                      className="space-y-4 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-[0_18px_48px_rgba(16,185,129,0.18)] transition-shadow duration-300 dark:border-green-800 dark:from-green-950/30 dark:to-emerald-950/30 dark:shadow-[0_20px_54px_rgba(52,211,153,0.22)]"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 font-medium text-green-800 dark:text-green-200">
                          <Volume2 className="h-4 w-4" />
                          Audio Ready!
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          className="border-green-300 text-green-700 cursor-pointer"
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

            <motion.section
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              variants={{ hidden: {}, show: {} }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.12 }}
            >
              <motion.div custom={0} variants={stairItem}>
                <Card className="glow-card-sm glow-card-sm-hover border-green-200 bg-white/70 backdrop-blur-md dark:border-green-900 dark:bg-slate-900/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Zap className="h-4 w-4 text-green-500" />
                      Edge TTS
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-900 dark:text-green-300">
                        FREE
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Microsoft neural TTS. Fast & reliable.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div custom={1} variants={stairItem}>
                <Card className="glow-card-sm glow-card-sm-hover border-pink-200 bg-white/70 backdrop-blur-md dark:border-pink-900 dark:bg-slate-900/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-pink-500" />
                      ElevenLabs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Industry-leading AI voices. Free tier.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div custom={2} variants={stairItem}>
                <Card className="glow-card-sm glow-card-sm-hover border-yellow-200 bg-white/70 backdrop-blur-md dark:border-yellow-900 dark:bg-slate-900/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Brain className="h-4 w-4 text-yellow-500" />
                      Hugging Face
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                        LIMITED
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Free but unreliable. May fail often.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div custom={3} variants={stairItem}>
                <Card className="glow-card-sm glow-card-sm-hover border-violet-200 bg-white/70 backdrop-blur-md dark:border-violet-900 dark:bg-slate-900/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Brain className="h-4 w-4 text-violet-500" />
                      OpenAI TTS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Premium AI voices. Requires API key.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.section>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0 : 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              viewport={{ once: true }}
              className="text-center text-sm text-muted-foreground"
            >
              Powered by Edge TTS • ElevenLabs • Hugging Face • OpenAI
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}
