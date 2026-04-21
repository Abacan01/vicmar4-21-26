import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { Bed, Bath, Square, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import fallbackCardImage from "@/images/hero-properties.jpg";
import { resolvePropertyPanoramaSources } from "@/lib/panoramaTour";

const typeLabels = {
  single_attached_unit_deluxe: "Single Attached Deluxe",
  single_attached_unit_standard: "Single Attached Standard",
  duplex: "Duplex",
  triplex: "Triplex",
  rowhouse: "Rowhouse",
  townhouse: "Townhouse",
  bungalow: "Bungalow",
  lot_only: "Lot Only",
};

const statusColors = {
  available: "bg-green-500",
  sold: "bg-red-500",
  reserved: "bg-yellow-500",
};

function getSplitUnitGuideConfig(property) {
  if (!property) {
    return null;
  }

  const propertyType = String(property.property_type ?? "").toLowerCase();
  const title = String(property.title ?? "").toLowerCase();
  const isDuplex = propertyType === "duplex" || title.includes("duplex");

  if (!isDuplex) {
    return null;
  }

  const isDeluxe = title.includes("deluxe");
  const isPremiere = title.includes("premiere");

  return {
    leftLabel: "Deluxe",
    rightLabel: "Premiere",
    selectedSide: isDeluxe ? "left" : isPremiere ? "right" : null,
  };
}

function SplitUnitGuideOverlay({ config }) {
  const selectedSide = config?.selectedSide ?? null;
  const leftLabel = config?.leftLabel ?? "Left Unit";
  const rightLabel = config?.rightLabel ?? "Right Unit";

  const leftSideClass = selectedSide === "left"
    ? "bg-emerald-500/18"
    : selectedSide === "right"
      ? "bg-slate-950/40"
      : "bg-slate-950/25";

  const rightSideClass = selectedSide === "right"
    ? "bg-emerald-500/18"
    : selectedSide === "left"
      ? "bg-slate-950/40"
      : "bg-slate-950/25";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/10" />
      <div className={`absolute inset-y-0 left-0 w-1/2 ${leftSideClass}`} />
      <div className={`absolute inset-y-0 right-0 w-1/2 ${rightSideClass}`} />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] bg-white/90 shadow-[0_0_0_1px_rgba(15,23,42,0.15)]" />

      <div className={`absolute bottom-2 left-2 rounded-full text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wide shadow-sm ${selectedSide === "left" ? "bg-emerald-600/95" : "bg-slate-600/95"}`}>
        {leftLabel}
      </div>
      <div className={`absolute bottom-2 right-2 rounded-full text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wide shadow-sm ${selectedSide === "right" ? "bg-emerald-600/95" : "bg-slate-600/95"}`}>
        {rightLabel}
      </div>
    </div>
  );
}

