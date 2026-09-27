"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { fetchActiveLevel } from "../../fetch/severity";
import { fetchRessourcesByQuarter } from "../../fetch/ressources";
import { fetchAllQuarter } from "../../fetch/ressources";
import { changeSeverityLevel } from "../../fetch/severity";
import { fetchMe } from "@/fetch/auth";
import { useAuth } from "../contexte/provider";
import { getSocket } from "../contexte/socket";
import { updateThreshold } from "../../fetch/ressources";

type ZoneId = "A" | "E" | "X" | "W" | "Z";

// Forme réelle renvoyée par /api/ressources/quarter/:quarterId
type ResourceType = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type ResourceItem = {
  id: string;
  currentQuantity: number;
  initialQuantity: number;
  quarterId: string;
  resourceTypeId: string;
  updatedAt: string;
  resourceType: ResourceType;
};

// Forme renvoyée par /api/quarters
type Quarter = {
  code: string;
  id: string;
  name: string;
  hasSeaAccess: boolean;
  treshHoldPercent: number;
  createdAt: string;
};

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

// Calcule le pourcentage restant d'une ressource (currentQuantity / initialQuantity * 100)
function getResourcePercent(resource: ResourceItem) {
  if (!resource.initialQuantity) return 0;
  return (resource.currentQuantity / resource.initialQuantity) * 100;
}

// Vrai si la ressource est à (ou sous) le seuil de rétention -> doit apparaître en rouge
function isResourceCritical(
  resource: ResourceItem,
  retentionLevel: number | null,
) {
  if (retentionLevel === null) return false;
  return getResourcePercent(resource) <= retentionLevel;
}

