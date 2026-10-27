import { defineMcpClientConnection } from "eve/connections";
import { felsparConnection } from "@felspar/sdk/eve";

// Felspar as a registered company agent, with its own key in FELSPAR_AGENT_KEY.
export default defineMcpClientConnection(felsparConnection());
