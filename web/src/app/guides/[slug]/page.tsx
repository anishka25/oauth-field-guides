import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GuideView } from "@/components/guide";
import { ShareButton } from "@/components/copy";
import { getGuide } from "@/lib/guides";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = await getGuide((await params).slug);
  return g ? { title: `${g.name} OAuth setup · ${g.verdict.label}`, description: g.verdict.headline } : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = await getGuide((await params).slug);
  if (!g) notFound();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> All guides
        </Link>
        <ShareButton />
      </div>
      <GuideView g={g} />
    </div>
  );
}
