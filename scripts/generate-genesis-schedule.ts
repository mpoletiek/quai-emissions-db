/* eslint-disable no-console */
// Regenerates the data tables in lib/quai/genesis-schedule.ts from the
// canonical go-quai source:
//   params/genesis_alloc.json     — 16,744 accounts × 4 unlock cohorts
//   params/genesis_alloc.go       — calculateLockedBalances logic
//   params/forfeiture_addresses.json — Singularity-fork forfeiture set
//   core/state/gen_allocs.go      — AddLockedBalances applies forfeiture
//                                    when PrimeTerminusNumber >= SingularityForkBlock
//
// Emits two tables: the full schedule (no Singularity) and the
// post-Singularity schedule (forfeiture applied at month >= 14, since
// the fork date 2026-03-19 falls between m13 (2026-02-23) and m14
// (2026-03-25)). Run: `npx tsx scripts/generate-genesis-schedule.ts`.

const ALLOC_URL =
  "https://raw.githubusercontent.com/dominant-strategies/go-quai/main/params/genesis_alloc.json";
const FORFEITURE_URL =
  "https://raw.githubusercontent.com/dominant-strategies/go-quai/main/params/forfeiture_addresses.json";

/** First unlock month at/after the Singularity Fork. */
const SINGULARITY_FIRST_FORFEIT_MONTH = 14;

// The four go-quai unlock schedules, mirroring params/genesis_alloc.go.
type ScheduleDef = {
  unlockDuration: number;
  lumpSumPercentage: bigint;
  lumpSumMonth: number;
  unlockMonthStart: number;
};
const SCHEDULES: readonly ScheduleDef[] = [
  { unlockDuration: 0, lumpSumPercentage: 0n, lumpSumMonth: 0, unlockMonthStart: 0 },
  { unlockDuration: 0, lumpSumPercentage: 100n, lumpSumMonth: 0, unlockMonthStart: 0 },
  { unlockDuration: 36, lumpSumPercentage: 25n, lumpSumMonth: 0, unlockMonthStart: 13 },
  { unlockDuration: 36, lumpSumPercentage: 25n, lumpSumMonth: 12, unlockMonthStart: 13 },
];

type RawAccount = {
  unlockSchedule: number;
  address: string;
  award: number | string; // big numeric — JSON.parse turns small ones into number
  vested: number | string;
  lumpSumMonth: number;
};

function asBig(n: number | string): bigint {
  // JSON has values like 211500000000000000000 (no quotes) — JSON.parse loses
  // precision. We re-fetch as text and parse bigints by string match below;
  // this branch is the fallback if a small int slips through.
  return BigInt(typeof n === "string" ? n : Math.round(n));
}

async function fetchAllocs(): Promise<RawAccount[]> {
  const text = await fetch(ALLOC_URL).then((r) => {
    if (!r.ok) throw new Error(`fetch ${ALLOC_URL} → ${r.status}`);
    return r.text();
  });
  // The alloc JSON ships big integers without quotes. JSON.parse with a
  // reviver can't help (numeric tokens are pre-parsed to Number). Wrap the
  // numeric fields in strings before parsing so we keep precision.
  const safe = text.replace(
    /("award"|"vested")\s*:\s*(\d+)/g,
    '$1: "$2"',
  );
  return JSON.parse(safe) as RawAccount[];
}

async function fetchForfeitureSet(): Promise<Set<string>> {
  const arr = (await fetch(FORFEITURE_URL).then((r) => {
    if (!r.ok) throw new Error(`fetch ${FORFEITURE_URL} → ${r.status}`);
    return r.json();
  })) as string[];
  return new Set(arr.map((a) => a.toLowerCase()));
}

type Schedules = {
  full: Map<number, bigint>;
  postSingularity: Map<number, bigint>;
};

function buildSchedules(
  accounts: RawAccount[],
  forfeit: Set<string>,
): Schedules {
  const full = new Map<number, bigint>();
  const post = new Map<number, bigint>();
  const inc = (table: Map<number, bigint>, month: number, wei: bigint) => {
    table.set(month, (table.get(month) ?? 0n) + wei);
  };

  for (const a of accounts) {
    const sched = SCHEDULES[a.unlockSchedule];
    if (a.unlockSchedule === 0) continue;
    const award = asBig(a.award);
    const vested = asBig(a.vested);
    const isForfeit = forfeit.has(a.address.toLowerCase());

    let lump = (award * sched.lumpSumPercentage) / 100n;
    if (lump > vested) lump = vested;
    const lumpMonth =
      a.unlockSchedule === 1 ? a.lumpSumMonth : sched.lumpSumMonth;

    type Row = { m: number; w: bigint };
    const rows: Row[] = [{ m: lumpMonth, w: lump }];
    let distributed = lump;

    if (sched.unlockDuration !== 0) {
      const unlockable = award - lump;
      const perUnlock = unlockable / BigInt(sched.unlockDuration);
      const remaining = vested - lump;
      const numUnlocks = Number(remaining / perUnlock);
      const first = sched.unlockMonthStart;
      const last = first + numUnlocks - 1;
      for (let m = first; m <= last; m++) {
        rows.push({ m, w: perUnlock });
        distributed += perUnlock;
      }
      const rounding = vested - distributed;
      // Add rounding to the final monthly unlock.
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].m === last) {
          rows[i] = { m: last, w: rows[i].w + rounding };
          break;
        }
      }
    }

    for (const { m, w } of rows) {
      inc(full, m, w);
      if (!(isForfeit && m >= SINGULARITY_FIRST_FORFEIT_MONTH)) {
        inc(post, m, w);
      }
    }
  }
  return { full, postSingularity: post };
}

function emit(label: string, table: Map<number, bigint>) {
  const months = [...table.keys()].sort((a, b) => a - b);
  let cum = 0n;
  console.log(`// ${label}`);
  for (const m of months) {
    const mu = table.get(m)!;
    cum += mu;
    console.log(`  [${m}, ${mu}n, ${cum}n],`);
  }
  console.error(`  ${label} → final cumulative ${cum} wei`);
  return cum;
}

async function main() {
  console.error(`Fetching ${ALLOC_URL} …`);
  const accounts = await fetchAllocs();
  console.error(`Parsed ${accounts.length} accounts`);
  console.error(`Fetching ${FORFEITURE_URL} …`);
  const forfeit = await fetchForfeitureSet();
  console.error(`Loaded ${forfeit.size} forfeit addresses`);

  const { full, postSingularity } = buildSchedules(accounts, forfeit);
  const fullTotal = emit(
    "Replace the body of GENESIS_UNLOCK_SCHEDULE with these rows:",
    full,
  );
  console.log();
  const postTotal = emit(
    "Replace the body of POST_SINGULARITY_UNLOCK_SCHEDULE with these rows:",
    postSingularity,
  );

  const skipped = fullTotal - postTotal;
  console.error(
    `Skipped at Singularity (~SINGULARITY_SKIP_QUAI): ${
      Number(skipped / 10n ** 18n).toLocaleString()
    } QUAI`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
