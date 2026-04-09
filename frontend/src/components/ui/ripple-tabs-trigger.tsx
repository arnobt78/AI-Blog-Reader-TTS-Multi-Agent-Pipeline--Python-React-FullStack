import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";

type Ripple = { id: string; x: number; y: number };

export const RippleTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, onClick, ...props }, ref) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idPrefix = useId();
  const seq = useRef(0);

  const addRipple = useCallback(
    (clientX: number, clientY: number, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const id = `${idPrefix}-${seq.current++}`;
      setRipples((r) => [...r, { id, x, y }]);
    },
    [idPrefix],
  );

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    addRipple(e.clientX, e.clientY, e.currentTarget);
    onClick?.(e);
  };

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      type="button"
      className={cn(
        "relative inline-flex w-full touch-manipulation items-center justify-center overflow-hidden whitespace-nowrap rounded-xl border-2 py-2.5 text-sm font-medium ring-offset-background transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=inactive]:border-violet-400/40 data-[state=inactive]:bg-slate-900/[0.12] data-[state=inactive]:text-muted-foreground dark:data-[state=inactive]:border-violet-500/45 dark:data-[state=inactive]:bg-white/[0.06]",
        "data-[state=inactive]:hover:border-violet-400/55 data-[state=inactive]:hover:bg-violet-500/12 data-[state=inactive]:hover:text-slate-800 dark:data-[state=inactive]:hover:text-slate-100",
        "data-[state=active]:border-violet-400/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:via-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-[0_12px_32px_rgba(124,58,237,0.45)]",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute z-[5] animate-ripple-expand rounded-full bg-white/50 shadow-[0_0_24px_rgba(255,255,255,0.55)] ring-2 ring-white/35 will-change-transform"
          style={{
            left: r.x,
            top: r.y,
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
          }}
          onAnimationEnd={() => {
            setRipples((prev) => prev.filter((x) => x.id !== r.id));
          }}
        />
      ))}
      <span className="relative z-[3] inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </TabsPrimitive.Trigger>
  );
});
RippleTabsTrigger.displayName = "RippleTabsTrigger";
