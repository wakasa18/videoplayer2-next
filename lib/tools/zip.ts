"use client";

import { bytesToArrayBuffer } from "./binary";

export type ZipSource = {
  name: string;
  data: Uint8Array;
  modifiedAt?: Date;
};

export type ZipEntryInfo = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  encrypted: boolean;
  directory: boolean;
  localHeaderOffset: number;
};

type EncodedZipEntry = ZipEntryInfo & {
  nameBytes: Uint8Array;
  crc32: number;
  dosDate: number;
  dosTime: number;
  compressedData: Uint8Array;
};

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const UTF8_FLAG = 0x0800;
const MAX_ZIP_ENTRIES = 1000;
const MAX_EXTRACT_BYTES = 512 * 1024 * 1024;

export async function createZipBlob(
  sources: ZipSource[],
  options: { compress?: boolean } = {},
): Promise<Blob> {
  if (!sources.length) throw new Error("Add at least one file to create a ZIP archive.");
  if (sources.length > MAX_ZIP_ENTRIES) {
    throw new Error(`A ZIP can contain at most ${MAX_ZIP_ENTRIES} files in this tool.`);
  }

  const encoded: EncodedZipEntry[] = [];
  let localOffset = 0;

  for (const source of sources) {
    const safeName = sanitizeZipPath(source.name);
    if (!safeName) continue;
    const input = source.data;
    const crc = crc32(input);
    const { date, time } = toDosDateTime(source.modifiedAt ?? new Date());
    const compressed = options.compress === false ? null : await deflateRaw(input);
    const method = compressed && compressed.byteLength < input.byteLength ? 8 : 0;
    const compressedData = method === 8 ? compressed! : input;
    const nameBytes = new TextEncoder().encode(safeName);

    encoded.push({
      name: safeName,
      compressedSize: compressedData.byteLength,
      uncompressedSize: input.byteLength,
      method,
      encrypted: false,
      directory: safeName.endsWith("/"),
      localHeaderOffset: localOffset,
      nameBytes,
      crc32: crc,
      dosDate: date,
      dosTime: time,
      compressedData,
    });

    localOffset += 30 + nameBytes.byteLength + compressedData.byteLength;
  }

  if (!encoded.length) throw new Error("No valid file names were available for the ZIP archive.");

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];

  for (const entry of encoded) {
    const local = new Uint8Array(30 + entry.nameBytes.byteLength);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, ZIP_LOCAL_SIGNATURE, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, UTF8_FLAG, true);
    localView.setUint16(8, entry.method, true);
    localView.setUint16(10, entry.dosTime, true);
    localView.setUint16(12, entry.dosDate, true);
    localView.setUint32(14, entry.crc32 >>> 0, true);
    localView.setUint32(18, entry.compressedSize, true);
    localView.setUint32(22, entry.uncompressedSize, true);
    localView.setUint16(26, entry.nameBytes.byteLength, true);
    localView.setUint16(28, 0, true);
    local.set(entry.nameBytes, 30);
    localParts.push(local, entry.compressedData);

    const central = new Uint8Array(46 + entry.nameBytes.byteLength);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, ZIP_CENTRAL_SIGNATURE, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, UTF8_FLAG, true);
    centralView.setUint16(10, entry.method, true);
    centralView.setUint16(12, entry.dosTime, true);
    centralView.setUint16(14, entry.dosDate, true);
    centralView.setUint32(16, entry.crc32 >>> 0, true);
    centralView.setUint32(20, entry.compressedSize, true);
    centralView.setUint32(24, entry.uncompressedSize, true);
    centralView.setUint16(28, entry.nameBytes.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, entry.directory ? 0x10 : 0, true);
    centralView.setUint32(42, entry.localHeaderOffset, true);
    central.set(entry.nameBytes, 46);
    centralParts.push(central);
  }

  const centralOffset = localOffset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, ZIP_END_SIGNATURE, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, encoded.length, true);
  endView.setUint16(10, encoded.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob(
    [...localParts, ...centralParts, end].map(bytesToArrayBuffer),
    { type: "application/zip" },
  );
}

export function inspectZip(buffer: ArrayBuffer): ZipEntryInfo[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset < 0) throw new Error("This does not appear to be a valid ZIP archive.");

  const totalEntries = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(`This ZIP contains more than ${MAX_ZIP_ENTRIES} entries, which exceeds the browser safety limit.`);
  }
  if (centralOffset + centralSize > bytes.byteLength) {
    throw new Error("The ZIP central directory is incomplete or corrupted.");
  }

  const entries: ZipEntryInfo[] = [];
  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error("The ZIP central directory is malformed.");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.byteLength) throw new Error("The ZIP contains an invalid file name record.");
    const rawName = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(nameStart, nameEnd));
    const name = sanitizeZipPath(rawName);
    if (name) {
      totalUncompressed += uncompressedSize;
      if (totalUncompressed > MAX_EXTRACT_BYTES) {
        throw new Error("The expanded ZIP is larger than the 512 MB browser safety limit.");
      }
      entries.push({
        name,
        compressedSize,
        uncompressedSize,
        method,
        encrypted: Boolean(flags & 0x0001),
        directory: name.endsWith("/"),
        localHeaderOffset,
      });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function extractZipEntry(
  buffer: ArrayBuffer,
  entry: ZipEntryInfo,
): Promise<Uint8Array> {
  if (entry.directory) return new Uint8Array();
  if (entry.encrypted) throw new Error(`“${entry.name}” is encrypted. Password-protected ZIP extraction is not supported.`);
  if (![0, 8].includes(entry.method)) {
    throw new Error(`“${entry.name}” uses ZIP compression method ${entry.method}, which this browser tool does not support.`);
  }

  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > bytes.byteLength || view.getUint32(offset, true) !== ZIP_LOCAL_SIGNATURE) {
    throw new Error(`The local record for “${entry.name}” is invalid.`);
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > bytes.byteLength) throw new Error(`The compressed data for “${entry.name}” is incomplete.`);
  const compressed = bytes.slice(start, end);
  if (entry.method === 0) return compressed;

  const inflated = await inflateRaw(compressed);
  if (entry.uncompressedSize && inflated.byteLength !== entry.uncompressedSize) {
    throw new Error(`“${entry.name}” did not expand to the expected size.`);
  }
  return inflated;
}

export function sanitizeZipPath(input: string): string {
  const normalized = input
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return normalized.slice(0, 1000);
}

async function deflateRaw(input: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([bytesToArrayBuffer(input)])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function inflateRaw(input: Uint8Array): Promise<Uint8Array> {
  try {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser does not provide raw DEFLATE support.");
    }
    const stream = new Blob([bytesToArrayBuffer(input)])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not expand this ZIP entry: ${error.message}`
        : "Could not expand this ZIP entry.",
    );
  }
}


function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= min; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
}

function toDosDateTime(value: Date): { date: number; time: number } {
  const year = Math.max(1980, value.getFullYear());
  const date = ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate();
  const time = (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2);
  return { date, time };
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
