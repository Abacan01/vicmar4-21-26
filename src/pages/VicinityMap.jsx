import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import baseMapImg from "@/images/properties_map/vicinity-updated.png";
import { MapPin, ZoomIn, ZoomOut, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { subscribeToSlotStatuses } from "@/lib/slotStatusService";
import { SLOT_STATUS_OPTIONS, getSlotStatusMeta, makeSlotId, normalizeSlotStatus } from "@/lib/slotStatus";
import { getAllVicinityProperties, getPropertyUnitEntries } from "@/lib/vicinitySlots";
import propertiesCatalog from "../../data/properties.json";

const MAP_NATURAL_WIDTH = 1404;
const MAP_NATURAL_HEIGHT = 908;

// Color mapping for property types
const typeColors = {
  "Duplex Premiere": { fill: "rgba(22, 163, 74, 0.35)", stroke: "#16a34a", hover: "rgba(22, 163, 74, 0.55)" },
  "Duplex Premier": { fill: "rgba(22, 163, 74, 0.35)", stroke: "#16a34a", hover: "rgba(22, 163, 74, 0.55)" },
  "Duplex Deluxe": { fill: "rgba(37, 99, 235, 0.35)", stroke: "#2563eb", hover: "rgba(37, 99, 235, 0.55)" },
  "Duplex Economic": { fill: "rgba(234, 179, 8, 0.35)", stroke: "#ca8a04", hover: "rgba(234, 179, 8, 0.55)" },
  "Triplex": { fill: "rgba(168, 85, 247, 0.35)", stroke: "#9333ea", hover: "rgba(168, 85, 247, 0.55)" },
  "RowHouse Socialized": { fill: "rgba(239, 68, 68, 0.35)", stroke: "#dc2626", hover: "rgba(239, 68, 68, 0.55)" },
  "RowHouse Compound": { fill: "rgba(249, 115, 22, 0.35)", stroke: "#ea580c", hover: "rgba(249, 115, 22, 0.55)" },
  "VACANT LOT": { fill: "rgba(107, 114, 128, 0.25)", stroke: "#6b7280", hover: "rgba(107, 114, 128, 0.45)" },
  " VACANT LOT": { fill: "rgba(107, 114, 128, 0.25)", stroke: "#6b7280", hover: "rgba(107, 114, 128, 0.45)" },
};

const defaultColor = { fill: "rgba(107, 114, 128, 0.3)", stroke: "#6b7280", hover: "rgba(107, 114, 128, 0.5)" };
const STATUS_PRIORITY = {
  available: 1,
  reserved: 2,
  not_available: 3,
};

function parseCoords(coordsStr) {
  const nums = coordsStr.split(",").map(Number);
  const points = [];
  for (let i = 0; i < nums.length; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }
  return points;
}

function pointsToSvg(points) {
  return points.map(p => `${p.x},${p.y}`).join(" ");
}

function getPointBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function getLegendStripeLines(points) {
  const bounds = getPointBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return [];
  }

  const inset = Math.max(4, Math.min(width, height) * 0.04);
  const gap = Math.max(7, Math.min(width, height) * 0.08);
  const startX = bounds.minX - inset;
  const endX = bounds.maxX + inset;
  const diagonalSpan = endX - startX;
  const startY = bounds.minY - inset;

  return [0, gap, gap * 2].map((offset) => ({
    x1: startX,
    y1: startY + offset,
    x2: endX,
    y2: startY + offset + diagonalSpan,
  }));
}

function getDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function interpolatePoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function normalizeQuadPoints(points) {
  if (points.length !== 4) {
    return points;
  }

  const sortedByY = [...points].sort((pointA, pointB) => {
    if (pointA.y !== pointB.y) {
      return pointA.y - pointB.y;
    }

    return pointA.x - pointB.x;
  });

  const topTwo = [sortedByY[0], sortedByY[1]].sort((pointA, pointB) => pointA.x - pointB.x);
  const bottomTwo = [sortedByY[2], sortedByY[3]].sort((pointA, pointB) => pointA.x - pointB.x);

  const topLeft = topTwo[0];
  const topRight = topTwo[1];
  const bottomLeft = bottomTwo[0];
  const bottomRight = bottomTwo[1];

  return [topLeft, bottomLeft, bottomRight, topRight];
}

