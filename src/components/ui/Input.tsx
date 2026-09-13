"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, className = "", id, type, ...props },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const isDateInput = type === "date";

  return (
    <div className="w-full min-w-0">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-charcoal-200 mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`
          w-full min-w-0 max-w-full px-4 py-2.5
          bg-charcoal-800 border border-charcoal-600
          rounded-lg text-charcoal-100
          placeholder:text-charcoal-500
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isDateInput ? "min-h-[44px] appearance-none" : ""}
          ${error ? "border-error ring-1 ring-error" : ""}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-sm text-charcoal-400">{helperText}</p>
      )}
    </div>
  );
});
