import React from "react";
import { Home, TrendingUp, Shield, FileCheck } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const services = [
  {
    icon: Home,
    title: "Quality Homes",
    description: "Expertly designed homes meeting the highest standards for quality and comfort for Filipino families.",
  },
  {
    icon: TrendingUp,
    title: "Investment Value",
    description: "Strategic locations and quality construction ensure your property grows in value over time.",
  },
  {
    icon: Shield,
    title: "Secure Ownership",
    description: "Complete documentation and transparent transactions for a worry-free home buying experience.",
  },
  {
    icon: FileCheck,
    title: "Flexible Financing",
    description: "Payment schemes including bank financing, Pag-IBIG, and in-house financing options.",
  },
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

export default function ServicesSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-14">
          <p className="text-[#16a34a] text-xs font-semibold uppercase tracking-widest mb-3">Why Choose Us</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#16a34a] mb-3">
            How Vicmar Homes Can Help You
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm">
            We're committed to making your dream of owning a home a reality.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Reveal key={index} delay={index * 90}>
                <div className="svc-card bg-gray-50 rounded-2xl p-7 border border-gray-100 h-full">
                  <div className="w-12 h-12 bg-[#16a34a]/10 rounded-xl flex items-center justify-center mb-5 transition-colors group-hover:bg-[#16a34a]/20">
                    <Icon className="w-6 h-6 text-[#16a34a]" />
                  </div>
                  <h3 className="font-bold text-[#16a34a] mb-2">{service.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{service.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      <style>{`
        .svc-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .svc-card:hover { transform: translateY(-5px); box-shadow: 0 16px 40px rgba(22,101,52,0.10); }
      `}</style>
    </section>
  );
}
