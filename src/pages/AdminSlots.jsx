import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Filter, MapPin, Pencil, Save, ArrowUpDown, ArrowUp, ArrowDown, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import baseMapImg from "@/images/properties_map/vicinity-updated.png";
import { auth } from "@/lib/firebase";
import { subscribeToSlotStatuses, updateSlotDetails, updateSlotStatus } from "@/lib/slotStatusService";
import { SLOT_STATUS_OPTIONS, getSlotStatusMeta, normalizeSlotStatus } from "@/lib/slotStatus";
import { buildVicinitySlots, getAllVicinityProperties } from "@/lib/vicinitySlots";
import { SLOT_PROPERTY_TYPE_OPTIONS } from "@/lib/propertyTypes";
import { toast } from "sonner";

// Helper component for circular progress rings
const CircularProgress = ({ percentage, color = "text-blue-500", trackColor = "text-slate-100", size = 64, strokeWidth = 4 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className={trackColor}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${color} transition-all duration-300 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-700">
        {percentage > 0 ? Math.round(percentage) : 0}%
      </div>
    </div>
  );
};

const MAP_NATURAL_WIDTH = 1404;
const MAP_NATURAL_HEIGHT = 908;
const TABLE_PAGE_SIZE = 15;
const EMPTY_EDIT_FORM = {
  lotNum: "",
  lotArea: "",
  price: "",
  blockNum: "",
  phase: "",
  type: "",
};

const TABLE_FILTER_FIELDS = [
  { key: "type", label: "Type", enabled: true },
  { key: "unit", label: "Unit", enabled: true },
  { key: "status", label: "Status", enabled: true },
  { key: "price", label: "Price", enabled: true },
  { key: "lotNum", label: "Lot", enabled: false },
  { key: "lotArea", label: "Floor Area", enabled: false },
  { key: "blockNum", label: "Block", enabled: false },
  { key: "phase", label: "Phase", enabled: false },
];

function createEmptyTableFilters() {
  return TABLE_FILTER_FIELDS.reduce((accumulator, field) => {
    accumulator[field.key] = [];
    return accumulator;
  }, {});
}

function cloneTableFilters(filters) {
  return TABLE_FILTER_FIELDS.reduce((accumulator, field) => {
    accumulator[field.key] = Array.isArray(filters?.[field.key]) ? [...filters[field.key]] : [];
    return accumulator;
  }, {});
}

function sortFilterValues(fieldKey, values) {
  if (fieldKey === "lotNum") {
    return [...values].sort((valueA, valueB) => {
      const lotDifference = extractLotSortValue(valueA) - extractLotSortValue(valueB);
      if (lotDifference !== 0) {
        return lotDifference;
      }

      return String(valueA).localeCompare(String(valueB));
    });
  }

  return [...values].sort((valueA, valueB) =>
    String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: "base" }),
  );
}

function extractLotSortValue(lotNum) {
  const match = String(lotNum ?? "").match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function resolveLotNumber(overrideLotNum, defaultLotNum) {
  const normalizedOverride = String(overrideLotNum ?? "").trim();
  if (normalizedOverride) {
    return normalizedOverride;
  }

  return String(defaultLotNum ?? "").trim();
}

function parseCoords(coordsStr) {
  if (!coordsStr) {
    return [];
  }

  const nums = String(coordsStr)
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value));

  const points = [];
  for (let index = 0; index < nums.length; index += 2) {
    if (nums[index + 1] === undefined) {
      break;
    }

    points.push({ x: nums[index], y: nums[index + 1] });
  }

  return points;
}

