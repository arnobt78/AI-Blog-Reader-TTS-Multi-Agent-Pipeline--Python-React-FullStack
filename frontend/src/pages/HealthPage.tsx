/**
 * Dashboard for GET /api/health + /api/provider-health (same-origin or VITE_API_BASE_URL).
 * Educational use: compare `resolvedApiOrigin` vs `VITE_API_BASE_URL` when debugging CORS/proxy issues between Vercel and Coolify.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Boxes,
  ExternalLink,
  Home,
  Monitor,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { PageBackground } from "@/components/layout/PageBackground";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  apiUrl,
  backendDocsUrl,
  backendHealthUrl,
  getApiBaseUrl,
} from "@/lib/api-base";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const readerHeaderBtnClass =
  "gap-1.5 rounded-full border-violet-500/25 bg-white/60 px-3 shadow-sm backdrop-blur-xs dark:border-violet-400/30 dark:bg-slate-900/70 cursor-pointer";

type HealthSummary = {
  status: string;
  providers: number;
  working: number;
};

type ProviderHealthEntry = {
  status: string;
  label: string;
  detail: string;
};

const STATUS_DOT: Record<string, string> = {
  green: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]",
  yellow: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  red: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
  gray: "bg-slate-400",
};

// Fixed slot order keeps the grid stable even if the API omits a provider key temporarily.
const PROVIDER_SLOTS = [
  "edge-tts",
  "gtts",
  "elevenlabs",
  "huggingface",
  "replicate",
  "openai",
] as const;

function badgeForProviderStatus(
  status: string,
): ComponentProps<typeof Badge>["variant"] {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  if (status === "red") return "destructive";
  return "muted";
}

export default function HealthPage() {
  const reduced = usePrefersReducedMotion();
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [providers, setProviders] = useState<
    Record<string, ProviderHealthEntry>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolvedApiOrigin = useMemo(() => {
    const base = getApiBaseUrl();
    if (base) return base;
    if (import.meta.env.DEV)
      return `${typeof window !== "undefined" ? window.location.origin : ""} → proxy :8000`;
    return typeof window !== "undefined" ? window.location.origin : "";
  }, []);

  const rawHealthUrl = useMemo(() => backendHealthUrl(), []);
  const frontendOrigin = useMemo(
    () =>
      typeof window !== "undefined" ? window.location.origin : "unavailable",
    [],
  );
  const providerEntries = useMemo(() => Object.entries(providers), [providers]);
  const hasProviderData = providerEntries.length > 0;
  const providerTotal = providerEntries.length;
  const providerOnline = providerEntries.filter(
    ([, p]) => p.status === "green",
  ).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel fetch keeps the summary cards in sync (one round-trip latency).
      const [hRes, pRes] = await Promise.all([
        fetch(apiUrl("/api/health")),
        fetch(apiUrl("/api/provider-health")),
      ]);
      if (!hRes.ok) {
        throw new Error(`Health: HTTP ${hRes.status}`);
      }
      if (!pRes.ok) {
        throw new Error(`Provider health: HTTP ${pRes.status}`);
      }
      const hJson = (await hRes.json()) as HealthSummary;
      const pJson = (await pRes.json()) as Record<string, ProviderHealthEntry>;
      setHealth(hJson);
      setProviders(pJson);
    } catch (e) {
      // Stale-while-revalidate: keep last good health + provider grid so refresh
      // does not empty / blink; error banner explains the failed attempt.
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overallOk = health?.status === "ok" && !error;
  const stairItem = useMemo(() => {
    const ease = [0.22, 1, 0.36, 1] as const;
    return {
      hidden: (i = 0) => ({
        opacity: 0,
        y: reduced ? 0 : 16 + i * 2,
      }),
      show: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {
          duration: reduced ? 0 : 0.45,
          ease,
          delay: reduced ? 0 : i * 0.08,
        },
      }),
    };
  }, [reduced]);

  const staggerContainer = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: {
          staggerChildren: reduced ? 0 : 0.08,
          delayChildren: reduced ? 0 : 0.05,
        },
      },
    }),
    [reduced],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PageBackground
        orbitClassName="reader-orbit"
        orbitOpacity="opacity-[0.14] dark:opacity-[0.11]"
      />
      <div className="relative z-10 flex flex-1 flex-col py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[96rem] px-1 sm:px-2">
          <div className="mx-auto w-full space-y-6">
            <motion.header
              className="flex flex-col gap-3 sm:gap-4"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              <motion.div
                custom={0}
                variants={stairItem}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-violet-500/55 bg-violet-500/10 text-violet-600 dark:border-violet-400/50 dark:text-violet-300"
                    aria-hidden
                  >
                    <Activity className="h-5 w-5" />
                  </div>
                  <h1 className="font-display min-w-0 text-2xl font-normal tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                    API health
                  </h1>
                </div>
                <nav
                  className="flex flex-wrap items-center gap-2 sm:justify-end"
                  aria-label="Health page navigation"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className={readerHeaderBtnClass}
                  >
                    <a
                      href={backendDocsUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      API Docs
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className={readerHeaderBtnClass}
                  >
                    <a
                      href={rawHealthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden
                      />
                      Raw JSON
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className={readerHeaderBtnClass}
                  >
                    <Link to="/app">
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Reader
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className={readerHeaderBtnClass}
                  >
                    <Link to="/">
                      <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Home
                    </Link>
                  </Button>
                </nav>
              </motion.div>
              <motion.p
                custom={1}
                variants={stairItem}
                className="max-w-3xl text-sm text-slate-600 dark:text-slate-400"
              >
                Live summary from{" "}
                <code className="rounded bg-slate-900/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
                  {apiUrl("/api/health")}
                </code>
                . Requests use{" "}
                <code className="rounded bg-slate-900/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
                  VITE_API_BASE_URL
                </code>{" "}
                when set (production); otherwise same-origin / dev proxy.
              </motion.p>
              <motion.div
                custom={2}
                variants={stairItem}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
              >
                <p className="min-w-0 flex-1 text-xs text-muted-foreground sm:flex-none">
                  Resolved origin:{" "}
                  <span className="break-all font-mono text-violet-600 dark:text-violet-300">
                    {resolvedApiOrigin}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void load()}
                  disabled={loading}
                  className={cn(readerHeaderBtnClass, "shrink-0 sm:min-w-[7.5rem]")}
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      loading && "animate-spin",
                    )}
                    aria-hidden
                  />
                  {loading ? "Refreshing..." : "Refresh"}
                </Button>
              </motion.div>
            </motion.header>

            <motion.div
              className="grid gap-4 sm:grid-cols-3"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              <motion.div custom={0} variants={stairItem}>
              <Card
                className={cn(
                  "glow-card-sm glow-card-sm-hover border-slate-200 bg-white/70 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70",
                  "sm:col-span-1",
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Server className="h-4 w-4 text-violet-500" />
                    Status
                  </CardTitle>
                  <CardDescription>Core health check</CardDescription>
                </CardHeader>
                <CardContent>
                  {error ? (
                    <Badge variant="destructive">Error</Badge>
                  ) : loading && !health ? (
                    <Skeleton className="h-6 w-24" />
                  ) : overallOk ? (
                    <Badge variant="success" className="text-sm">
                      {health?.status ?? "—"}
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      {health?.status ?? "unknown"}
                    </Badge>
                  )}
                </CardContent>
              </Card>
              </motion.div>
              <motion.div custom={1} variants={stairItem}>
              <Card className="glow-card-sm glow-card-sm-hover border-slate-200 bg-white/70 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Boxes className="h-4 w-4 text-sky-500" />
                    Providers
                  </CardTitle>
                  <CardDescription>Registered engines</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl text-slate-900 dark:text-slate-50">
                    {loading && !health ? (
                      <Skeleton className="h-9 w-16" />
                    ) : (
                      health?.providers ?? "—"
                    )}
                  </p>
                </CardContent>
              </Card>
              </motion.div>
              <motion.div custom={2} variants={stairItem}>
              <Card className="glow-card-sm glow-card-sm-hover border-slate-200 bg-white/70 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Working / partial
                  </CardTitle>
                  <CardDescription>
                    Usable on free tier or with keys
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl text-slate-900 dark:text-slate-50">
                    {loading && !health ? (
                      <Skeleton className="h-9 w-14" />
                    ) : (
                      health?.working ?? "—"
                    )}
                  </p>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>

            <motion.div
              className="grid gap-4 lg:grid-cols-2"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              <motion.div custom={0} variants={stairItem}>
              <Card className="glow-card-sm glow-card-sm-hover border-slate-200 bg-white/70 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Monitor className="h-4 w-4 text-violet-500" />
                    Frontend runtime
                  </CardTitle>
                  <CardDescription>Live browser/client details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Mode:{" "}
                    <span className="font-mono text-foreground">
                      {import.meta.env.MODE}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Frontend origin:{" "}
                    <span className="font-mono text-foreground">
                      {frontendOrigin}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    API base env:{" "}
                    <span className="font-mono text-foreground">
                      {getApiBaseUrl() || "not set (proxy/same-origin)"}
                    </span>
                  </p>
                </CardContent>
              </Card>
              </motion.div>

              <motion.div custom={1} variants={stairItem}>
              <Card className="glow-card-sm glow-card-sm-hover border-slate-200 bg-white/70 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/70">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Network className="h-4 w-4 text-cyan-500" />
                    Backend routing
                  </CardTitle>
                  <CardDescription>Dynamic URLs resolved in app</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Health endpoint:{" "}
                    <span className="font-mono text-foreground">
                      {apiUrl("/api/health")}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Provider health:{" "}
                    <span className="font-mono text-foreground">
                      {apiUrl("/api/provider-health")}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Docs URL:{" "}
                    <span className="font-mono text-foreground">
                      {backendDocsUrl()}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Raw health URL:{" "}
                    <span className="font-mono text-foreground">
                      {rawHealthUrl}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Provider cards loaded:{" "}
                    <span className="font-mono text-foreground">
                      {providerOnline}/{providerTotal} green
                    </span>
                  </p>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>

            {error && (
              <motion.div variants={stairItem} custom={0} initial="hidden" animate="show">
              <Card className="border-red-500/40 bg-red-500/5 dark:bg-red-950/20">
                <CardHeader>
                  <CardTitle className="text-base text-red-800 dark:text-red-200">
                    Could not reach API
                  </CardTitle>
                  <CardDescription className="text-red-700/90 dark:text-red-300/90">
                    {error}
                  </CardDescription>
                </CardHeader>
              </Card>
              </motion.div>
            )}

            <motion.div variants={stairItem} custom={1} initial="hidden" animate="show">
            <Card className="glow-card glow-card-hover rounded-3xl border border-white/40 bg-white/55 backdrop-blur-xs dark:border-slate-700/60 dark:bg-slate-900/60">
              <CardHeader>
                <CardTitle className="font-display text-xl">
                  Provider status
                </CardTitle>
                <CardDescription>
                  Live from{" "}
                  <code className="text-xs">
                    {apiUrl("/api/provider-health")}
                  </code>
                  {loading && Object.keys(providers).length > 0 ? (
                    <span className="block pt-1 text-muted-foreground">
                      Showing last successful response while refreshing.
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul
                  className="grid gap-3 sm:grid-cols-2"
                  aria-busy={loading}
                >
                  {PROVIDER_SLOTS.map((id) => {
                    const p = providers[id];
                    const showSkeleton = loading && !hasProviderData;
                    return (
                    <li
                      key={id}
                      className="flex gap-3 rounded-xl border border-slate-200/80 bg-white/50 p-3 dark:border-white/10 dark:bg-slate-950/40"
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                          p ? STATUS_DOT[p.status] || STATUS_DOT.gray : STATUS_DOT.gray,
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {id}
                          </span>
                          {showSkeleton ? (
                            <Skeleton className="h-5 w-20" />
                          ) : p ? (
                            <Badge variant={badgeForProviderStatus(p.status)}>
                              {p.label}
                            </Badge>
                          ) : (
                            <Badge variant="muted">Unknown</Badge>
                          )}
                        </div>
                        {showSkeleton ? (
                          <Skeleton className="h-4 w-full max-w-[26rem]" />
                        ) : p?.detail ? (
                          <p className="text-xs text-muted-foreground">
                            {p.detail}
                          </p>
                        ) : null}
                      </div>
                    </li>
                    );
                  })}
                  {!loading && Object.keys(providers).length === 0 && !error ? (
                    <li className="text-sm text-muted-foreground">
                      No provider data.
                    </li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
