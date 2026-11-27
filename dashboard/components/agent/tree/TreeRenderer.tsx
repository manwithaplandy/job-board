"use client";

import { useCallback, useContext, useMemo, useState } from "react";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV2 } from "@/lib/agent/surfaces/v2/tree";
import { ViewHostContext } from "../ViewHostContext";
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
 *
 * Inside a view frame (ViewHostContext) the frame's h3 is the title, so the tree draws
 * none of its own; rendered alone it keeps its h2.
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
  // `order` keeps the ids in the order first filled: Object.entries would list integer-like
  // ids ("1", "2") first, whatever the fill order (PR J1 review M5).
  const [fields, setFields] = useState<{ values: Record<string, string>; order: string[] }>({ values: {}, order: [] });
  const values = fields.values;
  const setValue = useCallback((id: string, value: string) => {
    setFields((f) => ({ values: { ...f.values, [id]: value }, order: f.order.includes(id) ? f.order : [...f.order, id] }));
  }, []);
  const press = useCallback(
    (action: ActionIntent) => {
      if (action.name === "answer") {
        for (const questionId of fields.order) {
          const value = fields.values[questionId];
          if (typeof value === "string" && value.trim() !== "") onIntent({ name: "answer", questionId, value });
        }
        setFields({ values: {}, order: [] });
      }
      onIntent(action);
    },
    [onIntent, fields],
  );
  const inFrame = useContext(ViewHostContext) !== null;
  const ctx = useMemo<TreeCtx>(() => ({ gathered, values, setValue, press }), [gathered, values, setValue, press]);
  return (
    <TreeContext.Provider value={ctx}>
      <div className="rf-tree">
        {payload.title && !inFrame && <h2 className="rf-tree__title">{payload.title}</h2>}
        <TreeNode node={payload.root} depth={1} />
      </div>
    </TreeContext.Provider>
  );
}
