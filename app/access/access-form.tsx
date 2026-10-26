"use client";

import { useState } from "react";

export default function AccessForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    if (res?.ok) {
      const next = new URLSearchParams(location.search).get("next") || "/";
      // Only follow same-site paths.
      location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
      return;
    }
    setError(res ? "That code isn't right. Try again." : "Couldn't reach the server. Try again.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="access-code" className="form-label fw-semibold">
        Access code
      </label>
      <input
        id="access-code"
        className={`form-control form-control-lg mb-2${error ? " is-invalid" : ""}`}
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ fontSize: 16 }}
      />
      {error && <div className="invalid-feedback d-block mb-2">{error}</div>}
      <button className="btn btn-lg w-100 text-white" style={{ background: "#A6192E" }} disabled={busy || !code}>
        {busy ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