export default function PropertyCard({ property, showTourButtons = false, singleActionMode = false }) {
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState(null);
  const splitGuideConfig = getSplitUnitGuideConfig(property);
  const formatPrice = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return "Contact for price";
    }

    return new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      maximumFractionDigits: 0 
    }).format(numericValue);
  };

  const propertyDetailUrl = createPageUrl("PropertyDetail") + `?id=${property.id}`;
  const tours = showTourButtons && !singleActionMode ? resolvePropertyPanoramaSources(property) : null;
  const initialTourType = tours ? (tours.hasExterior ? "exterior" : "interior") : "interior";
  const tourEntryUrl = `${propertyDetailUrl}&tour=${initialTourType}`;

  return (
    <div className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full flex flex-col">
      <Link to={propertyDetailUrl} className="block flex-1">
        {/* Image */}
        <div className="relative h-72 overflow-hidden">
          <img
            src={property.main_image || fallbackCardImage}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="bg-[#16a34a] hover:bg-[#22c55e] text-white font-semibold px-6 py-3 rounded-lg transform transition-all duration-300 hover:scale-105 shadow-lg">
              {singleActionMode ? "Open Unit" : "View Property"}
            </span>
          </div>

          {/* Status Badge: hide label for available/reserved per request */}
          <Badge className={`absolute top-4 left-4 ${statusColors[property.status]} text-white border-0`}> 
            {!["available", "reserved"].includes(property.status) ? property.status : null}
          </Badge>

          {/* Property Type */}
          <div className="absolute bottom-4 left-4 right-4">
            <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
              {typeLabels[property.property_type] || property.property_type}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="font-bold text-xl text-[#16a34a] mb-2 line-clamp-1 group-hover:text-[#16a34a] transition-colors">
            {property.title}
          </h3>

          {property.location && (
            <p className="text-gray-500 text-sm mb-4 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {property.location}
            </p>
          )}

          {!singleActionMode && property.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {property.description}
            </p>
          )}

          {/* Single large floor plan preview with next/prev controls */}
          {!singleActionMode && property.floor_plans && (
            <FloorPreview property={property} setSelectedFloorPlan={setSelectedFloorPlan} setShowFloorPlan={setShowFloorPlan} />
          )}

          {/* Price */}
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Price</p>
            <p className="text-[#16a34a] font-bold text-2xl">{formatPrice(property.price)}</p>
          </div>

          {/* Features */}
          <div className="flex items-center gap-4 text-gray-500 text-sm border-t pt-4">
            {property.bedrooms && (
              <div className="flex items-center gap-1">
                <Bed className="w-4 h-4" />
                <span>{property.bedrooms} Beds</span>
              </div>
            )}
            {property.bathrooms && (
              <div className="flex items-center gap-1">
                <Bath className="w-4 h-4" />
                <span>{property.bathrooms} Baths</span>
              </div>
            )}
            {property.floor_area && (
              <div className="flex items-center gap-1">
                <Square className="w-4 h-4" />
                <span>{property.floor_area} sqm</span>
              </div>
            )}
          </div>

          {singleActionMode && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <span className="inline-flex w-full items-center justify-center rounded-full bg-[#16a34a] text-white font-semibold text-sm px-4 py-2.5 transition-colors group-hover:bg-[#22c55e]">
                View Unit Details
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Quick floor-plan button - stops propagation so it goes directly to floor plan view */}
      {!singleActionMode && property.floor_plans && (
        <div className="px-6 pb-6 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const plan = property.floor_plans.groundFloor || Object.values(property.floor_plans)[0];
              setSelectedFloorPlan(plan);
              setShowFloorPlan(true);
            }}
            className="inline-flex items-center justify-center rounded-full bg-[#16a34a] text-white hover:bg-[#22c55e] font-semibold text-sm px-3 py-1.5 transition-colors"
            aria-label="View Floor Plan"
          >
            View Floor Plan
          </button>
        </div>
      )}

      <Dialog open={showFloorPlan} onOpenChange={setShowFloorPlan}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="px-5 pt-4 pb-2">
            <DialogTitle className="text-base font-semibold">{selectedFloorPlan?.label || "Floor Plan"}</DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center overflow-hidden bg-black/95 rounded-xl p-4 min-h-[48vh]">
            <img
              src={selectedFloorPlan?.image}
              alt="Floor Plan"
              className="block max-w-full max-h-[70vh] w-auto h-auto object-contain"
            />
            {splitGuideConfig ? <SplitUnitGuideOverlay config={splitGuideConfig} /> : null}
          </div>
        </DialogContent>
      </Dialog>

      {showTourButtons && !singleActionMode && (
        <div className="px-6 pb-6 pt-1">
          <Link
            to={tourEntryUrl}
            className="inline-flex items-center justify-center rounded-full bg-[#16a34a] text-white hover:bg-[#22c55e] font-semibold text-xs px-3 py-1.5 transition-colors"
          >
            View 360 Tour
          </Link>
        </div>
      )}
    </div>
  );
}

function FloorPreview({ property, setSelectedFloorPlan, setShowFloorPlan }) {
  const [index, setIndex] = useState(0);

  // build ordered array: groundFloor, secondFloor, then any others
  const plans = [];
  if (property.floor_plans?.groundFloor) plans.push(property.floor_plans.groundFloor);
  if (property.floor_plans?.secondFloor) plans.push(property.floor_plans.secondFloor);
  const otherPlans = Object.entries(property.floor_plans || {}).filter(
    ([k]) => k !== "groundFloor" && k !== "secondFloor"
  ).map(([, v]) => v);
  otherPlans.forEach(p => plans.push(p));

  if (plans.length === 0) return null;

  const current = plans[Math.max(0, Math.min(index, plans.length - 1))];

  const prev = (e) => { e?.preventDefault(); e?.stopPropagation(); setIndex((i) => (i - 1 + plans.length) % plans.length); };
  const next = (e) => { e?.preventDefault(); e?.stopPropagation(); setIndex((i) => (i + 1) % plans.length); };

  return (
    <div className="mb-4">
      <p className="text-sm text-gray-500 mb-2">Floor Plan</p>
      <div className="relative rounded-md border overflow-hidden bg-white">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedFloorPlan(current); setShowFloorPlan(true); }}
          className="w-full h-64 md:h-80 lg:h-96 overflow-hidden flex items-center justify-center"
          aria-label={`Open ${current.label || "Floor"} plan`}
        >
          <img src={current.image} alt={current.label || "Floor Plan"} className="max-h-full max-w-full object-contain block" />
        </button>
        {splitGuideConfig ? <SplitUnitGuideOverlay config={splitGuideConfig} /> : null}

        {plans.length > 1 && (
          <>
            <button type="button" onClick={prev} aria-label="Previous floor" className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={next} aria-label="Next floor" className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-center text-sm text-white py-1">{current.label || `Floor ${index + 1}`}</div>
      </div>
    </div>
  );
}
