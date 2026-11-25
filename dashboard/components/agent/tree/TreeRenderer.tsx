"use client";

import { useCallback, useMemo, useState } from "react";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV2 } from "@/lib/agent/surfaces/v2/tree";
import { TreeContext, TreeNode, type TreeCtx } from "./nodes";

/**
 * A variant 2 surface (plan Task 2.2, spec 7.1 "Primitives + tokens"): the agent's
 * primitive tree, drawn by one fixed component per node (nodes.tsx). `gathered` is the
 * surface's stored gathered data; every bound value is read from it by pointer or job id.
 *
 * Field and Select values are kept per surface (per mounted renderer; key it by the
 * surface row id so a new row starts empty). A Button whose action is `answer` first sends
 * one answer intent per filled field, in the order the user first filled them, then its own
 * action, and clears the values. Any other Button sends exactly its own action.
 *
 * Preconditions for the host (Task 2.8): `payload` passed validateSurfaceV2 or at least
 * its schema, and `gathered` was total-parsed from the stored row. The renderer still
 * never throws on a bind that no longer resolves; it shows a fixed placeholder.
 */
export function TreeRenderer({
  payload,
  gathered,
  onIntent,
}: {
  payload: SurfacePayloadV2;
  gathered: GatheredData;
  onIntent: (intent: ActionIntent) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const setValue = useCallback((id: string, value: string) => {
    setValues((v) => ({ ...v, [id]: value }));
  }, []);
  const press = useCallback(
    (action: ActionIntent) => {
      if (action.name === "answer") {
        for (const [questionId, value] of Object.entries(values)) {
          if (value.trim() !== "") onIntent({ name: "answer", questionId, value });
        }
        setValues({});
      }
      onIntent(action);
    },
    [onIntent, values],
  );
  const ctx = useMemo<TreeCtx>(() => ({ gathered, values, setValue, press }), [gathered, values, setValue, press]);
  return (
    <TreeContext.Provider value={ctx}>
      <div className="rf-tree">
        {payload.title && <h2 className="rf-tree__title">{payload.title}</h2>}
        <TreeNode node={payload.root} depth={1} />
      </div>
    </TreeContext.Provider>
  );
}
