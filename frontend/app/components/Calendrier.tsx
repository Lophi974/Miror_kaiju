"use client";

import { useEffect, useState } from "react";
import {
  DEMANDE_LOG_EVENT,
  DemandeLog,
  readDemandeLogs,
} from "./demandeLog";

export default function OperationalCalendar({
  visible = true,
}: {
  visible?: boolean;
}) {
  const [logs, setLogs] = useState<DemandeLog[]>(readDemandeLogs);

  useEffect(() => {
    const handleNewLog = (event: Event) => {
      const log = (event as CustomEvent<DemandeLog>).detail;
      if (log) setLogs((currentLogs) => [log, ...currentLogs].slice(0, 20));
    };

    window.addEventListener(DEMANDE_LOG_EVENT, handleNewLog);
    return () => window.removeEventListener(DEMANDE_LOG_EVENT, handleNewLog);
  }, []);

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));

  if (!visible) return null;

return (
  <div className="fixed bottom-1 right-6 z-30 w-90 max-w-[calc(100vw-3rem)] bg-[#0a1420] border-2 border-[#1b3a55] rounded-xl p-5">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-white text-base font-bold">
        Calendrier opérationnel
      </h2>
      <span className="text-white/40 text-sm">Activité</span>
    </div>

    <div className="max-h-64 space-y-3 overflow-y-auto">
      {logs.length === 0 && (
        <p className="text-sm text-white/50">Aucune demande récente.</p>
      )}
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400" />
          <p className="text-sm leading-5 text-white">
            La zone <strong>{log.fromZone}</strong> a fait une demande à la zone{" "}
            <strong>{log.toZone}</strong>
            <span className="block text-xs text-white/50">
              {log.resource} à {log.horaire} · {formatDate(log.createdAt)}
            </span>
          </p>
        </div>
      ))}
    </div>
  </div>
);
}