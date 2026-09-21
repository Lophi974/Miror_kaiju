"use client";

import { useState } from "react";
import Image from "next/image";

type ZoneId = "A" | "E" | "X" | "W" | "Z";

const ZONES: Record<
  ZoneId,
  { name: string; color: string; points: string; resources: string[] }
> = {
  A: {
    name: "Zone A",
    color: "#801c23",
    points:
      "4.2,20.78 3.59,22.63 3.79,25.82 10.04,31.38 11.68,36.01 16.19,36.93 25.92,37.04 30.74,38.99 32.07,38.89 32.17,37.86 29.61,33.95 29.51,31.17 30.53,28.91 37.3,24.07 42.52,22.22 41.6,20.27 36.27,17.39 30.12,15.74 27.25,12.65 26.02,12.24 21.31,12.24 17.21,14.71 11.78,15.02 7.27,17.49",
    resources: ["Bois x120", "Pierre x80", "Or x50"],
  },
  E: {
    name: "Zone E",
    color: "#0f4530",
    points:
      "30.02,10.29 30.43,13.48 38.52,15.23 43.75,18.31 46.11,22.33 59.63,26.95 63.63,30.86 67.42,31.38 73.26,35.08 73.87,37.86 76.74,39.4 76.64,43.0 77.97,43.31 77.97,45.78 75.2,46.5 75.31,48.35 79.41,48.56 79.71,50.31 85.35,52.47 95.08,46.4 95.08,44.65 90.98,43.52 92.11,41.67 95.29,41.67 94.98,35.08 90.16,32.3 86.27,26.65 87.6,22.43 82.99,15.43 83.81,10.49 81.86,8.64 77.77,8.64 73.87,5.76 67.42,5.86 62.7,2.37 56.76,3.81 57.58,10.08 55.84,11.63 47.03,11.63 43.95,9.77",
    resources: ["Fer x200", "Cristal x30", "Or x90"],
  },
  X: {
    name: "Zone X",
    color: "#eab308",
    points:
      "32.07,30.04 31.86,33.13 32.79,34.77 38.32,39.3 38.11,41.36 40.47,43.83 40.16,46.81 41.91,47.22 44.67,50.0 49.59,50.0 52.15,42.8 57.07,41.56 57.89,38.89 59.43,39.3 58.3,42.8 58.81,44.86 55.84,47.22 56.45,48.97 60.14,49.07 62.09,47.84 64.34,47.84 65.47,48.97 71.72,48.87 72.13,43.72 66.8,34.26 62.91,33.13 62.5,35.19 58.91,36.32 58.61,34.47 62.4,32.82 62.4,31.69 59.73,29.22 54.41,27.67 51.43,25.0 48.87,25.0 45.49,23.46 43.85,26.03 41.19,25.41 37.7,26.54 33.5,30.04",
    resources: ["Bois x60", "Cristal x10"],
  },
  W: {
    name: "Zone W",
    color: "#a33909",
    points:
      "9.22,37.35 9.94,50.41 8.09,56.48 9.84,61.01 17.93,63.68 21.21,65.95 24.08,69.44 27.77,69.44 28.69,68.72 28.48,63.58 31.45,62.45 32.79,60.29 35.55,60.8 39.04,59.57 39.04,55.14 37.81,53.5 38.73,52.47 38.73,50.72 40.37,50.62 40.98,48.46 39.14,47.12 35.55,38.89 34.73,38.89 34.43,40.43 29.41,40.02 25.72,37.86",
    resources: ["Pierre x150", "Or x40"],
  },
  Z: {
    name: "Zone Z",
    color: "#1d4e8b",
    points:
      "42.01,49.59 39.04,53.29 40.16,54.84 39.96,59.77 35.25,61.93 32.48,61.73 31.76,63.89 29.1,64.4 29.51,69.34 27.97,70.58 24.8,70.47 24.8,71.4 34.02,81.38 33.71,85.49 34.84,87.55 36.58,86.21 39.75,87.14 42.73,85.49 46.52,84.98 52.46,85.7 56.66,87.45 60.96,86.73 65.06,81.48 58.71,72.02 50.72,71.5 51.64,68.42 53.59,67.9 54.51,63.68 51.43,58.13 50.92,55.25 47.95,55.45 47.44,51.34",
    resources: ["Or x300", "Bois x90", "Fer x70"],
  },
};

export default function ZoneMap() {
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);
  const [hoverZone, setHoverZone] = useState<ZoneId | null>(null);

  return (
    <main className="min-h-screen bg-[#11253C]">
        <h1 className="font-mono text-5xl text-center font-bold">Carte Tokyork</h1>
      <div className="relative w-full max-w-200 aspect-square mx-auto border-3 rounded-lg border-[#113554] bg-[#061A2C]">
        {/* Carte */}
        <Image
          src="/MAP.png"
          alt="Carte des zones"
          fill
          className="object-contain pointer-events-none select-none"
        />

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          {(Object.keys(ZONES) as ZoneId[]).map((id) => {
            const zone = ZONES[id];
            const isHover = hoverZone === id;
            const isActive = activeZone === id;
            return (
              <polygon
                key={id}
                points={zone.points}
                fill={isHover || isActive ? zone.color : "transparent"}
                fillOpacity={isActive ? 0.35 : isHover ? 0.2 : 0}
                stroke={isHover || isActive ? zone.color : "transparent"}
                strokeWidth={0.5}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoverZone(id)}
                onMouseLeave={() => setHoverZone(null)}
                onClick={() => setActiveZone(id)}
              />
            );
          })}
        </svg>

        {/* Popup */}
        <div
          className={`fixed top-0 right-0 h-full w-80 bg-[#0a0f1a] text-white shadow-2xl border-l border-white/10
          transform transition-transform duration-300 ease-out z-50
          ${activeZone ? "translate-x-0" : "translate-x-full"}`}
        >
          {activeZone && (
            <div className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="text-2xl font-bold"
                  style={{ color: ZONES[activeZone].color }}
                >
                  {ZONES[activeZone].name}
                </h2>
                <button
                  onClick={() => setActiveZone(null)}
                  className="text-white/50 hover:text-white text-xl leading-none"
                >
                  ✕
                </button>
              </div>

              <h3 className="text-sm uppercase tracking-wide text-white/40 mb-3">
                Ressources
              </h3>
              <ul className="space-y-2">
                {ZONES[activeZone].resources.map((r) => (
                  <li
                    key={r}
                    className="bg-white/5 rounded-lg px-4 py-2 text-sm border border-white/10"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Overlay pour fermer */}
        {activeZone && (
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setActiveZone(null)}
          />
        )}
      </div>
    </main>
  );
}