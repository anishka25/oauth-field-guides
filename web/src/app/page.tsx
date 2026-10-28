import { Library } from "@/components/library";
import { listGuides } from "@/lib/guides";

export const dynamic = "force-dynamic";

export default async function Home() {
  const guides = await listGuides();
  return (
    <div>
      <section className="mb-10 max-w-3xl">
        <p className="eyebrow">For agent builders</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          Know if your OAuth app takes an hour or six weeks.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Before your users can connect an app, you register an OAuth app with the provider, and sometimes you need it approved. Each guide covers the effort, the review wait, the requirements that block approval, and which steps an agent can do for you.
        </p>
      </section>
      <Library guides={guides} />
    </div>
  );
}
