"use client";

import React from "react";

interface CharacterCountProps {
  current: number;
  max: number;
  min?: number;
}

export function CharacterCount({
  current,
  max,
  min,
}: CharacterCountProps): React.ReactElement {
  const overMax = current > max;
  const meetsMin = min === undefined || current >= min;

  return (
    <p
      className={`text-xs ${
        overMax
          ? "text-error"
          : meetsMin
            ? "text-charcoal-400"
            : "text-charcoal-500"
      }`}
    >
      {current}/{max}
    </p>
  );
}
