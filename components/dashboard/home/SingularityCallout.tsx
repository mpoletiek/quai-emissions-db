import { Card, CardTitle } from "@/components/ui/Card";
import {
  SINGULARITY_FORK_DATE,
  SINGULARITY_FORK_BLOCK,
  SINGULARITY_SKIP_QUAI,
} from "@/lib/quai/protocol-constants";
import { formatCompact, weiToFloat } from "@/lib/format";

// SingularityCallout — text card explaining what the Singularity Fork did
// and why it doesn't appear as a wedge on the supply chart. Sits next to
// the conversion / exchange-rate panels in the tokenomics grid so the
// numeric story (constants in the hero) gets a narrative anchor.

export function SingularityCallout() {
  return (
    <Card>
      <CardTitle>The Singularity Fork</CardTitle>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-900/75 dark:text-white/75">
        <p>
          On <span className="font-medium">{SINGULARITY_FORK_DATE}</span>, at
          Prime block{" "}
          <span className="font-mono">
            #{SINGULARITY_FORK_BLOCK.toLocaleString()}
          </span>
          , Quai's foundation, investors, and core team agreed to permanently
          eliminate{" "}
          <span className="font-mono text-slate-900 dark:text-white">
            {formatCompact(weiToFloat(SINGULARITY_SKIP_QUAI, 0))} QUAI
          </span>{" "}
          of future genesis unlocks.
        </p>
        <p>
          Those allocations were never minted. They aren't in{" "}
          <code className="text-slate-900/80 dark:text-white/80">
            quaiSupplyTotal
          </code>{" "}
          today and won't be in any future cumulative chart — so this event
          doesn't appear as a wedge on the supply curves. What it changes is
          the eventual maximum supply: roughly 81% of the future-vested
          baseline was struck.
        </p>
        <p className="text-xs text-slate-900/55 dark:text-white/55">
          Annotation only on the time-series charts. The numeric impact lives
          in the <span className="italic">Singularity skip</span> hero card
          above.
        </p>
      </div>
    </Card>
  );
}
