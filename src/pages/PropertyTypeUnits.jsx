import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bath,
  Bed,
  MapPin,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from "../utils";
import {
  getPropertiesWithLivePrices,
  subscribeToPropertyPriceOverrides,
} from "@/lib/propertyPriceService";
import { resolvePropertyPanoramaSources } from "@/lib/panoramaTour";
import PanoramaViewer from "@/components/shared/PanoramaViewer";
import fallbackPropertyImage from "@/images/hero-properties.jpg";

const TYPE_META = {
  duplex: {
    label: "Duplex Units",
    description: "Browse available duplex units with key information visible right away.",
  },
  triplex: {
    label: "Triplex Units",
    description: "Browse available triplex units with key information visible right away.",
  },
  rowhouse: {
    label: "Rowhouse Units",
    description: "Browse available rowhouse units with key information visible right away.",
  },
};

const TYPE_LABELS = {
  duplex: "Duplex",
  triplex: "Triplex",
  rowhouse: "Rowhouse",
};

const STATUS_LABELS = {
  available: "For Sale",
  reserved: "Reserved",
  sold: "Sold",
};

const STATUS_BADGE_CLASS = {
  available: "bg-green-500 text-white border-0",
  reserved: "bg-amber-500 text-white border-0",
  sold: "bg-red-500 text-white border-0",
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

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Contact for price";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPropertyImages(property) {
  const images = [
    property.main_image,
    property.images?.main,
    ...(Array.isArray(property.gallery_images) ? property.gallery_images : []),
    ...(Array.isArray(property.images?.interior) ? property.images.interior : []),
    ...(Array.isArray(property.images?.exterior) ? property.images.exterior : []),
    ...(Array.isArray(property.interior) ? property.interior : []),
    ...(Array.isArray(property.exterior) ? property.exterior : []),
  ].filter(Boolean);

  return [...new Set(images)].length > 0 ? [...new Set(images)] : [fallbackPropertyImage];
}

function getExteriorImage(property) {
  return getPropertyImages(property)[0] || fallbackPropertyImage;
}

function getExteriorImages(property) {
  const exteriorImages = [
    property.main_image,
    property.images?.main,
    ...(Array.isArray(property.images?.exterior) ? property.images.exterior : []),
    ...(Array.isArray(property.exterior) ? property.exterior : []),
  ].filter(Boolean);

  return exteriorImages.length > 0 ? [...new Set(exteriorImages)] : [fallbackPropertyImage];
}

function getInteriorImages(property) {
  const interiorImages = [
    ...(Array.isArray(property.images?.interior) ? property.images.interior : []),
    ...(Array.isArray(property.interior) ? property.interior : []),
  ].filter(Boolean);

  if (interiorImages.length > 0) {
    return [...new Set(interiorImages)];
  }

  return getPropertyImages(property).slice(1);
}

function getGalleryImages(property, galleryScope = "interior") {
  if (galleryScope === "exterior") {
    return getExteriorImages(property);
  }

  if (galleryScope === "all") {
    return [...new Set([
      ...getExteriorImages(property),
      ...getInteriorImages(property),
    ])];
  }

  return getInteriorImages(property);
}

function getFloorPlans(property) {
  const plans = property.floor_plans ?? {};
  const preferredOrder = ["groundFloor", "secondFloor"];
  const result = [];

  preferredOrder.forEach((key) => {
    if (plans[key]) {
      result.push({ key, ...plans[key] });
    }
  });

  Object.entries(plans).forEach(([key, plan]) => {
    if (preferredOrder.includes(key)) {
      return;
    }

    result.push({ key, ...plan });
  });

  return result;
}

function getPlanAreas(plan) {
  if (!plan) {
    return [];
  }

  if (Array.isArray(plan.areas)) {
    return plan.areas;
  }

  if (Array.isArray(plan.areaDetails)) {
    return plan.areaDetails;
  }

  return [];
}

function getUnitVariantLabel(property) {
  const title = String(property?.title ?? "").toLowerCase();

  if (title.includes("deluxe")) {
    return "Deluxe";
  }

  if (title.includes("premiere")) {
    return "Premiere";
  }

  return "Unit";
}

