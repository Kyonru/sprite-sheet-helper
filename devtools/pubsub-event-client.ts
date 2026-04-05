import { EventClient } from "@tanstack/devtools-event-client";
import type { EventLogEntry } from "../src/lib/events";

type EventMap = {
  "pubsub-log": { entries: EventLogEntry[] };
};

class PubSubEventClient extends EventClient<EventMap> {
  constructor(enabled = true) {
    super({
      pluginId: "pubsub-devtools",
      debug: enabled,
    });
  }
}

export const pubSubEventClient = new PubSubEventClient();
