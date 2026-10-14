"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FILE_BUCKET, newFilePath } from "@/lib/files";
import { FileError, prepareUpload } from "@/lib/image";
import { setItemPhoto } from "../actions";

type Props = { itemId: string; userId: string; photoUrl: string | null };

export function PhotoUpload({ itemId, userId, photoUrl }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    let path: string | null = null;
    try {
      const blob = await prepareUpload(file, 1600, 0.8);
      path = newFilePath(userId, itemId, blob.type);
      const { error: uploadError } = await supabase.storage
        .from(FILE_BUCKET)
        .upload(path, blob, { contentType: blob.type });
      if (uploadError) throw new Error(uploadError.message);

      const result = await setItemPhoto(itemId, path);
      if (result.error) throw new FileError(result.error);
      router.refresh();
    } catch (e) {
      if (path) await supabase.storage.from(FILE_BUCKET).remove([path]);
      setError(
        e instanceof FileError ? e.message : "Das Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm("Foto wirklich entfernen?")) return;
    setBusy(true);
    setError(null);
    const result = await setItemPhoto(itemId, null);
    if (result.error) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- zeitlich begrenzter Link aus privatem Speicher
        <img
          src={photoUrl}
          alt="Foto des Artikels"
          className="aspect-square w-full max-w-sm rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
        />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-[4/3] w-full max-w-sm flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          <span className="text-3xl">📷</span>
          <span>{busy ? "Wird hochgeladen …" : "Foto hinzufügen"}</span>
        </button>
      )}

      {photoUrl && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-60 dark:border-zinc-700"
          >
            {busy ? "Wird hochgeladen …" : "Foto ändern"}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="px-2 py-2 text-sm text-red-700 disabled:opacity-60 dark:text-red-300"
          >
            Entfernen
          </button>
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
