import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import {
  Trophy, Home, Sprout
} from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import galleryImage1 from "@/images/amenities/Render 002 - Sico Rotonda.jpg";
import galleryImage2 from "@/images/amenities/REVISED_Render 002 - Greenway Alley.jpg";
import galleryImage3 from "@/images/amenities/REVISED_Render 002 - Parks and Playgrounds.jpg";
import galleryImage4 from "@/images/amenities/REVISED_Render 006 - CLOSE_Main Entrance Gate.jpg";
import galleryImage5 from "@/images/properties/Interior/compound_img1.png";
import galleryImage6 from "@/images/properties/Interior/socialized_img1.png";

const amenities = [
  { 
    icon: Trophy, 
    title: "Basketball Court", 
    description: "A basketball court offers numerous benefits, including promoting physical activity, providing a space for family and friends to bond, and enhancing basketball skills. Basketball court can also be a source of pride and enjoyment for the community, promoting a healthy and active lifestyle." 
  },
  { 
    icon: Home, 
    title: "Pavillion", 
    description: "A pavilion offers numerous benefits, including expanded outdoor living space, enhanced property value, and a versatile area for hosting events and relaxation. It provides shelter from the elements, allowing for year-round enjoyment of the outdoors, and can be a focal point for social gatherings and community interaction." 
  },
  { 
    icon: Sprout, 
    title: "Community Garden", 
    description: "Community gardens offer numerous benefits, including promoting healthy eating, improving mental well-being, and strengthening community bonds. They also provide fresh, locally grown food, especially valuable in food deserts, and contribute to environmental sustainability by creating green spaces and promoting biodiversity." 
  },
];

const galleryImages = [
  galleryImage1,
  galleryImage2,
  galleryImage3,
  galleryImage4,
  galleryImage5,
  galleryImage6,
];

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useScrollReveal({ threshold: 0.1, triggerOnce: true });
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

export default function Amenities() {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <style>{`
        .scroll-reveal-init {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .scroll-reveal-init.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        .amenity-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .amenity-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 30px rgba(22,101,52,0.10);
        }
      `}</style>

      {/* Hero */}
      <div
        id="community-amenities"
        className="relative py-28 px-4 scroll-mt-24"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1920&q=80')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[#15803d]/90" />
        <div className="relative max-w-7xl mx-auto text-center">
          <p className="text-[#86efac] text-xs font-semibold uppercase tracking-widest mb-3">What We Offer</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Community Amenities</h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            Everything you need for a comfortable, safe, and connected community life.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Amenities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {amenities.map((amenity, idx) => {
            const Icon = amenity.icon;
            return (
              <Reveal key={idx} delay={idx * 60}>
                <div className="amenity-card bg-white rounded-xl p-6 shadow-sm border border-gray-100 group h-full text-center">
                  <div className="w-14 h-14 bg-[#16a34a]/10 group-hover:bg-[#16a34a]/20 rounded-lg flex items-center justify-center mx-auto mb-4 transition-colors">
                    <Icon className="w-7 h-7 text-[#16a34a]" />
                  </div>
                  <h3 className="text-base font-bold text-[#16a34a] mb-3">{amenity.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{amenity.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Live the Vicmar Lifestyle */}
        <div id="vicmar-lifestyle" className="mt-20 scroll-mt-24">
          <Reveal>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div
                  className="h-64 lg:h-auto min-h-[280px]"
                  style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <p className="text-[#16a34a] text-xs font-semibold uppercase tracking-widest mb-3">Our Community</p>
                  <h2 className="text-2xl font-bold text-[#16a34a] mb-6">Live the Vicmar Lifestyle</h2>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {[
                      "Family-oriented community",
                      "Safe and secure environment",
                      "Well-maintained facilities",
                      "Active homeowner association",
                    ].map((item, i) => (
                      <span key={i} className="bg-[#16a34a]/10 text-[#16a34a] text-xs font-medium px-3 py-1.5 rounded-full">
                        {item}
                      </span>
                    ))}
                  </div>
                  <Link to={createPageUrl("Properties")}>
                    <span className="inline-flex bg-[#16a34a] hover:bg-[#22c55e] text-white w-fit rounded-full px-6 py-2 text-sm font-medium transition-colors">
                      Explore Our Properties
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Community Gallery */}
        <div id="community-gallery" className="mt-20 scroll-mt-24">
          <Reveal>
            <h2 className="text-2xl font-bold text-[#16a34a] mb-8 text-center">Community Gallery</h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleryImages.map((img, idx) => (
              <Reveal key={idx} delay={idx * 70}>
                <div className="relative h-48 rounded-xl overflow-hidden group cursor-pointer">
                  <img
                    src={img}
                    alt={`Gallery ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
