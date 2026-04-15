import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import baseMapImg from "@/images/properties_map/vicinity-updated.png";
import { MapPin, ZoomIn, ZoomOut, Maximize2, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { subscribeToSlotStatuses } from "@/lib/slotStatusService";
import { SLOT_STATUS_OPTIONS, getSlotStatusMeta, makeSlotId, normalizeSlotStatus } from "@/lib/slotStatus";
import { getAllVicinityProperties, getPropertyUnitEntries } from "@/lib/vicinitySlots";

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
    return "Corner Unit";
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

  // Pan & Zoom state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Legend visibility
  const [showLegend, setShowLegend] = useState(true);

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

    const selectedType = getDisplayType(selected, slotStatuses);
    const detailPropertyId = resolveDetailPropertyIdByUnitType(selectedType);

    if (!detailPropertyId) {
      return;
    }

    const unitParam = selected.unit?.key
      ? `&unit=${encodeURIComponent(selected.unit.key)}`
      : "";

    navigate(`${createPageUrl("PropertyDetail")}?id=${encodeURIComponent(detailPropertyId)}${unitParam}`);
  };

  const legendItems = [
    { label: "Duplex Premiere", color: "#16a34a" },
    { label: "Duplex Deluxe", color: "#2563eb" },
    { label: "Duplex Economic", color: "#ca8a04" },
    { label: "Triplex", color: "#9333ea" },
    { label: "Rowhouse", color: "#dc2626" },
    { label: "Vacant Lot", color: "#6b7280" },
  ];

  return (
    <div ref={revealRef} className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#15803d] py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-7xl mx-auto text-center page-header">
          <p className="text-[#86efac] text-xs font-semibold uppercase tracking-widest mb-3">Explore the Community</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Subdivision Plan</h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            Explore the Vicmar Homes community layout and find your perfect lot.
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#16a34a]">Community Layout</h2>
            <p className="text-gray-500 text-sm mt-1">Hover over a lot to see details · Click to view more info · Scroll to zoom</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLegend(!showLegend)}
            className="map-control gap-2 border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a]/5"
          >
            <Info className="w-4 h-4" />
            {showLegend ? "Hide Legend" : "Show Legend"}
          </Button>
        </div>

        {statusSyncError ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 mb-4">
            {statusSyncError}
          </p>
        ) : null}

        {/* Legend */}
        {showLegend && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
            <p className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider mb-3">Property Type (Outline)</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
              {legendItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded border-2" style={{ borderColor: item.color }} />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider mb-2">Availability</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {SLOT_STATUS_OPTIONS.map((status) => (
                  <div key={status.value} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${status.dotClass}`} />
                    <span className="text-sm text-gray-600">{status.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div
          ref={containerRef}
          className="relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden select-none"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHoveredTarget(null); }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
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
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.2s ease-out",
            }}
          >
            {/* Base map image */}
            <div className="relative" style={{ width: "100%" }}>
              <img
                src={baseMapImg}
                alt="Vicmar Homes Community Map"
                className="w-full h-auto block"
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

                      return (
                    <polygon
                      key={`${prop.id}-${outlineIndex}`}
                      points={pointsToSvg(points)}
                      fill={statusMeta.color}
                      fillOpacity={isHovered ? 0.62 : 0.42}
                      stroke={typeColor.stroke}
                      strokeWidth={isHovered || isSelected ? 2 : 1}
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
                left: `${Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth || 999) - 260)}px`,
                top: `${Math.min(tooltipPos.y - 10, (containerRef.current?.clientHeight || 999) - 180)}px`,
              }}
            >
              <div className="bg-white text-gray-800 p-4 rounded-xl shadow-xl border border-gray-100 min-w-[220px] max-w-[280px]">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-[#16a34a] flex-shrink-0" />
                  <span className="text-xs text-[#16a34a] font-semibold uppercase tracking-wider">
                    Block {hoveredTarget.prop.info.blockNum} · {hoveredTarget.prop.info.phase}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#16a34a] mb-3">
                  {getDisplayType(hoveredTarget, slotStatuses)}
                  {hoveredTarget.unit?.key ? ` · Unit ${hoveredTarget.unit.key}` : ""}
                </h3>

                {(() => {
                  const units = hoveredTarget.unit
                    ? [hoveredTarget.unit]
                    : getUnitInfo(hoveredTarget.prop, slotStatuses);
                  if (units.length === 0) return null;
                  return (
                    <div className="space-y-1.5">
                      {units.map((u, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <span className="text-gray-600">
                            {u.key ? `Unit ${u.key} · ` : ""}Lot {u.data.lotNum}
                            <span className="text-gray-400 ml-1">({u.data.lotArea} sqm)</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${u.statusMeta.dotClass}`} />
                            <span className={`font-semibold ${u.statusMeta.textClass}`}>
                              {u.statusMeta.label}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="mt-3 pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400">Click for more details</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: "Total Lots", value: allProperties.length },
            { label: "Duplex Units", value: allProperties.filter(p => p.info.type.toLowerCase().includes("duplex")).length },
            { label: "Triplex Units", value: allProperties.filter(p => p.info.type.toLowerCase().includes("triplex")).length },
            { label: "Rowhouse Units", value: allProperties.filter(p => p.info.type.toLowerCase().includes("rowhouse")).length },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
              <p className="text-3xl font-bold text-[#16a34a]">{stat.value}</p>
              <p className="text-gray-500 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
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
                <span className="text-xs text-[#16a34a] font-semibold uppercase tracking-wider">
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
              {(() => {
                const units = selectedTarget.unit
                  ? [selectedTarget.unit]
                  : getUnitInfo(selectedTarget.prop, slotStatuses);
                if (units.length === 0) {
                  return (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider mb-3">Property Details</p>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
                        <p className="text-sm font-semibold text-[#16a34a]">
                          {selectedTarget.prop.info.type || "Property"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Block {selectedTarget.prop.info.blockNum} · {selectedTarget.prop.info.phase}
                        </p>
                        <p className="text-xs text-gray-400">
                          No per-unit records are available for this lot.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider mb-3">Unit Details</p>
                    {units.map((u, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <p className="text-sm font-semibold text-[#16a34a]">
                            {u.key ? `Unit ${u.key} — ` : ""}Lot {u.data.lotNum}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{u.data.lotArea} sqm</p>
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
                );
              })()}

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <Button
                  onClick={() => handleViewUnit(selectedTarget)}
                  className="flex-1 bg-[#16a34a] hover:bg-[#22c55e] text-white font-semibold"
                >
                  View Unit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedTarget(null)}
                  className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
