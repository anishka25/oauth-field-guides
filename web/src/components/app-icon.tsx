"use client";
import { useEffect, useRef, useState } from "react";

// Favicons are derived from the guide's website, so curated and agent-generated
// guides both get one with no extra data. Tries the exact host, then the root
// domain (console.cloud.google.com → google.com), then falls back to a monogram.
function candidates(website: string) {
  try {
    const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
    const root = host.split(".").slice(-2).join(".");
    return [...new Set([host, root])];
  } catch {
    return [];
  }
}

// DuckDuckGo returns 404 for unknown domains, so onError is a reliable miss signal.
const src = (d: string) => `https://icons.duckduckgo.com/ip3/${d}.ico`;

export function AppIcon({ name, website, size = 40 }: { name: string; website: string; size?: number }) {
  const domains = candidates(website);
  const [idx, setIdx] = useState(0);
  const img = useRef<HTMLImageElement>(null);

  // An image can fail before hydration attaches onError.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setIdx((i) => i + 1);
  }, [idx]);

  const domain = domains[idx];
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white"
      style={{ width: size, height: size }}
    >
      {domain ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          key={domain}
          src={src(domain)}
          alt=""
          width={size * 0.6}
          height={size * 0.6}
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <span className="font-semibold text-zinc-700" style={{ fontSize: size * 0.42 }}>
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
