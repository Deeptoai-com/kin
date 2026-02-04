"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

// Pastel neon palette for skill icons
const PASTEL_COLORS = [
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400" },
  { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400" },
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-600 dark:text-yellow-400" },
  { bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-600 dark:text-lime-400" },
  { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-600 dark:text-teal-400" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-600 dark:text-cyan-400" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-600 dark:text-sky-400" },
  { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-600 dark:text-indigo-400" },
  { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-600 dark:text-pink-400" },
];

// Simple hash function to get consistent color for a name
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

interface LetterAvatarProps {
  name: string;
  iconUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-12 text-lg",
};

export function LetterAvatar({ name, iconUrl, size = "md", className }: LetterAvatarProps) {
  const colorIndex = hashString(name) % PASTEL_COLORS.length;
  const color = PASTEL_COLORS[colorIndex];
  const letter = name.charAt(0).toUpperCase();

  // If iconUrl is provided and valid, show the icon
  if (iconUrl) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg overflow-hidden",
          sizeClasses[size],
          className
        )}
      >
        <img
          src={iconUrl}
          alt={name}
          className="size-full object-cover"
          onError={(e) => {
            // Fallback to letter on error
            e.currentTarget.style.display = "none";
            e.currentTarget.parentElement?.classList.add(color.bg);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold",
        sizeClasses[size],
        color.bg,
        color.text,
        className
      )}
    >
      {letter}
    </div>
  );
}
