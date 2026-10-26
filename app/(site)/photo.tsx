"use client";

/* eslint-disable @next/next/no-img-element -- hotlinked from the real site */
import { useState } from "react";

/** A photo from the real site; shows a neutral placeholder if it can't be loaded. */
export default function Photo(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  if (failed || !props.src) {
    return <span role="img" aria-label={props.alt || undefined} className={`photo-placeholder ${props.className ?? ""}`} style={props.style} />;
  }
  return <img {...props} alt={props.alt ?? ""} data-photo="" onError={() => setFailed(true)} />;
}