const ZONES: Record<ZoneId, { name: string; color: string; points: string }> = {
  A: {
    name: "A",
    color: "#22c55e",
    points:
      "1.83,25.2 1.99,27.99 2.39,28.47 2.15,30.46 2.71,31.02 2.79,32.14 3.27,32.93 5.9,34.21 8.13,34.13 9.09,35.49 10.21,36.28 9.49,37.4 9.49,38.28 10.05,39.07 9.81,40.67 10.13,40.91 12.28,40.99 15.15,42.26 18.34,42.66 19.3,42.19 20.81,42.9 21.77,42.9 23.84,42.34 25.2,42.5 25.68,42.19 26.95,43.22 30.3,44.42 31.1,45.14 33.73,45.06 34.37,45.37 35.33,45.22 35.89,41.87 34.85,40.99 34.53,39.95 33.25,39.07 32.85,37.64 32.3,37.16 32.85,36.52 33.09,35.09 33.89,34.45 34.77,34.45 38.44,31.18 40.11,31.18 42.74,29.82 44.34,30.38 44.98,29.11 44.98,28.39 46.25,26.71 46.25,26.0 45.22,25.12 45.22,24.32 44.26,24.16 43.3,22.65 40.03,21.61 38.6,20.65 38.2,19.7 37.16,19.54 35.57,18.18 34.13,17.62 32.46,17.86 30.3,17.07 28.63,15.39 28.63,13.16 28.31,12.84 26.79,12.92 23.13,14.35 22.65,14.04 19.54,14.35 18.26,15.39 18.18,16.91 17.07,17.86 16.35,17.78 15.47,16.35 13.56,16.75 11.16,18.5 8.53,19.14 5.66,21.13 5.02,22.25 3.99,22.81 3.51,23.84",
  },
  E: {
    name: "E",
    color: "#84cc16",
    points:
      "28.79,14.35 28.63,15.87 30.22,17.3 35.09,18.18 37.8,19.78 39.79,21.77 42.98,22.73 43.94,24.24 45.22,24.72 46.17,27.03 48.64,27.35 49.36,28.15 51.12,27.75 54.31,28.95 55.74,30.7 57.66,30.7 59.73,32.14 60.93,32.14 63.32,35.57 64.99,35.96 66.19,37.08 66.91,37.08 67.3,35.96 71.61,39.47 72.89,39.31 73.92,40.75 75.28,40.35 76.0,41.55 74.8,42.26 74.8,42.9 76.16,43.62 77.11,43.22 78.71,44.58 78.79,46.25 77.99,48.25 79.82,48.33 79.74,50.24 77.03,50.48 75.68,51.12 75.44,51.99 77.59,52.55 76.71,52.95 76.95,54.15 80.86,54.39 80.3,55.5 80.7,56.86 82.46,57.1 84.77,54.63 91.87,53.19 98.01,50.08 97.93,49.12 96.17,49.28 95.37,48.64 96.17,47.45 99.04,46.33 98.17,43.3 99.04,40.59 97.77,39.15 97.61,37.32 95.3,36.2 93.3,34.29 92.58,31.34 91.15,29.67 92.11,26.71 90.59,24.32 89.47,23.84 89.31,22.41 88.2,21.53 87.32,19.38 85.65,18.26 85.25,13.72 83.57,11.96 81.5,11.64 79.67,10.21 77.67,10.85 76.56,9.09 76.24,6.94 74.56,6.7 71.69,7.42 66.99,6.94 64.27,3.51 62.68,3.11 61.24,4.47 56.06,5.1 56.46,10.85 55.18,12.76 52.95,13.72 47.61,14.04 45.06,13.16 43.62,11.08 39.39,12.04 37.96,11.24 35.17,11.48 30.54,12.76",
  },
  X: {
    name: "X",
    color: "#eab308",
    points:
      "45.85,26.95 44.9,28.07 44.9,28.79 44.5,29.11 44.5,29.74 43.94,30.3 43.7,29.74 42.11,29.82 41.39,30.46 40.59,30.54 39.47,31.18 38.12,31.1 36.52,32.7 35.89,32.85 34.45,34.37 33.17,34.53 32.78,36.12 32.3,36.68 32.3,37.48 32.85,38.04 33.25,39.55 34.37,40.19 34.85,41.39 38.76,44.5 38.6,46.49 41.31,48.72 41.31,49.36 40.99,49.76 41.15,50.96 42.66,51.59 43.06,51.99 43.38,52.87 44.34,53.67 45.77,55.66 49.04,55.82 49.76,56.22 51.28,56.3 52.47,55.98 53.03,55.34 52.79,54.15 53.75,53.43 53.59,51.28 54.07,50.88 54.23,50.0 55.42,48.8 56.54,48.64 59.33,46.97 59.41,45.93 60.13,45.06 60.13,44.42 59.09,43.46 59.49,43.06 59.49,42.5 60.85,41.15 60.93,40.03 63.0,38.28 63.0,37.64 62.6,37.0 63.32,36.04 63.32,34.69 62.28,33.81 62.04,33.09 61.4,32.54 61.24,32.06 60.05,32.06 59.09,31.18 57.97,30.62 56.06,30.62 55.02,29.67 54.94,29.03 54.55,28.79 52.79,28.55 51.83,27.75 50.64,27.75 49.68,28.07 48.96,27.27",
  },
  W: {
    name: "W",
    color: "#f97316",
    points:
      "9.49,40.75 9.49,41.87 8.93,42.26 8.61,44.1 9.25,44.66 9.09,47.29 9.33,48.25 10.37,49.84 10.05,51.59 10.29,54.23 9.33,55.66 9.33,56.54 7.89,57.66 7.58,60.93 7.89,61.4 9.17,61.96 9.25,63.16 10.05,63.96 9.49,64.99 9.57,66.67 12.6,67.46 13.48,68.1 14.83,67.78 16.03,68.98 17.38,69.3 19.3,71.05 20.57,71.69 22.01,73.37 23.44,74.4 24.64,75.76 25.2,77.11 27.91,76.48 30.46,77.27 31.9,76.32 31.74,73.92 32.46,72.97 32.46,71.93 31.5,70.89 31.66,69.46 33.89,68.26 35.65,66.43 36.52,67.15 37.64,67.15 39.39,65.71 41.23,65.55 41.63,65.23 41.79,63.08 41.31,62.76 41.23,61.56 42.03,60.85 42.03,59.97 40.75,59.09 40.43,58.37 42.03,56.62 41.95,55.82 43.22,54.47 43.54,52.55 42.98,51.52 41.23,50.64 40.99,50.16 41.39,48.48 38.68,46.17 38.84,44.18 36.52,42.42 35.81,42.42 35.33,43.38 35.33,44.74 34.77,45.3 34.13,44.98 31.5,45.06 30.62,44.34 27.11,42.98 26.08,42.11 24.8,42.42 23.44,42.26 21.45,42.82 19.86,42.19 18.66,42.19 17.7,42.58 15.47,42.19 12.84,40.99",
  },
  Z: {
    name: "Z",
    color: "#dc2626",
    points:
      "43.38,52.95 43.14,54.15 41.87,55.5 41.95,56.3 40.35,58.37 40.43,59.17 42.03,60.37 41.15,61.16 41.23,63.08 41.71,63.4 41.55,64.83 40.83,65.47 38.76,65.71 37.16,67.07 36.04,66.35 35.25,66.35 33.41,68.26 31.58,69.06 31.42,71.21 32.38,72.65 31.66,73.52 31.9,75.84 30.14,77.19 28.23,76.4 26.63,76.79 25.44,76.56 25.12,77.51 25.84,78.15 26.08,79.43 27.19,81.02 30.78,84.77 30.86,85.89 34.21,89.0 34.53,90.03 33.97,91.31 34.13,93.7 35.09,95.14 37.0,96.73 38.12,96.57 37.8,94.82 38.12,94.58 39.07,96.17 41.15,96.65 44.58,95.06 52.15,93.94 53.43,93.3 54.78,93.7 56.54,93.3 58.37,93.94 61.48,95.93 62.84,95.93 67.15,90.67 67.38,89.15 69.38,86.52 70.02,83.57 69.14,82.85 68.9,81.66 67.7,80.94 67.3,79.35 66.43,79.03 64.75,77.19 63.96,77.19 62.84,76.24 61.16,76.16 60.69,75.68 58.13,75.84 56.94,76.4 56.46,75.76 55.1,75.36 55.74,74.4 56.46,74.32 57.18,73.29 59.25,71.85 59.33,71.05 57.89,70.73 56.78,71.45 56.46,71.13 56.78,70.1 57.58,69.54 57.58,68.42 56.94,67.22 55.42,65.95 55.1,64.19 53.43,62.04 53.67,60.53 53.35,59.57 52.79,59.25 50.08,59.49 49.84,58.69 50.72,57.97 50.72,57.1 50.08,56.06 46.49,55.74 44.02,52.95",
  },
};

