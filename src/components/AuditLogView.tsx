import React, { useState } from "react";
import { AuditLog } from "../types";
import { Shield, Search, Trash2, HelpCircle, Activity } from "lucide-react";

interface AuditLogViewProps {
  logs: AuditLog[];
}

export default function AuditLogView({ logs }: AuditLogViewProps) {
  const [search, setSearch] = useState("");

  const filteredLogs = logs.filter((log) => {
    return (
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.entityType.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Sort chronological descending
  filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div id="audit-log-module" className="space-y-6 font-sans">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">System Audit logs</h2>
          <p className="text-xs text-slate-400">Chronological trail of every transaction, blueprint update, and user profile edit performed on the MIS ledger</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4.5 h-4.5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-slate-950 border border-slate-750 rounded-lg py-1.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div id="audit-table-wrapper" className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Timestamp</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">User Account</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Trigger Action</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Audit Trail Details</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider">Entity Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-750/30 transition text-slate-300">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400" title={log.timestamp}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                    {log.userEmail}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                      log.action.includes("CREATE") 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : log.action.includes("EDIT") || log.action.includes("UPDATE")
                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        : log.action.includes("DELETE")
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-white max-w-sm truncate" title={log.details}>
                    {log.details}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 capitalize font-mono text-[11px]">
                    {log.entityType || "—"}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <Activity className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <h5 className="font-semibold text-slate-300">No audit logs matched search criteria</h5>
                    <p className="text-xs text-slate-500 mt-0.5">Logs generate automatically as system updates occur.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
