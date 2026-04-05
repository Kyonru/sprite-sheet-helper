import { useEffect, useState } from "react";
import { pubSubEventClient } from "./pubsub-event-client";
import type { EventLogEntry } from "../src/lib/events";
import { PubSub } from "../src/lib/events";
import { JsonEditor } from "@/components/editor/json";

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 1000) return `${diff}ms ago`;
  return `${(diff / 1000).toFixed(1)}s ago`;
};

const EntryRow = ({ entry }: { entry: EventLogEntry }) => {
  const [expanded, setExpanded] = useState(false);
  const hasPayload = entry.payload !== null && entry.payload !== undefined;

  return (
    <div
      style={{
        borderBottom: "1px solid #333",
        padding: "6px 10px",
        cursor: hasPayload ? "pointer" : "default",
        fontSize: 12,
      }}
      onClick={() => hasPayload && setExpanded((v) => !v)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3b82f6",
              display: "inline-block",
            }}
          />
          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
            {String(entry.event)}
          </span>
          {entry.listeners === 0 && (
            <span style={{ color: "#f59e0b", fontSize: 10 }}>no listeners</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, color: "#888", fontSize: 10 }}>
          <span>{entry.listeners} listeners</span>
          <span>{timeAgo(entry.timestamp)}</span>
        </div>
      </div>
      {expanded && hasPayload && (
        <JsonEditor
          value={JSON.stringify(entry.payload, null, 2)}
          editable={false}
        />
      )}
    </div>
  );
};

export default function PubSubDevtoolPanel() {
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    return pubSubEventClient.on("pubsub-log", (e) => {
      setEntries(e.payload.entries);
    });
  }, []);

  const filtered = filter
    ? entries.filter((e) => String(e.event).includes(filter))
    : entries;

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderBottom: "1px solid #333",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>📡 PubSub Events</span>
        <input
          style={{
            marginLeft: "auto",
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid #444",
            background: "#1a1a1a",
            color: "#fff",
            width: 140,
          }}
          placeholder="Filter events..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          style={{
            fontSize: 11,
            color: "#888",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => PubSub.clearLog()}
        >
          Clear
        </button>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#666",
              fontSize: 12,
              padding: 24,
            }}
          >
            No events yet. Emit something!
          </p>
        ) : (
          filtered.map((entry) => <EntryRow key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "4px 10px",
          borderTop: "1px solid #333",
          fontSize: 10,
          color: "#666",
        }}
      >
        {filtered.length} of {entries.length} events · click entry to expand
        payload
      </div>
    </div>
  );
}
