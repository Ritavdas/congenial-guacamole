import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getHonestyStats, getHonestyCommentary } from "@/lib/honesty";
import { HonestyView } from "./honesty-view";

export default async function HonestyPage() {
  await headers();
  const { userId } = await auth();
  if (!userId) return null;

  const stats = await getHonestyStats(userId);
  const commentary = await getHonestyCommentary(userId, stats);

  return <HonestyView stats={stats} commentary={commentary} />;
}
