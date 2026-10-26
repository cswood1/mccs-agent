import type { Metadata } from "next";
import AccessForm from "@/app/access/access-form";

export const metadata: Metadata = { title: "Access" };

export default function AccessPage() {
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ background: "#0C2340" }}>
      <div className="card shadow border-0" style={{ maxWidth: 420, width: "100%" }}>
        <div className="card-body p-4">
          <p className="text-uppercase small fw-bold mb-1" style={{ color: "#A6192E", letterSpacing: "0.08em" }}>
            Prototype demo
          </p>
          <h1 className="h3 ubuntu-bold mb-2">MCCS installation assistant</h1>
          <p className="text-secondary mb-4">
            This demo recreates an MCCS installation site to show the AI assistant in context. It is not the official
            MCCS site. Enter the access code to continue.
          </p>
          <AccessForm />
        </div>
      </div>
    </main>
  );
}