function splitQuadIntoUnitPolygons(points, unitCount) {
  if (points.length !== 4 || unitCount <= 1) {
    return [points];
  }

  const [p0, p1, p2, p3] = normalizeQuadPoints(points);
  const pairA = (getDistance(p0, p1) + getDistance(p2, p3)) / 2;
  const pairB = (getDistance(p1, p2) + getDistance(p3, p0)) / 2;
  const polygons = [];
  const shouldUseColumnSplit = unitCount >= 3 || pairB <= pairA;

  if (shouldUseColumnSplit) {
    for (let index = 0; index < unitCount; index += 1) {
      const startT = index / unitCount;
      const endT = (index + 1) / unitCount;
      polygons.push([
        interpolatePoint(p0, p3, startT),
        interpolatePoint(p1, p2, startT),
        interpolatePoint(p1, p2, endT),
        interpolatePoint(p0, p3, endT),
      ]);
    }

    return polygons;
  }

  for (let index = 0; index < unitCount; index += 1) {
    const startT = index / unitCount;
    const endT = (index + 1) / unitCount;
    polygons.push([
      interpolatePoint(p0, p1, startT),
      interpolatePoint(p0, p1, endT),
      interpolatePoint(p3, p2, endT),
      interpolatePoint(p3, p2, startT),
    ]);
  }

  return polygons;
}

function getPropertyOutlinePolygons(property) {
  if (Array.isArray(property.outlineCoords) && property.outlineCoords.length > 0) {
    return property.outlineCoords.map(parseCoords);
  }

  const points = parseCoords(property.coords);
  const units = getPropertyUnitEntries(property.info);
  const shouldAutoSplit = units.length > 1 && points.length === 4;

  if (shouldAutoSplit) {
    return splitQuadIntoUnitPolygons(points, units.length);
  }

  return [points];
}

function getUnitInfo(property, slotStatuses) {
  return getPropertyUnitEntries(property.info).map((unitEntry) => {
    const slotId = makeSlotId(property.id, unitEntry.sourceKey);
    const slotOverride = slotStatuses[slotId] ?? {};
    const effectiveStatus = normalizeSlotStatus(slotOverride.status ?? unitEntry.data.availability);
    const effectiveType = String(slotOverride.type ?? slotOverride.propertyType ?? slotOverride.property_type ?? "").trim()
      || String(unitEntry.data?.type ?? "").trim()
      || String(property.info?.type ?? "").trim();

    return {
      key: unitEntry.unitKey,
      type: effectiveType,
      data: {
        ...unitEntry.data,
        lotNum: slotOverride.lotNum || unitEntry.data.lotNum,
        lotArea: slotOverride.lotArea ?? unitEntry.data.lotArea,
        price: slotOverride.price ?? unitEntry.data?.price ?? property.info?.price ?? null,
      },
      status: effectiveStatus,
      statusMeta: getSlotStatusMeta(effectiveStatus),
    };
  });
}

function getPropertyStatusMeta(property, slotStatuses) {
  const units = getUnitInfo(property, slotStatuses);
  if (units.length === 0) {
    return getSlotStatusMeta("not_available");
  }

  const dominantStatus = units.reduce((currentStatus, unit) => {
    if (STATUS_PRIORITY[unit.status] > STATUS_PRIORITY[currentStatus]) {
      return unit.status;
    }

    return currentStatus;
  }, "available");

  return getSlotStatusMeta(dominantStatus);
}

