import { cn } from "@/lib/utils";

export const CoachName = "Penny";

export type CoachMood = "happy" | "cheer" | "think" | "comfort";

const SIZES = { sm: 48, md: 80, lg: 128 } as const; // width in px; height is 1.2x

// Scalloped cloud body: 10 bumps around a core.
const BUMPS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return { cx: 50 + Math.cos(a) * 27, cy: 45 + Math.sin(a) * 27 };
});

const INK = "#14231C";

/** Penny: mustard cloud AI coach from the Figma baseline. Pure SVG, server- or client-side. */
export function PennySvg({ mood = "happy", px = 80 }: { mood?: CoachMood; px?: number }) {
  const line = { stroke: INK, strokeWidth: 2.4, fill: "none", strokeLinecap: "round" as const };
  const face = {
    happy: (
      <>
        <circle cx="41" cy="40" r="2.8" fill={INK} />
        <path d="M55 41 q4 -4.5 8 0" {...line} />
        <path d="M43 51 q6 5 12 0" {...line} />
      </>
    ),
    cheer: (
      <>
        <path d="M37 41 q4 -4.5 8 0" {...line} />
        <path d="M55 41 q4 -4.5 8 0" {...line} />
        <path d="M42 49 q8 9 16 0 z" fill={INK} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
    think: (
      <>
        <circle cx="43" cy="38" r="2.8" fill={INK} />
        <circle cx="59" cy="38" r="2.8" fill={INK} />
        <circle cx="52" cy="52" r="2.2" fill={INK} />
      </>
    ),
    comfort: (
      <>
        <path d="M37 40 q4 4 8 0" {...line} />
        <path d="M55 40 q4 4 8 0" {...line} />
        <path d="M45 51 q5 3.5 10 0" {...line} />
      </>
    ),
  }[mood];

  return (
    <svg viewBox="0 0 100 120" width={px} height={px * 1.2} role="img" aria-label={`${CoachName}, your AI money coach`}>
      {/* legs */}
      <path d="M38 80 v32 q0 3 -3 3" stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <path d="M38 80 v32 q0 3 -3 3" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M62 80 v32 q0 3 3 3" stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <path d="M62 80 v32 q0 3 3 3" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* body */}
      <g fill="#F2C24B">
        <circle cx="50" cy="45" r="30" />
        {BUMPS.map((b, i) => (
          <circle key={i} cx={b.cx.toFixed(2)} cy={b.cy.toFixed(2)} r="13.5" />
        ))}
      </g>
      {face}
      {/* crossed arms */}
      <path d="M22 60 q14 12 30 8 q12 -3 22 -10" {...line} strokeWidth="2" />
      <path d="M26 66 q10 -8 24 -6 q14 2 26 8" {...line} strokeWidth="2" />
      {mood === "cheer" && (
        <g fill="#1F4A39">
          <path d="M6 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
          <path d="M92 10 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" />
        </g>
      )}
      {mood === "think" && (
        <g fill="#6B746E">
          <circle cx="88" cy="16" r="2.5" />
          <circle cx="95" cy="7" r="3.5" />
        </g>
      )}
      {mood === "comfort" && <path d="M90 22 c-3 -5 -10 -2 -6 4 l6 6 6 -6 c4 -6 -3 -9 -6 -4z" fill="#e0607a" />}
    </svg>
  );
}

export function Coach({
  mood = "happy",
  message,
  size = "md",
  className,
}: {
  mood?: CoachMood;
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const stacked = size === "lg"; // big Penny: bubble above, like the onboarding screen
  return (
    <div className={cn("flex gap-3", stacked ? "flex-col items-center" : "items-end", className)}>
      {message && (
        <div
          className={cn(
            "relative max-w-xs rounded-2xl bg-white px-4 py-3 text-sm leading-snug text-[#14231C] shadow-sm",
            stacked ? "order-first text-center" : "order-last mb-6",
          )}
          aria-live="polite"
        >
          {message}
          <span
            aria-hidden
            className={cn(
              "absolute size-3 rotate-45 bg-white",
              stacked ? "-bottom-1.5 left-1/2 -translate-x-1/2" : "bottom-3 -left-1.5",
            )}
          />
        </div>
      )}
      <div className={cn("relative shrink-0", mood === "cheer" ? "coach-bounce" : "coach-float")}>
        <PennySvg mood={mood} px={SIZES[size]} />
        <span
          className="absolute -right-1 bottom-[22%] rounded-full bg-[#1F4A39] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow"
          title={`${CoachName} is an AI assistant`}
        >
          AI
        </span>
      </div>
    </div>
  );
}
