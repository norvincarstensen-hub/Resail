// Fotos und Belege liegen im privaten Speicher "item-files" unter <user_id>/<item_id>/<datei>.
// Die Regeln dazu stehen in supabase/migrations/20261015000000_storage.sql.

export const FILE_BUCKET = "item-files";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_SECONDS = 60 * 60;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export function isAllowedFileType(type: string): boolean {
  return type in EXTENSIONS;
}

export function newFilePath(userId: string, itemId: string, contentType: string): string {
  return `${userId}/${itemId}/${crypto.randomUUID()}.${EXTENSIONS[contentType] ?? "bin"}`;
}

export function isItemFilePath(path: string, userId: string, itemId: string): boolean {
  return path.startsWith(`${userId}/${itemId}/`) && !path.includes("..");
}
