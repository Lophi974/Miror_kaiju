"use client";

import { useState } from "react";
import Image from "next/image";

type ZoneId = "A" | "E" | "X" | "W" | "Z";

const LEVEL_COLORS: Record<number, string> = {
  1: "#22c55e",
  2: "#84cc16",
  3: "#eab308",
  4: "#f97316",
  5: "#dc2626",
};

function darken(hex: string, amount = 0.35) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) * (1 - amount);
  const g = ((num >> 8) & 0x00ff) * (1 - amount);
  const b = (num & 0x0000ff) * (1 - amount);
  return `#${(
    (1 << 24) +
    (Math.round(r) << 16) +
    (Math.round(g) << 8) +
    Math.round(b)
  )
    .toString(16)
    .slice(1)}`;
}

const ZONES: Record<
  ZoneId,
  { name: string; color: string; points: string; resources: string[] }
> = {
  A: {
    name: "Zone A",
    color: "#22c55e",
    points:
      "20.08,10.6 16.6,13.07 10.86,13.37 5.23,16.67 1.95,20.88 1.95,26.85 7.48,31.38 9.43,34.36 9.63,36.73 8.3,36.93 8.81,44.75 8.5,51.65 6.66,54.73 6.66,57.0 8.4,60.49 8.5,62.14 14.75,63.68 20.08,66.87 23.05,70.06 24.9,70.06 24.9,68.21 24.08,66.26 21.52,63.68 15.98,60.7 11.27,59.67 10.45,58.44 9.84,55.97 11.58,52.06 11.37,41.67 10.25,37.14 17.01,37.86 17.11,38.48 22.54,37.65 22.85,38.48 25.92,38.48 26.02,39.3 28.18,40.02 34.22,40.23 34.84,39.81 35.55,43.11 37.5,47.63 40.27,49.49 42.11,49.49 42.11,47.53 40.06,46.6 39.75,44.34 37.09,38.68 36.27,37.86 34.32,37.76 31.86,34.47 31.15,31.79 32.48,29.53 36.37,26.75 39.86,24.9 43.95,23.87 44.47,23.15 44.47,20.47 43.03,18.72 38.52,16.26 30.23,13.58 29.0,11.32 27.97,10.7",
    resources: ["Bois x120", "Pierre x80", "Or x50"],
  },
  E: {
    name: "Zone E",
    color: "#84cc16",
    points:
      "29.1,10.29 29.1,13.07 29.71,14.2 31.97,14.92 35.45,15.02 37.81,15.95 39.65,17.8 43.03,19.03 44.26,20.27 45.29,22.94 46.93,23.15 48.05,23.97 50.51,23.87 52.15,25.1 53.79,25.31 55.23,27.26 58.81,27.57 59.84,28.7 61.48,28.91 62.5,31.07 64.96,32.72 66.8,32.72 66.91,32.3 70.29,35.29 70.29,36.83 71.21,36.93 71.11,39.92 73.26,44.34 77.25,44.14 77.05,45.27 73.87,45.99 73.87,47.84 74.69,48.05 74.8,49.07 78.69,49.28 79.0,51.03 80.12,51.13 83.81,53.29 85.86,53.29 90.06,50.82 93.14,49.79 93.44,48.66 95.9,47.02 95.8,43.93 93.55,43.93 92.21,43.0 92.83,42.39 96.11,42.39 95.7,34.47 90.88,31.38 90.06,30.35 89.65,27.98 87.19,25.93 88.42,23.97 88.42,21.81 87.19,20.47 86.37,20.37 86.27,19.24 83.91,14.71 84.12,9.26 81.66,7.82 77.25,7.51 74.49,4.84 68.03,4.94 64.55,1.54 61.99,1.44 55.94,2.98 55.94,4.84 56.86,6.58 56.86,9.36 55.23,10.7 47.54,10.7 47.23,10.08 46.21,10.08 44.57,8.85",
    resources: ["Fer x200", "Cristal x30", "Or x90"],
  },
  X: {
    name: "Zone X",
    color: "#eab308",
    points:
      "31.56,29.32 31.15,33.64 32.38,35.6 33.71,36.42 34.02,37.55 37.6,39.81 37.4,41.87 39.75,44.34 39.55,47.43 42.32,48.46 42.42,49.18 44.36,50.72 49.59,51.13 50.61,50.51 50.61,48.05 51.43,47.74 51.43,46.19 52.87,44.24 52.87,43.52 55.12,43.31 56.35,42.28 57.58,42.39 57.58,44.14 57.89,44.44 55.02,46.5 55.02,48.77 55.74,49.69 58.2,50.1 58.3,51.34 59.12,51.95 59.43,52.98 61.27,52.98 61.27,51.95 62.5,51.34 62.5,49.28 61.89,48.97 62.81,48.46 63.73,48.56 63.93,49.49 72.23,49.59 72.44,49.28 72.85,42.9 69.36,35.49 68.14,34.57 67.32,33.23 65.68,33.02 63.93,31.58 63.22,31.58 63.11,30.76 60.66,28.5 55.33,26.95 52.36,24.18 49.39,24.07 46.93,22.53 45.08,22.53 43.95,23.87 43.44,25.21 43.14,24.79 40.78,24.79 38.52,25.72 37.09,25.93 35.86,27.47 34.53,27.78 33.09,29.22",
    resources: ["Bois x60", "Cristal x10"],
  },
  W: {
    name: "Zone W",
    color: "#f97316",
    points:
      "8.5,36.63 8.3,41.87 8.81,44.75 8.5,51.65 6.86,54.32 6.76,57.0 7.58,59.26 8.4,60.49 8.4,61.93 8.91,62.45 13.22,63.17 17.21,64.92 20.08,66.87 23.26,70.27 28.38,70.27 29.41,69.34 29.61,65.64 29.0,65.12 29.2,64.3 32.17,63.17 32.99,61.32 33.4,61.21 33.91,61.63 35.96,61.63 37.4,60.7 38.83,60.7 39.75,60.29 39.96,58.02 39.55,57.61 39.55,56.79 39.96,56.48 39.96,54.63 38.83,53.81 39.55,53.09 39.55,51.44 41.09,51.34 42.11,49.49 42.11,47.63 41.29,47.02 41.29,46.6 39.96,46.4 39.96,45.16 36.48,37.96 34.43,37.86 33.81,38.37 33.71,39.51 30.23,39.3 29.82,38.58 27.56,37.96 26.33,37.04 19.98,37.04 19.36,36.73 17.42,36.73 17.01,37.14 13.83,36.93 13.01,36.42",
    resources: ["Pierre x150", "Or x40"],
  },
  Z: {
    name: "Zone Z",
    color: "#dc2626",
    points:
      "41.5,48.77 40.16,50.62 39.14,50.72 39.04,51.75 37.91,52.88 37.91,54.73 39.14,55.45 38.93,58.74 39.24,59.05 37.6,60.08 36.27,60.08 34.84,61.01 34.43,60.7 32.48,60.7 31.66,61.11 31.35,62.76 30.94,63.17 28.48,63.48 28.18,66.15 28.79,66.56 28.79,68.52 27.36,69.65 24.59,69.65 24.18,69.96 24.18,72.02 27.05,74.59 31.15,80.14 33.3,82.0 33.4,86.42 33.91,87.65 36.07,87.65 36.89,87.14 36.99,87.86 39.86,87.86 43.03,86.42 46.31,85.91 49.18,85.91 49.69,86.42 51.84,86.42 54.61,87.45 56.66,87.45 58.61,85.49 59.84,85.08 60.96,83.33 62.5,81.89 63.32,80.14 63.83,79.94 63.83,77.98 59.53,71.3 56.76,71.19 56.66,70.78 54.1,70.88 54.0,70.37 52.05,70.16 52.56,69.03 55.84,68.62 56.05,67.8 57.38,67.8 57.38,65.74 55.33,65.64 55.64,65.33 55.64,63.27 55.23,63.07 52.36,57.72 51.64,54.53 50.2,54.42 50.51,54.12 50.31,51.75 48.26,51.85 48.16,50.62 45.9,50.51 44.88,50.21 43.34,48.77",
    resources: ["Or x300", "Bois x90", "Fer x70"],
  },
};

