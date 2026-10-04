import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#333333] active:scale-[0.98]",
  secondary: "bg-surface text-ink border border-border hover:bg-surface-soft active:scale-[0.98]",
  ghost: "bg-transparent text-ink-secondary hover:bg-surface-soft hover:text-ink",
  danger: "bg-pale-red text-pale-red-ink hover:brightness-95 active:scale-[0.98]",
};

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-all duration-200 disabled:opacity-40",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
