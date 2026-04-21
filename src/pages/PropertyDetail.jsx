import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bed, Bath, Square, MapPin, ArrowLeft, Phone,
  ChevronLeft, ChevronRight, Check, Maximize, Eye, MessageCircle
} from "lucide-react";
import PanoramaViewer from "@/components/shared/PanoramaViewer";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { getPropertyByIdWithLivePrice, subscribeToPropertyPriceOverrides } from "@/lib/propertyPriceService";
import fallbackPropertyImage from "@/images/hero-properties.jpg";
import propertyMapImage from "@/images/properties_map/baseMap2.jpg";
import { resolvePropertyPanoramaSources } from "@/lib/panoramaTour";

const typeLabels = {
  duplex: "Duplex",
  triplex: "Triplex",
  rowhouse: "Rowhouse",
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

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useScrollReveal({ threshold: 0.08, triggerOnce: true });
  return (
    <div
      ref={ref}
      className={`scroll-reveal-init ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export default function PropertyDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const propertyId = urlParams.get("id");
  const sourcePage = String(urlParams.get("from") ?? "");
  const sourceType = String(urlParams.get("type") ?? "").toLowerCase().trim();
  const requestedTourParam = urlParams.get("tour");
  const requestedShowFloor = urlParams.get("showFloorPlan");
  const requestedFloorKey = urlParams.get("floor");
  const requestedTourType = requestedTourParam === "interior" ? "interior" : "exterior";
  const queryClient = useQueryClient();

  const cameFromTypeUnits = sourcePage === "PropertyTypeUnits" && Boolean(sourceType);
  const backUrl = cameFromTypeUnits
    ? `${createPageUrl("PropertyTypeUnits")}?type=${encodeURIComponent(sourceType)}`
    : createPageUrl("Properties");
  const backLabel = cameFromTypeUnits ? "Back to Unit Listings" : "Back to Properties";

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [activeTourType, setActiveTourType] = useState(requestedTourType);
  const [didAutoOpenRequestedTour, setDidAutoOpenRequestedTour] = useState(false);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState(null);

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => getPropertyByIdWithLivePrice(propertyId),
    enabled: !!propertyId,
  });

  useEffect(() => {
    const unsubscribe = subscribeToPropertyPriceOverrides(
      () => {
        queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      },
      (error) => {
        console.error(error);
      },
    );

    return unsubscribe;
  }, [propertyId, queryClient]);

  useEffect(() => {
    if (didAutoOpenRequestedTour || !property) {
      return;
    }

    if (requestedTourParam === "interior" || requestedTourParam === "exterior") {
      setActiveTourType(requestedTourType);
      setShowVirtualTour(true);
      setDidAutoOpenRequestedTour(true);
    }
  }, [didAutoOpenRequestedTour, property, requestedTourParam, requestedTourType]);

  useEffect(() => {
    if (!property) return;
    if (requestedShowFloor === "true") {
      let plan = null;
      if (requestedFloorKey && property.floor_plans && property.floor_plans[requestedFloorKey]) {
        plan = property.floor_plans[requestedFloorKey];
      } else if (property.floor_plans) {
        plan = property.floor_plans.groundFloor || Object.values(property.floor_plans)[0];
      }

      if (plan) {
        setSelectedFloorPlan(plan);
        setShowFloorPlan(true);
      }
    }
  }, [property, requestedShowFloor, requestedFloorKey]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#16a34a] border-t-transparent" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Property not found</h1>
        <Link to={createPageUrl("Properties")}>
          <Button className="bg-[#16a34a] hover:bg-[#22c55e]">Back to Properties</Button>
        </Link>
      </div>
    );
  }

  const allImages = [property.main_image, ...(property.gallery_images || [])].filter(Boolean);
  if (allImages.length === 0) {
    allImages.push(fallbackPropertyImage);
  }

  const tours = resolvePropertyPanoramaSources(property);
  const defaultTourType = tours.hasExterior ? "exterior" : "interior";
  const activeTourSource = activeTourType === "interior" ? tours.interior : tours.exterior;

  const formatPrice = (value) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);

  const inquireUrl = createPageUrl("ContactUs") + `?property=${encodeURIComponent(property.title)}`;

  const statusConfig = {
    available: { label: "For Sale", className: "bg-green-500 text-white border-0" },
    reserved:  { label: "Reserved", className: "bg-amber-500 text-white border-0" },
    sold:      { label: "Sold",     className: "bg-red-500 text-white border-0" },
  };
  const status = statusConfig[property.status] || statusConfig.available;
  const splitGuideConfig = getSplitUnitGuideConfig(property);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <style>{`
        @keyframes galleryFade {
          from { opacity: 0.4; transform: scale(1.02); }
          to   { opacity: 1;   transform: scale(1); }
        }
        .gallery-img { animation: galleryFade 0.4s ease both; }
        .spec-pill {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; background: #f0fdf4;
          border: 1px solid #bbf7d0; border-radius: 999px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .spec-pill:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(22,101,52,0.10); }
        .feat-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px;
          transition: background 0.2s ease;
        }
        .feat-item:hover { background: #f0fdf4; }
        .floor-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .floor-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(22,101,52,0.12); }
        .sticky-bar {
          animation: stickySlideUp 0.4s ease both;
        }
        @keyframes stickySlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>

      {/* Back Bar */}
      <div className="bg-white border-b border-gray-100 page-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-[#16a34a] transition-colors text-xs sm:text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
          <div className="flex items-center gap-2">
            <Badge className={`${status.className} text-xs px-2 py-0.5`}>{status.label}</Badge>
            <Badge variant="outline" className="text-[#16a34a] border-[#16a34a]/30 text-xs px-2 py-0.5">
              {typeLabels[property.property_type] || property.property_type}
            </Badge>
          </div>
        </div>
      </div>

      {/* Cinematic Gallery */}
      <div className="relative bg-black flex items-center justify-center" style={{ height: "clamp(320px, 55vh, 600px)" }}>
        <img
          key={currentImageIndex}
          src={allImages[currentImageIndex]}
          alt={property.title}
          className="gallery-img w-full h-full object-contain opacity-100 object-center"
        />

        {/* Dark gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        {/* Nav arrows */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {/* Bottom overlay info */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-5 flex items-end justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{property.title}</h1>
            {property.location && (
              <p className="text-white/75 text-sm flex items-center gap-1.5 mt-1">
                <MapPin className="w-4 h-4" />
                {property.location}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[#86efac]">{formatPrice(property.price)}</p>
          </div>
        </div>

        {/* Counter + expand */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="bg-black/50 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
            {currentImageIndex + 1} / {allImages.length}
          </span>
          <button
            onClick={() => setShowGallery(true)}
            className="bg-black/50 hover:bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm transition-colors"
          >
            <Maximize className="w-3.5 h-3.5" />
            All Photos
          </button>
        </div>
      </div>

      {/* Thumbnail Strip */}
      {allImages.length > 1 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 py-3 overflow-x-auto scrollbar-hide">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentImageIndex ? "border-[#16a34a] opacity-100" : "border-transparent opacity-60 hover:opacity-90"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Specs Bar */}
        {(property.bedrooms || property.bathrooms || property.floor_area || property.lot_area) && (
          <Reveal>
            <div className="flex flex-wrap gap-3">
              {property.bedrooms && (
                <div className="spec-pill">
                  <Bed className="w-4 h-4 text-[#16a34a]" />
                  <span className="text-sm font-semibold text-[#16a34a]">{property.bedrooms} Bedrooms</span>
                </div>
              )}
              {property.bathrooms && (
                <div className="spec-pill">
                  <Bath className="w-4 h-4 text-[#16a34a]" />
                  <span className="text-sm font-semibold text-[#16a34a]">{property.bathrooms} Bathrooms</span>
                </div>
              )}
              {property.floor_area && (
                <div className="spec-pill">
                  <Square className="w-4 h-4 text-[#16a34a]" />
                  <span className="text-sm font-semibold text-[#16a34a]">{property.floor_area} sqm Floor Area</span>
                </div>
              )}
              {property.lot_area && (
                <div className="spec-pill">
                  <Square className="w-4 h-4 text-[#16a34a]" />
                  <span className="text-sm font-semibold text-[#16a34a]">{property.lot_area} sqm Lot Area</span>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* Quick Actions */}
        <Reveal>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setActiveTourType(defaultTourType);
                setShowVirtualTour(true);
              }}
              className="bg-[#16a34a] hover:bg-[#16a34a]/90 gap-2 rounded-full px-6"
            >
              <Eye className="w-4 h-4" />
              View 360 Tour
            </Button>
          </div>
        </Reveal>

        {/* Description */}
        {property.description && (
          <Reveal>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <p className="text-[#16a34a] text-xs font-semibold uppercase tracking-widest mb-2">About This Property</p>
              <h2 className="text-xl font-bold text-[#16a34a] mb-4">Description</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
            </div>
          </Reveal>
        )}

        {/* Features */}
        {property.features?.length > 0 && (
          <Reveal>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <p className="text-[#16a34a] text-xs font-semibold uppercase tracking-widest mb-2">Inclusions</p>
              <h2 className="text-xl font-bold text-[#16a34a] mb-5">Features & Amenities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                {property.features.map((feature, idx) => (
                  <div key={idx} className="feat-item" style={{ transitionDelay: `${idx * 30}ms` }}>
                    <div className="w-5 h-5 bg-[#16a34a] rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-gray-600 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {/* Floor Plans */}
        {property.floor_plans && (
          <Reveal>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <p className="text-[#16a34a] text-xs font-semibold uppercase tracking-widest mb-2">Layout</p>
              <h2 className="text-xl font-bold text-[#16a34a] mb-5">Floor Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {property.floor_plans.groundFloor && (
                  <div
                    className="floor-card cursor-pointer group"
                    onClick={() => { setSelectedFloorPlan(property.floor_plans.groundFloor); setShowFloorPlan(true); }}
                  >
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 group-hover:border-[#16a34a] transition-colors">
                      <img
                        src={property.floor_plans.groundFloor.image}
                        alt="Ground Floor Plan"
                        className="w-full h-auto object-contain max-h-[60vh] transition-transform duration-400"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                        <Maximize className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {splitGuideConfig ? <SplitUnitGuideOverlay config={splitGuideConfig} /> : null}
                    </div>
                    <p className="mt-2.5 text-center text-sm font-semibold text-[#16a34a]">
                      {property.floor_plans.groundFloor.label || "Ground Floor"}
                    </p>
                  </div>
                )}
                {property.floor_plans.secondFloor && (
                  <div
                    className="floor-card cursor-pointer group"
                    onClick={() => { setSelectedFloorPlan(property.floor_plans.secondFloor); setShowFloorPlan(true); }}
                  >
                    <div className="relative overflow-hidden rounded-xl border border-gray-200 group-hover:border-[#16a34a] transition-colors">
                      <img
                        src={property.floor_plans.secondFloor.image}
                        alt="Second Floor Plan"
                        className="w-full h-auto object-contain max-h-[60vh] transition-transform duration-400"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                        <Maximize className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {splitGuideConfig ? <SplitUnitGuideOverlay config={splitGuideConfig} /> : null}
                    </div>
                    <p className="mt-2.5 text-center text-sm font-semibold text-[#16a34a]">
                      {property.floor_plans.secondFloor.label || "Second Floor"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        )}

        {/* Map */}
        {property.latitude && property.longitude && (
          <Reveal>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <p className="text-[#16a34a] text-xs font-semibold uppercase tracking-widest mb-2">Where It Is</p>
              <h2 className="text-xl font-bold text-[#16a34a] mb-5">Location</h2>
              <div className="h-80 rounded-xl overflow-hidden border border-gray-100">
                <div className="relative h-full w-full">
                  <img
                    src={propertyMapImage}
                    alt="Vicmar Homes location map"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="text-center text-white px-4">
                      <p className="text-lg font-bold mb-2">{property.title}</p>
                      <p className="text-sm mb-4">Latitude: {property.latitude}, Longitude: {property.longitude}</p>
                      <a
                        href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#16a34a] hover:bg-[#22c55e] rounded-lg font-semibold text-sm transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                        Open in Google Maps
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* ── Sticky Bottom Action Bar ── */}
      <div className="sticky-bar fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
          <div className="hidden md:block flex-1 min-w-0">
            <p className="font-bold text-[#16a34a] truncate text-sm">{property.title}</p>
            <p className="text-[#16a34a] font-bold text-lg leading-tight">{formatPrice(property.price)}</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <a href="tel:+63432332050">
              <Button
                variant="outline"
                className="gap-2 rounded-full border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a]/5"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Call Us</span>
              </Button>
            </a>
            <Link to={inquireUrl}>
              <Button className="bg-[#16a34a] hover:bg-[#22c55e] gap-2 rounded-full px-6 shadow-lg">
                <MessageCircle className="w-4 h-4" />
                Send Inquiry
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Gallery Modal */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Photo Gallery</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <div className="w-full max-h-[70vh] overflow-hidden rounded-lg bg-black">
              <img src={allImages[currentImageIndex]} alt="" className="w-full h-full object-cover" />
            </div>
            {allImages.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pt-4">
            {allImages.map((img, idx) => (
              <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${idx === currentImageIndex ? "border-[#16a34a]" : "border-transparent"}`}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Virtual Tour Modal */}
      <Dialog open={showVirtualTour} onOpenChange={setShowVirtualTour}>
        <DialogContent className="max-w-6xl w-[95vw] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>360° {activeTourType === "interior" ? "Interior" : "Exterior"} Tour — {property.title}</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-3 flex flex-wrap items-center gap-2 border-b border-gray-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tour Type</span>
            <Button
              type="button"
              size="sm"
              variant={activeTourType === "exterior" ? "default" : "outline"}
              className={activeTourType === "exterior" ? "bg-[#16a34a] hover:bg-[#16a34a]/90" : "border-[#16a34a]/40 text-[#16a34a]"}
              onClick={() => setActiveTourType("exterior")}
            >
              Exterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTourType === "interior" ? "default" : "outline"}
              className={activeTourType === "interior" ? "bg-[#16a34a] hover:bg-[#16a34a]/90" : "border-[#16a34a]/40 text-[#16a34a]"}
              onClick={() => setActiveTourType("interior")}
            >
              Interior
            </Button>
          </div>
          <div className="w-full h-[70vh]">
            {activeTourSource ? (
              <PanoramaViewer src={activeTourSource} alt={`360° ${activeTourType} view of ${property.title}`} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
                No 360 image found for this unit.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Floor Plan Modal */}
      <Dialog open={showFloorPlan} onOpenChange={setShowFloorPlan}>
        <DialogContent className="max-w-4xl w-[96vw] h-[90vh] !p-0 gap-0 overflow-hidden bg-white/95 border-slate-200 shadow-2xl backdrop-blur-xl">
          <div className="flex h-full w-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-900">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Floor Plan</p>
                <h2 className="text-lg font-bold">{selectedFloorPlan?.label || "Floor Plan"}</h2>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-100 p-4">
              <img
                src={selectedFloorPlan?.image}
                alt="Floor Plan"
                className="block h-full w-full object-contain"
              />
              {splitGuideConfig ? <SplitUnitGuideOverlay config={splitGuideConfig} /> : null}
            </div>

            {property.floor_plans && Object.keys(property.floor_plans).length > 1 && (
              <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex gap-4">
                  {property.floor_plans.groundFloor && (
                    <Button
                      variant={selectedFloorPlan === property.floor_plans.groundFloor ? "default" : "outline"}
                      onClick={() => setSelectedFloorPlan(property.floor_plans.groundFloor)}
                      className="flex-1"
                    >
                      {property.floor_plans.groundFloor.label || "Ground Floor"}
                    </Button>
                  )}
                  {property.floor_plans.secondFloor && (
                    <Button
                      variant={selectedFloorPlan === property.floor_plans.secondFloor ? "default" : "outline"}
                      onClick={() => setSelectedFloorPlan(property.floor_plans.secondFloor)}
                      className="flex-1"
                    >
                      {property.floor_plans.secondFloor.label || "Second Floor"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