function resolveDetailPropertyIdByUnitType(rawType) {
  const normalizedType = String(rawType ?? "").trim().toLowerCase();

  if (!normalizedType) {
    return "";
  }

  const exactTypeToIdMap = {
    "single attached duplex (deluxe)": "duplex-unit-deluxe",
    "single attached unit (deluxe)": "duplex-unit-deluxe",
    "duplex deluxe": "duplex-unit-deluxe",
    "single attached duplex (premiere)": "duplex-unit-premiere",
    "single attached unit (premiere)": "duplex-unit-premiere",
    "duplex premiere": "duplex-unit-premiere",
    "triplex (end unit a)": "triplex-end-unit-a",
    "triplex (center unit)": "triplex-center-unit",
    "triplex (end unit b)": "triplex-end-unit-b",
    "rowhouse (economic unit)": "rowhouse-economic-unit",
    "rowhouse (compound unit)": "rowhouse-compound-unit",
    "rowhouse (socialized unit)": "rowhouse-socialized-unit",
  };

  if (exactTypeToIdMap[normalizedType]) {
    return exactTypeToIdMap[normalizedType];
  }

  if (normalizedType.includes("premiere") && normalizedType.includes("duplex")) {
    return "duplex-unit-premiere";
  }

  if (normalizedType.includes("deluxe") && normalizedType.includes("duplex")) {
    return "duplex-unit-deluxe";
  }

  if (normalizedType.includes("triplex") && normalizedType.includes("end") && normalizedType.includes("a")) {
    return "triplex-end-unit-a";
  }

  if (normalizedType.includes("triplex") && normalizedType.includes("end") && normalizedType.includes("b")) {
    return "triplex-end-unit-b";
  }

  if (normalizedType.includes("triplex") && normalizedType.includes("center")) {
    return "triplex-center-unit";
  }

  if (normalizedType.includes("triplex")) {
    return "triplex-center-unit";
  }

  if (normalizedType.includes("rowhouse") && normalizedType.includes("economic")) {
    return "rowhouse-economic-unit";
  }

  if (normalizedType.includes("rowhouse") && normalizedType.includes("compound")) {
    return "rowhouse-compound-unit";
  }

  if (normalizedType.includes("rowhouse") && normalizedType.includes("socialized")) {
    return "rowhouse-socialized-unit";
  }

  if (normalizedType.includes("rowhouse")) {
    return "rowhouse-economic-unit";
  }

  if (normalizedType.includes("duplex")) {
    return "duplex-unit-premiere";
  }

  return "";
}

function isVacantType(rawType) {
  return String(rawType ?? "").trim().toLowerCase() === "vacant lot";
}

function inferTypeFromCategory(category) {
  const normalizedCategory = String(category ?? "").trim().toLowerCase();

  if (!normalizedCategory) {
    return "";
  }

  if (normalizedCategory.includes("corner")) {
    return "Corner Slot";
  }

  if (normalizedCategory.includes("triplex")) {
    return "Triplex";
  }

  if (normalizedCategory.includes("rowhouse")) {
    return "Rowhouse";
  }

  if (normalizedCategory.includes("premiere") || normalizedCategory.includes("premier")) {
    return "Duplex Premiere";
  }

  if (normalizedCategory.includes("deluxe")) {
    return "Duplex Deluxe";
  }

  if (normalizedCategory.includes("economic")) {
    return "Duplex Economic";
  }

  if (normalizedCategory.includes("duplex")) {
    return "Duplex";
  }

  return "";
}

function normalizeUnitsPageType(rawType) {
  const normalizedType = String(rawType ?? "").trim().toLowerCase();

  if (!normalizedType) {
    return "";
  }

  if (normalizedType.includes("rowhouse")) {
    return "rowhouse";
  }

  if (normalizedType.includes("triplex")) {
    return "triplex";
  }

  if (normalizedType.includes("duplex")) {
    return "duplex";
  }

  return "";
}

function getDisplayType(target, slotStatuses) {
  if (!target?.prop) {
    return "";
  }

  const categoryFallback = inferTypeFromCategory(target.prop.category);
  const propertyOverrideTypes = Object.entries(slotStatuses)
    .filter(([slotId]) => slotId.startsWith(`${target.prop.id}__`))
    .map(([, slot]) => String(slot?.type ?? slot?.propertyType ?? slot?.property_type ?? "").trim())
    .filter(Boolean);
  const nonVacantOverrideTypes = [...new Set(propertyOverrideTypes.filter((type) => !isVacantType(type)))];

  if (nonVacantOverrideTypes.length === 1) {
    return nonVacantOverrideTypes[0];
  }

  if (nonVacantOverrideTypes.length > 1) {
    return nonVacantOverrideTypes[0];
  }

  if (target.unit?.type) {
    return isVacantType(target.unit.type) ? (categoryFallback || target.unit.type) : target.unit.type;
  }

  const units = getUnitInfo(target.prop, slotStatuses);
  const distinctTypes = [...new Set(units.map((unit) => unit.type).filter(Boolean))];

  if (distinctTypes.length === 1) {
    return isVacantType(distinctTypes[0]) ? (categoryFallback || distinctTypes[0]) : distinctTypes[0];
  }

  const baseType = String(target.prop.info.type ?? "").trim();
  if (isVacantType(baseType)) {
    return categoryFallback || baseType;
  }

  return baseType;
}

