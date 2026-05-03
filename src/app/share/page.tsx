import { redirect } from "next/navigation";
import { ShareHandler } from "./share-handler";

function extractUrl(params: {
  url?: string;
  text?: string;
  title?: string;
}): string | null {
  const isHttp = (s: string) => /^https?:\/\//i.test(s);

  const direct = params.url?.trim();
  if (direct && isHttp(direct)) return direct;

  // Android Chrome often shoves the shared URL into the `text` field.
  for (const field of [params.text, params.title]) {
    if (!field) continue;
    const match = field.match(/https?:\/\/\S+/i);
    if (match) return match[0].trim();
  }

  return null;
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const url = extractUrl({
    url: pick(sp.url),
    text: pick(sp.text),
    title: pick(sp.title),
  });

  if (!url) {
    redirect("/?share_error=missing_url");
  }

  return <ShareHandler url={url} />;
}
