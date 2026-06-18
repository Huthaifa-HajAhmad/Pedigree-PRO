import React from "react";

interface AppLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export function AppLogo({ className = "", size = "100%", color = "currentColor" }: AppLogoProps) {
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
      {/* Male Node (Square) */}
      <rect
        x="12"
        y="12"
        width="24"
        height="24"
        rx="3"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Female Node (Circle) */}
      <circle
        cx="76"
        cy="24"
        r="12"
        stroke={color}
        strokeWidth="5"
        fill="none"
      />

      {/* Horizontal Line (Couple Connection) */}
      <line
        x1="36"
        y1="24"
        x2="64"
        y2="24"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Vertical Connection Drop */}
      <path
        d="M 50 24 V 40"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* DNA Backbone 1 */}
      <path
        d="M 50 40 C 50 48, 35 48, 35 56 C 35 64, 65 64, 65 72 C 65 80, 35 80, 35 88 C 35 96, 50 96, 50 100"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* DNA Backbone 2 */}
      <path
        d="M 50 40 C 50 48, 65 48, 65 56 C 65 64, 35 64, 35 72 C 35 80, 65 80, 65 88 C 65 96, 50 96, 50 100"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* Base pair rungs */}
      <line x1="40" y1="48" x2="60" y2="48" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <line x1="40" y1="64" x2="60" y2="64" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <line x1="40" y1="80" x2="60" y2="80" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
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
