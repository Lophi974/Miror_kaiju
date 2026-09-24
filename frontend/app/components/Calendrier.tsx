export default function OperationalCalendar({
  visible = true,
}: {
  visible?: boolean;
}) {
  const events = [
    { time: "09:00", color: "bg-red-500", title: "Mission de reconnaissance - Est" },
    { time: "11:30", color: "bg-blue-500", title: "Transfert de ressources - Centre" },
    { time: "14:00", color: "bg-yellow-500", title: "Maintenance - Générateurs" },
    { time: "17:00", color: "bg-green-500", title: "Réunion d'équipes - QC" },
  ];

  if (!visible) return null;

return (
  <div className="fixed bottom-1 right-6 z-30 w-90 bg-[#0a1420] border-2 border-[#1b3a55] rounded-xl p-10">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-white text-base font-bold">
        Calendrier opérationnel
      </h2>
      <span className="text-white/40 text-sm">Septembre</span>
    </div>

    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="text-white/50 w-12">{event.time}</span>
          <span className={`w-2.5 h-2.5 rounded-full ${event.color}`} />
          <span className="text-white text-sm">{event.title}</span>
        </div>
      ))}
    </div>
  </div>
);
}