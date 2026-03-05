import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TanStackDevtools } from "@tanstack/react-devtools";
import "react-complex-tree/lib/style-modern.css";
import "./index.css";
import App from "./App.tsx";
import StoreInspectorPanel from "../devtools/store.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />

    <TanStackDevtools
      plugins={[
        {
          id: "react-devtools",

          name: "Zustand Inspector",
          render: <StoreInspectorPanel />,
        },
      ]}
    />
  </StrictMode>,
);
