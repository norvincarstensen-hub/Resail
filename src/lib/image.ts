// Verkleinert Fotos vor dem Hochladen im Browser. Handyfotos haben oft 5–12 MB,
// für die App reichen ein paar hundert KB. PDFs werden unverändert hochgeladen.

import { MAX_FILE_BYTES, isAllowedFileType } from "./files";

export class FileError extends Error {}

export async function prepareUpload(file: File, maxSide: number, quality: number): Promise<Blob> {
  if (file.type.startsWith("image/")) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob) return blob;
    } catch {
      // Format kann der Browser nicht lesen (z. B. HEIC außerhalb von Safari): Original nehmen
    }
  }

  if (!isAllowedFileType(file.type)) {
    throw new FileError("Dieses Dateiformat wird nicht unterstützt. Erlaubt sind Fotos und PDFs.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new FileError("Die Datei ist zu groß (höchstens 10 MB).");
  }
  return file;
}
