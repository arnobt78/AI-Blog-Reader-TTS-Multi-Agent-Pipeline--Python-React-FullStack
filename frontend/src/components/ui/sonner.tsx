import { Toaster as Sonner } from "sonner";
import { useEffect, useState, type ComponentProps } from "react";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <Sonner
      theme={dark ? "dark" : "light"}
      position="bottom-right"
      expand={false}
      richColors
      closeButton
      offset={16}
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            "group border border-violet-200/70 bg-white/95 text-slate-900 shadow-lg backdrop-blur-md dark:border-violet-500/30 dark:bg-slate-950/95 dark:text-slate-50",
          title: "font-semibold text-sm",
          description: "text-xs text-slate-600 dark:text-slate-300",
          actionButton:
            "rounded-lg border border-violet-300/60 bg-violet-500/10 text-xs font-medium text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-100",
          cancelButton:
            "rounded-lg border border-slate-300/70 bg-white/80 text-xs dark:border-slate-600 dark:bg-slate-900/80",
          closeButton:
            "border border-slate-300/60 bg-white/90 text-slate-600 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200",
        },
      }}
      {...props}
    />
  );
}
