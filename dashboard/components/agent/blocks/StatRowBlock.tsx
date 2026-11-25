import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { METRIC_GONE_TEXT, METRIC_LABELS, WINDOW_LABELS, metricValue, sampleLabel } from "./metricLabels";
import { BlockFrame } from "./shared";

type StatRow = Extract<V1Block, { type: "StatRow" }>;

/**
 * Up to four headline figures (spec 5(d)), each a metric the turn read, by index into
 * gathered.metrics. Labels are fixed per metric; every figure shows the n it rests on,
 * and a rate with too few records reads "Not enough data yet".
 */
export function StatRowBlock({ block, gathered }: { block: StatRow; gathered: GatheredData }) {
  return (
    <BlockFrame title="At a glance" className="rf-block-stats">
      <dl className="rf-block-stats__row">
        {block.metricRefs.map((ref, i) => {
          const m = gathered.metrics[ref];
          if (!m) {
            return (
              <div key={i} className="rf-block-stats__item">
                <dt>{METRIC_GONE_TEXT}</dt>
              </div>
            );
          }
          return (
            <div key={i} className="rf-block-stats__item">
              <dt>{METRIC_LABELS[m.spec.metric]}</dt>
              <dd className="rf-block-stats__value">{metricValue(m)}</dd>
              <dd className="rf-block-stats__meta">{`${sampleLabel(m.n)} · ${WINDOW_LABELS[m.spec.window]}`}</dd>
            </div>
          );
        })}
      </dl>
    </BlockFrame>
  );
}
