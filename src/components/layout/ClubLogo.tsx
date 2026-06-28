"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

const LOGO_CANDIDATES = ["/logo.png", "/logo.jpg", "/logo.webp", "/logo.ico"];

interface ClubLogoProps {
  size?: number;
  className?: string;
}

export function ClubLogo({ size = 36, className }: ClubLogoProps) {
  const [srcIndex, setSrcIndex] = useState(0);
  const src = LOGO_CANDIDATES[srcIndex];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md object-contain", className)}
      decoding="async"
      onError={() => {
        setSrcIndex((current) =>
          current < LOGO_CANDIDATES.length - 1 ? current + 1 : current
        );
      }}
    />
  );
}
