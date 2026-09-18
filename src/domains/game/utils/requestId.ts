const UUID_BYTES = 16;
const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;

/**
 * A fresh identifier for **one write intention**, in the shape the backend's
 * `game_moves.request_id` column takes: a lowercase version-4 UUID. Anything
 * else comes back `422 request_id_invalid` before the write is applied.
 *
 * It is built from `crypto.getRandomValues` and never from
 * `crypto.randomUUID`, which is a secure-context API: this runs over plain HTTP
 * on a home LAN, where `crypto.randomUUID` is simply not there. One code path,
 * exercised everywhere, rather than a fast path that only the developer's
 * localhost ever takes.
 */
export function newRequestId (): string {
  const bytes = new Uint8Array(UUID_BYTES);

  crypto.getRandomValues(bytes);

  // Version 4 in the high nibble of byte 6, variant 10 in the top bits of byte 8.
  bytes[VERSION_BYTE] = (bytes[VERSION_BYTE] & 0x0f) | 0x40;
  bytes[VARIANT_BYTE] = (bytes[VARIANT_BYTE] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