function getFeatureValue(source) {
  if (source === null || source === undefined || source === "") {
    return null;
  }

  if (typeof source === "object") {
    if (Array.isArray(source.options) && source.options.length > 0) {
      const optionValue = source.options.find((option) => option !== null && option !== undefined && String(option).trim() !== "");
      if (optionValue !== undefined) {
        return optionValue;
      }
    }

    if (source.default !== null && source.default !== undefined && source.default !== "") {
      return source.default;
    }

    return null;
  }

  return source;
}

function normalizeMatchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isUnitlessDisplayType(rawType) {
  const normalizedType = normalizeMatchText(rawType);

  if (!normalizedType) {
    return false;
  }

  return (
    normalizedType.includes("corner")
    || normalizedType.includes("vacant")
    || normalizedType.includes("lot only")
    || normalizedType === "lot"
    || normalizedType.includes("no unit")
  );
}

function shouldShowViewUnitAction(target, slotStatuses) {
  if (!target?.prop) {
    return false;
  }

  const displayType = getDisplayType(target, slotStatuses);
  const categoryType = target.prop.category;
  const infoType = target.prop.info?.type ?? target.prop.property_type ?? target.prop.title;

  if (isUnitlessDisplayType(displayType) || isUnitlessDisplayType(categoryType) || isUnitlessDisplayType(infoType)) {
    return false;
  }

  const units = target.unit ? [target.unit] : getUnitInfo(target.prop, slotStatuses);
  const unitsPageType = normalizeUnitsPageType(displayType)
    || normalizeUnitsPageType(categoryType)
    || normalizeUnitsPageType(infoType);

  return units.length > 0 && Boolean(unitsPageType);
}

function getUnitFeatureItems(property, unit = null) {
  const info = property?.info ?? property ?? {};
  const bedrooms = getFeatureValue(unit?.data?.bedrooms ?? info.bedrooms ?? info.familyarea);
  const bathrooms = getFeatureValue(unit?.data?.bathrooms ?? info.bathrooms);
  const floorArea = unit?.data?.floorArea ?? info.floorArea ?? info.floor_area;
  const lotArea = unit?.data?.lotArea ?? info.lotArea ?? info.lot_area;

  const items = [];

  if (bedrooms !== null && bedrooms !== undefined && bedrooms !== "") {
    items.push(`${bedrooms} Bed${Number(bedrooms) === 1 ? "" : "s"}`);
  }

  if (bathrooms !== null && bathrooms !== undefined && bathrooms !== "") {
    items.push(`${bathrooms} Bath${Number(bathrooms) === 1 ? "" : "s"}`);
  }

  if (floorArea) {
    items.push(`${floorArea} Floor`);
  }

  if (lotArea) {
    items.push(`${lotArea} Lot`);
  }

  return items;
}

function getBrochureFeatureSource(property, slotStatuses, unit = null) {
  const displayType = getDisplayType({ prop: property, unit }, slotStatuses);
  const detailId = resolveDetailPropertyIdByUnitType(displayType);

  if (detailId) {
    const catalogMatch = (propertiesCatalog || []).find((entry) => {
      const entryId = String(entry?.id ?? "").trim().toLowerCase();
      const normalizedDetailId = String(detailId).trim().toLowerCase();

      return entryId === normalizedDetailId || entryId.startsWith(`${normalizedDetailId}`);
    });

    if (catalogMatch) {
      return catalogMatch;
    }
  }

  return property?.info ?? property ?? {};
}

