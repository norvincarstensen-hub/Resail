"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FILE_BUCKET, newFilePath } from "@/lib/files";
import { FileError, prepareUpload } from "@/lib/image";
import { RECEIPT_TYPES, RECEIPT_TYPE_LABELS, formatDate, type ReceiptType } from "@/lib/items";
import { addReceipt, deleteReceipt } from "../actions";
import { selectClass, SelectWrapper } from "../select";

export type ReceiptView = {
  id: string;
  type: ReceiptType;
  created_at: string;
  url: string | null;
};

type Props = { itemId: string; userId: string; receipts: ReceiptView[] };

export function Receipts({ itemId, userId, receipts }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<ReceiptType>("kassenbon");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    let path: string | null = null;
    try {
      // Belege etwas größer lassen, damit Text lesbar bleibt
      const blob = await prepareUpload(file, 2400, 0.85);
      path = newFilePath(userId, itemId, blob.type);
      const { error: uploadError } = await supabase.storage
        .from(FILE_BUCKET)
        .upload(path, blob, { contentType: blob.type });
      if (uploadError) throw new Error(uploadError.message);

      const result = await addReceipt(itemId, path, type);
      if (result.error) throw new FileError(result.error);
      router.refresh();
    } catch (e) {
      if (path) await supabase.storage.from(FILE_BUCKET).remove([path]);
      setError(
        e instanceof FileError ? e.message : "Der Beleg konnte nicht hochgeladen werden. Bitte versuche es erneut.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Beleg wirklich löschen?")) return;
    setBusy(true);
    setError(null);
    const result = await deleteReceipt(id);
    if (result.error) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Belege</h2>

      {receipts.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Noch keine Belege. Ein Kassenbon oder Screenshot vom Kauf hilft dir später, den
          Einkaufspreis nachzuweisen.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {receipts.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block font-medium">{RECEIPT_TYPE_LABELS[r.type]}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  hinzugefügt am {formatDate(r.created_at.slice(0, 10))}
                </span>
              </span>
              <span className="flex shrink-0 gap-3">
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">
                    Ansehen
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={busy}
                  className="text-red-700 disabled:opacity-60 dark:text-red-300"
                >
                  Löschen
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <SelectWrapper className="flex-1">
          <select
            aria-label="Belegart"
            value={type}
            onChange={(e) => setType(e.target.value as ReceiptType)}
            className={selectClass}
          >
            {RECEIPT_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECEIPT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </SelectWrapper>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-3 disabled:opacity-60 dark:border-zinc-700"
        >
          {busy ? "Wird hochgeladen …" : "+ Beleg"}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
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
