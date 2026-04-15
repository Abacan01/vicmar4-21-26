import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import PropertyCard from "../shared/PropertyCard";
import { ArrowRight } from "lucide-react";

export default function RecentListings({ properties = [], isLoading }) {
  if (isLoading) {
    return (
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#16a34a]">Recent Listings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#16a34a]">Recent Listings</h2>
          <Link
            to={createPageUrl("Properties")}
            className="hidden md:flex items-center gap-2 text-[#16a34a] hover:text-[#22c55e] font-semibold transition-colors"
          >
            View More Properties
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No properties available yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.slice(0, 9).map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}

        <div className="mt-8 text-center md:hidden">
          <Link
            to={createPageUrl("Properties")}
            className="inline-flex items-center gap-2 text-[#16a34a] hover:text-[#22c55e] font-semibold transition-colors"
          >
            View More Properties
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
