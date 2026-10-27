import { felsparDecisionEvents } from "@felspar/sdk/eve";
import { defineHook } from "eve/hooks";
import { gate } from "../lib/felspar-gate.ts";

// Record each Felspar decision and output check as Felspar returned it, with
// the case the call asked about, so the action gate can check it.
export default defineHook({ events: felsparDecisionEvents(gate) });
