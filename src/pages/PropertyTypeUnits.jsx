import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import PropertyCard from "@/components/shared/PropertyCard";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "../utils";
import {
  getPropertiesWithLivePrices,
  subscribeToPropertyPriceOverrides,
} from "@/lib/propertyPriceService";

const TYPE_META = {
  duplex: {
    label: "Duplex Units",
    description: "Choose from all available duplex variants and open each unit's full details.",
  },
  triplex: {
    label: "Triplex Units",
    description: "Choose from all available triplex variants and open each unit's full details.",
  },
  rowhouse: {
    label: "Rowhouse Units",
    description: "Choose from all available rowhouse variants and open each unit's full details.",
  },
};

export default function PropertyTypeUnits() {
  const urlParams = new URLSearchParams(window.location.search);
  const selectedType = String(urlParams.get("type") ?? "").toLowerCase();
  const queryClient = useQueryClient();

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#15803d] py-16 px-4 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto page-header">
          <Link to={createPageUrl("Properties")} className="inline-flex items-center mb-5 text-white/85 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Link>
          <p className="text-[#86efac] text-xs font-semibold uppercase tracking-widest mb-2">Unit Variants</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{meta.label}</h1>
          <p className="text-gray-200 text-base max-w-2xl">{meta.description}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {isLoading ? (
          <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="bg-white rounded-xl h-96 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-500 text-lg mb-3">No units found for this category.</p>
            <Link to={createPageUrl("Properties")}>
              <Button variant="outline">Back to Properties</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} showTourButtons />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
