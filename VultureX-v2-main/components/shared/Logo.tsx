import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** Rendered size of the square mark, in pixels. */
  size?: number;
  /** Show the VultureX wordmark next to the mark. */
  wordmark?: boolean;
  /** Extra classes for the wrapping element. */
  className?: string;
  /** Text size for the wordmark, so each surface keeps its existing type scale. */
  textClassName?: string;
  /** Preload the mark when it is part of the first screen (navbar, auth card). */
  priority?: boolean;
};

/**
 * The official VultureX logo mark.
 *
 * The artwork ships with its own purple plate, so it stays legible on both the
 * light and dark palettes. A hairline ring keeps the square edge from bleeding
 * into either background, and the mark keeps its original square proportions
 * at every size.
 */
export function Logo({
  size = 22,
  wordmark = true,
  className,
  textClassName = "text-sm",
  priority = false,
}: LogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/vx-logo.png"
        alt={wordmark ? "" : "VultureX"}
        width={size}
        height={size}
        priority={priority}
        className="shrink-0 rounded-[22%] ring-1 ring-black/10 dark:ring-white/15"
        style={{ width: size, height: size }}
      />
      {wordmark && (
        <span className={cn("whitespace-nowrap font-semibold tracking-tight", textClassName)}>
          VultureX
        </span>
      )}
    </span>
  );
}
