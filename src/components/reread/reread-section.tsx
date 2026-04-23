import Image from "next/image";
import Link from "next/link";

import { getRereadCandidates } from "@/lib/reread";

export async function RereadSection({ userId }: { userId: string }) {
  const candidates = await getRereadCandidates(userId);
  if (candidates.length === 0) return null;

  return (
    <section className="mt-10">
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-semibold tracking-tight">
          Worth revisiting
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Based on what you recently finished
        </p>
      </header>
      <ul className="space-y-2">
        {candidates.map((c) => {
          const favicon = `https://www.google.com/s2/favicons?domain=${c.domain}&sz=64`;
          return (
            <li key={c.id}>
              <Link href={`/read/${c.id}`} className="group block">
                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2 hover:bg-accent/40 hover:border-border transition-colors">
                  <Image
                    src={favicon}
                    alt=""
                    width={20}
                    height={20}
                    unoptimized
                    className="h-5 w-5 shrink-0 rounded-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium leading-snug group-hover:text-primary">
                      {c.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.domain} · {c.readMinutes} min read
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
