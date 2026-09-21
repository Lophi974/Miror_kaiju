'use client';

const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

export default function Calendrier() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const startingDay = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: startingDay + daysInMonth }, (_, index) =>
    index < startingDay ? null : index - startingDay + 1,
  );

  return (
    <section className="bg-[#11253C] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl rounded-xl border border-[#2a4965] bg-[#061A2C] p-5 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold capitalize">{monthFormatter.format(today)}</h2>
          <span className="rounded-full bg-[#1d4e8b] px-3 py-1 text-sm font-semibold">
            Aujourd'hui
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-white/50">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2">
          {days.map((day, index) => (
            <div
              key={day === null ? `empty-${index}` : day}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm ${
                day === today.getDate()
                  ? 'bg-[#eab308] font-bold text-[#061A2C]'
                  : day === null
                    ? ''
                    : 'bg-white/5 text-white/80'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
