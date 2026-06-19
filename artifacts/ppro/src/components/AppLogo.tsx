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

      {/* 
        DNA Helix Backbone 1 (Starts Left, Ends Right)
        Alternating overlaps: Broken at Crossing 1 (y=44) and Crossing 3 (y=80), Continuous at Crossing 2 (y=62)
      */}
      {/* Segment A1: Top left to before Crossing 1 */}
      <path
        d="M 38 34 C 38 38, 44 40, 46 41"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />
      {/* Segment A2: Between Crossing 1 and Crossing 3 */}
      <path
        d="M 53 47 C 56 49, 65 49, 65 53 C 65 58, 50 58, 50 62 C 50 66, 35 66, 35 71 C 35 74, 44 76, 46 77"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />
      {/* Segment A3: After Crossing 3 to Bottom Right */}
      <path
        d="M 53 83 C 56 85, 65 85, 65 89 C 65 93, 60 93, 60 95"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />

      {/* 
        DNA Helix Backbone 2 (Starts Right, Ends Left)
        Alternating overlaps: Continuous at Crossing 1 (y=44) and Crossing 3 (y=80), Broken at Crossing 2 (y=62)
      */}
      {/* Segment B1: Top right to before Crossing 2 */}
      <path
        d="M 60 35 C 60 40, 50 40, 50 44 C 50 48, 35 48, 35 53 C 35 56, 44 58, 46 59"
        stroke={isTwoTone ? undefined : color}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={isTwoTone ? "stroke-blue-600 dark:stroke-blue-400" : ""}
      />
      {/* Segment B2: After Crossing 2 to Bottom Left */}
      <path
        d="M 54 65 C 56 66, 65 66, 65 71 C 65 76, 50 76, 50 80 C 50 84, 40 84, 40 95"
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
