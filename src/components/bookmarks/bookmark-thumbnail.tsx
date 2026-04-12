import Image from "next/image";

interface BookmarkThumbnailProps {
  ogImage: string | null;
  domain: string | null;
  size?: number;
  className?: string;
}

export function BookmarkThumbnail({
  ogImage,
  domain,
  size = 36,
  className = "",
}: BookmarkThumbnailProps) {
  if (ogImage) {
    return (
      <Image
        src={ogImage}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-lg object-cover ${className}`}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }

  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : null;

  if (faviconUrl) {
    return (
      <Image
        src={faviconUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-lg bg-muted p-1.5 ${className}`}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground ${className}`}
      style={{ width: size, height: size }}
    >
      ?
    </div>
  );
}
