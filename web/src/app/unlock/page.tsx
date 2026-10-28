import { Suspense } from "react";
import { UnlockForm } from "./form";

export default function UnlockPage() {
  return (
    <div className="mx-auto max-w-md py-16">
      <p className="eyebrow">Restricted</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Enter access code</h1>
      <p className="mt-2 text-sm text-muted">
        Live guide generation starts a sandbox and uses model credits, so it&apos;s limited to invited reviewers. The guide library is public.
      </p>
      <Suspense>
        <UnlockForm />
      </Suspense>
    </div>
  );
}
