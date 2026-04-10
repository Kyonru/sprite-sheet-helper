/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { storeInspector } from "./inspector-middleware";

const STORE_COLORS: Record<string, string> = {
  playerStore: "#4ade80",
  cameraStore: "#60a5fa",
  uiStore: "#f59e0b",
};
const getStoreColor = (name: string) => STORE_COLORS[name] ?? "#a78bfa";

function JsonNode({ value = "", depth = 0, defaultExpanded = true }) {
  const [open, setOpen] = useState(defaultExpanded && depth < 2);
  if (value === null) return <span style={{ color: "#f87171" }}>null</span>;
  if (typeof value === "boolean")
    return <span style={{ color: "#fb923c" }}>{String(value)}</span>;
  if (typeof value === "number")
    return <span style={{ color: "#60a5fa" }}>{value}</span>;
  if (typeof value === "string")
    return <span style={{ color: "#86efac" }}>"{value}"</span>;
  if (typeof value == "function")
    return (
      <span style={{ color: "#f87171" }}>
        Function{String(value).split(")")[0]})
      </span>
    );
  if (typeof value !== "object")
    return <span style={{ color: "#e2e8f0" }}>{String(value)}</span>;

  const isArr = Array.isArray(value);
  const entries = Object.entries(value as Record<string, any>);
  const bracket = isArr ? ["[", "]"] : ["{", "}"];

  if (entries.length === 0)
    return (
      <span style={{ color: "#64748b" }}>
        {bracket[0]}
        {bracket[1]}
      </span>
    );

  return (
    <span>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          color: "#64748b",
          fontFamily: "inherit",
          fontSize: "inherit",
        }}
      >
        {open ? "▾" : "▸"}
      </button>
      <span style={{ color: "#64748b" }}>{bracket[0]}</span>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
            color: "#475569",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          {entries.length} {isArr ? "items" : "keys"}
        </button>
      )}
      {open && (
        <div style={{ paddingLeft: 16, borderLeft: "1px solid #1e293b" }}>
          {entries.map(([k, v], i) => (
            <div key={k}>
              {!isArr && <span style={{ color: "#94a3b8" }}>{k}: </span>}
              <JsonNode
                value={v}
                depth={depth + 1}
                defaultExpanded={defaultExpanded}
              />
              {i < entries.length - 1 && (
                <span style={{ color: "#334155" }}>,</span>
              )}
            </div>
          ))}
        </div>
      )}
      {open && <span style={{ color: "#64748b" }}>{bracket[1]}</span>}
    </span>
  );
}

function ActionEntry({ entry, index }: { entry: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = getStoreColor(entry.storeName);
  const ts = new Date(entry.timestamp);
  const time = `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}:${String(ts.getSeconds()).padStart(2, "0")}.${String(ts.getMilliseconds()).padStart(3, "0")}`;

  return (
    <div
      style={{
        borderBottom: "1px solid #0f172a",
        opacity: 1,
        animation: index === 0 ? "flashIn 0.3s ease" : "none",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          fontFamily: "inherit",
          fontSize: 11,
          textAlign: "left",
          color: "#94a3b8",
        }}
      >
        <span style={{ color: "#334155", minWidth: 68, flexShrink: 0 }}>
          {time}
        </span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            boxShadow: `0 0 4px ${color}`,
          }}
        />
        <span
          style={{
            color: "#64748b",
            minWidth: 88,
            flexShrink: 0,
            fontSize: 10,
          }}
        >
          {entry.storeName}
        </span>
        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
          {entry.action}
        </span>
        <span style={{ marginLeft: "auto", color: "#334155" }}>
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded && (
        <div
          style={{
            padding: "4px 10px 8px 96px",
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          <JsonNode value={entry.payload} depth={0} defaultExpanded />
        </div>
      )}
    </div>
  );
}

