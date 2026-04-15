import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MissionPhilosophySection from "@/components/about/MissionPhilosophySection";
import CoreValuesSection from "@/components/about/CoreValuesSection";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import heroImage from "@/images/hero-properties.jpg";
import logoImage from "@/images/logos/transparent-vicmar-logo.png";
import introImage from "@/images/community.jpg";

/* ── Scroll-reveal wrapper ───────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }) {
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

/* ── TATAG Five Traits ───────────────────────────────────────────── */
const tatagTraits = [
  {
    label: "GARDEN SPACE",
    sublabel: "(Backyard Food Growing)",
    icon: (
      <svg viewBox="0 0 40 40" className="w-12 h-12 mx-auto" fill="none">
        <path d="M20 35V20" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 20c-6-1-10-6-10-12 6 1 10 6 10 12z" stroke="#16a34a" strokeWidth="2.3" fill="none" />
        <path d="M20 24c6-1 10-6 10-12-6 1-10 6-10 12z" stroke="#16a34a" strokeWidth="2.3" fill="none" />
        <path d="M12 35h16" stroke="#16a34a" strokeWidth="2.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "GREEN HOMES",
    sublabel: "(Nature Friendly)",
    icon: (
      <svg viewBox="0 0 40 40" className="w-12 h-12 mx-auto" fill="none">
        <path d="M6 20L20 8l14 12" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 20v13h20V20" stroke="#16a34a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M26 14c3-4 8-5 8-5s-1 5-5 8c-2 1.5-4 1-4 1s-.5-2 1-4z" stroke="#16a34a" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    label: "GARDEN LIVING",
    sublabel: "(Garden Centered Living)",
    icon: (
      <svg viewBox="0 0 40 40" className="w-12 h-12 mx-auto" fill="none">
        <circle cx="20" cy="18" r="4" stroke="#16a34a" strokeWidth="2.3" />
        <path d="M20 14c0-4-3-8-3-8s-3 4-3 8a6 6 0 006 0z" stroke="#16a34a" strokeWidth="2" fill="none" />
        <path d="M20 14c0-4 3-8 3-8s3 4 3 8a6 6 0 01-6 0z" stroke="#16a34a" strokeWidth="2" fill="none" />
        <path d="M12 22c-4 0-8 3-8 3s4 3 8 3a6 6 0 000-6z" stroke="#16a34a" strokeWidth="2" fill="none" />
        <path d="M28 22c4 0 8 3 8 3s-4 3-8 3a6 6 0 010-6z" stroke="#16a34a" strokeWidth="2" fill="none" />
        <path d="M20 22v14" stroke="#16a34a" strokeWidth="2.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "ECO VILLAGE",
    sublabel: "(Eco Living Community)",
    icon: (
      <svg viewBox="0 0 40 40" className="w-12 h-12 mx-auto" fill="none">
        <circle cx="20" cy="20" r="15" stroke="#16a34a" strokeWidth="2.3" />
        <path d="M14 28V20l6-5 6 5v8" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 15c2-3 5-4 5-4s-1 3-3 5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M30 15c-2-3-5-4-5-4s1 3 3 5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M20 15v-4" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M18 11c0 0 2-3 2-3s2 3 2 3" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
];

/* ═══════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════ */
export default function AboutUs() {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          const navHeight = document.querySelector("nav")?.offsetHeight ?? 80;
          const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 350);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <style>{`
        .scroll-reveal-init {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.65s ease, transform 0.65s ease;
        }
        .scroll-reveal-init.revealed {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <div
        className="relative w-full"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: "320px",
        }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(22,101,52,0.82)" }} />
        <div className="relative z-10 flex flex-col items-center justify-center text-center py-28 px-4">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight max-w-3xl">
            Building Better Lives: Vicmar Homes' Vision for Filipino Families
          </h1>
          <p className="mt-4 text-gray-200 text-sm md:text-base max-w-xl">
            For over a decade, we have built communities where Filipino families can truly thrive and grow.
          </p>
        </div>
      </div>

      {/* ── 2. ABOUT US INTRO ───────────────────────────────────────── */}
      <section className="bg-white py-14 px-4 sm:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <Reveal className="min-w-0">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: "#16a34a" }}
            >
              About Us
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 mb-4 max-w-xl">
              Vicmar Homes: Where Sustainability Meets Comfortable Living
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xl">
              Vicmar Homes is a sustainable and affordable housing community located in Barangay San Jose, Sico, Batangas City. The project focuses on resource efficiency and promotes sustainable living for families in the area. It also encourages home-based food gardening, allowing residents to grow their own fresh and healthy food. The housing units are designed with flexible layouts so they can easily adapt to the different needs of homeowners. With its eco-friendly concept and practical design, Vicmar Homes offers a modern and comfortable community for people who want a better way of living in Batangas City.
            </p>

            <div className="mt-8">
              <Link
                to={createPageUrl("ContactUs")}
                className="inline-block px-8 py-3 text-sm font-bold uppercase tracking-widest text-white rounded"
                style={{ background: "#16a34a" }}
              >
                Inquire Now
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative overflow-hidden rounded-2xl shadow-md border border-gray-100">
              <img
                src={introImage}
                alt="Vicmar Homes sustainable community"
                className="w-full h-[260px] sm:h-[320px] lg:h-[360px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 3. MISSION & PHILOSOPHY (2×2 grid) ─────────────────────── */}
      <MissionPhilosophySection />

      {/* ── 4. CORE VALUES ──────────────────────────────────────────── */}
      <CoreValuesSection />

      {/* ── 5. CORPORATE CULTURE ────────────────────────────────────── */}
      <section id="corporate-culture" className="w-full scroll-mt-24" style={{ background: "#15803d" }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-20 flex flex-col md:flex-row items-center gap-12">
          {/* Logo + name */}
          <Reveal className="flex-shrink-0 text-center md:text-left">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: "#ffffff" }}
              >
                <img
                  src={logoImage}
                  alt="Vicmar Logo"
                  className="w-16 h-16 object-contain"
                />
              </div>
              <div className="text-white">
              </div>
            </div>
          </Reveal>

          {/* Description */}
          <Reveal delay={120} className="flex-1 text-white">
            <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wide mb-6">
              Corporate Culture
            </h2>
            <p className="text-white/85 text-sm leading-relaxed">
              Vicmar Homes is built on the values of comfort, sustainability, affordability, and community. The organization promotes a culture of responsibility and innovation by developing homes that support sustainable living and efficient use of resources. Employees and partners work together to create housing solutions that are accessible and beneficial for families in Batangas City. The company also encourages teamwork, respect, and dedication in providing quality service to homeowners. Through this culture, Vicmar Homes aims to build not only houses but also a supportive and thriving community for its residents.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 6. THE 5 OF TATAG ───────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-8" style={{ background: "#f0fdf4" }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-extrabold text-center uppercase tracking-widest text-gray-800 mb-12">
              Vicmar Homes: Sustainable Living Community
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {tatagTraits.map((trait, idx) => (
              <Reveal key={idx} delay={idx * 80}>
                <div className="bg-white rounded-xl p-5 text-center shadow-sm border border-gray-100 h-full flex flex-col items-center justify-center gap-3">
                  {trait.icon}
                  <p className="text-sm font-extrabold text-gray-800 uppercase tracking-wider">
                    {trait.label}
                  </p>
                  <p className="text-xs text-gray-500">{trait.sublabel}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="text-center text-gray-500 text-xs leading-relaxed max-w-3xl mx-auto">
              Vicmar Homes in Batangas City is a designed community that promotes
              sustainable and affordable living. Each home includes space for gardens
              and urban farming, allowing families to grow food and herbs while
              enjoying greener surroundings - a community that supports a healthier
              and more connected lifestyle.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

