import React, { useState } from "react";
import { Navigation, MapPin, ExternalLink } from "lucide-react";

const TOLLWAY_URL =
  "https://www.google.com/maps/dir/STAR+Tollway,+Batangas/Randy's+store,+P5PH%2B532,+Batangas+City,+Batangas/@13.842405,121.128617,75691m/data=!3m1!1e3!4m14!4m13!1m5!1m1!1s0x33bd6c47c81960ad:0xb202f8fcae4d8cc4!2m2!1d121.1421878!2d13.9497285!1m5!1m1!1s0x33bd197c66633f33:0xf3269378daf86148!2m2!1d121.177656!2d13.7353748!3e0?hl=en&entry=ttu";
const SM_URL =
  "https://www.google.com/maps?ll=13.750405,121.122659&z=12&t=h&hl=en&gl=PH&saddr=SM+City+Batangas,+Brgy,+M.Pastor+Ave,+Pallocan+Kanluran,+Village,+Batangas+City,+Batangas&daddr=Randy%27s+store,+P5PH%2B532,+Batangas+City,+Batangas&dirflg=d";
const TOLLWAY_EMBED =
  "https://maps.google.com/maps?saddr=STAR+Tollway,+Batangas&daddr=Randy%27s+store,+P5PH%2B532,+Batangas+City,+Batangas&dirflg=d&output=embed";
const SM_EMBED =
  "https://maps.google.com/maps?saddr=SM+City+Batangas,+Batangas+City,+Batangas&daddr=Randy%27s+store,+P5PH%2B532,+Batangas+City,+Batangas&dirflg=d&output=embed";

const routes = {
  tollway: { label: "From STAR Tollway",      time: "~43 min", distance: "~37.7 km", embed: TOLLWAY_EMBED, url: TOLLWAY_URL },
  sm:      { label: "From SM City Batangas",  time: "~25 min", distance: "~15 km",   embed: SM_EMBED,      url: SM_URL },
};

export default function LocationSection() {
  const [activeRoute, setActiveRoute] = useState("tollway");
  const route = routes[activeRoute];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#16a34a] mb-2">Find Us</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800">How to Get Here</h2>
          <p className="text-gray-500 mt-3 text-base">San Jose Sico, Batangas City — select your starting point below</p>
        </div>

        {/* Route tab switcher */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-gray-100 rounded-full p-1 gap-1">
            {Object.entries(routes).map(([key, r]) => (
              <button
                key={key}
                onClick={() => setActiveRoute(key)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  activeRoute === key
                    ? "bg-[#16a34a] text-white shadow-md"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Route summary bar */}
          <div className="bg-[#15803d] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-[#86efac]" />
                <span className="text-white/70 text-sm">From</span>
                <span className="text-white font-semibold text-sm">{route.label.replace("From ", "")}</span>
              </div>
              <span className="text-white/30 text-lg">→</span>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#86efac]" />
                <span className="text-white font-semibold text-sm">Vicmar Homes, Sico</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[#86efac] text-xs font-semibold uppercase tracking-wide">Est. Time</p>
                <p className="text-white font-bold text-sm">{route.time}</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-[#86efac] text-xs font-semibold uppercase tracking-wide">Distance</p>
                <p className="text-white font-bold text-sm">{route.distance}</p>
              </div>
              <a
                href={route.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-white text-[#16a34a] hover:bg-[#f0fdf4] px-4 py-2 rounded-full text-xs font-bold transition-colors shadow-sm ml-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Maps
              </a>
            </div>
          </div>

          {/* Embedded map */}
          <div className="h-[460px]">
            <iframe
              key={activeRoute}
              src={route.embed}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Directions ${route.label}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
