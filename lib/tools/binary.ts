/**
 * Convert typed-array byte data into a standalone ArrayBuffer.
 *
 * Newer TypeScript DOM typings model Uint8Array as potentially backed by
 * SharedArrayBuffer (ArrayBufferLike), while Blob/File constructors accept
 * BlobPart backed by ArrayBuffer. Copying into a fresh ArrayBuffer removes
 * that ambiguity and keeps the runtime behavior identical.
 */
export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