function FeatureChips({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {items.map((item) => (
        <div key={item} className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          {item}
        </div>
      ))}
    </div>
  );
}

export default function VicinityMap() {
  const navigate = useNavigate();
  const allProperties = useMemo(() => getAllVicinityProperties(), []);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const revealRef = useScrollReveal();

  const [hoveredTarget, setHoveredTarget] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [slotStatuses, setSlotStatuses] = useState({});
  const [statusSyncError, setStatusSyncError] = useState("");
  const [activeLegend, setActiveLegend] = useState(null);

  const propertyImageMap = useMemo(() => {
    const map = {};
    try {
      (propertiesCatalog || []).forEach((p) => {
        if (p?.id) {
          map[p.id] = p?.images?.main || null;
          // also map a numeric-stripped id (some entries have trailing digits)
          const m = String(p.id).match(/^(.*?)(\d+)$/);
          if (m && m[1]) {
            map[m[1]] = map[m[1]] || p?.images?.main || null;
          }
          // map by normalized name (slug-like) for added robustness
          if (p?.name) {
            const slug = String(p.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            map[slug] = map[slug] || p?.images?.main || null;
          }
        }
      });
    } catch (e) {
      // ignore
    }
    return map;
  }, []);

  const selectedImageUrl = useMemo(() => {
    if (!selectedTarget?.prop) return null;
    const displayType = getDisplayType(selectedTarget, slotStatuses);
    const detailId = resolveDetailPropertyIdByUnitType(displayType);
    const imageName = propertyImageMap[detailId] || propertyImageMap[displayType?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')] || null;
    if (!imageName) return null;
    try {
      return new URL(`/src/images/properties/${imageName}`, import.meta.url).href;
    } catch (e) {
      return null;
    }
  }, [selectedTarget, slotStatuses, propertyImageMap]);

  // Pan & Zoom state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Legend visibility
  // Legend visibility (removed per request)

  useEffect(() => {
    const unsubscribe = subscribeToSlotStatuses(
      (nextStatuses) => {
        setSlotStatuses(nextStatuses);
        setStatusSyncError("");
      },
      (error) => {
        console.error(error);
        setStatusSyncError("Live slot status is temporarily unavailable. Showing default map availability.");
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // Auto-scroll to the map when this page mounts so users land on the vicinity map
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (mapRef.current && typeof mapRef.current.scrollIntoView === 'function') {
          mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (e) {
        // ignore
      }
    }, 120);

    return () => clearTimeout(t);
  }, []);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.3, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const next = prev / 1.3;
      if (next <= 1) {
        setTranslate({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };

  const handleReset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => {
      const next = Math.max(1, Math.min(prev * delta, 5));
      if (next <= 1) {
        setTranslate({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.target.closest(".map-control") || e.target.closest(".tooltip-card")) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  };

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy,
      });
    }
  }, [isPanning]);

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Touch pan handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      translateStart.current = { ...translate };
    }
  };

  const handleTouchMove = useCallback((e) => {
    if (isPanning && e.touches.length === 1) {
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy,
      });
    }
  }, [isPanning]);

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const handlePolygonHover = (e, prop, unit = null) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setHoveredTarget({
      prop,
      unit,
    });
  };

  const handlePolygonClick = (prop, unit = null) => {
    setSelectedTarget({
      prop,
      unit,
    });
  };

  const handleViewUnit = (selected) => {
    if (!selected?.prop) {
      return;
    }

    if (!shouldShowViewUnitAction(selected, slotStatuses)) {
      return;
    }

    const selectedType = getDisplayType(selected, slotStatuses);
    const unitsPageType = normalizeUnitsPageType(selectedType) || normalizeUnitsPageType(selected.prop.category) || normalizeUnitsPageType(selected.prop.info?.type);

    if (!unitsPageType) {
      return;
    }

    navigate(`${createPageUrl("PropertyTypeUnits")}?type=${encodeURIComponent(unitsPageType)}`);
  };

  const legendStatusItems = SLOT_STATUS_OPTIONS.map((status) => ({
    label: status.label,
    value: status.value,
    color: status.color,
    dotClass: status.dotClass,
  }));

  const handleLegendClick = (value) => {
    setSelectedTarget(null);
    setHoveredTarget(null);
    setActiveLegend((current) => (current === value ? null : value));
  };

  const clearLegend = () => setActiveLegend(null);

  return (
    <div ref={revealRef} className="h-full bg-gray-50 overflow-hidden">
      <div className="h-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex flex-col gap-3 min-h-0">

        {statusSyncError ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 mb-4">
            {statusSyncError}
          </p>
        ) : null}

        {/* Map Container */}
        <div
          ref={containerRef}
          className="relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden select-none flex-1 min-h-0"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHoveredTarget(null); }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute left-4 top-4 z-30 w-[210px] max-w-[calc(100%-5rem)] rounded-xl border border-gray-100 bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-gray-100 bg-white/90">
              <div>
                <p className="text-[11px] font-semibold text-[#16a34a] uppercase tracking-wider">Legend</p>
                <p className="text-sm font-bold text-slate-900">Availability</p>
              </div>
              {activeLegend ? (
                <button
                  type="button"
                  onClick={clearLegend}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Show All
                </button>
              ) : null}
            </div>

            <div className="max-h-[calc(100vh-240px)] overflow-auto px-3.5 py-3 space-y-2.5">
              <div className="space-y-2">
                {legendStatusItems.map((item) => {
                  const isActive = activeLegend === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleLegendClick(item.value)}
                      className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all ${isActive ? "border-[#16a34a] bg-[#f0fdf4] shadow-sm" : "border-gray-200 bg-white hover:border-[#16a34a]/30 hover:bg-gray-50"}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.dotClass}`} />
                      <span className="flex-1 text-sm font-medium text-slate-700">{item.label}</span>
                      {isActive ? <span className="text-[10px] font-bold uppercase tracking-wider text-[#16a34a]">Active</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="map-control absolute top-4 right-4 z-20 flex flex-col gap-1.5">
            <button
              onClick={handleZoomIn}
              className="w-9 h-9 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-center hover:bg-[#16a34a] hover:text-white hover:border-[#16a34a] text-gray-600 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-9 h-9 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-center hover:bg-[#16a34a] hover:text-white hover:border-[#16a34a] text-gray-600 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="w-9 h-9 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-center hover:bg-[#16a34a] hover:text-white hover:border-[#16a34a] text-gray-600 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom level indicator */}
          {scale > 1 && (
            <div className="absolute top-4 left-4 z-20 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-1.5">
              <span className="text-xs font-semibold text-[#16a34a]">{Math.round(scale * 100)}%</span>
            </div>
          )}

          {/* Zoomable/Pannable inner */}
          <div
            ref={mapRef}
            className="h-full"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.2s ease-out",
            }}
          >
            {/* Base map image */}
            <div className="relative flex h-full w-full items-center justify-center">
              <img
                src={baseMapImg}
                alt="Vicmar Homes Community Map"
                className="w-full h-full object-contain block"
                draggable={false}
              />

              {/* SVG Overlay */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${MAP_NATURAL_WIDTH} ${MAP_NATURAL_HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: "none" }}
              >
                {allProperties.map((prop) => {
                  const outlinePolygons = getPropertyOutlinePolygons(prop);
                  const typeColor = typeColors[prop.info.type] || defaultColor;
                  const propertyStatusMeta = getPropertyStatusMeta(prop, slotStatuses);
                  const units = getUnitInfo(prop, slotStatuses);
                  const hasUnitMappedPolygons = units.length > 1 && units.length === outlinePolygons.length;

                  return outlinePolygons.map((points, outlineIndex) => (
                    (() => {
                      const mappedUnit = hasUnitMappedPolygons ? units[outlineIndex] : null;
                      const isSelected = selectedTarget?.prop?.id === prop.id
                        && (mappedUnit ? selectedTarget?.unit?.key === mappedUnit.key : selectedTarget?.unit === null);
                      const isHovered = hoveredTarget?.prop?.id === prop.id
                        && (mappedUnit ? hoveredTarget?.unit?.key === mappedUnit.key : hoveredTarget?.unit === null);
                      const statusMeta = mappedUnit ? mappedUnit.statusMeta : propertyStatusMeta;
                      const polygonStatus = mappedUnit ? mappedUnit.status : statusMeta.value;
                      const shouldStripe = Boolean(activeLegend && polygonStatus === activeLegend);
                      const polygonOpacity = isHovered || isSelected ? 0.62 : 0.42;
                      const polygonStrokeOpacity = 1;
                      const polygonStrokeWidth = isHovered || isSelected ? 2 : 1;
                      const stripeLines = shouldStripe ? getLegendStripeLines(points) : [];

                      return (
                    <g key={`${prop.id}-${outlineIndex}`}>
                      <polygon
                        points={pointsToSvg(points)}
                        fill={statusMeta.color}
                        fillOpacity={polygonOpacity}
                        stroke={typeColor.stroke}
                        strokeOpacity={polygonStrokeOpacity}
                        strokeWidth={polygonStrokeWidth}
                        style={{
                          pointerEvents: "all",
                          cursor: "pointer",
                          transition: "fill-opacity 0.15s, stroke-width 0.15s",
                        }}
                        onMouseMove={(e) => {
                          e.stopPropagation();
                          handlePolygonHover(e, prop, mappedUnit);
                        }}
                        onMouseLeave={() => setHoveredTarget(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePolygonClick(prop, mappedUnit);
                        }}
                      />
                      {shouldStripe ? (
                        <g clipPath={`url(#legend-clip-${prop.id}-${outlineIndex})`} style={{ pointerEvents: "none" }}>
                          <defs>
                            <clipPath id={`legend-clip-${prop.id}-${outlineIndex}`}>
                              <polygon points={pointsToSvg(points)} />
                            </clipPath>
                          </defs>
                          {stripeLines.map((line, lineIndex) => (
                            <line
                              key={`${prop.id}-${outlineIndex}-stripe-${lineIndex}`}
                              x1={line.x1}
                              y1={line.y1}
                              x2={line.x2}
                              y2={line.y2}
                              stroke="#111827"
                              strokeOpacity={0.45}
                              strokeWidth={1.5}
                              strokeLinecap="butt"
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                        </g>
                      ) : null}
                    </g>
                      );
                    })()
                  ));
                })}
              </svg>
            </div>
          </div>

          {/* Hover Tooltip */}
          {hoveredTarget?.prop && !selectedTarget && (
            <div
              className="tooltip-card absolute z-30 pointer-events-none"
              style={{
                left: `${Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth || 999) - 440)}px`,
                top: `${Math.min(tooltipPos.y - 10, (containerRef.current?.clientHeight || 999) - 260)}px`,
              }}
            >
              {(() => {
                const displayType = getDisplayType(hoveredTarget, slotStatuses);
                const brochureSource = getBrochureFeatureSource(hoveredTarget.prop, slotStatuses, hoveredTarget.unit);
                const featureItems = getUnitFeatureItems(brochureSource, hoveredTarget.unit);
                const detailId = resolveDetailPropertyIdByUnitType(displayType);
                const imageName = propertyImageMap[detailId];
                const imageUrl = imageName ? new URL(`/src/images/properties/${imageName}`, import.meta.url).href : null;
                const units = hoveredTarget.unit
                  ? [hoveredTarget.unit]
                  : getUnitInfo(hoveredTarget.prop, slotStatuses);

                return (
                  <div className="bg-white text-gray-800 p-4 rounded-xl shadow-xl border border-gray-100 min-w-[320px] max-w-[480px]">
                    <div className="flex gap-4">
                      {imageUrl ? (
                        <div className="w-44 h-28 flex-shrink-0 overflow-hidden rounded-md shadow-sm border border-gray-100 bg-gray-50 flex items-center justify-center">
                          <img src={imageUrl} alt={displayType || "property"} className="w-full h-full object-contain" draggable={false} />
                        </div>
                      ) : null}

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-3.5 h-3.5 text-[#16a34a] flex-shrink-0" />
                          <span className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                            Block {hoveredTarget.prop.info.blockNum} · {hoveredTarget.prop.info.phase}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mb-2">
                          {displayType}
                          {hoveredTarget.unit?.key ? ` · Unit ${hoveredTarget.unit.key}` : ""}
                        </h3>

                        {units.length > 0 ? (
                          <div className="space-y-1.5">
                            {units.map((u, i) => (
                              <div key={i} className="flex items-start justify-between gap-3 text-xs bg-gray-50 rounded-lg px-2.5 py-2">
                                <div className="text-gray-600 flex flex-col">
                                  <span>{u.key ? `Unit ${u.key} · ` : ""}Lot {u.data.lotNum}</span>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {featureItems.length > 0
                                      ? featureItems.map((item, index) => (
                                        <span key={`${u.key || i}-feature-${index}`} className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                          {item}
                                        </span>
                                      ))
                                      : getUnitFeatureItems(hoveredTarget.prop, u).map((item, index) => (
                                        <span key={`${u.key || i}-fallback-feature-${index}`} className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                          {item}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${u.statusMeta.dotClass}`} />
                                  <span className={`font-semibold ${u.statusMeta.textClass}`}>{u.statusMeta.label}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <p className="text-[10px] text-gray-400">Click for more details</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

      </div>

      {/* Selected Property Modal */}
      {selectedTarget?.prop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTarget(null)}>
          <div
            className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
                <div className="bg-[#15803d] p-6 relative">
              <button
                onClick={() => setSelectedTarget(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-[#16a34a]" />
                    <span className="text-xs text-white/85 font-semibold uppercase tracking-wider">
                  Block {selectedTarget.prop.info.blockNum} · {selectedTarget.prop.info.phase}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">
                {getDisplayType(selectedTarget, slotStatuses)}
                {selectedTarget.unit?.key ? ` · Unit ${selectedTarget.unit.key}` : ""}
              </h3>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {selectedImageUrl ? (
                <div className="mb-4">
                  <img src={selectedImageUrl} alt={getDisplayType(selectedTarget, slotStatuses) || "property"} className="w-full h-64 object-contain rounded-md border border-gray-100 bg-gray-50 p-1" draggable={false} />
                </div>
              ) : null}
              {(() => {
                const selectedUnits = selectedTarget.unit
                  ? [selectedTarget.unit]
                  : getUnitInfo(selectedTarget.prop, slotStatuses);
                const brochureSource = getBrochureFeatureSource(selectedTarget.prop, slotStatuses, selectedTarget.unit);
                const featureItems = getUnitFeatureItems(brochureSource, selectedTarget.unit);
                const canShowViewUnit = shouldShowViewUnitAction(selectedTarget, slotStatuses);

                return (
                  <>
                    {selectedUnits.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider mb-3">Unit Details</p>
                        {selectedUnits.map((u, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#16a34a]">
                                {u.key ? `Unit ${u.key} — ` : ""}Lot {u.data.lotNum}
                              </p>
                              <div className="mt-2.5">
                                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Features</p>
                                <FeatureChips items={featureItems.length > 0 ? featureItems : getUnitFeatureItems(selectedTarget.prop, u)} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${u.statusMeta.dotClass}`} />
                              <span
                                className="text-sm font-semibold"
                                style={{ color: u.statusMeta.color }}
                              >
                                {u.statusMeta.label}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider mb-3">Property Details</p>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
                          <p className="text-sm font-semibold text-[#16a34a]">
                            {selectedTarget.prop.info.type || "Property"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Block {selectedTarget.prop.info.blockNum} · {selectedTarget.prop.info.phase}
                          </p>
                          <div className="pt-2">
                            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Features</p>
                            <FeatureChips items={featureItems} />
                          </div>
                          <p className="text-xs text-gray-400">
                            No per-unit records are available for this lot.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 flex gap-3">
                      {canShowViewUnit ? (
                        <Button
                          onClick={() => handleViewUnit(selectedTarget)}
                          className="flex-1 bg-[#16a34a] hover:bg-[#22c55e] text-white font-semibold"
                        >
                          View Unit
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => setSelectedTarget(null)}
                        className={canShowViewUnit ? "flex-1 border-gray-200 text-gray-600 hover:bg-gray-50" : "w-full border-gray-200 text-gray-600 hover:bg-gray-50"}
                      >
                        Close
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
