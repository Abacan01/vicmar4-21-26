import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Building, Building2, Home, ArrowRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { getPropertiesWithLivePrices, subscribeToPropertyPriceOverrides } from "@/lib/propertyPriceService";

import duplexImg from '@/images/properties/Duplex Deluxe.png';
import triplexImg from '@/images/properties/Triplex.png';
import rowhouseImg from '@/images/properties/Rowhouse Economic.png';

const propertyTypes = [
  {
    type: "duplex",
    label: "Duplex Units",
    icon: Building,
    description: "Premium duplex homes featuring modern architecture with 3 bedrooms and 2 bathrooms. Perfect for growing families who want quality living spaces with spacious layouts and premium finishes.",
    image: duplexImg
  },
  {
    type: "triplex",
    label: "Triplex Units",
    icon: Building2,
    description: "Affordable triplex homes available in End Unit and Center Unit configurations. Features 3 bedrooms and 2 bathrooms with practical layouts ideal for families.",
    image: triplexImg
  },
  {
    type: "rowhouse",
    label: "Rowhouse Units",
    icon: Home,
    description: "Budget-friendly rowhouse units including Economic, Compound, and Socialized options. Perfect for first-time homebuyers and those looking for affordable housing solutions.",
    image: rowhouseImg
  },
];

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useScrollReveal({ threshold: 0.12, triggerOnce: true });
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

export default function Properties() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  const { data: allProperties = [] } = useQuery({
    queryKey: ["properties-count"],
    queryFn: () => getPropertiesWithLivePrices(),
  });

  useEffect(() => {
    const unsubscribe = subscribeToPropertyPriceOverrides(
      () => {
        queryClient.invalidateQueries({ queryKey: ["properties-count"] });
      },
      (error) => {
        console.error(error);
      },
    );

    return unsubscribe;
  }, [queryClient]);

  const getTypeCount = (type) => allProperties.filter(p => p.property_type === type).length;
  const getTypeStartingPrice = (type) => {
    const props = allProperties.filter(p => p.property_type === type);
    if (props.length === 0) return null;

    const prices = props
      .map((property) => {
        const minPrice = Number(property.minPrice ?? property.price);
        return Number.isFinite(minPrice) ? minPrice : null;
      })
      .filter(Boolean);

    if (prices.length === 0) return null;

    const startingPrice = Math.min(...prices);
    const format = (v) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(v);
    return format(startingPrice);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .prop-img { transition: transform 0.5s ease; }
        .prop-img:hover { transform: scale(1.04); }
        .prop-section { border-bottom: 1px solid #e5e7eb; padding-bottom: 4rem; }
        .prop-section:last-child { border-bottom: none; }
      `}</style>

      {/* Header */}
      <div className="bg-[#15803d] py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative max-w-7xl mx-auto text-center page-header">
          <p className="text-[#86efac] text-xs font-semibold uppercase tracking-widest mb-3">What We Build</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Our Properties</h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            Quality homes designed to meet every lifestyle and budget.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-24">
          {propertyTypes.map((item, index) => {
            const Icon = item.icon;
            const count = getTypeCount(item.type);
            const startingPrice = getTypeStartingPrice(item.type);
            const isReversed = index % 2 === 1;

            return (
              <div
                key={item.type}
                id={item.type}
                className={`prop-section scroll-mt-24 flex flex-col ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 items-center`}
              >
                {/* Image */}
                <Reveal className="w-full lg:w-1/2" delay={100}>
                  <div className="relative rounded-2xl overflow-hidden shadow-xl">
                    <img
                      src={item.image}
                      alt={item.label}
                      className="prop-img w-full h-80 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-6 left-6">
                      <div className="flex items-center gap-3 text-white">
                        <div className="w-11 h-11 bg-[#16a34a] rounded-full flex items-center justify-center shadow-lg">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{item.label}</p>
                          <p className="text-white/75 text-sm">{count} {count === 1 ? 'Property' : 'Properties'} Available</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>

                {/* Content */}
                <Reveal className="w-full lg:w-1/2" delay={200}>
                  <div className="space-y-5">
                    <p className="text-[#16a34a] text-xs font-semibold uppercase tracking-widest">{item.type}</p>
                    <h2 className="text-3xl font-bold text-[#16a34a]">{item.label}</h2>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>

                    {startingPrice && (
                      <div className="bg-[#16a34a]/5 rounded-xl p-4 border border-[#16a34a]/10">
                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Starting Price</p>
                        <p className="text-2xl font-bold text-[#16a34a]">{startingPrice}</p>
                      </div>
                    )}

                    <Link to={createPageUrl("PropertyTypeUnits") + `?type=${item.type}`}>
                      <Button className="bg-[#16a34a] hover:bg-[#22c55e] gap-2 rounded-full px-6 mt-2">
                        View {item.label}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


