"use client";

import { Check, Database, Plug, ShieldCheck } from "lucide-react";

export default function McpView() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <header className="flex h-16 shrink-0 items-center border-b border-slate-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Plug size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">MCP Connections</h2>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
        <section className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700">
            <Check size={14} /> Native architecture active
          </div>
          <h3 className="mt-5 text-2xl font-bold text-slate-950">Rhelo no longer opens a local HTTP port.</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Scripture, research, sessions, speech, and PDF export now run through direct Tauri IPC.
            The previous Python MCP bridge has been retired; a future connection here will use a
            native Rust transport rather than a background web service.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <Database size={20} className="text-blue-600" />
              <h4 className="mt-3 font-bold text-slate-900">Private by default</h4>
              <p className="mt-1 text-sm leading-6 text-slate-500">Your study database stays inside the app sandbox and is accessed directly by Rust.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <ShieldCheck size={20} className="text-indigo-600" />
              <h4 className="mt-3 font-bold text-slate-900">No orphan process</h4>
              <p className="mt-1 text-sm leading-6 text-slate-500">There is no sidecar process, localhost dependency, or port 5050 lifecycle to manage.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
