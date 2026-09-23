"use client";

import { useState } from "react";
import ZoneMap from "./home/page";
import Calendrier from "./Calendrier/Calendrier";
import DemandeButton from "./components/DemandeButton";
import ProfileMenu from "./components/ProfileMenu";

export default function Home() {
	const [isPopupOpen, setIsPopupOpen] = useState(false);

	return (
		<>
			<ProfileMenu />
			<Calendrier visible={!isPopupOpen} />
			<ZoneMap onPopupChange={setIsPopupOpen} />
			<DemandeButton />
		</>
	);
}
