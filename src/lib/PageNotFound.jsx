import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Home, MapPinned } from "lucide-react";
import logoImg from "@/images/logos/transparent-vicmar-logo.png";
import { createPageUrl } from "@/utils";

export default function PageNotFound() {
    const location = useLocation();
    const requestedPath = location.pathname || "/";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 flex items-center justify-center px-6 py-12 overflow-hidden relative">
            <div className="absolute top-[-10%] left-[-10%] w-[32rem] h-[32rem] rounded-full bg-emerald-200/30 blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-[#15803d]/15 blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-3xl bg-white/75 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_12px_40px_rgba(2,6,23,0.12)] overflow-hidden">
                <div className="bg-[#15803d] px-8 py-10 text-white">
                    <img src={logoImg} alt="Vicmar Homes" className="h-10 object-contain brightness-0 invert mb-5" />
                    <p className="text-emerald-100 text-xs font-semibold uppercase tracking-[0.18em]">Error 404</p>
                    <h1 className="text-4xl font-black tracking-tight mt-2">Page Not Found</h1>
                    <p className="text-emerald-100/85 mt-2 text-sm">
                        The page you requested does not exist or may have been moved.
                    </p>
                </div>

                <div className="px-8 py-8">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Requested Path</p>
                        <p className="text-sm text-slate-700 break-all">{requestedPath}</p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            to={createPageUrl("Home")}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Back to Home
                        </Link>

                        <Link
                            to={createPageUrl("VicinityMap")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 hover:border-[#15803d]/40 text-slate-700 hover:text-[#15803d] bg-white text-sm font-semibold px-4 py-2.5 transition-colors"
                        >
                            <MapPinned className="w-4 h-4" />
                            Open Subdivision Plan
                        </Link>

                        <Link
                            to={createPageUrl("Properties")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 hover:border-[#15803d]/40 text-slate-700 hover:text-[#15803d] bg-white text-sm font-semibold px-4 py-2.5 transition-colors"
                        >
                            Browse Properties
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
