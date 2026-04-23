import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { getCullCandidates } from "@/lib/cull";
import { CullClient } from "./cull-client";

export default async function CullPage() {
  await headers();
  const { userId } = await auth();
  if (!userId) return null;

  const candidates = await getCullCandidates(userId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cull list</h2>
        <p className="text-muted-foreground">
          Bookmarks unlikely to ever be read. Archive in bulk to keep your queue
          honest.
        </p>
      </div>
      <CullClient candidates={candidates} />
    </div>
  );
}
