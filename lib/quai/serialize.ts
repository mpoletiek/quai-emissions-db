/**
 * Bigints don't survive JSON.stringify. We serialize them as decimal strings
 * over the wire and rehydrate on the client.
 */
export type JsonBig = string;

export const b2s = (v: bigint): JsonBig => v.toString();
export const s2b = (v: JsonBig): bigint => BigInt(v);

// Serialize an object, replacing all bigints with strings.
export function serializeBig<T>(obj: T): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) =>
      typeof v === "bigint" ? { __big: v.toString() } : v,
    ),
  );
}

// Parse the mirrored structure back to bigints.
export function reviveBig<T>(obj: unknown): T {
  return JSON.parse(JSON.stringify(obj), (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v) && "__big" in v && Object.keys(v).length === 1) {
      return BigInt((v as { __big: string }).__big);
    }
    return v;
  }) as T;
}
