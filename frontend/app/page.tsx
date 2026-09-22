"use client";

import { useState } from "react";
import ZoneMap from "./test/page";
import Calendrier from "./Calendrier/Calendrier";
import DemandeButton from "./components/DemandeButton";

export default function Home() {
	const [isPopupOpen, setIsPopupOpen] = useState(false);

	return (
		<>
			<Calendrier visible={!isPopupOpen} />
			<ZoneMap onPopupChange={setIsPopupOpen} />
			<DemandeButton />
		</>
	);
}
