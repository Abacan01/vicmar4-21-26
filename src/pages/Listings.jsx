import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PropertyCard from "../components/shared/PropertyCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X, Grid3X3, List } from "lucide-react";
import {
  getPropertiesWithLivePrices,
  getPropertyPriceRangeSettings,
  subscribeToPropertyPriceOverrides,
} from "@/lib/propertyPriceService";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/propertyTypes";

export default function Listings() {
  const urlParams = new URLSearchParams(window.location.search);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [propertyType, setPropertyType] = useState(urlParams.get("type") || "all");
  const [status, setStatus] = useState(urlParams.get("status") || "all");
  const [priceRange, setPriceRange] = useState([500000, 5000000]);
  const [hasInitializedPriceRange, setHasInitializedPriceRange] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  const { data: priceRangeSettings = { minPrice: 500000, maxPrice: 5000000 } } = useQuery({
    queryKey: ["property-price-range-settings"],
    queryFn: getPropertyPriceRangeSettings,
  });

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties-all"],
    queryFn: () => getPropertiesWithLivePrices("-created_date"),
  });

  useEffect(() => {
    const unsubscribe = subscribeToPropertyPriceOverrides(
      () => {
        queryClient.invalidateQueries({ queryKey: ["properties-all"] });
        queryClient.invalidateQueries({ queryKey: ["property-price-range-settings"] });
      },
      (error) => {
        console.error(error);
      },
    );

    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    if (hasInitializedPriceRange) {
      return;
    }

    const parsedMin = Number(urlParams.get("minPrice"));
    const parsedMax = Number(urlParams.get("maxPrice"));

    const min = Number.isFinite(parsedMin) ? parsedMin : priceRangeSettings.minPrice;
    const max = Number.isFinite(parsedMax) ? parsedMax : priceRangeSettings.maxPrice;

    setPriceRange([min, Math.max(min, max)]);
    setHasInitializedPriceRange(true);
  }, [hasInitializedPriceRange, priceRangeSettings.maxPrice, priceRangeSettings.minPrice, urlParams]);

  useEffect(() => {
    setPriceRange((prev) => {
      const nextMin = Math.max(priceRangeSettings.minPrice, prev[0]);
      const nextMaxBase = Math.min(priceRangeSettings.maxPrice, prev[1]);
      const nextMax = Math.max(nextMin, nextMaxBase);

      if (nextMin === prev[0] && nextMax === prev[1]) {
        return prev;
      }

      return [nextMin, nextMax];
    });
  }, [priceRangeSettings.maxPrice, priceRangeSettings.minPrice]);

  const filteredProperties = useMemo(() => {
    let filtered = [...properties];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(s) ||
        p.location?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s)
      );
    }
    if (propertyType !== "all") filtered = filtered.filter(p => p.property_type === propertyType);
    if (status !== "all") filtered = filtered.filter(p => p.status === status);
    filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    switch (sortBy) {
      case "price-low":  filtered.sort((a, b) => a.price - b.price); break;
      case "price-high": filtered.sort((a, b) => b.price - a.price); break;
      case "oldest":     filtered.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)); break;
      default:           filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    return filtered;
  }, [properties, search, propertyType, status, priceRange, sortBy]);

  const formatPrice = (value) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value);

  const clearFilters = () => {
    setSearch(""); setPropertyType("all"); setStatus("all");
    setPriceRange([priceRangeSettings.minPrice, priceRangeSettings.maxPrice]); setSortBy("newest");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes cardFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .listing-card { animation: cardFadeUp 0.45s ease both; }
      `}</style>

      {/* Header */}
      <div className="bg-[#15803d] py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-7xl mx-auto text-center page-header">
          <p className="text-[#86efac] text-xs font-semibold uppercase tracking-widest mb-3">Browse & Discover</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Property Listings</h1>
          <p className="text-gray-300 text-lg">Browse all available properties from Vicmar Homes</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search properties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Property Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PROPERTY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </Button>

              <div className="hidden md:flex border rounded-lg">
                <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("grid")} className="rounded-r-none">
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("list")} className="rounded-l-none">
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range: {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  min={priceRangeSettings.minPrice}
                  max={priceRangeSettings.maxPrice}
                  step={100000}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button variant="outline" onClick={clearFilters} className="gap-2">
                  <X className="w-4 h-4" /> Clear All Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-500 text-sm">
            Showing <span className="font-semibold text-[#16a34a]">{filteredProperties.length}</span> {filteredProperties.length === 1 ? 'property' : 'properties'}
          </p>
        </div>

        {/* Property Grid */}
        {isLoading ? (
          <div className={`grid gap-8 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl h-96 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-400 text-lg mb-2">No properties found</p>
            <p className="text-gray-400 text-sm mb-6">Try adjusting your search or filters.</p>
            <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
          </div>
        ) : (
          <div className={`grid gap-8 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            {filteredProperties.map((property, idx) => (
              <div key={property.id} className="listing-card" style={{ animationDelay: `${idx * 60}ms` }}>
                <PropertyCard property={property} showTourButtons />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