// Calcule le centre d'une zone (moyenne des points du polygone)
function getZoneCenter(id: ZoneId): [number, number] {
  const pts = ZONES[id].points.split(" ").map((p) => p.split(",").map(Number));
  const x = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const y = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  return [x, y];
}

export default function ZoneMap({
  onPopupChange,
  onLevelChange,
}: {
  onPopupChange: (isOpen: boolean) => void;
  onLevelChange?: (level: number | null) => void;
}) {
  const { user, loading, isAuthenticated, logout } = useAuth();

  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  // Seuil de rétention, identique pour tous les quartiers
  const [retentionLevel, setRetentionLevel] = useState<number | null>(null);
  // id backend -> code de zone, pour router les événements socket
  const zoneByQuarterId = useRef<Record<string, ZoneId>>({});

  // Réglage du seuil par le CD (niveau 5)
  const [thresholdInput, setThresholdInput] = useState(30);
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  // Ligne entre la zone cliquée et la popup
  const mapRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Toast affiché en haut à droite quand le niveau change
  const [toast, setToast] = useState<{ level: number; show: boolean } | null>(
    null,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(level: number) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ level, show: true });
    toastTimer.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, show: false } : t));
    }, 3000); // durée d'affichage en ms
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Ressources fetchées, indexées par zone
  const [resourcesByZone, setResourcesByZone] = useState<
    Partial<Record<ZoneId, ResourceItem[]>>
  >({});
  const [loadingZones, setLoadingZones] = useState<Set<ZoneId>>(new Set());

  const fetchAllZonesResources = useCallback(async () => {
    setLoadingZones(new Set(Object.keys(ZONES) as ZoneId[]));

    // 1. On récupère la liste des quartiers pour avoir le vrai id backend
    //    associé à chaque code de zone (A, E, X, W, Z)
    const quartersRes = await fetchAllQuarter();

    const quarters: Quarter[] = quartersRes?.data ?? [];

    setRetentionLevel(quarters[0]?.treshHoldPercent ?? null);

    zoneByQuarterId.current = quarters.reduce<Record<string, ZoneId>>(
      (acc, q) => {
        acc[q.id] = q.code as ZoneId;
        return acc;
      },
      {},
    );

    // code -> id, ex: { A: "01a0c7b1-...", E: "01a0c7b1-..." }
    const quarterIdByCode = quarters.reduce<Partial<Record<ZoneId, string>>>(
      (acc, q) => {
        acc[q.code as ZoneId] = q.id;
        return acc;
      },
      {},
    );

    // 2. Pour chaque zone connue côté front, on fetch ses ressources
    //    via le vrai id récupéré (si trouvé)
    const zoneIds = Object.keys(ZONES) as ZoneId[];
    const results = await Promise.all(
      zoneIds.map(async (id) => {
        const quarterId = quarterIdByCode[id];

        if (!quarterId) {
          console.warn(`Aucun id backend trouvé pour le code "${id}"`);
          return { id, data: [] as ResourceItem[] };
        }

        const res = await fetchRessourcesByQuarter(quarterId);
        return { id, data: res?.data ?? [] };
      }),
    );

    const grouped: Partial<Record<ZoneId, ResourceItem[]>> = {};
    results.forEach(({ id, data }) => {
      grouped[id] = data;
    });

    setResourcesByZone(grouped);
    setLoadingZones(new Set());
  }, []);

  useEffect(() => {
    const loadActiveLevel = async () => {
      const level = await fetchActiveLevel();
      if (level) {
        setActiveLevel(level.data?.level);
      }
    };
    loadActiveLevel();
    fetchAllZonesResources();
  }, [fetchAllZonesResources]);

  // Connexion Socket.IO : le backend diffuse les changements de niveau, de
  // stock et de seuil, on met à jour l'affichage sans recharger.
  useEffect(() => {
    const socket = getSocket();

    const handleAlertLevelChange = (payload: { level: number }) => {
      setActiveLevel(payload.level);
    };

    const handleResourceChange = (payload: {
        quarterId: string;
        resourceTypeId: string;
        currentQuantity: number;
      }) => {
        const zone = zoneByQuarterId.current[payload.quarterId];
        if (!zone) return;

        setResourcesByZone((current) => ({
          ...current,
          [zone]: (current[zone] ?? []).map((r) =>
            r.resourceTypeId === payload.resourceTypeId
              ? { ...r, currentQuantity: payload.currentQuantity }
              : r,
          ),
        }));
      };

    const handleThresholdChange = (payload: { treshHoldPercent: number }) => {
      setRetentionLevel(payload.treshHoldPercent);
    };

    socket.on("alertLevelChange", handleAlertLevelChange);
    socket.on("resourceChange", handleResourceChange);
    socket.on("thresholdChange", handleThresholdChange);

    return () => {
      socket.off("alertLevelChange", handleAlertLevelChange);
      socket.off("resourceChange", handleResourceChange);
      socket.off("thresholdChange", handleThresholdChange);
    };
  }, []);

  // Le niveau est partagé avec la page (bouton de demande, panneau QC)
  useEffect(() => {
    onLevelChange?.(activeLevel);
  }, [activeLevel, onLevelChange]);

  async function handleChangeThreshold() {
    setThresholdError(null);
    const response = await updateThreshold(thresholdInput);

    // En cas de succès, l'affichage est mis à jour par le socket thresholdChange
    if (!response?.success) {
      setThresholdError(response?.message || "Erreur lors du changement de seuil");
    }
  }

  // Recalcule la position de la ligne quand on change de zone / qu'on resize / qu'on scroll
  useEffect(() => {
    if (!activeZone) {
      setLine(null);
      return;
    }

    const update = () => {
      const rect = mapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const [cx, cy] = getZoneCenter(activeZone);
      setLine({
        x1: rect.left + (cx / 100) * rect.width,
        y1: rect.top + (cy / 100) * rect.height,
        x2: window.innerWidth / 2 + 358, // bord gauche de la popup
        y2: 81 + 40, // un peu sous le haut de la popup
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [activeZone]);

  async function handleChangeLevel(level: number) {
    // On utilise directement "level" (le paramètre reçu au clic), jamais
    // "activeLevel" ici : setActiveLevel est asynchrone, donc juste après
    // l'avoir appelé, "activeLevel" contiendrait encore l'ANCIENNE valeur
    // (celle du rendu précédent), pas celle qu'on vient de sélectionner.
    // C'est ce qui causait l'incrément "d'un cran de retard".
    if (level < 1 || level > 5) {
      return;
    }

    setActiveLevel(level);

    try {
      await changeSeverityLevel(level);
      showToast(level);
    } catch (error) {
      console.error("Error changing severity level:", error);
    }
  }

  return (
    <main className="min-h-screen bg-[#11253C] pt-8">
      {/* Toast niveau de sévérité */}
      <div
        role="status"
        style={toast ? { backgroundColor: LEVEL_COLORS[toast.level] } : undefined}
        className={`fixed top-6 right-6 z-[60] rounded-xl px-5 py-3 font-semibold shadow-2xl transition-all duration-300 ease-out ${toast && (toast.level === 2 || toast.level === 3)
            ? "text-black"
            : "text-white"
          } ${toast?.show
            ? "translate-x-0 opacity-100"
            : "translate-x-[120%] opacity-0 pointer-events-none"
          }`}
      >
        {toast && `Niveau de sévérité changé : niveau ${toast.level}`}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div
        ref={mapRef}
        className="relative right-[31px] w-full max-w-[730px] aspect-square mx-auto border-3 rounded-lg border-[#113554] bg-[#061A2C] "
      >
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
            const baseColor = activeLevel
              ? LEVEL_COLORS[activeLevel]
              : zone.color;
            return (
              <polygon
                key={id}
                points={zone.points}
                style={
                  isActive
                    ? {
                      fill: darken(baseColor),
                      stroke: darken(baseColor),
                    }
                    : undefined
                }
                fillOpacity={isActive ? 0.55 : 1}
                strokeWidth={0.5}
                strokeLinejoin="round"
                className="cursor-pointer fill-transparent stroke-transparent transition-all duration-300 hover:fill-white/10"
                onClick={() => {
                  setActiveZone(id);
                }}
              />
            );
          })}
        </svg>

        {/* Ligne entre la zone et la popup */}
        {line && activeZone && (
          <svg className="fixed inset-0 w-full h-full pointer-events-none z-[45]">
            <line
              key={activeZone}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#60a5fa"
              strokeWidth={2}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
              style={{ animation: "drawLine 0.5s ease-out 0.15s forwards" }}
            />
            <circle
              cx={line.x1}
              cy={line.y1}
              r={5}
              fill="#60a5fa"
              className="animate-pulse"
            />
          </svg>
        )}

        {/* Popup */}
        <div
          className={`fixed top-[15px] left-[calc(50%+358px)] w-80 max-h-[calc(100vh-8rem)] overflow-y-auto
          rounded-[2rem] bg-[#11253C] text-white shadow-2xl border border-white/20
          transform transition-all duration-300 ease-out z-50
          ${activeZone
              ? "translate-x-0 scale-100 opacity-100"
              : "translate-x-[120%] scale-95 opacity-0 pointer-events-none"
            }`}
        >
          {activeZone && (
            <div className="p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-2xl font-bold"
                  style={{ color: ZONES[activeZone].color }}
                >
                  {ZONES[activeZone].name}
                </h2>
                <button
                  onClick={() => {
                    setActiveZone(null);
                  }}
                  className="text-white/50 hover:text-white hover:rotate-90 transition-all duration-200 text-xl leading-none"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-white/50 mb-4">
                Seuil de rétention : {retentionLevel ?? "?"} %
              </p>

              <h3 className="text-sm uppercase tracking-wide text-white/50 mb-3">
                Ressources
              </h3>

              {loadingZones.has(activeZone) ? (
                <p className="text-white/50 text-sm animate-pulse">
                  Chargement...
                </p>
              ) : (
                <ul className="space-y-2">
                  {(resourcesByZone[activeZone] ?? []).length === 0 ? (
                    <li className="text-white/50 text-sm">
                      Aucune ressource trouvée
                    </li>
                  ) : (
                    resourcesByZone[activeZone]!.map((r, i) => {
                      const critical = isResourceCritical(r, retentionLevel);
                      return (
                        <li
                          key={r.id}
                          style={{
                            animation: "fadeUp 0.4s ease-out both",
                            animationDelay: `${i * 80}ms`,
                          }}
                          className={`rounded-xl px-4 py-2 text-sm border flex items-center justify-between gap-2 transition-transform duration-200 hover:scale-[1.03] ${critical
                              ? "bg-red-500/10 border-red-500/50 text-red-400"
                              : "bg-white/5 border-white/10"
                            }`}
                        >
                          <span className="font-medium">
                            {r.resourceType.name}
                          </span>
                          <span
                            className={`whitespace-nowrap ${critical ? "text-red-400" : "text-white/70"
                              }`}
                          >
                            {r.currentQuantity}/{r.initialQuantity}{" "}
                            {r.resourceType.unit}
                          </span>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Overlay pour fermer */}
        {activeZone && (
          <div
            className="fixed inset-0 bg-black/0 z-40"
            onClick={() => {
              setActiveZone(null);
            }}
          />
        )}
      </div>

      {user != null && user.role == "CD" && (
        <div className="relative right-[31px] z-45 flex flex-wrap justify-center gap-3 pt-6">
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
              onClick={() => {
                handleChangeLevel(level);
              }}
              className={`rounded-lg px-5 py-2 font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 active:scale-95 ${color} ${activeLevel === level ? "ring-4 ring-white/50" : ""
                }`}
            >
              Niveau {level}
            </button>
          ))}
        </div>
      )}

      {user != null && user.role == "CD" && activeLevel === 5 && (
        <div className="relative right-[31px] z-45 mx-auto mt-4 w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-3 text-white">
          <label className="mb-2 block text-xs uppercase tracking-wide text-white/50">
            Seuil de rétention de tous les quartiers (15 à 30 %) — actuel :{" "}
            {retentionLevel ?? "?"} %
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={15}
              max={30}
              value={thresholdInput}
              onChange={(event) => setThresholdInput(Number(event.target.value))}
              className="w-20 rounded-lg border border-white/20 bg-[#0a1420] px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={handleChangeThreshold}
              className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Appliquer à toute la ville
            </button>
          </div>
          {thresholdError && (
            <p className="mt-2 text-xs text-red-400">{thresholdError}</p>
          )}
        </div>
      )}
    </main>
  );
}