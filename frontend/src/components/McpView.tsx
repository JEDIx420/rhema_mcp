"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clipboard, Plug, RefreshCw, Server, Terminal, WifiOff } from "lucide-react";
import { fetchMcpConfig, fetchMcpStatus, getApiBase, McpStatus, setApiBase } from "@/lib/api";

const isTauriRuntime = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function McpView() {
  const [endpoint, setEndpoint] = useState("http://127.0.0.1:5050");
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [configuration, setConfiguration] = useState("{}");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [desktop, setDesktop] = useState(() => isTauriRuntime());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, configData] = await Promise.all([fetchMcpStatus(), fetchMcpConfig()]);
      setStatus(statusData);
      setConfiguration(JSON.stringify(configData, null, 2));
    } catch (requestError) {
      setStatus(null);
      setError(requestError instanceof Error ? requestError.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialization = window.setTimeout(() => {
      setEndpoint(getApiBase());
      setDesktop(isTauriRuntime());
      void refresh();
    }, 0);
    return () => window.clearTimeout(initialization);
  }, [refresh]);

  const saveAndTest = () => {
    setEndpoint(setApiBase(endpoint));
    void refresh();
  };

  const copyConfiguration = async () => {
    await navigator.clipboard.writeText(configuration);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <Plug size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">MCP Connections</h2>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100" title="Test connection">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-slate-900"><Server size={18} className="text-blue-500" />Rhelo local service</h3>
                <p className="mt-1 text-sm text-slate-500">The web app connects through HTTP; AI clients connect to the same backend through MCP stdio.</p>
              </div>
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${status ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {status ? <Check size={14} /> : <WifiOff size={14} />}
                {loading ? "Testing" : status ? "Connected" : "Disconnected"}
              </div>
            </div>

            {desktop ? (
              <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
                The local study service is managed automatically by Rhelo.
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm outline-none focus:border-blue-500" aria-label="Rhelo API endpoint" />
                <button onClick={saveAndTest} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Save & test</button>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{desktop ? "Rhelo could not start its local study service. Quit and reopen the app." : `${error}. Start the local Rhelo backend, then test again.`}</p>}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-slate-900"><Plug size={18} className="text-indigo-500" />Available tools</h3>
              <div className="mt-4 space-y-2">
                {(status?.tools ?? []).map((tool) => <div key={tool} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{tool}</div>)}
                {!status && <p className="text-sm text-slate-400">Connect to inspect tools.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-slate-900"><Terminal size={18} className="text-violet-500" />Client configuration</h3>
              <p className="mt-1 text-sm text-slate-500">Copy this into an MCP-compatible desktop or editor client.</p>
              <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-200">{configuration}</pre>
              <button onClick={() => void copyConfiguration()} disabled={!status} className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Copied" : "Copy configuration"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-sm text-blue-950">
            <strong>{desktop ? "Desktop mode:" : "Web mode:"}</strong>{" "}
            {desktop ? "Rhelo launches its bundled backend sidecar with the app. Connection settings here control how this interface reaches it." : "A browser cannot launch or stop local processes. This page can configure and test an already-running Rhelo backend."}
          </section>
        </div>
      </div>
    </div>
  );
}
