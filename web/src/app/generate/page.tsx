import { Suspense } from "react";
import { Generator } from "./generator";

export default function GeneratePage() {
  return (
    <div>
      <section className="mb-8 max-w-3xl">
        <p className="eyebrow">Live agent</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Generate a guide for any app</h1>
        <p className="mt-3 text-muted">
          A Codex agent starts in an isolated Modal sandbox. It reads the provider&apos;s docs and probes their OAuth endpoints. Then it asks if you want to try the setup yourself: you sign in and create the app in your own browser, and the agent checks the result.
        </p>
      </section>
      <Suspense>
        <Generator />
      </Suspense>
    </div>
  );
}
