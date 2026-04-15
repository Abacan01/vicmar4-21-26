export const PROPERTY_TYPE_OPTIONS = [
	{ value: "duplex", label: "Duplex" },
	{ value: "triplex", label: "Triplex" },
	{ value: "rowhouse", label: "Rowhouse" },
];

export const SLOT_PROPERTY_TYPE_OPTIONS = [
	{ value: "Duplex Units", label: "Duplex Units" },
	{ value: "Triplex Units", label: "Triplex Units" },
	{ value: "Rowhouse Units", label: "Rowhouse Units" },
	{ value: "Rowhouse (Compound Unit)", label: "Rowhouse (Compound Unit)" },
	{ value: "Rowhouse (Economic Unit)", label: "Rowhouse (Economic Unit)" },
	{ value: "Rowhouse (Socialized Unit)", label: "Rowhouse (Socialized Unit)" },
	{ value: "Single Attached Duplex (Deluxe)", label: "Single Attached Duplex (Deluxe)" },
	{ value: "Single Attached Duplex (Premiere)", label: "Single Attached Duplex (Premiere)" },
	{ value: "Triplex (Center Unit)", label: "Triplex (Center Unit)" },
	{ value: "Triplex (End Unit A)", label: "Triplex (End Unit A)" },
	{ value: "Triplex (End Unit B)", label: "Triplex (End Unit B)" },
	{ value: "Corner Unit", label: "Corner Unit" },
];

export const PROPERTY_TYPE_LABELS = Object.freeze(
	PROPERTY_TYPE_OPTIONS.reduce((accumulator, option) => {
		accumulator[option.value] = option.label;
		return accumulator;
	}, {}),
);

export function normalizePropertyType(rawType) {
	const normalized = String(rawType ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

	if (!normalized) {
		return "";
	}

	if (normalized.includes("duplex")) {
		return "duplex";
	}

	if (normalized.includes("triplex")) {
		return "triplex";
	}

	if (normalized.includes("rowhouse") || normalized.includes("row house")) {
		return "rowhouse";
	}

	return "";
}
