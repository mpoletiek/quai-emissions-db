import { Card, CardTitle } from "@/components/ui/Card";
import {
  SOAP_ACTIVATION_DATE,
  SOAP_FORK_BLOCK,
} from "@/lib/quai/protocol-constants";

// SoapCallout — text card framing what SOAP does and why each audience
// (miners, investors) cares. Pairs with SingularityCallout above the
// supply-story flagship so the chart's wedges and reference lines have an
// upstream narrative anchor.

export function SoapCallout() {
  return (
    <Card>
      <CardTitle>
        SOAP — Subsidized Open-market Acquisition Protocol
      </CardTitle>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-900/75 dark:text-white/75">
        <p>
          Active since{" "}
          <span className="font-medium">{SOAP_ACTIVATION_DATE}</span>, Prime
          block{" "}
          <span className="font-mono">
            #{Number(SOAP_FORK_BLOCK).toLocaleString()}
          </span>
          . Three algorithms now contribute to each block:{" "}
          <span className="font-medium">KawPoW</span> (GPU) seals the block
          and merge-mines from RVN;{" "}
          <span className="font-medium">SHA-256</span> workshares
          merge-mine from BCH;{" "}
          <span className="font-medium">Scrypt</span> workshares merge-mine
          from LTC and DOGE.
        </p>
        <p>
          Parent-chain coinbase subsidies are routed to the{" "}
          <span className="font-medium">Quai Foundation</span>, sold on
          market for QUAI, and burned. Cumulative result is the orange line
          on the supply and SOAP mining charts below.
        </p>
        <p>
          <span className="font-medium">For miners</span>: existing
          RVN/BCH/LTC/DOGE hashrate adds Quai workshares with zero extra
          power or hardware. GPU operators earn QUAI directly via KawPoW.{" "}
          <span className="font-medium">For investors</span>: parent-chain
          mining emissions become continuous on-chain QUAI buy pressure,
          then burn — pushing net dilution toward zero as adoption scales.
        </p>
        <p className="text-xs text-slate-900/55 dark:text-white/55">
          Annotation visible across every time-series chart on this
          dashboard.
        </p>
      </div>
    </Card>
  );
}
