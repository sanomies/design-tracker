import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import App from "@/App";
import { queryClient } from "@/lib/queryClient";
import "@/index.css";
import "@/components/rich-text/rich-text.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found in index.html");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Opt into the v7 transition behaviors now so we (a) don't get the
          dev-only "Future Flag" console warnings and (b) move when v7
          lands without a behavior shift. `v7_startTransition` wraps
          internal route state updates in React's `startTransition`; the
          relativeSplatPath flag fixes how relative paths resolve inside
          splat (`*`) routes. */}
      <BrowserRouter
        basename={import.meta.env.BASE_URL}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
