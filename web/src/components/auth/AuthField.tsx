import clsx from "clsx";

export function AuthField({
  label,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-secondary">{label}</span>
      <input
        id={id}
        className={clsx(
          "w-full rounded-[6px] border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-tertiary focus:border-border-strong",
          className,
        )}
        {...props}
      />
    </label>
  );
}