export default function PropertyTypeUnits() {
  const urlParams = new URLSearchParams(window.location.search);
  const selectedType = String(urlParams.get("type") ?? "").toLowerCase();
  const queryClient = useQueryClient();
  const [zoomedImage, setZoomedImage] = useState(null);
  const [galleryModalState, setGalleryModalState] = useState(null);
  const [floorPlanModalState, setFloorPlanModalState] = useState(null);
  const [tourModalProperty, setTourModalProperty] = useState(null);
  const [activeTourType, setActiveTourType] = useState("exterior");

  const { data: allProperties = [], isLoading } = useQuery({
    queryKey: ["properties-by-type", selectedType],
    queryFn: () => getPropertiesWithLivePrices("-created_date"),
  });

  useEffect(() => {
    const unsubscribe = subscribeToPropertyPriceOverrides(
      () => {
        queryClient.invalidateQueries({ queryKey: ["properties-by-type", selectedType] });
      },
      (error) => {
        console.error(error);
      },
    );

    return unsubscribe;
  }, [queryClient, selectedType]);

  const meta = TYPE_META[selectedType] ?? {
    label: "Property Units",
    description: "Choose a unit variant and open its details.",
  };

  const filteredProperties = useMemo(() => {
    if (!selectedType) {
      return [];
    }

    return allProperties.filter((property) => property.property_type === selectedType);
  }, [allProperties, selectedType]);

  const unitGridClassName = useMemo(() => {
    return "grid gap-8 grid-cols-1 max-w-6xl mx-auto";
  }, []);

  const openImageZoom = (src, alt, overlayConfig = null) => {
    if (!src) {
      return;
    }

    setZoomedImage({ src, alt: alt || "Image preview", overlayConfig });
  };

  const openGalleryModal = (property, galleryScope = "interior", startIndex = 0) => {
    if (!property) {
      return;
    }

    const images = getGalleryImages(property, galleryScope);
    if (images.length === 0) {
      return;
    }

    setGalleryModalState({
      property,
      galleryScope,
      images,
      currentIndex: Math.min(Math.max(startIndex, 0), images.length - 1),
    });
  };

  const openFloorPlanModal = (property, plan) => {
    if (!property || !plan?.image) {
      return;
    }

    setFloorPlanModalState({
      property,
      plan,
      splitGuideConfig: getSplitUnitGuideConfig(property),
    });
  };

  const openTourModal = (property, tourType) => {
    if (!property) {
      return;
    }

    const sources = resolvePropertyPanoramaSources(property);
    if (!sources.hasAny) {
      return;
    }

    const initialTourType = tourType === "interior" && sources.hasInterior
      ? "interior"
      : sources.hasExterior
        ? "exterior"
        : "interior";

    setActiveTourType(initialTourType);
    setTourModalProperty(property);
  };

  const activeTourSources = tourModalProperty ? resolvePropertyPanoramaSources(tourModalProperty) : null;
  const activeTourSource = activeTourSources
    ? (activeTourType === "interior" ? activeTourSources.interior : activeTourSources.exterior)
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="bg-[#15803d] py-7 md:py-8 px-4 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto page-header text-center flex flex-col items-center">
          <Link to={createPageUrl("Properties")} className="self-start inline-flex items-center mb-3 text-white/85 hover:text-white text-xs sm:text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Link>
          <p className="text-[#86efac] text-[11px] font-semibold uppercase tracking-widest mb-1.5">Unit Variants</p>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1">{meta.label}</h1>
          <p className="text-gray-200 text-xs md:text-sm max-w-2xl mx-auto">{meta.description}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
            {[1, 2, 3].map((index) => (
              <div key={index} className="bg-white rounded-2xl h-96 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-lg mb-3">No units found for this category.</p>
            <Link to={createPageUrl("Properties")}>
              <Button variant="outline">Back to Properties</Button>
            </Link>
          </div>
        ) : (
          <div className={unitGridClassName}>
            {filteredProperties.map((property) => {
              const splitGuideConfig = getSplitUnitGuideConfig(property);
              const exteriorImage = getExteriorImage(property);
              const interiorImages = getInteriorImages(property);
              const tourSources = resolvePropertyPanoramaSources(property);
              const unitVariantLabel = getUnitVariantLabel(property);
              const tourButtons = [
                tourSources.hasExterior
                  ? { label: "360 Exterior Tour", tour: "exterior", variant: "default" }
                  : null,
                tourSources.hasInterior
                  ? { label: "360 Interior Tour", tour: "interior", variant: "outline" }
                  : null,
              ].filter(Boolean);
              const floorPlans = getFloorPlans(property);

              return (
              <article
                key={property.id}
                className="group bg-white border border-slate-200/70 rounded-[28px] p-4 md:p-6 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{unitVariantLabel}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
                  <span className="text-slate-400">{property.location || TYPE_LABELS[property.property_type] || "Unit"}</span>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-4">
                    <div className="relative rounded-2xl border border-slate-200 bg-slate-100 p-3 overflow-hidden">
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => openImageZoom(exteriorImage, `${property.title} exterior`)}
                          className="w-full h-full"
                          aria-label={`Zoom exterior image of ${property.title}`}
                        >
                          <img
                            src={exteriorImage}
                            alt={property.title}
                            className="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
                          />
                        </button>
                      </div>
                      <div className="absolute top-5 left-5 right-5 flex items-center justify-between gap-2">
                        <Badge className={STATUS_BADGE_CLASS[property.status] || STATUS_BADGE_CLASS.available}>
                          {STATUS_LABELS[property.status] || "For Sale"}
                        </Badge>
                        <Badge variant="outline" className="bg-white/90 text-[#15803d] border-[#15803d]/30">
                          {TYPE_LABELS[property.property_type] || property.property_type}
                        </Badge>
                      </div>
                    </div>

                    {interiorImages.length > 0 ? (
                      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Interior Views</p>
                            <h3 className="text-sm font-bold text-slate-900">Interior gallery</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => openGalleryModal(property, "interior")}
                            className="text-xs font-semibold text-[#15803d] hover:text-[#166534] transition-colors"
                          >
                            View All Photos
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {interiorImages.slice(0, 6).map((image, index) => (
                            <button
                              key={`${property.id}-interior-${index}`}
                              type="button"
                              onClick={() => openImageZoom(image, `${property.title} interior ${index + 1}`)}
                              className="rounded-xl overflow-hidden border border-slate-200 bg-white aspect-[4/3]"
                              aria-label={`Open interior image ${index + 1} of ${property.title}`}
                            >
                              <img src={image} alt={`Interior ${index + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{property.title}</h2>
                          {property.location ? (
                            <p className="text-sm text-slate-500 flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              {property.location}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-2xl font-black text-[#15803d] whitespace-nowrap">{formatPrice(property.price)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        {property.bedrooms ? (
                          <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-2 border border-slate-200">
                            <Bed className="w-3.5 h-3.5 text-[#15803d]" />
                            <span>{property.bedrooms} Beds</span>
                          </div>
                        ) : null}
                        {property.bathrooms ? (
                          <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-2 border border-slate-200">
                            <Bath className="w-3.5 h-3.5 text-[#15803d]" />
                            <span>{property.bathrooms} Baths</span>
                          </div>
                        ) : null}
                        {property.floor_area ? (
                          <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-2 border border-slate-200">
                            <Square className="w-3.5 h-3.5 text-[#15803d]" />
                            <span>{property.floor_area} sqm Floor</span>
                          </div>
                        ) : null}
                        {property.lot_area ? (
                          <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-2 border border-slate-200">
                            <Square className="w-3.5 h-3.5 text-[#15803d]" />
                            <span>{property.lot_area} sqm Lot</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {property.description ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Description</p>
                        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{property.description}</p>
                      </div>
                    ) : null}

                    {tourButtons.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">360 Tours</p>
                        <div className="flex flex-wrap gap-2.5">
                          {tourButtons.map((buttonConfig) => (
                            <Button
                              type="button"
                              key={`${property.id}-${buttonConfig.tour}`}
                              variant={buttonConfig.variant === "default" ? "default" : "outline"}
                              className={buttonConfig.variant === "default" ? "bg-[#15803d] hover:bg-[#166534] text-white" : "border-[#15803d]/25 text-[#15803d] hover:bg-[#f0fdf4]"}
                              onClick={() => openTourModal(property, buttonConfig.tour)}
                            >
                              {buttonConfig.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {property.description ? null : (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm text-slate-600">No description is available for this unit.</p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Highlights</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-700">
                        {property.bedrooms ? <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">{property.bedrooms} bedroom layout</p> : null}
                        {property.bathrooms ? <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">{property.bathrooms} bathroom configuration</p> : null}
                        {property.floor_area ? <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">{property.floor_area} sqm floor area</p> : null}
                        {property.lot_area ? <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">{property.lot_area} sqm lot area</p> : null}
                      </div>
                    </div>
                  </div>
                </div>

                {floorPlans.length > 0 ? (
                  <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Floor Plans</p>
                        <h3 className="text-lg font-bold text-slate-900">Layout details</h3>
                      </div>
                      <span className="text-xs text-slate-500">Tap to zoom</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {floorPlans.map((plan) => {
                        const planAreas = getPlanAreas(plan);

                        return (
                          <div key={plan.key} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => openFloorPlanModal(property, plan)}
                                className="w-full h-full"
                                aria-label={`Open ${plan.label || "Floor Plan"} of ${property.title}`}
                              >
                                <img
                                  src={plan.image}
                                  alt={plan.label || "Floor Plan"}
                                  className="w-full h-[240px] object-contain cursor-zoom-in"
                                />
                              </button>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-800 truncate">{plan.label || "Floor Plan"}</p>
                              {planAreas.length > 0 ? <span className="text-[11px] text-slate-500">{planAreas.length} areas</span> : null}
                            </div>
                            {planAreas.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {planAreas.slice(0, 6).map((area, index) => (
                                  <span key={`${plan.key}-area-${index}`} className="text-[11px] rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-600">
                                    {area.name}: {area.area} sqm
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {property.features?.length > 0 ? (
                  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Features and Inclusions</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {property.features.map((feature, index) => (
                        <div key={`${property.id}-feature-${index}`} className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-[#15803d] inline-flex items-center justify-center flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-white" />
                          </span>
                          <span className="text-sm text-slate-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(zoomedImage)}
        onOpenChange={(open) => {
          if (!open) {
            setZoomedImage(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[96vw] h-[92vh] !p-0 gap-0 overflow-hidden bg-white/95 border-slate-200 shadow-2xl backdrop-blur-xl">
          {zoomedImage ? (
            <div className="flex h-full w-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-900">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Photo Viewer</p>
                  <h2 className="text-lg font-bold truncate">{zoomedImage.alt}</h2>
                </div>
              </div>
              <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-100 p-4">
                <img
                  src={zoomedImage.src}
                  alt={zoomedImage.alt}
                  className="block h-full w-full object-contain"
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(galleryModalState)}
        onOpenChange={(open) => {
          if (!open) {
            setGalleryModalState(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[96vw] h-[92vh] !p-0 gap-0 overflow-hidden bg-white/95 border-slate-200 shadow-2xl backdrop-blur-xl">
          {galleryModalState ? (
            <div className="grid h-full w-full grid-rows-[auto,1fr,auto]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-900">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Photo Gallery</p>
                  <h2 className="text-lg font-bold">
                    {galleryModalState.galleryScope === "exterior" ? "Exterior Photos" : "Interior Photos"}
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  {galleryModalState.currentIndex + 1} / {galleryModalState.images.length}
                </p>
              </div>

              <div className="relative min-h-0 overflow-hidden bg-slate-100 p-4">
                <img
                  src={galleryModalState.images[galleryModalState.currentIndex]}
                  alt={`${galleryModalState.property.title} gallery`}
                  className="block h-full w-full object-contain"
                  draggable={false}
                />

                {galleryModalState.images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryModalState((current) => current ? { ...current, currentIndex: (current.currentIndex - 1 + current.images.length) % current.images.length } : current)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 text-slate-700 border border-slate-200 shadow-md hover:bg-white flex items-center justify-center transition-colors"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryModalState((current) => current ? { ...current, currentIndex: (current.currentIndex + 1) % current.images.length } : current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 text-slate-700 border border-slate-200 shadow-md hover:bg-white flex items-center justify-center transition-colors"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>

              {galleryModalState.images.length > 1 ? (
                <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {galleryModalState.images.map((image, index) => (
                      <button
                        key={`${galleryModalState.property.id}-gallery-${index}`}
                        type="button"
                        onClick={() => setGalleryModalState((current) => current ? { ...current, currentIndex: index } : current)}
                        className={`flex-shrink-0 h-16 w-24 overflow-hidden rounded-lg border-2 bg-white transition-all ${index === galleryModalState.currentIndex ? "border-[#16a34a] ring-2 ring-[#16a34a]/20" : "border-slate-200 opacity-80 hover:opacity-100 hover:border-slate-300"}`}
                        aria-label={`Open photo ${index + 1}`}
                      >
                        <img src={image} alt="" className="h-full w-full object-contain bg-white" draggable={false} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(floorPlanModalState)}
        onOpenChange={(open) => {
          if (!open) {
            setFloorPlanModalState(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[96vw] h-[90vh] !p-0 gap-0 overflow-hidden bg-white/95 border-slate-200 shadow-2xl backdrop-blur-xl">
          {floorPlanModalState ? (
            <div className="flex h-full w-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-900">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Floor Plan</p>
                  <h2 className="text-lg font-bold">{floorPlanModalState.plan.label || "Floor Plan"}</h2>
                </div>
              </div>

              <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-100 p-4">
                <img
                  src={floorPlanModalState.plan.image}
                  alt={floorPlanModalState.plan.label || "Floor Plan"}
                  className="block h-full w-full object-contain"
                />
                {floorPlanModalState.splitGuideConfig ? <SplitUnitGuideOverlay config={floorPlanModalState.splitGuideConfig} /> : null}
              </div>

              {floorPlanModalState.property.floor_plans && Object.keys(floorPlanModalState.property.floor_plans).length > 1 ? (
                <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex gap-4">
                    {floorPlanModalState.property.floor_plans.groundFloor ? (
                      <Button
                        variant={floorPlanModalState.plan === floorPlanModalState.property.floor_plans.groundFloor ? "default" : "outline"}
                        onClick={() => setFloorPlanModalState((current) => current ? { ...current, plan: current.property.floor_plans.groundFloor } : current)}
                        className="flex-1"
                      >
                        {floorPlanModalState.property.floor_plans.groundFloor.label || "Ground Floor"}
                      </Button>
                    ) : null}
                    {floorPlanModalState.property.floor_plans.secondFloor ? (
                      <Button
                        variant={floorPlanModalState.plan === floorPlanModalState.property.floor_plans.secondFloor ? "default" : "outline"}
                        onClick={() => setFloorPlanModalState((current) => current ? { ...current, plan: current.property.floor_plans.secondFloor } : current)}
                        className="flex-1"
                      >
                        {floorPlanModalState.property.floor_plans.secondFloor.label || "Second Floor"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(tourModalProperty)}
        onOpenChange={(open) => {
          if (!open) {
            setTourModalProperty(null);
            setActiveTourType("exterior");
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[96vw] h-[92vh] !p-0 gap-0 overflow-hidden bg-white">
          {tourModalProperty ? (
            <div className="h-full flex flex-col min-h-0">
              <div className="px-5 py-4 border-b border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">360 Tour</p>
                    <h2 className="text-lg font-bold text-slate-900">{tourModalProperty.title}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 pr-10 md:pr-14">
                    <Button
                      type="button"
                      variant={activeTourType === "exterior" ? "default" : "outline"}
                      className={activeTourType === "exterior" ? "bg-[#15803d] hover:bg-[#166534] text-white" : "border-[#15803d]/25 text-[#15803d] hover:bg-[#f0fdf4]"}
                      onClick={() => setActiveTourType("exterior")}
                      disabled={!activeTourSources?.hasExterior}
                    >
                      Exterior
                    </Button>
                    <Button
                      type="button"
                      variant={activeTourType === "interior" ? "default" : "outline"}
                      className={activeTourType === "interior" ? "bg-[#15803d] hover:bg-[#166534] text-white" : "border-[#15803d]/25 text-[#15803d] hover:bg-[#f0fdf4]"}
                      onClick={() => setActiveTourType("interior")}
                      disabled={!activeTourSources?.hasInterior}
                    >
                      Interior
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 bg-slate-950">
                {activeTourSource ? (
                  <PanoramaViewer src={activeTourSource} alt={`360° ${activeTourType} view of ${tourModalProperty.title}`} />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-slate-200">
                    No 360 image found for this unit.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
