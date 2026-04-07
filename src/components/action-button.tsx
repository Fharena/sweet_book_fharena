"use client";

import type { ButtonHTMLAttributes } from "react";

type ActionButtonVariant = "primary" | "secondary" | "ghost";
type ActionButtonSize = "sm" | "md" | "lg" | "pill";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  fullWidth?: boolean;
};

const variantClasses: Record<ActionButtonVariant, string> = {
  primary:
    "bg-[#00342b] text-white hover:bg-[#004d40] shadow-[0_6px_16px_rgba(0,52,43,0.08)]",
  secondary:
    "border border-[rgba(191,201,196,0.22)] bg-[rgba(234,232,227,0.95)] text-slate-900 hover:bg-[rgba(228,226,221,1)]",
  ghost:
    "border border-transparent bg-transparent text-[#3f4945] hover:bg-[#004d40] hover:text-white",
};

const sizeClasses: Record<ActionButtonSize, string> = {
  sm: "min-h-10 rounded-[18px] px-4 py-2.5 text-sm font-semibold",
  md: "min-h-11 rounded-[20px] px-5 py-3 text-sm font-semibold",
  lg: "min-h-12 rounded-[22px] px-8 py-4 text-[14px] font-bold",
  pill: "rounded-full px-4 py-2 text-xs font-semibold",
};

export function ActionButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ActionButtonProps) {
  const classes = [
    "inline-flex touch-manipulation items-center justify-center gap-2 leading-none transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...props} />;
}