export default function StoreInspectorPanel() {
  const [actions, setActions] = useState<
    {
      action: string;
      storeName: string;
      payload: any;
      timestamp: number;
    }[]
  >([]);
  const [activeStore, setActiveStore] = useState<string>(null!);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("state"); // "state" | "actions"
  const logRef = useRef(null);

  const [state, setState] = useState<Record<string, any>>({});

  useEffect(() => {
    const cleanupState = storeInspector.on("state-changed", (e) => {
      setState((prev) => ({ ...prev, [e.payload.storeName]: e.payload.state }));
    });
    const cleanupActions = storeInspector.on("action-dispatched", (e: any) => {
      setActions((prev: any) => [
        {
          action: e.payload.action,
          storeName: e.payload.storeName,
          payload: e.payload.payload,
          timestamp: e.payload.timestamp,
        },
        ...prev.slice(0, 199),
      ]);
    });
    return () => {
      cleanupState();
      cleanupActions();
    };
  }, []);

  const storeNames = Object.keys(state);
  const displayStore = activeStore ?? storeNames[0];

  const filteredActions = filter
    ? actions.filter(
        (a: any) =>
          a.action.toLowerCase().includes(filter.toLowerCase()) ||
          a.storeName.toLowerCase().includes(filter.toLowerCase()),
      )
    : actions;

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 12,
        background: "#080d14",
        color: "#94a3b8",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #1e293b",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        @keyframes flashIn {
          from { background: #1e3a1e; }
          to { background: transparent; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080d14; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid #1e293b",
          background: "#0a1120",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#4ade80",
            boxShadow: "0 0 6px #4ade80",
            animation: "pulse 2s infinite",
          }}
        />
        <span
          style={{
            color: "#e2e8f0",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Zustand Inspector
        </span>
        <span style={{ marginLeft: "auto", color: "#334155", fontSize: 10 }}>
          {storeNames.length} stores · {actions.length} actions
        </span>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        {["state", "actions"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "7px 0",
              background: "none",
              border: "none",
              borderBottom:
                tab === t ? "2px solid #4ade80" : "2px solid transparent",
              color: tab === t ? "#e2e8f0" : "#475569",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: tab === t ? 700 : 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              transition: "color 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "state" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Store list */}
          <div
            style={{
              width: 120,
              borderRight: "1px solid #1e293b",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            {storeNames.map((name) => {
              const color = getStoreColor(name);
              const active = name === displayStore;
              return (
                <button
                  key={name}
                  onClick={() => setActiveStore(name)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: active ? "#0f1e2e" : "none",
                    border: "none",
                    borderLeft: `2px solid ${active ? color : "transparent"}`,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 10,
                    color: active ? color : "#475569",
                    display: "block",
                    transition: "all 0.1s",
                  }}
                >
                  {name.replace("Store", "")}
                  <div style={{ fontSize: 9, color: "#334155", marginTop: 2 }}>
                    {Object.keys(state[name] ?? {}).length} keys
                  </div>
                </button>
              );
            })}
          </div>

          {/* State tree */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 10,
              lineHeight: 1.7,
              fontSize: 11,
            }}
          >
            {displayStore && state[displayStore] ? (
              <JsonNode value={state[displayStore]} depth={0} defaultExpanded />
            ) : (
              <span style={{ color: "#334155" }}>No state</span>
            )}
          </div>
        </div>
      )}

      {tab === "actions" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* Filter + controls */}
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "6px 10px",
              borderBottom: "1px solid #1e293b",
              flexShrink: 0,
            }}
          >
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter actions…"
              style={{
                flex: 1,
                background: "#0f172a",
                border: "1px solid #1e293b",
                color: "#e2e8f0",
                fontFamily: "inherit",
                fontSize: 11,
                padding: "4px 8px",
                outline: "none",
              }}
            />
            <button
              onClick={() => setActions([])}
              style={{
                background: "none",
                border: "1px solid #1e293b",
                color: "#475569",
                fontFamily: "inherit",
                fontSize: 10,
                padding: "4px 8px",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              CLEAR
            </button>
          </div>

          {/* Action log */}
          <div ref={logRef} style={{ flex: 1, overflowY: "auto" }}>
            {filteredActions.length === 0 ? (
              <div
                style={{ padding: 16, color: "#334155", textAlign: "center" }}
              >
                waiting for actions…
              </div>
            ) : (
              filteredActions.map((a: any, i) => (
                <ActionEntry key={`${a.timestamp}-${i}`} entry={a} index={i} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
