import { defineState } from "eve/context";
import type { EveGateState } from "@felspar/sdk/eve";

// Host-owned session evidence. Never expose this handle to model-written tools.
export const state = defineState<EveGateState | null>(
  "agent.felspar-gate",
  () => null,
);
