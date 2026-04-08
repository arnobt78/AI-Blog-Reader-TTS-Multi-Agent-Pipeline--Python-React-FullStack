/**
 * Portfolio landing: full-viewport column, shared PageBackground, motion, CTA with shine + ripple.
 */
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PageBackground } from "@/components/layout/PageBackground";
import { BackendDocLinks } from "@/components/layout/BackendDocLinks";
import { RippleButton } from "@/components/ui/RippleButton";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Brain,
  BrainCircuit,
  History,
  Layers,
  Server,
  Sparkles,
  Wand2,
  Workflow,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const badgeClass =
  "glow-card-sm glow-card-sm-hover inline-flex items-center gap-1 rounded-full border border-violet-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-violet-900 backdrop-blur-xs dark:border-violet-500/30 dark:bg-slate-900/60 dark:text-violet-100";

/** Icon-only frame for “How it works” steps (no vertical rule on the text). */
const stepIconFrame =
  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-violet-500/55 ring-1 ring-violet-400/25 dark:border-violet-400/45 dark:ring-violet-500/20";

const BADGES = [
  { icon: Sparkles, label: "Portfolio showcase" },
  { icon: Layers, label: "FastAPI + React + TypeScript" },
  { icon: Workflow, label: "Pipeline mode, local history, responsive UI" },
] as const;

const SUBTITLE =
  "A full-stack learning lab: extract text from URLs or paste your own, run simple mode or a multi-agent SSE pipeline, pick from Edge TTS through OpenAI (plus gTTS), and land on MP3s with friendly errors, provider health, and browser conversion history — built to ship and to study.";

const HOW_STEPS = [
  {
    icon: BookOpen,
    title: "Bring your content",
    body: "Paste text or enter a blog URL; FastAPI scrapes and normalizes readable content for TTS.",
    iconClass: "bg-violet-600/15 text-violet-700 dark:text-violet-300",
  },
  {
    icon: Wand2,
    title: "Choose provider & voice",
    body: "Edge TTS, Google TTS (gTTS), ElevenLabs, Hugging Face, Replicate, and OpenAI — speed control, optional keys, and honest UI notes when free tiers or platform limits apply.",
    iconClass: "bg-fuchsia-600/15 text-fuchsia-700 dark:text-fuchsia-300",
  },
  {
    icon: AudioLines,
    title: "Play & download",
    body: "Stream in the browser, save MP3, and revisit recent runs from localStorage — same glass UI from phone to desktop.",
    iconClass: "bg-purple-600/15 text-purple-700 dark:text-purple-300",
  },
] as const;

const STACK_ITEMS = [
  {
    icon: Zap,
    text: "Vite 7 + React 19 + TypeScript",
    color: "text-amber-500",
  },
  { icon: Layers, text: "Tailwind 4 + shadcn-style UI", color: "text-sky-500" },
  {
    icon: Sparkles,
    text: "Framer Motion entrance + scroll reveals",
    color: "text-violet-500",
  },
  {
    icon: Brain,
    text: "FastAPI + uvicorn, Docker-ready backend",
    color: "text-emerald-500",
  },
  {
    icon: Workflow,
    text: "SSE multi-agent pipeline + /api/health",
    color: "text-fuchsia-500",
  },
  {
    icon: Server,
    text: "VPS-friendly container deploy",
    color: "text-cyan-500",
  },
  {
    icon: History,
    text: "localStorage conversion history",
    color: "text-orange-400",
  },
] as const;

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

const PROVIDER_SHOWCASE = [
  {
    name: "Edge TTS (Free)",
    badge: "FREE",
    badgeColor: "green" as const,
    dot: "green" as const,
    isAi: false,
    description:
      "Microsoft neural TTS — free, no API key needed. Always works.",
  },
  {
    name: "Google TTS (Free)",
    badge: "FREE",
    badgeColor: "green" as const,
    dot: "green" as const,
    isAi: false,
    description:
      "Google Translate TTS (gTTS) — free, no API key. Basic quality, 100% reliable.",
  },
  {
    name: "ElevenLabs",
    badge: "FREEMIUM",
    badgeColor: "pink" as const,
    dot: "yellow" as const,
    isAi: true,
    description:
      "Premium AI voices. Free tier: 10k credits/month with Flash model. Some voices may need paid plan.",
  },
  {
    name: "Hugging Face",
    badge: "UNAVAILABLE",
    badgeColor: "red" as const,
    dot: "red" as const,
    isAi: true,
    description:
      "Hub hf-inference router. Currently lists zero TTS models (April 2026). All calls 404. Platform limitation.",
  },
  {
    name: "Replicate",
    badge: "PAID",
    badgeColor: "orange" as const,
    dot: "yellow" as const,
    isAi: true,
    description:
      "High-quality AI TTS. Requires billing (~$0.002–0.01/run). Multiple model options.",
  },
  {
    name: "OpenAI TTS",
    badge: "PAID",
    badgeColor: "blue" as const,
    dot: "yellow" as const,
    isAi: true,
    description:
      "High-quality AI voices. $5 free credits for new accounts. Multiple models available.",
  },
] as const;

