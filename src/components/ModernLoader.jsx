import React from "react";
import logoImg from "@/images/logos/transparent-vicmar-logo.png";

export default function ModernLoader({
  title = "Preparing your dashboard",
  subtitle = "Syncing live data and securing your session...",
}) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 px-6">
      <div className="absolute top-[-12%] left-[-8%] w-[30rem] h-[30rem] rounded-full bg-emerald-200/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-14%] right-[-8%] w-[32rem] h-[32rem] rounded-full bg-[#15803d]/15 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-[0_14px_50px_rgba(15,23,42,0.14)] px-8 py-9 text-center">
        <img
          src={logoImg}
          alt="Vicmar Homes"
          className="h-12 mx-auto object-contain mb-4"
          draggable={false}
        />

        <div className="mx-auto mb-4 relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#15803d] border-r-emerald-400 animate-spin" />
        </div>

        <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]/70 animate-pulse [animation-delay:180ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]/50 animate-pulse [animation-delay:360ms]" />
        </div>
      </div>
    </div>
  );
}
