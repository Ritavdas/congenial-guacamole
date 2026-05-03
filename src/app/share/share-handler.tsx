"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddBookmarkDialog } from "@/components/bookmarks/add-bookmark-dialog";

export function ShareHandler({ url }: { url: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <AddBookmarkDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) router.push("/");
      }}
      initialUrl={url}
      // Hide the default trigger — this dialog is opened programmatically.
      trigger={<span style={{ display: "none" }} aria-hidden />}
    />
  );
}
