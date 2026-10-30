"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface OverflowMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface OverflowMenuProps {
  label: string;
  items: OverflowMenuItem[];
}

export function OverflowMenu({
  label,
  items,
}: OverflowMenuProps): React.ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-lg leading-none text-charcoal-200 hover:bg-charcoal-800"
        >
          …
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1">
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.disabled}
                className="min-h-11 w-full rounded-md px-3 py-2 text-left text-sm text-charcoal-100 hover:bg-charcoal-800 disabled:cursor-not-allowed disabled:text-charcoal-400"
                onClick={item.onSelect}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
