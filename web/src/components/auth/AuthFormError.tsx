export function AuthFormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-[6px] bg-pale-red px-3 py-2 text-[12px] text-pale-red-ink" role="alert">
      {message}
    </p>
  );
}