export default function ZoneMap({
  onPopupChange,
}: {
  onPopupChange: (isOpen: boolean) => void;
}) {
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-[#11253C] pt-20">
      <div className="relative w-full max-w-200 aspect-square mx-auto border-3 rounded-lg border-[#113554] bg-[#061A2C] ">
        {/* Carte + teinte, isolées du fond */}
        <div className="absolute inset-0 isolate">
          <Image
            src="/MAP.png"
            alt="Carte des zones"
            fill
            className="object-contain pointer-events-none select-none"
          />

          {activeLevel && (
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              {(Object.keys(ZONES) as ZoneId[]).map((id) => (
                <polygon
                  key={id}
                  points={ZONES[id].points}
                  fill={LEVEL_COLORS[activeLevel]}
                  fillOpacity={0.55}
                  stroke={LEVEL_COLORS[activeLevel]}
                  strokeWidth={1.2}
                  strokeOpacity={0.55}
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          )}
        </div>

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          {(Object.keys(ZONES) as ZoneId[]).map((id) => {
            const zone = ZONES[id];
            const isActive = activeZone === id;
            const baseColor = activeLevel ? LEVEL_COLORS[activeLevel] : zone.color;
            return (
              <polygon
                key={id}
                points={zone.points}
                fill={isActive ? darken(baseColor) : "transparent"}
                fillOpacity={isActive ? 0.55 : 0}
                stroke={isActive ? darken(baseColor) : "transparent"}
                strokeWidth={0.5}
                strokeLinejoin="round"
                className="cursor-pointer"
                onClick={() => {
                  setActiveZone(id);
                  onPopupChange(true);
                }}
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
                  onClick={() => {
                    setActiveZone(null);
                    onPopupChange(false);
                  }}
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
            className="fixed inset-0 bg-black/0 z-40"
            onClick={() => {
              setActiveZone(null);
              onPopupChange(false);
            }}
          />
        )}
      </div>

      <div className="relative z-45 flex flex-wrap justify-center gap-3 pt-6">
        {[
          { level: 1, color: "bg-green-500 hover:bg-green-400" },
          { level: 2, color: "bg-lime-500 hover:bg-lime-400" },
          { level: 3, color: "bg-yellow-500 hover:bg-yellow-400" },
          { level: 4, color: "bg-orange-500 hover:bg-orange-400" },
          { level: 5, color: "bg-red-600 hover:bg-red-500" },
        ].map(({ level, color }) => (
          <button
            key={level}
            type="button"
            onClick={() => setActiveLevel(activeLevel === level ? null : level)}
            className={`rounded-lg px-5 py-2 font-semibold text-white shadow-md transition-colors ${color} ${
              activeLevel === level ? "ring-4 ring-white/50" : ""
            }`}
          >
            Niveau {level}
          </button>
        ))}
      </div>
    </main>
  );
}