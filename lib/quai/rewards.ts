// Port of go-quai's base-block-reward math. Bit-identical to
// consensus/misc/rewards.go:CalculateQuaiReward in go-quai v0.52.0.
//
// We compute this client-side for every block (pre- and post-SOAP), so
// pre-SOAP data (which quai_getMiningInfo refuses) still has first-principles
// reward values. For post-SOAP blocks we could rely on getMiningInfo.baseBlockReward
// instead, but computing client-side keeps the column consistent and serves as
// a correctness cross-check.

const MANT_BITS = 64n;
const BIG_2E32 = 1n << 32n;
const BIG_2E64 = 1n << 64n;
const BIG_TWO_FP = 2n << MANT_BITS; // 2 in (MANT_BITS)-bit fixed point

// Protocol constants (params/protocol_params.go)
export const KAWPOW_FORK_BLOCK = 1_171_500n; // prime-terminus numbering
export const KQUAI_RESET_AFTER_KAWPOW_FORK_BLOCK = KAWPOW_FORK_BLOCK;
export const KQUAI_DIFFICULTY_DIVISOR = 300_000_000_000n;
export const EXPECTED_WORKSHARES_PER_BLOCK = 8n;

/**
 * Port of common.LogBig (common/big.go:92) — `floor(log2(n) * 2^64)` as a
 * bigint. Uses fixed-point iterative squaring to produce MANT_BITS fractional
 * bits of precision without converting to float.
 *
 * Algorithm: c = floor(log2(n)); normalize n to y in [1,2) × 2^64; then for
 * each fractional bit, square-and-compare y against 2, shifting right if it
 * overflowed. Result: c*2^64 + m, where m captures the fractional bits.
 */
export function logBig(n: bigint): bigint {
  if (n <= 0n) throw new Error("logBig: n must be positive");
  // Integer part
  let c = 0n;
  let v = n;
  while (v > 1n) {
    v >>= 1n;
    c++;
  }
  // y = (n / 2^c) * 2^64, a fixed-point value in [1,2) with 64 frac bits.
  let y = (n << MANT_BITS) >> c;
  let m = 0n;
  for (let i = 0n; i < MANT_BITS; i++) {
    y = (y * y) >> MANT_BITS; // square, drop half the fractional bits
    m <<= 1n;
    if (y >= BIG_TWO_FP) {
      m |= 1n;
      y >>= 1n; // renormalize into [1,2) × 2^64
    }
  }
  return c * BIG_2E64 + m;
}

/**
 * KawPowEquivalentDifficulty — adjusts the raw difficulty upward based on
 * cross-algorithm workshare activity so the reward formula treats KawPoW as
 * if it were still the sole algorithm. Source: consensus/misc/rewards.go:191.
 *
 * shaShares / scryptShares are the EMA counts from woHeader, in 2^32 units.
 */
export function kawPowEquivalentDifficulty(
  difficulty: bigint,
  shaShares: bigint,
  scryptShares: bigint,
): bigint {
  const expectedTotalShares = (EXPECTED_WORKSHARES_PER_BLOCK + 1n) * BIG_2E32;
  const cap = expectedTotalShares - BIG_2E32;
  const combined = shaShares + scryptShares;
  const totalMultiAlgoShares = combined < cap ? combined : cap;
  const numerator = difficulty * expectedTotalShares;
  const denominator = expectedTotalShares - totalMultiAlgoShares;
  if (denominator <= 0n) return difficulty;
  return numerator / denominator;
}

/**
 * Client-side CalculateQuaiReward. Returns QUAI wei.
 *
 * `primeTerminusNumber` is the prime-chain block number whose terminus this
 * zone block rolled up from. Pass 0 (or any value < KawPowForkBlock) for
 * pre-SOAP blocks, where shaShares/scryptShares aren't used.
 */
export function calculateQuaiReward(args: {
  difficulty: bigint;
  exchangeRate: bigint;
  primeTerminusNumber: number;
  shaShares: bigint;
  scryptShares: bigint;
}): bigint {
  const ptn = BigInt(args.primeTerminusNumber);
  let effective = args.difficulty;
  if (ptn >= KAWPOW_FORK_BLOCK) {
    effective = kawPowEquivalentDifficulty(
      args.difficulty,
      args.shaShares,
      args.scryptShares,
    );
  }
  let logDiff = logBig(effective);
  if (ptn >= KQUAI_RESET_AFTER_KAWPOW_FORK_BLOCK) {
    logDiff = logDiff - logBig(KQUAI_DIFFICULTY_DIVISOR);
  }
  const reward = (args.exchangeRate * logDiff) / BIG_2E64;
  return reward <= 0n ? 1n : reward;
}
