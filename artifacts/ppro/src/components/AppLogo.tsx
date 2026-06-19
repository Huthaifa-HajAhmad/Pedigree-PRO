import React from "react";

interface AppLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export function AppLogo({ className = "", size = "100%", color = "currentColor" }: AppLogoProps) {
  const isTwoTone = color === "currentColor";

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      {/* Circle (Female Node) on the Left */}
      <circle
        cx="25"
        cy="22"
        r="9"
        fill={isTwoTone ? undefined : color}
        className={isTwoTone ? "fill-slate-500 dark:fill-slate-400" : ""}
      />

      {/* Square (Male Node) on the Right */}
      <rect
        x="66"
        y="13"
        width="18"
        height="18"
        rx="2.5"
        fill={isTwoTone ? undefined : color}
        className={isTwoTone ? "fill-slate-500 dark:fill-slate-400" : ""}
      />

      {/* Horizontal couple connection line */}
      <line
        x1="34"
        y1="22"
        x2="66"
        y2="22"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5"
        strokeLinecap="round"
        className={isTwoTone ? "stroke-slate-500 dark:stroke-slate-400" : ""}
      />

      {/* Vertical connection drop that hooks into the DNA loop */}
      <path
        d="M 50 22 V 33 C 50 37, 47 38, 43 38"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        className={isTwoTone ? "stroke-slate-500 dark:stroke-slate-400" : ""}
      />

      {/* DNA double helix backbone 1 (continuous through first crossing, broken at second crossing at y=80) */}
      <path
        d="M 38 34 C 38 42, 50 42, 50 50 C 50 58, 65 58, 65 65 C 65 71, 56 71, 53 76"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />
      <path
        d="M 47 84 C 44 89, 38 89, 38 96"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />

      {/* DNA double helix backbone 2 (broken at first crossing at y=50, continuous through second crossing) */}
      <path
        d="M 62 34 C 62 40, 56 40, 53 46"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />
      <path
        d="M 47 54 C 44 59, 35 59, 35 65 C 35 72, 50 72, 50 80 C 50 88, 62 88, 62 96"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />

      {/* Base pair rungs: Top loop rungs (complementary split) */}
      <line
        x1="39"
        y1="42"
        x2="46"
        y2="42"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="4"
        strokeLinecap="round"
        className={isTwoTone ? "stroke-blue-600/70 dark:stroke-blue-400/70" : ""}
        opacity="0.8"
      />
      <line
        x1="61"
        y1="42"
        x2="54"
        y2="42"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="4"
        strokeLinecap="round"
        className={isTwoTone ? "stroke-blue-600/70 dark:stroke-blue-400/70" : ""}
        opacity="0.8"
      />

      {/* Base pair rungs: Middle loop rungs (centered in loops) */}
      <line
        x1="37"
        y1="59"
        x2="63"
        y2="59"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="4"
        strokeLinecap="round"
        className={isTwoTone ? "stroke-blue-600/70 dark:stroke-blue-400/70" : ""}
        opacity="0.8"
      />
      <line
        x1="37"
        y1="71"
        x2="63"
        y2="71"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="4"
        strokeLinecap="round"
        className={isTwoTone ? "stroke-blue-600/70 dark:stroke-blue-400/70" : ""}
        opacity="0.8"
      />

      {/* Base pair rungs: Bottom loop rung (centered in loop) */}
      <line
        x1="41"
        y1="88"
        x2="59"
        y2="88"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="4"
        strokeLinecap="round"
        className={isTwoTone ? "stroke-blue-600/70 dark:stroke-blue-400/70" : ""}
        opacity="0.8"
      />
    </svg>
  );
}

export function AppLogoIcon({ className = "w-5 h-5", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-primary/10 p-2 shrink-0`}>
      <AppLogo className={`${className} text-primary`} size="100%" color={color} />
    </div>
  );
}
