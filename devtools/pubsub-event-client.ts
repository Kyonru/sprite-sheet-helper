import { EventClient } from "@tanstack/devtools-event-client";

interface EventLogEntry {
  id: number;
  event: string | symbol;
  payload: unknown;
  timestamp: number;
  listeners: number;
}

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
