import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import heroImage from "../../../images/heroimage.jpg";

export default function HeroSection() {
  return (
    <section className="relative flex flex-col overflow-hidden" style={{ minHeight: 'calc(100vh - 134px)' }}>
      {/* Background image */}
      <img
        src={heroImage}
        alt="Vicmar Homes community"
        className="hero-img absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      />
      {/* Gradient: transparent top → solid green at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#15803d] via-[#15803d]/70 to-transparent" style={{ zIndex: 1 }} />

      {/* Push content to bottom */}
      <div className="flex-1" />

      {/* Bottom content strip */}
      <div className="relative z-10 w-full px-8 md:px-16 pt-10 pb-10 flex flex-col items-start">
        <p className="hero-label text-[#86efac] text-xs font-semibold uppercase tracking-widest mb-3">
          Trusted Real Estate Developer in the Philippines
        </p>
        <h1 className="hero-title text-4xl md:text-5xl font-bold text-white leading-tight mb-1">
          Building Better Communities
        </h1>
        <div className="flex items-center gap-4 flex-wrap mb-3">
          <span className="text-4xl md:text-5xl font-bold text-[#86efac] leading-tight">for Filipinos</span>
          <Link
            to={createPageUrl("ContactUs")}
            className="hero-btn inline-flex items-center bg-white text-[#16a34a] font-bold px-6 py-2.5 rounded-sm text-sm tracking-wide uppercase shadow-md hover:bg-[#f0fdf4] transition-colors duration-200"
          >
            Inquire Now
          </Link>
        </div>
        <p className="hero-sub text-white/70 text-sm max-w-lg leading-relaxed">
          Find your dream home with Vicmar Homes — where tradition meets modern Filipino living.
        </p>
      </div>
    </section>
  );
}