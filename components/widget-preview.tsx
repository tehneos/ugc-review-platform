"use client";

import { useEffect, useRef } from "react";

/** Učitava pravi widget.js, isti koji ide na stranicu brenda. */
export function WidgetPreview({ publicKey }: { publicKey: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.async = true;
    script.dataset.widget = publicKey;
    box.appendChild(script);
    return () => {
      box.replaceChildren();
    };
  }, [publicKey]);

  return <div ref={ref} />;
}