const easeIO = [0.42, 0, 0.58, 1] as const;

export default function IntroPage() {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const stairItem = useMemo(() => {
    const ease = [0.22, 1, 0.36, 1] as const;
    return {
      hidden: () => ({
        opacity: 0,
        y: reduced ? 0 : 22,
        x: reduced ? 0 : -18,
      }),
      show: (i: number) => ({
        opacity: 1,
        y: 0,
        x: 0,
        transition: {
          duration: reduced ? 0 : 0.55,
          ease,
          delay: reduced ? 0 : i * 0.12,
        },
      }),
    };
  }, [reduced]);

  /** Glass cards: ease-in-out on the panel + staggered children in sync */
  const glassCard = useMemo(
    () => ({
      hidden: { opacity: 0, y: reduced ? 0 : 26 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduced ? 0 : 0.72,
          ease: easeIO,
          staggerChildren: reduced ? 0 : 0.11,
          delayChildren: reduced ? 0 : 0.08,
        },
      },
    }),
    [reduced],
  );

  const glassChild = useMemo(
    () => ({
      hidden: { opacity: 0, y: reduced ? 0 : 14 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: reduced ? 0 : 0.5, ease: easeIO },
      },
    }),
    [reduced],
  );

  const headerLinksIndex = BADGES.length;
  const titleIndex = headerLinksIndex + 1;
  const subtitleIndex = titleIndex + 1;
  const heroCtaIndex = subtitleIndex + 1;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <PageBackground />

      <div className="relative z-10 flex flex-1 flex-col px-1 pb-6 pt-8 sm:pb-8 sm:pt-10">
        <div className="mx-auto flex w-full min-w-0 max-w-[96rem] flex-1 flex-col gap-10 sm:gap-14">
          <header className="flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex flex-wrap gap-2">
                {BADGES.map(({ icon: Icon, label }, i) => (
                  <motion.span
                    key={label}
                    custom={i}
                    variants={stairItem}
                    initial="hidden"
                    animate="show"
                    className={badgeClass}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </motion.span>
                ))}
              </div>
              <motion.div
                custom={headerLinksIndex}
                variants={stairItem}
                initial="hidden"
                animate="show"
                className="shrink-0 sm:justify-end"
              >
                <BackendDocLinks />
              </motion.div>
            </div>

            <motion.div
              custom={titleIndex}
              variants={stairItem}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-violet-500/55 bg-violet-500/10 text-violet-600 shadow-sm ring-1 ring-violet-400/30 dark:border-violet-400/50 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25 sm:h-14 sm:w-14"
                aria-hidden
              >
                <BrainCircuit
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  strokeWidth={1.5}
                />
              </div>
              <h1 className="font-display min-w-0 flex-1 text-2xl font-normal leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-4xl dark:text-slate-50">
                AI Blog Reader — turn writing into{" "}
                <span className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
                  listenable audio
                </span>
              </h1>
            </motion.div>

            <motion.p
              custom={subtitleIndex}
              variants={stairItem}
              initial="hidden"
              animate="show"
              className="max-w-3xl text-base leading-relaxed text-slate-700 sm:text-lg dark:text-slate-300"
            >
              {SUBTITLE}
            </motion.p>

            {/* Primary CTA above the fold (long page still scrolls for detail below). */}
            <motion.div
              custom={heroCtaIndex}
              variants={stairItem}
              initial="hidden"
              animate="show"
              className="inline-flex"
            >
              <div className="cta-shine-wrap rounded-full">
                <RippleButton
                  type="button"
                  enableCtaShine
                  onClick={() => navigate("/app")}
                  className="group cta-shine-button rounded-full bg-gradient-to-r from-violet-600 via-sky-500 to-purple-600 px-7 py-3 text-base font-semibold text-white shadow-lg ring-1 ring-white/25 transition-[background-image] duration-300 hover:from-violet-600 hover:via-sky-400 hover:to-purple-500 sm:px-8 sm:py-3.5 cursor-pointer"
                >
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <span className="select-none">Let&apos;s get started</span>
                  {/* translate-x only on the arrow: no width change, no layout flicker */}
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-visible transition-transform duration-300 ease-out will-change-transform group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
                    aria-hidden
                  >
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </RippleButton>
              </div>
            </motion.div>
          </header>

          <motion.section
            className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-10"
            variants={{ hidden: {}, show: {} }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.12 }}
          >
            <div className="space-y-4">
              <motion.h2
                custom={0}
                variants={stairItem}
                className="font-display text-2xl text-slate-900 dark:text-slate-100 sm:text-3xl"
              >
                How it works
              </motion.h2>
              <ol className="space-y-4 text-slate-700 dark:text-slate-300">
                {HOW_STEPS.map((step, i) => {
                  const StepIcon = step.icon;
                  return (
                    <motion.li
                      key={step.title}
                      custom={i + 1}
                      variants={stairItem}
                      className="flex gap-3"
                    >
                      <span className={`${stepIconFrame} ${step.iconClass}`}>
                        <StepIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {step.title}
                        </p>
                        <p className="text-sm">{step.body}</p>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            </div>

            <motion.div
              variants={glassCard}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="glow-card glow-card-hover rounded-3xl border border-white/40 bg-white/55 p-6 backdrop-blur-xs dark:border-slate-700/60 dark:bg-slate-900/55"
            >
              <motion.h3
                variants={glassChild}
                className="font-display mb-4 text-xl text-slate-900 dark:text-slate-100"
              >
                Stack highlights
              </motion.h3>
              <ul className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                {STACK_ITEMS.map((row) => {
                  const RowIcon = row.icon;
                  return (
                    <motion.li
                      key={row.text}
                      variants={glassChild}
                      className="flex items-center gap-2 rounded-xl border border-transparent bg-slate-900/5 px-3 py-2 dark:bg-white/5"
                    >
                      <RowIcon className={`h-4 w-4 shrink-0 ${row.color}`} />
                      {row.text}
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          </motion.section>

          <motion.section
            className="space-y-4"
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: reduced ? 0 : 0.09,
                  delayChildren: reduced ? 0 : 0.05,
                },
              },
            }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
          >
            <motion.h2
              variants={stairItem}
              custom={0}
              className="font-display text-2xl text-slate-900 dark:text-slate-100 sm:text-3xl"
            >
              Engines on the reader
            </motion.h2>
            <motion.p
              variants={stairItem}
              custom={1}
              className="max-w-3xl text-sm text-slate-700 dark:text-slate-300 sm:text-base"
            >
              Pick an engine, see free-tier reality in the UI, and fall back
              when a platform blocks you.
            </motion.p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROVIDER_SHOWCASE.map((p, idx) => (
                <motion.div key={p.name} custom={idx + 2} variants={stairItem}>
                  <Card className="glow-card-sm glow-card-sm-hover h-full border-slate-200 bg-white/70 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70 rounded-3xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span
                          className={cn(
                            "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                            STATUS_DOT[p.dot] || STATUS_DOT.gray,
                          )}
                        />
                        {p.isAi ? (
                          <Brain className="h-4 w-4 shrink-0 text-violet-500" />
                        ) : (
                          <Zap className="h-4 w-4 shrink-0 text-yellow-500" />
                        )}
                        {p.name}
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                            BADGE_COLORS[p.badgeColor] || "",
                          )}
                        >
                          {p.badge}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            <motion.p
              variants={stairItem}
              custom={PROVIDER_SHOWCASE.length + 2}
              className="text-center text-sm text-white/80"
            >
              Powered by Edge TTS • gTTS • ElevenLabs • Hugging Face • Replicate
              • OpenAI
            </motion.p>
          </motion.section>

          <motion.section
            variants={glassCard}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            className="glow-card glow-card-hover rounded-3xl border border-white/30 bg-white/45 p-6 text-center backdrop-blur-xs dark:border-slate-700/50 dark:bg-slate-900/50 sm:p-10"
          >
            <motion.p
              variants={glassChild}
              className="mb-2 text-sm font-medium uppercase tracking-widest text-violet-700 dark:text-violet-300"
            >
              Try the live app
            </motion.p>
            <motion.h2
              variants={glassChild}
              className="font-display mb-3 text-2xl text-slate-900 dark:text-slate-50 sm:text-3xl"
            >
              Ready when you are
            </motion.h2>
            <motion.p
              variants={glassChild}
              className="mx-auto mb-4 max-w-2xl text-sm text-slate-700 sm:text-base dark:text-slate-300"
            >
              Open the reader for the full experience: provider and voice
              selects, simple vs pipeline mode with live SSE steps, speed
              control, conversion history, API Docs / Health shortcuts, and the
              same routes in dev via the Vite proxy. Point production at your
              API with{" "}
              <code className="rounded bg-slate-900/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
                VITE_API_BASE_URL
              </code>
              .
            </motion.p>
            <motion.div variants={glassChild} className="inline-block">
              <button
                type="button"
                onClick={() => navigate("/app")}
                className="text-sm font-medium text-violet-500 underline-offset-4 hover:underline dark:text-violet-400 cursor-pointer"
              >
                Open the reader →
              </button>
            </motion.div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
