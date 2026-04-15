import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { 
  AlertCircle, 
  ArrowRight, 
  Calendar,
  CheckCircle2,
  Clock,
  Home, 
  MapPinned, 
  MessageCircle,
  PhilippinePeso,
  TrendingUp
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { subscribeToSlotStatuses } from "@/lib/slotStatusService";
import { buildVicinitySlots, getAllVicinityProperties } from "@/lib/vicinitySlots";
import { normalizeSlotStatus } from "@/lib/slotStatus";
import { createPageUrl } from "@/utils";

export default function AdminDashboard() {
  const [statusOverrides, setStatusOverrides] = useState({});
  const [syncError, setSyncError] = useState("");
  const [isAdminSessionReady, setIsAdminSessionReady] = useState(false);

  const allProperties = useMemo(() => getAllVicinityProperties(), []);
  const allSlots = useMemo(() => buildVicinitySlots(allProperties), [allProperties]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminSessionReady(Boolean(user && !user.isAnonymous));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAdminSessionReady) {
      return undefined;
    }

    const unsubscribe = subscribeToSlotStatuses(
      (nextStatuses) => {
        setStatusOverrides(nextStatuses);
        setSyncError("");
      },
      (error) => {
        console.error(error);
        setSyncError("Unable to sync live slot status right now.");
      },
    );

    return unsubscribe;
  }, [isAdminSessionReady]);

  const slotsWithStatus = useMemo(() => {
    return allSlots.map((slot) => {
      const override = statusOverrides[slot.slotId];
      const currentStatus = normalizeSlotStatus(override?.status ?? slot.defaultStatus);
      const effectivePrice = override?.price ?? slot.price;

      return {
        ...slot,
        currentStatus,
        price: effectivePrice === "" || effectivePrice === undefined ? null : Number(effectivePrice),
      };
    });
  }, [allSlots, statusOverrides]);

  const summary = useMemo(() => {
    const result = {
      totalSlots: slotsWithStatus.length,
      available: 0,
      reserved: 0,
      notAvailable: 0,
      pricedSlots: 0,
      avgPrice: 0,
    };

    let totalPrice = 0;

    slotsWithStatus.forEach((slot) => {
      if (slot.currentStatus === "available") {
        result.available += 1;
      } else if (slot.currentStatus === "reserved") {
        result.reserved += 1;
      } else {
        result.notAvailable += 1;
      }

      if (Number.isFinite(slot.price)) {
        result.pricedSlots += 1;
        totalPrice += slot.price;
      }
    });

    if (result.pricedSlots > 0) {
      result.avgPrice = Math.round(totalPrice / result.pricedSlots);
    }

    return result;
  }, [slotsWithStatus]);

  const availabilityPercent = summary.totalSlots > 0 ? Math.round((summary.available / summary.totalSlots) * 100) : 0;
  const reservedPercent = summary.totalSlots > 0 ? Math.round((summary.reserved / summary.totalSlots) * 100) : 0;
  const soldPercent = summary.totalSlots > 0 ? Math.round((summary.notAvailable / summary.totalSlots) * 100) : 0;

  return (
    <div className="space-y-6">
        {syncError && (
          <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 shadow-sm">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-500" />
            <span className="font-medium">{syncError}</span>
          </div>
        )}

        {/* Quick Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-5">
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400 cursor-default">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Available Lots</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{summary.available}</h2>
                  <span className="text-xs font-bold text-emerald-600">{availabilityPercent}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400 cursor-default">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Reserved Lots</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{summary.reserved}</h2>
                  <span className="text-xs font-bold text-amber-600">{reservedPercent}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-400 cursor-default">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Sold / Closed</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{summary.notAvailable}</h2>
                  <span className="text-xs font-bold text-rose-600">{soldPercent}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Properties Progress Bar */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Properties Breakdown</h3>
            <span className="text-xs font-semibold text-slate-400">{summary.totalSlots} total lots</span>
          </div>
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
            {summary.available > 0 && (
              <div 
                className="h-full bg-emerald-500 transition-all duration-700 ease-out"
                style={{ width: `${availabilityPercent}%` }}
                title={`Available: ${summary.available}`}
              />
            )}
            {summary.reserved > 0 && (
              <div 
                className="h-full bg-amber-500 transition-all duration-700 ease-out"
                style={{ width: `${reservedPercent}%` }}
                title={`Reserved: ${summary.reserved}`}
              />
            )}
            {summary.notAvailable > 0 && (
              <div 
                className="h-full bg-rose-500 transition-all duration-700 ease-out"
                style={{ width: `${soldPercent}%` }}
                title={`Not Available: ${summary.notAvailable}`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-500">Available ({summary.available})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-slate-500">Reserved ({summary.reserved})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-xs font-medium text-slate-500">Sold / Closed ({summary.notAvailable})</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          
          {/* Main Column - Quick Actions */}
          <div className="xl:col-span-2 space-y-5">
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] overflow-hidden">
              <div className="px-6 py-5 border-b border-white/40 bg-white/40">
                <h2 className="text-lg font-bold text-slate-900">Quick Actions</h2>
                <p className="text-sm text-slate-400 mt-0.5">Jump to common admin tasks</p>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to={createPageUrl("AdminSlots")}
                  className="group flex items-center gap-4 p-5 rounded-2xl bg-white/50 hover:bg-white/80 border border-white/40 hover:border-green-200 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 text-[#15803d] flex items-center justify-center group-hover:bg-[#15803d] group-hover:text-white group-hover:shadow-md transition-all duration-300">
                    <MapPinned className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800 group-hover:text-[#15803d] transition-colors">Slot Management</p>
                    <p className="text-xs font-medium text-zinc-500">Edit map bounds & statuses</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#15803d] transition-colors" />
                </Link>

                <Link
                  to={createPageUrl("AdminPropertyPricing")}
                  className="group flex items-center gap-4 p-5 rounded-2xl bg-white/50 hover:bg-white/80 border border-white/40 hover:border-green-200 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 text-[#15803d] flex items-center justify-center group-hover:bg-[#15803d] group-hover:text-white group-hover:shadow-md transition-all duration-300">
                    <PhilippinePeso className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800 group-hover:text-[#15803d] transition-colors">Unit Pricing</p>
                    <p className="text-xs font-medium text-zinc-500">Adjust model costs</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#15803d] transition-colors" />
                </Link>

                <Link
                  to={createPageUrl("AdminMessages")}
                  className="group flex items-center gap-4 p-5 rounded-2xl bg-white/50 hover:bg-white/80 border border-white/40 hover:border-green-200 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 text-[#15803d] flex items-center justify-center group-hover:bg-[#15803d] group-hover:text-white group-hover:shadow-md transition-all duration-300">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800 group-hover:text-[#15803d] transition-colors">Messages</p>
                    <p className="text-xs font-medium text-zinc-500">Live chat support</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#15803d] transition-colors" />
                </Link>

                <div className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#15803d]/5 to-emerald-50 border border-emerald-100 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-[#15803d]/10 border border-[#15803d]/20 text-[#15803d] flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800">Today's Date</p>
                    <p className="text-xs font-medium text-zinc-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column */}
          <div className="xl:col-span-1 space-y-5">
             {/* Workflow Guide Widget */}
             <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-400">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#15803d]/10 text-[#15803d] flex items-center justify-center flex-shrink-0">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Workflow Guide</h3>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Update slot availabilities through Slot Management first, then adjust standard model pricing in Unit Pricing.
                    </p>
                  </div>
                </div>
             </div>

             {/* Pricing Summary Widget */}
             <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-400">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Pricing Snapshot</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Lots with pricing</span>
                    <span className="text-sm font-bold text-slate-800">{summary.pricedSlots}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Average price</span>
                    <span className="text-sm font-bold text-slate-800">
                      {summary.avgPrice > 0 ? `₱${summary.avgPrice.toLocaleString()}` : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Without pricing</span>
                    <span className="text-sm font-bold text-slate-800">{summary.totalSlots - summary.pricedSlots}</span>
                  </div>
                </div>
             </div>

             {/* System Status */}
             <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_24px_rgb(0,0,0,0.03)] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-400">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-900">System Status</h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Firebase Sync</span>
                    <span className={`text-xs font-bold ${syncError ? 'text-red-500' : 'text-emerald-600'}`}>
                      {syncError ? 'Error' : 'Connected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Properties tracked</span>
                    <span className="text-sm font-bold text-slate-800">{allProperties.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Total slots</span>
                    <span className="text-sm font-bold text-slate-800">{summary.totalSlots}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
  );
}
