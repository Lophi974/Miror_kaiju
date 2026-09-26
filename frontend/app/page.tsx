"use client";

import { useState } from "react";
import ZoneMap from "./components/home";
import Calendrier from "./components/Calendrier";
import DemandeButton from "./components/DemandeButton";
import DemandesPanel from "./components/DemandesPanel";
import ProfileMenu from "./components/ProfileMenu";

export default function Home() {
	const [isPopupOpen, setIsPopupOpen] = useState(false);
	// Niveau de sévérité courant (tenu à jour par la carte via le socket)
	const [activeLevel, setActiveLevel] = useState<number | null>(null);

	return (
		<>
			<ProfileMenu />
			<DemandesPanel level={activeLevel} />
			<Calendrier visible={!isPopupOpen} />
			<ZoneMap onPopupChange={setIsPopupOpen} onLevelChange={setActiveLevel} />
			<DemandeButton level={activeLevel} />
		</>
	);
}
