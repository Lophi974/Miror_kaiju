"use client";

import { useState } from "react";
import ZoneMap from "./test/page";
import Calendrier from "./Calendrier/Calendrier";

export default function Home() {
	const [isPopupOpen, setIsPopupOpen] = useState(false);

	return (
		<>
			<Calendrier visible={!isPopupOpen} />
			<ZoneMap onPopupChange={setIsPopupOpen} />
		</>
	);
}
