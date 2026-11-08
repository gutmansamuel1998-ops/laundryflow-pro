import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { clampMinutes } from "@/lib/laundrySession";

// Large, clearly labeled controls (min 56px tall), visible focus comes from index.css.

export const BigButton = React.forwardRef(function BigButton(
  { variant = "primary", className, children, ...props },
  ref
) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-background text-foreground border-2 border-foreground hover:bg-muted",
    ghost: "bg-transparent text-foreground underline underline-offset-4 hover:bg-muted min-h-[48px] text-base font-medium",
  };
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "w-full min-h-[56px] rounded-2xl px-6 py-3 text-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function Panel({ className, children, ...props }) {
  return (
    <section className={cn("rounded-3xl border-2 border-border bg-card p-5", className)} {...props}>
      {children}
    </section>
  );
}

export function Chip({ pressed, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "min-h-[48px] rounded-full border-2 px-5 text-base font-medium",
        pressed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
      )}
      {...props}
    >
      {pressed ? "✓ " : ""}
      {children}
    </button>
  );
}

export function MinutesStepper({ id, label, value, onChange, min = 5, max = 240, step = 5, hint }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = (raw) => {
    const n = clampMinutes(raw, min, max);
    onChange(n);
    setText(String(n));
  };

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-base font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label} by ${step} minutes`}
          onClick={() => commit(value - step)}
          disabled={value <= min}
          className="min-h-[56px] min-w-[56px] rounded-2xl border-2 border-foreground text-2xl font-bold disabled:opacity-40"
        >
          −
        </button>
        <div className="flex flex-1 items-baseline justify-center gap-2">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => commit(text)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(text);
            }}
            aria-describedby={hint ? `${id}-hint` : undefined}
            className="w-24 rounded-xl border-2 border-border bg-background py-2 text-center text-3xl font-semibold tabular-nums"
          />
          <span className="text-lg">min</span>
        </div>
        <button
          type="button"
          aria-label={`Increase ${label} by ${step} minutes`}
          onClick={() => commit(value + step)}
          disabled={value >= max}
          className="min-h-[56px] min-w-[56px] rounded-2xl border-2 border-foreground text-2xl font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function OptionGroup({ legend, name, value, onChange, options, description }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-base font-semibold">{legend}</legend>
      {description && <p className="mb-2 text-sm text-muted-foreground">{description}</p>}
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex min-h-[56px] cursor-pointer items-start gap-3 rounded-2xl border-2 p-4",
            value === o.value ? "border-primary bg-secondary" : "border-border"
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-1 h-5 w-5"
          />
          <span>
            <span className="block font-medium">{o.label}</span>
            {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

// A native checkbox exposed as a switch: large target, keyboard + screen-reader friendly,
// with a visible On/Off word so state never depends on color.
export function ToggleRow({ id, label, hint, checked, onChange, disabled }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-[56px] items-center justify-between gap-4 rounded-2xl border-2 border-border p-4",
        disabled ? "opacity-60" : "cursor-pointer"
      )}
    >
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-semibold" aria-hidden="true">
          {checked ? "On" : "Off"}
        </span>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-7 w-7"
        />
      </span>
    </label>
  );
}
