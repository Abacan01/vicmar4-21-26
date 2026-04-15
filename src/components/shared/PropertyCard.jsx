import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { Bed, Bath, Square, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export default function PropertyCard({ property, showTourButtons = false }) {
  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-PH', { 
      style: 'currency', 
      currency: 'PHP',
      maximumFractionDigits: 0 
    }).format(value);
  };

  const propertyDetailUrl = createPageUrl("PropertyDetail") + `?id=${property.id}`;
  const tours = resolvePropertyPanoramaSources(property);
  const initialTourType = tours.hasExterior ? "exterior" : "interior";
  const tourEntryUrl = `${propertyDetailUrl}&tour=${initialTourType}`;

  return (
    <div className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100">
      <Link to={propertyDetailUrl} className="block">
        {/* Image */}
        <div className="relative h-56 overflow-hidden">
          <img
            src={property.main_image || fallbackCardImage}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="bg-[#16a34a] hover:bg-[#22c55e] text-white font-semibold px-6 py-3 rounded-lg transform transition-all duration-300 hover:scale-105 shadow-lg">
              View Property
            </span>
          </div>

          {/* Status Badge */}
          <Badge className={`absolute top-4 left-4 ${statusColors[property.status]} text-white border-0 capitalize`}>
            {property.status === "available" ? "For Sale" : property.status}
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
          <h3 className="font-bold text-lg text-[#16a34a] mb-2 line-clamp-1 group-hover:text-[#16a34a] transition-colors">
            {property.title}
          </h3>

          {property.location && (
            <p className="text-gray-500 text-sm mb-4 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {property.location}
            </p>
          )}

          {property.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {property.description}
            </p>
          )}

          {/* Price */}
          <p className="text-[#16a34a] font-bold text-xl mb-4">
            Price: {formatPrice(property.price)}
          </p>

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
        </div>
      </Link>

      {showTourButtons && (
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
