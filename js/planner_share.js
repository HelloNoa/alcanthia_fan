// 배치 데이터는 fragment에 넣어 정적 서버의 요청 URI 길이 제한을 피한다.
const SHARE_HASH_PREFIX = "#p/";
const LEGACY_SHARE_HASH_PREFIX = "#planner/plan/";
const DEFLATE_BASE85_PREFIX = "z.";
const GZIP_BASE64_PREFIX = "gz.";
const GZIP_UNICODE_PREFIX = "gzu.";
// URL fragment와 Discord Markdown 양쪽에서 별도 이스케이프가 필요 없는 85자.
const BASE85_ALPHABET = "!$&'*+,-./0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~";
const BASE85_INDEX = new Map([...BASE85_ALPHABET].map((char, index) => [char, index]));
const UNICODE_BASE = 0x4e00;
const UNICODE_RADIX = 8192;
const MAX_COMPRESSED_BYTES = 100000;
const MAX_RAW_BYTES = 200000;

const bytesFromBase64Url = (code) => {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const base64UrlFromBytes = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const bytesFromUnicode = (encoded) => {
  if (encoded.length < 2) return null;
  const lengthHigh = encoded.charCodeAt(0) - UNICODE_BASE;
  const lengthLow = encoded.charCodeAt(1) - UNICODE_BASE;
  if (lengthHigh < 0 || lengthHigh >= UNICODE_RADIX
    || lengthLow < 0 || lengthLow >= UNICODE_RADIX) return null;
  const byteLength = lengthHigh * UNICODE_RADIX + lengthLow;
  if (byteLength > MAX_COMPRESSED_BYTES) return null;

  const output = new Uint8Array(byteLength);
  let outputIndex = 0;
  let buffer = 0;
  let bitCount = 0;
  for (let index = 2; index < encoded.length && outputIndex < byteLength; index++) {
    const value = encoded.charCodeAt(index) - UNICODE_BASE;
    if (value < 0 || value >= UNICODE_RADIX) return null;
    buffer = (buffer << 13) | value;
    bitCount += 13;
    while (bitCount >= 8 && outputIndex < byteLength) {
      bitCount -= 8;
      output[outputIndex++] = (buffer >> bitCount) & 0xff;
      buffer &= bitCount ? (1 << bitCount) - 1 : 0;
    }
  }
  return outputIndex === byteLength ? output : null;
};

const base85FromBytes = (bytes) => {
  const packed = new Uint8Array(bytes.length + 3);
  packed[0] = (bytes.length >>> 16) & 0xff;
  packed[1] = (bytes.length >>> 8) & 0xff;
  packed[2] = bytes.length & 0xff;
  packed.set(bytes, 3);

  let output = "";
  for (let offset = 0; offset < packed.length; offset += 4) {
    let value = 0;
    for (let index = 0; index < 4; index++) value = value * 256 + (packed[offset + index] || 0);
    const encoded = Array(5);
    for (let index = 4; index >= 0; index--) {
      encoded[index] = BASE85_ALPHABET[value % 85];
      value = Math.floor(value / 85);
    }
    output += encoded.join("");
  }
  return output;
};

const bytesFromBase85 = (encoded) => {
  if (!encoded || encoded.length % 5) return null;
  const packedLength = (encoded.length / 5) * 4;
  if (packedLength > MAX_COMPRESSED_BYTES + 6) return null;
  const packed = new Uint8Array(packedLength);
  let outputIndex = 0;
  for (let offset = 0; offset < encoded.length; offset += 5) {
    let value = 0;
    for (let index = 0; index < 5; index++) {
      const digit = BASE85_INDEX.get(encoded[offset + index]);
      if (digit == null) return null;
      value = value * 85 + digit;
    }
    if (value > 0xffffffff) return null;
    packed[outputIndex++] = Math.floor(value / 0x1000000) & 0xff;
    packed[outputIndex++] = Math.floor(value / 0x10000) & 0xff;
    packed[outputIndex++] = Math.floor(value / 0x100) & 0xff;
    packed[outputIndex++] = value & 0xff;
  }
  if (packed.length < 3) return null;
  const byteLength = packed[0] * 0x10000 + packed[1] * 0x100 + packed[2];
  if (byteLength > MAX_COMPRESSED_BYTES || byteLength > packed.length - 3) return null;
  return packed.slice(3, 3 + byteLength);
};

const transformBytes = async (bytes, stream) => {
  const transformed = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(transformed).arrayBuffer());
};

export const plannerCompressShareCode = async (code) => {
  if (!code || typeof CompressionStream !== "function") return code;
  try {
    const compressed = await transformBytes(
      bytesFromBase64Url(code),
      new CompressionStream("deflate"),
    );
    if (compressed.length > MAX_COMPRESSED_BYTES) return code;
    const packed = DEFLATE_BASE85_PREFIX + base85FromBytes(compressed);
    return packed.length < code.length ? packed : code;
  } catch {
    return code;
  }
};

export const plannerDecompressShareCode = async (code) => {
  const isBase85 = code?.startsWith(DEFLATE_BASE85_PREFIX);
  const isUnicode = code?.startsWith(GZIP_UNICODE_PREFIX);
  const isBase64 = code?.startsWith(GZIP_BASE64_PREFIX);
  if (!isBase85 && !isUnicode && !isBase64) return code || "";
  if (typeof DecompressionStream !== "function") return "";
  try {
    const compressed = isBase85
      ? bytesFromBase85(code.slice(DEFLATE_BASE85_PREFIX.length))
      : isUnicode
        ? bytesFromUnicode(code.slice(GZIP_UNICODE_PREFIX.length))
        : bytesFromBase64Url(code.slice(GZIP_BASE64_PREFIX.length));
    if (!compressed) return "";
    const format = isBase85 ? "deflate" : "gzip";
    const raw = await transformBytes(compressed, new DecompressionStream(format));
    if (raw.length > MAX_RAW_BYTES) return "";
    return base64UrlFromBytes(raw);
  } catch {
    return "";
  }
};

export const plannerShareCodeFromLocation = ({ search = "", hash = "" } = {}) => {
  const legacyCode = new URLSearchParams(search).get("plan");
  if (legacyCode) return legacyCode;
  const prefix = hash.startsWith(SHARE_HASH_PREFIX)
    ? SHARE_HASH_PREFIX
    : hash.startsWith(LEGACY_SHARE_HASH_PREFIX)
      ? LEGACY_SHARE_HASH_PREFIX
      : "";
  if (!prefix) return "";
  const hashCode = hash.slice(prefix.length);
  try { return decodeURIComponent(hashCode); }
  catch { return hashCode; }
};

export const plannerShareHash = (code) => `${SHARE_HASH_PREFIX}${code}`;

export const plannerDiscordShareText = (url) => `[알칸시아 배치 보기](${url})`;
