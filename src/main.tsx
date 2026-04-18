if (__CLI_BUILD__) await import("./lib/cli-bridge");
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TanStackDevtools } from "@tanstack/react-devtools";
import "react-complex-tree/lib/style-modern.css";
import "./index.css";
import App from "./App.tsx";
import StoreInspectorPanel from "../devtools/store";
import PubSubDevtoolPanel from "../devtools/pubsub-panel";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />

    {import.meta.env.DEV && (
      <TanStackDevtools
        config={{
          urlFlag: "devtools",
          requireUrlFlag: true,
        }}
        plugins={[
          {
            id: "zustand-inspector",
            name: "Zustand Inspector",
            render: <StoreInspectorPanel />,
          },
          {
            id: "pub-sub",
            name: "PubSub",
            render: <PubSubDevtoolPanel />,
          },
        ]}
      />
    )}
  </StrictMode>,
);