function pointsToSvg(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
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

function getPropertyOutlinePolygons(property, propertySlots) {
  if (Array.isArray(property.outlineCoords) && property.outlineCoords.length > 0) {
    return property.outlineCoords.map(parseCoords);
  }

  const points = parseCoords(property.coords);
  const shouldAutoSplit = propertySlots.length > 1 && points.length === 4;

  if (shouldAutoSplit) {
    return splitQuadIntoUnitPolygons(points, propertySlots.length);
  }

  return [points];
}

function hexToRgba(hexColor, opacity) {
  const clean = String(hexColor ?? "").replace("#", "").trim();
  if (clean.length !== 6) {
    return `rgba(107, 114, 128, ${opacity})`;
  }

  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function getAreaVisual(slots) {
  if (!slots.length) {
    return {
      fill: "rgba(107, 114, 128, 0.2)",
      hoverFill: "rgba(107, 114, 128, 0.35)",
      stroke: "#6b7280",
    };
  }

  const statuses = [...new Set(slots.map((slot) => slot.currentStatus))];
  if (statuses.length === 1) {
    const statusMeta = getSlotStatusMeta(statuses[0]);
    return {
      fill: hexToRgba(statusMeta.color, 0.28),
      hoverFill: hexToRgba(statusMeta.color, 0.45),
      stroke: statusMeta.color,
    };
  }

  return {
    fill: "rgba(14, 165, 233, 0.28)",
    hoverFill: "rgba(14, 165, 233, 0.45)",
    stroke: "#0284c7",
  };
}

function getSlotVisual(slot) {
  const statusMeta = slot?.currentMeta ?? getSlotStatusMeta(slot?.currentStatus);

  return {
    fill: hexToRgba(statusMeta.color, 0.28),
    hoverFill: hexToRgba(statusMeta.color, 0.45),
    stroke: statusMeta.color,
  };
}

function formatPhp(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function getStatusSelectClass(statusValue) {
  const normalizedStatus = normalizeSlotStatus(statusValue);

  if (normalizedStatus === "available") {
    return "border-emerald-200 bg-emerald-50/80 text-emerald-700";
  }

  if (normalizedStatus === "reserved") {
    return "border-amber-200 bg-amber-50/80 text-amber-700";
  }

  return "border-rose-200 bg-rose-50/80 text-rose-700";
}

export default function AdminSlots() {
  const [statusOverrides, setStatusOverrides] = useState({});
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isFilterSettingsOpen, setIsFilterSettingsOpen] = useState(false);
  const [appliedTableFilters, setAppliedTableFilters] = useState(() => createEmptyTableFilters());
  const [draftTableFilters, setDraftTableFilters] = useState(() => createEmptyTableFilters());
  const [filterFields, setFilterFields] = useState(TABLE_FILTER_FIELDS);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [savingSlotId, setSavingSlotId] = useState("");
  const [syncError, setSyncError] = useState("");
  const [actionError, setActionError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingSlotId, setEditingSlotId] = useState("");
  const [slotEditForm, setSlotEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingDetailSlotId, setSavingDetailSlotId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [hoveredMapTargetKey, setHoveredMapTargetKey] = useState("");
  const editPanelRef = useRef(null);

  const mergeLocalSlotOverride = (slotId, patch) => {
    setStatusOverrides((prev) => {
      const current = prev[slotId] ?? {};
      return {
        ...prev,
        [slotId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const allProperties = useMemo(() => getAllVicinityProperties(), []);
  const allSlots = useMemo(() => buildVicinitySlots(allProperties), [allProperties]);

  useEffect(() => {
    const unsubscribe = subscribeToSlotStatuses(
      (nextStatuses) => {
        setStatusOverrides(nextStatuses);
        setSyncError("");
      },
      (error) => {
        console.error(error);
        setSyncError("Unable to sync live slot status right now.");
      },
    );

    return unsubscribe;
  }, []);

  const slotsWithStatus = useMemo(() => {
    const nextSlots = allSlots.map((slot) => {
      const override = statusOverrides[slot.slotId];
      const currentStatus = normalizeSlotStatus(override?.status ?? slot.defaultStatus);
      const currentMeta = getSlotStatusMeta(currentStatus);
      const effectiveLotArea = override?.lotArea ?? slot.lotArea;
      const effectivePrice = override?.price ?? slot.price;

      return {
        ...slot,
        lotNum: resolveLotNumber(override?.lotNum, slot.lotNum),
        lotArea: effectiveLotArea === "" || effectiveLotArea === undefined ? null : effectiveLotArea,
        price: effectivePrice === "" || effectivePrice === undefined ? null : effectivePrice,
        blockNum: String(override?.blockNum ?? slot.blockNum ?? "").trim(),
        phase: String(override?.phase ?? slot.phase ?? "").trim(),
        type: String(override?.type ?? override?.propertyType ?? override?.property_type ?? slot.type ?? "").trim(),
        currentStatus,
        currentMeta,
        hasOverride: Boolean(override),
      };
    });

    return nextSlots.sort((slotA, slotB) => {
      const lotDifference = extractLotSortValue(slotA.lotNum) - extractLotSortValue(slotB.lotNum);
      if (lotDifference !== 0) {
        return lotDifference;
      }

      return String(slotA.lotNum).localeCompare(String(slotB.lotNum));
    });
  }, [allSlots, statusOverrides]);

  const statusSummary = useMemo(() => {
    const summary = {
      total: slotsWithStatus.length,
      available: 0,
      reserved: 0,
      not_available: 0,
    };

    slotsWithStatus.forEach((slot) => {
      summary[slot.currentStatus] += 1;
    });

    return summary;
  }, [slotsWithStatus]);

  const slotsByPropertyId = useMemo(() => {
    const map = {};

    slotsWithStatus.forEach((slot) => {
      if (!map[slot.propertyId]) {
        map[slot.propertyId] = [];
      }

      map[slot.propertyId].push(slot);
    });

    return map;
  }, [slotsWithStatus]);

  const selectedProperty = useMemo(() => {
    return allProperties.find((property) => property.id === selectedPropertyId) ?? null;
  }, [allProperties, selectedPropertyId]);

  const selectedPropertySlots = useMemo(() => {
    if (!selectedProperty) {
      return [];
    }

    const propertySlots = slotsByPropertyId[selectedProperty.id] ?? [];

    const sortedSlots = [...propertySlots].sort((slotA, slotB) => {
      const lotDifference = extractLotSortValue(slotA.lotNum) - extractLotSortValue(slotB.lotNum);
      if (lotDifference !== 0) {
        return lotDifference;
      }

      return String(slotA.lotNum).localeCompare(String(slotB.lotNum));
    });

    if (!selectedSlotId) {
      return sortedSlots;
    }

    return sortedSlots.filter((slot) => slot.slotId === selectedSlotId);
  }, [selectedProperty, selectedSlotId, slotsByPropertyId]);

  const selectedSlot = useMemo(() => {
    if (!selectedSlotId) {
      return null;
    }

    return slotsWithStatus.find((slot) => slot.slotId === selectedSlotId) ?? null;
  }, [selectedSlotId, slotsWithStatus]);

  const propertyTypeOptions = SLOT_PROPERTY_TYPE_OPTIONS;

  useEffect(() => {
    if (!selectedSlotId || !selectedPropertyId) {
      return;
    }

    const selectedPropertySlotsList = slotsByPropertyId[selectedPropertyId] ?? [];
    const slotStillBelongsToProperty = selectedPropertySlotsList.some((slot) => slot.slotId === selectedSlotId);

    if (!slotStillBelongsToProperty) {
      setSelectedSlotId("");
    }
  }, [selectedPropertyId, selectedSlotId, slotsByPropertyId]);

  const getSlotTableFieldValue = (slot, fieldKey) => {
    if (fieldKey === "lotNum") {
      return slot.lotNum || "-";
    }

    if (fieldKey === "lotArea") {
      return slot.lotArea ? `${slot.lotArea} m2` : "-";
    }

    if (fieldKey === "price") {
      return slot.price !== null ? formatPhp(slot.price) : "-";
    }

    if (fieldKey === "unit") {
      return slot.unitKey ? `Unit ${slot.unitKey}` : "-";
    }

    if (fieldKey === "blockNum") {
      return slot.blockNum || "-";
    }

    if (fieldKey === "phase") {
      return slot.phase || "-";
    }

    if (fieldKey === "type") {
      return slot.type || "-";
    }

    if (fieldKey === "status") {
      return slot.currentMeta?.label ?? getSlotStatusMeta(slot.currentStatus).label;
    }

    return "";
  };

  const tableFilterOptions = useMemo(() => {
    const uniqueValuesByField = TABLE_FILTER_FIELDS.reduce((accumulator, field) => {
      accumulator[field.key] = new Set();
      return accumulator;
    }, {});

    slotsWithStatus.forEach((slot) => {
      TABLE_FILTER_FIELDS.forEach((field) => {
        uniqueValuesByField[field.key].add(getSlotTableFieldValue(slot, field.key));
      });
    });

    return TABLE_FILTER_FIELDS.reduce((accumulator, field) => {
      accumulator[field.key] = sortFilterValues(field.key, Array.from(uniqueValuesByField[field.key]));
      return accumulator;
    }, {});
  }, [slotsWithStatus]);

  const enabledFilterFields = useMemo(() => {
    return filterFields.filter((field) => field.enabled);
  }, [filterFields]);

  const activeFilterFieldCount = useMemo(() => {
    return enabledFilterFields.filter((field) => (appliedTableFilters[field.key] ?? []).length > 0).length;
  }, [appliedTableFilters, enabledFilterFields]);

  const activeFilterValueCount = useMemo(() => {
    return enabledFilterFields.reduce((total, field) => total + (appliedTableFilters[field.key] ?? []).length, 0);
  }, [appliedTableFilters, enabledFilterFields]);

  const filteredSlots = useMemo(() => {
    return slotsWithStatus.filter((slot) => {
      return TABLE_FILTER_FIELDS.every((field) => {
        const selectedValues = appliedTableFilters[field.key] ?? [];
        if (!selectedValues.length) {
          return true;
        }

        const fieldValue = getSlotTableFieldValue(slot, field.key);
        return selectedValues.includes(fieldValue);
      });
    });
  }, [slotsWithStatus, appliedTableFilters]);

  const sortedAndFilteredSlots = useMemo(() => {
    if (!sortConfig.key) return filteredSlots;

    return [...filteredSlots].sort((a, b) => {
      let aVal, bVal;

      if (sortConfig.key === 'lotNum') {
        aVal = extractLotSortValue(a.lotNum);
        bVal = extractLotSortValue(b.lotNum);
      } else if (sortConfig.key === 'lotArea') {
        aVal = a.lotArea ?? -1;
        bVal = b.lotArea ?? -1;
      } else if (sortConfig.key === 'price') {
        aVal = a.price ?? -1;
        bVal = b.price ?? -1;
      } else if (sortConfig.key === 'unit') {
        aVal = a.unitKey || '';
        bVal = b.unitKey || '';
      } else if (sortConfig.key === 'blockNum') {
        aVal = a.blockNum || '';
        bVal = b.blockNum || '';
      } else if (sortConfig.key === 'phase') {
        aVal = a.phase || '';
        bVal = b.phase || '';
      } else if (sortConfig.key === 'type') {
        aVal = a.type || '';
        bVal = b.type || '';
      } else if (sortConfig.key === 'status') {
        aVal = a.currentStatus || '';
        bVal = b.currentStatus || '';
      } else {
        return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true });
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSlots, sortConfig]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(sortedAndFilteredSlots.length / TABLE_PAGE_SIZE));
  }, [sortedAndFilteredSlots.length]);

  const paginatedSlots = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE;
    const endIndex = startIndex + TABLE_PAGE_SIZE;
    return sortedAndFilteredSlots.slice(startIndex, endIndex);
  }, [currentPage, sortedAndFilteredSlots]);

  const currentlyEditingSlot = useMemo(() => {
    return slotsWithStatus.find((slot) => slot.slotId === editingSlotId) ?? null;
  }, [editingSlotId, slotsWithStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedTableFilters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!editingSlotId) {
      return;
    }

    const editedSlotStillVisible = slotsWithStatus.some((slot) => slot.slotId === editingSlotId);
    if (!editedSlotStillVisible) {
      setEditingSlotId("");
      setSlotEditForm(EMPTY_EDIT_FORM);
    }
  }, [editingSlotId, slotsWithStatus]);

  const handleStatusChange = async (slot, status) => {
    setActionError("");
    setSavingSlotId(slot.slotId);

    try {
      await updateSlotStatus(slot, status, auth.currentUser?.email ?? "admin");

      // Reflect status update immediately while awaiting snapshot propagation.
      mergeLocalSlotOverride(slot.slotId, {
        status,
        lotNum: slot.lotNum,
        lotArea: slot.lotArea,
        price: slot.price,
        blockNum: slot.blockNum,
        phase: slot.phase,
        type: slot.type,
        unitKey: slot.unitKey,
        sourceKey: slot.sourceKey,
        propertyId: slot.propertyId,
      });

      toast.success(`Lot ${slot.lotNum} status updated to ${status}.`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to update status for lot ${slot.lotNum}.`);
    } finally {
      setSavingSlotId("");
    }
  };

  const startSlotEdit = (slot, { scrollToEditor = true } = {}) => {
    setActionError("");
    setSelectedPropertyId(slot.propertyId);
    setSelectedSlotId(slot.slotId);
    setEditingSlotId(slot.slotId);
    setSlotEditForm({
      lotNum: slot.lotNum ?? "",
      lotArea: slot.lotArea === null || slot.lotArea === undefined ? "" : String(slot.lotArea),
      price: slot.price === null || slot.price === undefined ? "" : String(slot.price),
      blockNum: slot.blockNum ?? "",
      phase: slot.phase ?? "",
      type: slot.type ?? "",
    });

    if (scrollToEditor) {
      window.requestAnimationFrame(() => {
        editPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const cancelSlotEdit = () => {
    setEditingSlotId("");
    setSlotEditForm(EMPTY_EDIT_FORM);
  };

  const handleSlotEditField = (fieldName, value) => {
    setSlotEditForm((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSlotDetailsSave = async () => {
    if (!currentlyEditingSlot) {
      return;
    }

    const trimmedLotNum = slotEditForm.lotNum.trim();
    const effectiveLotNum = trimmedLotNum || String(currentlyEditingSlot.lotNum ?? "").trim();
    const slotLabel = effectiveLotNum
      ? `Lot ${effectiveLotNum}`
      : currentlyEditingSlot.unitKey
        ? `Unit ${currentlyEditingSlot.unitKey}`
        : "Selected slot";
    const trimmedLotArea = slotEditForm.lotArea.trim();
    const trimmedPrice = slotEditForm.price.trim();

    if (trimmedLotArea) {
      const parsedLotArea = Number(trimmedLotArea);
      if (!Number.isFinite(parsedLotArea) || parsedLotArea < 0) {
        toast.error("Lot area must be a valid non-negative number.");
        return;
      }
    }

    if (trimmedPrice) {
      const parsedPrice = Number(trimmedPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        toast.error("Slot price must be a valid non-negative number.");
        return;
      }
    }

    setActionError("");
    setSavingDetailSlotId(currentlyEditingSlot.slotId);

    try {
      const nextDetails = {
        lotNum: effectiveLotNum,
        lotArea: trimmedLotArea === "" ? null : Number(trimmedLotArea),
        price: trimmedPrice === "" ? null : Number(trimmedPrice),
        blockNum: slotEditForm.blockNum.trim(),
        phase: slotEditForm.phase.trim(),
        type: slotEditForm.type.trim(),
      };

      await updateSlotDetails(
        currentlyEditingSlot.slotId,
        nextDetails,
        auth.currentUser?.email ?? "admin",
      );

      // Reflect detail edits immediately while awaiting snapshot propagation.
      mergeLocalSlotOverride(currentlyEditingSlot.slotId, {
        ...nextDetails,
        status: currentlyEditingSlot.currentStatus,
        unitKey: currentlyEditingSlot.unitKey,
        sourceKey: currentlyEditingSlot.sourceKey,
        propertyId: currentlyEditingSlot.propertyId,
      });

      toast.success(`${slotLabel} details updated successfully.`);
      setEditingSlotId("");
      setSlotEditForm(EMPTY_EDIT_FORM);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to update details for ${slotLabel.toLowerCase()}.`);
    } finally {
      setSavingDetailSlotId("");
    }
  };

  const handleFilterPanelOpenChange = (nextOpen) => {
    setIsFilterPanelOpen(nextOpen);
    setDraftTableFilters(cloneTableFilters(appliedTableFilters));
  };

  const handleToggleDraftFilterValue = (fieldKey, value) => {
    setDraftTableFilters((prev) => {
      const existingValues = prev[fieldKey] ?? [];
      const nextValues = existingValues.includes(value)
        ? existingValues.filter((item) => item !== value)
        : [...existingValues, value];

      return {
        ...prev,
        [fieldKey]: nextValues,
      };
    });
  };

  const handleSetDraftFieldSelectAll = (fieldKey, shouldSelectAll) => {
    setDraftTableFilters((prev) => ({
      ...prev,
      [fieldKey]: shouldSelectAll ? [...(tableFilterOptions[fieldKey] ?? [])] : [],
    }));
  };

  const handleClearDraftFilters = () => {
    setDraftTableFilters(createEmptyTableFilters());
  };

  const handleApplyDraftFilters = () => {
    setAppliedTableFilters(cloneTableFilters(draftTableFilters));
    setIsFilterPanelOpen(false);
  };

  const handleCancelDraftFilters = () => {
    setDraftTableFilters(cloneTableFilters(appliedTableFilters));
    setIsFilterPanelOpen(false);
  };

  const handleClearAppliedFilters = () => {
    const emptyFilters = createEmptyTableFilters();
    setAppliedTableFilters(emptyFilters);
    setDraftTableFilters(emptyFilters);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: null, direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="w-3.5 h-3.5" />;
    return <ArrowDown className="w-3.5 h-3.5" />;
  };

  const handleToggleFilterField = (fieldKey) => {
    setFilterFields((prev) =>
      prev.map((field) =>
        field.key === fieldKey ? { ...field, enabled: !field.enabled } : field
      )
    );
  };

  return (
      <div className="space-y-6">
        {/* TOP METRICS - Modern accent border cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
          {/* Total Slots */}
          <div className="group bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400 cursor-default">
            <div className="flex items-stretch">
              <div className="w-1.5 bg-[#15803d] rounded-l-2xl" />
              <div className="flex-1 p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Slots</p>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{statusSummary.total}</h2>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">All tracked properties</p>
                </div>
                <CircularProgress percentage={100} color="text-[#15803d]" />
              </div>
            </div>
          </div>

          {/* Available */}
          <div className="group bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400 cursor-default">
            <div className="flex items-stretch">
              <div className="w-1.5 bg-emerald-500 rounded-l-2xl" />
              <div className="flex-1 p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Available</p>
                  <h2 className="text-3xl font-black text-emerald-600 tracking-tight">{statusSummary.available}</h2>
                  <p className="text-[11px] text-emerald-500/70 mt-1 font-medium">Ready to sell</p>
                </div>
                <CircularProgress
                  percentage={statusSummary.total > 0 ? (statusSummary.available / statusSummary.total) * 100 : 0}
                  color="text-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Reserved */}
          <div className="group bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400 cursor-default">
            <div className="flex items-stretch">
              <div className="w-1.5 bg-amber-500 rounded-l-2xl" />
              <div className="flex-1 p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Reserved</p>
                  <h2 className="text-3xl font-black text-amber-600 tracking-tight">{statusSummary.reserved}</h2>
                  <p className="text-[11px] text-amber-500/70 mt-1 font-medium">Pending close</p>
                </div>
                <CircularProgress
                  percentage={statusSummary.total > 0 ? (statusSummary.reserved / statusSummary.total) * 100 : 0}
                  color="text-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Not Available */}
          <div className="group bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400 cursor-default">
            <div className="flex items-stretch">
              <div className="w-1.5 bg-rose-500 rounded-l-2xl" />
              <div className="flex-1 p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Sold</p>
                  <h2 className="text-3xl font-black text-rose-600 tracking-tight">{statusSummary.not_available}</h2>
                  <p className="text-[11px] text-rose-500/70 mt-1 font-medium">Closed deals</p>
                </div>
                <CircularProgress
                  percentage={statusSummary.total > 0 ? (statusSummary.not_available / statusSummary.total) * 100 : 0}
                  color="text-rose-500"
                />
              </div>
            </div>
          </div>
        </section>

        {syncError ? (
          <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{syncError}</span>
          </div>
        ) : null}

        {actionError ? (
          <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        ) : null}

        <section className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_24px_rgb(0,0,0,0.03)] overflow-hidden">
          <div className="border-b border-white/40 px-6 py-5 bg-white/40">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-[#15803d]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#15803d]">Subdivision Plan</p>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Select Slot Availability on Map</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Click any lot area to quickly update status and jump to editing details.
            </p>
          </div>

          <div className="p-5">
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
              <div className="rounded-2xl border border-white/60 overflow-hidden bg-white/50 shadow-inner">
                <div className="relative isolate">
                  <img src={baseMapImg} alt="Vicinity admin map" className="w-full h-auto block" draggable={false} />
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox={`0 0 ${MAP_NATURAL_WIDTH} ${MAP_NATURAL_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {allProperties.map((property) => {
                      const propertySlots = slotsByPropertyId[property.id] ?? [];
                      const orderedPropertySlots = [...propertySlots].sort((slotA, slotB) => {
                        const unitKeyA = String(slotA.unitKey ?? "").trim();
                        const unitKeyB = String(slotB.unitKey ?? "").trim();

                        if (unitKeyA || unitKeyB) {
                          const unitKeyDifference = unitKeyA.localeCompare(unitKeyB, undefined, { numeric: true, sensitivity: "base" });
                          if (unitKeyDifference !== 0) {
                            return unitKeyDifference;
                          }
                        }

                        const lotDifference = extractLotSortValue(slotA.lotNum) - extractLotSortValue(slotB.lotNum);
                        if (lotDifference !== 0) {
                          return lotDifference;
                        }

                        return String(slotA.lotNum).localeCompare(String(slotB.lotNum));
                      });
                      const outlinePolygons = getPropertyOutlinePolygons(property, propertySlots);
                      if (!outlinePolygons.length) {
                        return null;
                      }

                      const areaVisual = getAreaVisual(propertySlots);
                      const hasSlotMappedPolygons = orderedPropertySlots.length > 1 && orderedPropertySlots.length === outlinePolygons.length;

                      return outlinePolygons.map((points, outlineIndex) => {
                        const mappedSlot = hasSlotMappedPolygons ? orderedPropertySlots[outlineIndex] : null;
                        const targetKey = `${property.id}-${outlineIndex}`;
                        const isSelected = mappedSlot
                          ? selectedSlotId === mappedSlot.slotId
                          : selectedPropertyId === property.id && !selectedSlotId;
                        const isHovered = hoveredMapTargetKey === targetKey;
                        const visual = mappedSlot ? getSlotVisual(mappedSlot) : areaVisual;

                        return (
                        <polygon
                          key={targetKey}
                          points={pointsToSvg(points)}
                          fill={isHovered ? visual.hoverFill : visual.fill}
                          stroke={isSelected ? "#111827" : visual.stroke}
                          strokeWidth={isSelected ? 2.5 : 1.2}
                          style={{
                            cursor: "pointer",
                            transition: "fill 0.15s ease, stroke-width 0.15s ease",
                          }}
                          onClick={() => {
                            setSelectedPropertyId(property.id);
                            setSelectedSlotId(mappedSlot?.slotId ?? "");
                          }}
                          onMouseEnter={() => setHoveredMapTargetKey(targetKey)}
                          onMouseLeave={() => setHoveredMapTargetKey("")}
                        />
                        );
                      });
                    })}
                  </svg>
                </div>

                <div className="px-5 py-3 border-t border-white/40 bg-white/40 flex flex-wrap gap-x-6 gap-y-2">
                  {SLOT_STATUS_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${option.dotClass}`} />
                      <span className="text-xs text-slate-500 font-medium">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/50 overflow-hidden shadow-inner flex flex-col">
                {selectedProperty ? (
                  <>
                    <div className="flex items-start gap-3 bg-white/60 border-b border-white/50 px-5 py-4">
                      <div className="flex-shrink-0 w-9 h-9 bg-[#15803d]/10 rounded-xl flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-[#15803d]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#15803d]">Selected Area</p>
                        <h3 className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedSlot?.type || selectedProperty.info?.type || "Property"}
                          {selectedSlot?.unitKey ? ` · Unit ${selectedSlot.unitKey}` : ""}
                          {selectedSlot?.lotNum ? ` · Lot ${selectedSlot.lotNum}` : ""}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Block {selectedSlot?.blockNum || selectedProperty.info?.blockNum} · {selectedSlot?.phase || selectedProperty.info?.phase}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 overflow-y-auto max-h-[460px]">
                      {selectedPropertySlots.map((slot) => (
                        <div key={slot.slotId} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {slot.unitKey ? `Unit ${slot.unitKey} · ` : ""}
                                Lot {slot.lotNum}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {slot.lotArea ? `${slot.lotArea} sqm` : "Area N/A"} | {formatPhp(slot.price)}
                              </p>
                            </div>
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${slot.currentMeta.color}18`, color: slot.currentMeta.color }}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${slot.currentMeta.dotClass}`} />
                              {slot.currentMeta.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={slot.currentStatus}
                              onChange={(event) => handleStatusChange(slot, event.target.value)}
                              disabled={savingSlotId === slot.slotId}
                              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#15803d]/40 focus:border-[#15803d]/50 transition-all shadow-inner ${getStatusSelectClass(slot.currentStatus)}`}
                            >
                              {SLOT_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              className="flex items-center gap-1.5 border border-[#15803d]/20 bg-[#15803d]/10 hover:bg-[#15803d] text-[#15803d] hover:text-white font-semibold text-xs rounded-xl px-3 py-2 transition-all duration-300 disabled:opacity-50"
                              onClick={() => startSlotEdit(slot)}
                              disabled={savingDetailSlotId === slot.slotId}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!selectedPropertySlots.length ? (
                      <p className="p-4 text-sm text-slate-400">No slots were found for this selected area.</p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                    <MapPin className="w-8 h-8 text-slate-300" />
                    <p className="text-sm text-slate-400">Select a slot area on the map to edit availability.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#15803d]">Table Filters</p>
              <p className="text-sm text-slate-500 mt-0.5">Filter table rows using values from any column.</p>
            </div>

            <div className="flex items-center gap-2">
              <Popover open={isFilterSettingsOpen} onOpenChange={setIsFilterSettingsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-slate-200 text-slate-600"
                  >
                    <Settings className="w-4 h-4" />
                    Customize
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[280px] p-0 border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-white">
                    <p className="text-sm font-bold text-slate-800">Filter Categories</p>
                    <p className="text-[11px] text-slate-500">Enable/disable filter options</p>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto px-4 py-3 space-y-2 bg-slate-50/40">
                    {filterFields.map((field) => (
                      <label key={field.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white/60 p-2 rounded-lg transition-colors">
                        <Checkbox
                          checked={field.enabled}
                          onCheckedChange={() => handleToggleFilterField(field.key)}
                          className="border-slate-300 data-[state=checked]:bg-[#15803d] data-[state=checked]:border-[#15803d]"
                        />
                        <span className="font-medium">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {activeFilterValueCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearAppliedFilters}
                  className="h-9 rounded-xl border-slate-200 text-slate-600"
                >
                  Clear Active
                </Button>
              ) : null}

              <Popover open={isFilterPanelOpen} onOpenChange={handleFilterPanelOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    className="h-9 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white px-4"
                  >
                    <Filter className="w-4 h-4" />
                    Filter
                    {activeFilterFieldCount > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white text-[#15803d] text-[11px] font-bold">
                        {activeFilterFieldCount}
                      </span>
                    ) : null}
                  </Button>
                </PopoverTrigger>

                <PopoverContent align="end" className="w-[420px] p-0 border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Filter</p>
                      <p className="text-[11px] text-slate-500">Select values to include in the table.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDraftFilters}
                      className="text-xs font-semibold text-[#15803d] hover:underline"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/40">
                    {enabledFilterFields.map((field) => {
                      const options = tableFilterOptions[field.key] ?? [];
                      const selectedValues = draftTableFilters[field.key] ?? [];
                      const allSelected = options.length > 0 && selectedValues.length === options.length;

                      return (
                        <div key={field.key} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{field.label}</p>
                            <button
                              type="button"
                              onClick={() => handleSetDraftFieldSelectAll(field.key, !allSelected)}
                              disabled={!options.length}
                              className="text-[11px] font-semibold text-slate-500 hover:text-[#15803d] disabled:opacity-40"
                            >
                              {allSelected ? "Unselect All" : "Select All"}
                            </button>
                          </div>

                          <div className="mt-2 max-h-28 overflow-y-auto pr-1 space-y-1.5">
                            {!options.length ? (
                              <p className="text-xs text-slate-400">No options available.</p>
                            ) : (
                              options.map((optionValue) => (
                                <label key={`${field.key}-${optionValue}`} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <Checkbox
                                    checked={selectedValues.includes(optionValue)}
                                    onCheckedChange={() => handleToggleDraftFilterValue(field.key, optionValue)}
                                    className="border-slate-300 data-[state=checked]:bg-[#15803d] data-[state=checked]:border-[#15803d]"
                                  />
                                  <span className="truncate">{optionValue}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCancelDraftFilters} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleApplyDraftFilters} className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white">
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {activeFilterValueCount > 0 ? (
            <p className="text-xs text-slate-500">
              Active selections: <span className="font-semibold text-slate-700">{activeFilterValueCount}</span>
            </p>
          ) : null}

          <div className="overflow-x-auto border border-white/60 rounded-2xl shadow-inner bg-white/40">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#15803d] text-white">
                  <th className="text-left font-bold px-5 py-4 text-xs tracking-wider rounded-tl-2xl">
                    <button onClick={() => handleSort('unit')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      UNIT {getSortIcon('unit')}
                    </button>
                  </th>
                  <th className="text-left font-semibold px-4 py-3 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('lotNum')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      LOT {getSortIcon('lotNum')}
                    </button>
                  </th>
                  <th className="text-left font-semibold px-4 py-3 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('blockNum')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      BLOCK {getSortIcon('blockNum')}
                    </button>
                  </th>
                  <th className="text-left font-semibold px-4 py-3 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('phase')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      PHASE {getSortIcon('phase')}
                    </button>
                  </th>
                  <th className="text-left font-semibold px-4 py-3 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('price')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      PRICE {getSortIcon('price')}
                    </button>
                  </th>
                  <th className="text-left font-semibold px-4 py-3 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('type')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      TYPE {getSortIcon('type')}
                    </button>
                  </th>
                  <th className="text-left font-semibold px-4 py-3 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('status')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      STATUS {getSortIcon('status')}
                    </button>
                  </th>
                  <th className="text-left font-semibold px-4 py-3 text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort('lotArea')} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                      FLOOR AREA {getSortIcon('lotArea')}
                    </button>
                  </th>
                  <th className="text-left font-bold px-5 py-4 text-xs tracking-wider">Edit</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/40">
                {paginatedSlots.map((slot, rowIndex) => (
                  <tr
                    key={slot.slotId}
                    onClick={() => setSelectedPropertyId(slot.propertyId)}
                    className="hover:bg-white/60 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{slot.unitKey ? `Unit ${slot.unitKey}` : "-"}</td>
                    <td className="px-5 py-3.5 text-slate-800 font-bold">{slot.lotNum}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{slot.blockNum || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{slot.phase || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{slot.price !== null ? formatPhp(slot.price) : "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{slot.type || "-"}</td>
                    <td className="px-5 py-3.5">
                      <select
                        value={slot.currentStatus}
                        onChange={(event) => handleStatusChange(slot, event.target.value)}
                        disabled={savingSlotId === slot.slotId}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all shadow-inner disabled:opacity-60 ${getStatusSelectClass(slot.currentStatus)}`}
                      >
                        {SLOT_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{slot.lotArea ? `${slot.lotArea} m2` : "-"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 border border-[#15803d]/20 bg-[#15803d]/10 hover:bg-[#15803d] text-[#15803d] hover:text-white font-semibold text-xs rounded-xl px-3 py-1.5 transition-all duration-300 disabled:opacity-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          startSlotEdit(slot, { scrollToEditor: true });
                        }}
                        disabled={savingDetailSlotId === slot.slotId}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/40 pt-5 mt-2">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="font-semibold text-slate-600">{paginatedSlots.length}</span> of{" "}
              <span className="font-semibold text-slate-600">{sortedAndFilteredSlots.length}</span> filtered slots {"-"} Page{" "}
              <span className="font-semibold text-slate-600">{currentPage}</span> of{" "}
              <span className="font-semibold text-slate-600">{totalPages}</span>
            </p>

            <Pagination className="justify-end w-auto mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage <= 1}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50 text-xs gap-1 h-8 pl-2" : "cursor-pointer text-xs gap-1 h-8 pl-2"}
                  />
                </PaginationItem>
                
                {(() => {
                    const maxPagesToShow = 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

                    if (endPage - startPage + 1 < maxPagesToShow) {
                      startPage = Math.max(1, endPage - maxPagesToShow + 1);
                    }

                    const pages = [];
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(i);
                    }
                    if (pages.length === 0) pages.push(1);

                    return pages.map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink 
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className="cursor-pointer text-xs w-8 h-8 font-semibold"
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    ));
                })()}

                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50 text-xs gap-1 h-8 pr-2" : "cursor-pointer text-xs gap-1 h-8 pr-2"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </section>

{currentlyEditingSlot ? (
        <Dialog open={!!currentlyEditingSlot} onOpenChange={(open) => { if (!open) cancelSlotEdit(); }}>
          <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-white border-slate-200 shadow-2xl rounded-3xl outline-none" aria-describedby="edit-slot-description">
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-extrabold text-slate-800">
                  Edit Slot Details
                </DialogTitle>
                <DialogDescription id="edit-slot-description" className="text-xs text-slate-500 font-medium mt-1">
                  {currentlyEditingSlot?.unitKey ? `Unit ${currentlyEditingSlot.unitKey} - ` : ""}
                  Lot {currentlyEditingSlot?.lotNum}
                </DialogDescription>
              </div>
            </div>

            <div className="px-6 py-6 pb-2">
              <div className="grid sm:grid-cols-3 gap-5">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Lot Number</span>
                  <input
                    value={slotEditForm.lotNum}
                    onChange={(event) => handleSlotEditField("lotNum", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Lot Area (sqm)</span>
                  <input
                    value={slotEditForm.lotArea}
                    onChange={(event) => handleSlotEditField("lotArea", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Slot Price (PHP)</span>
                  <input
                    value={slotEditForm.price}
                    onChange={(event) => handleSlotEditField("price", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-3 gap-5 mt-5">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Block</span>
                  <input
                    value={slotEditForm.blockNum}
                    onChange={(event) => handleSlotEditField("blockNum", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Phase</span>
                  <input
                    value={slotEditForm.phase}
                    onChange={(event) => handleSlotEditField("phase", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Property Type</span>
                  <select
                    value={slotEditForm.type}
                    onChange={(event) => handleSlotEditField("type", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white shadow-sm px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all"
                  >
                    <option value="">Select property type</option>
                    {propertyTypeOptions.map((propertyType) => (
                      <option key={propertyType.value} value={propertyType.value}>
                        {propertyType.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <DialogFooter className="bg-white px-6 py-5 mt-4 border-t border-slate-100 flex items-center justify-end gap-2 sm:justify-end">
              <button
                type="button"
                className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors min-w-[100px]"
                onClick={cancelSlotEdit}
                disabled={savingDetailSlotId === currentlyEditingSlot.slotId}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2.5 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 min-w-[140px] shadow-sm shadow-[#15803d]/10"
                onClick={handleSlotDetailsSave}
                disabled={savingDetailSlotId === currentlyEditingSlot.slotId}
              >
                <Save className="w-4 h-4" />
                {savingDetailSlotId === currentlyEditingSlot.slotId ? "Saving..." : "Save Details"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      </div>
  );
}
