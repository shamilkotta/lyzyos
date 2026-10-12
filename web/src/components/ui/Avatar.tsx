import clsx from "clsx";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

type Props = {
  name: string;
  image?: string | null;
  /** Shown instead of initials when there is no image (e.g. an agent glyph). */
  fallback?: ReactNode;
  className?: string;
  title?: string;
};

/** Round avatar: the user's image, else `fallback`, else their initials. Size comes from `className`. */
export function Avatar({ name, image, fallback, className, title }: Props) {
  return (
    <span
      title={title}
      className={clsx(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas font-medium leading-none text-ink",
        className,
      )}
    >
      {image ? (
        // Avatars are arbitrary external URLs — next/image would need every host allowlisted.
        // oxlint-disable-next-line next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        (fallback ?? initials(name))
      )}
    </span>
  );
}
