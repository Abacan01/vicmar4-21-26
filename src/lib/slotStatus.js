export const SLOT_STATUS_OPTIONS = [
  {
    value: "available",
    label: "Available",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-500",
    color: "#10b981",
  },
  {
    value: "reserved",
    label: "Reserved",
    dotClass: "bg-amber-400",
    textClass: "text-amber-500",
    color: "#f59e0b",
  },
  {
    value: "not_available",
    label: "Sold",
    dotClass: "bg-red-500",
    textClass: "text-red-500",
    color: "#ef4444",
  },
];

const STATUS_ALIASES = {
  available: "available",
  reserve: "reserved",
  reserved: "reserved",
  sold: "not_available",
  vacant: "not_available",
  unavailable: "not_available",
  "not available": "not_available",
  "not_available": "not_available",
};

export function normalizeSlotStatus(rawStatus) {
  const normalized = String(rawStatus ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ");

  return STATUS_ALIASES[normalized] ?? "not_available";
}

export function getSlotStatusMeta(rawStatus) {
  const normalized = normalizeSlotStatus(rawStatus);

  return (
    SLOT_STATUS_OPTIONS.find((status) => status.value === normalized) ??
    SLOT_STATUS_OPTIONS[SLOT_STATUS_OPTIONS.length - 1]
  );
}

export function makeSlotId(propertyId, unitSourceKey) {
  const normalizedUnitKey = String(unitSourceKey ?? "")
    .trim()
    .toLowerCase() || "blank";

  return `${propertyId}__${normalizedUnitKey}`;
}