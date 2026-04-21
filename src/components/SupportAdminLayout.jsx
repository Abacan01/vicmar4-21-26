import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  LogOut,
  Menu,
  MessageCircle,
  Shield,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { isPrimaryAdminUser, isSupportAdminUser } from "@/lib/adminAccess";
import { createPageUrl } from "@/utils";
import ModernLoader from "@/components/ModernLoader";

const SUPPORT_NAV_ITEMS = [
  {
    page: "AdminMessages",
    label: "Chat Support",
    icon: MessageCircle,
  },
];

export default function SupportAdminLayout({ currentPageName, children }) {
  const navigate = useNavigate();
  const [supportAdminUser, setSupportAdminUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const validSupportUser = isSupportAdminUser(user) ? user : null;
      setSupportAdminUser(validSupportUser);
      setIsCheckingAuth(false);

      if (!validSupportUser) {
        if (isPrimaryAdminUser(user)) {
          navigate(createPageUrl("AdminDashboard"), { replace: true });
          return;
        }

        if (user) {
          signOut(auth).catch((error) => console.error(error));
        }
        navigate(createPageUrl("AdminLogin"), { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  const activePage = useMemo(() => currentPageName ?? "AdminMessages", [currentPageName]);

  const pageContent = useMemo(() => {
    switch (activePage) {
      case "AdminMessages":
        return {
          title: "Support Chat Dashboard",
          subtitle: "View requests and respond to customer chat conversations.",
        };
      default:
        return {
          title: "Support Dashboard",
          subtitle: "",
        };
    }
  }, [activePage]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate(createPageUrl("AdminLogin"), { replace: true });
  };

  if (isCheckingAuth) {
    return (
      <ModernLoader
        title="Loading support dashboard"
        subtitle="Validating support session..."
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#f0f9ff]/30 to-emerald-50/60 flex relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-5%] w-[35%] h-[35%] bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-12%] right-[-8%] w-[45%] h-[45%] bg-[#15803d]/10 rounded-full blur-3xl pointer-events-none" />

      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen z-50 w-[240px] bg-white/80 backdrop-blur-xl border-r border-white/50 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-3 h-20 border-b border-white/40 px-4">
          <Link to={createPageUrl("AdminMessages")} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#15803d] to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-green-700/20 transition-transform group-hover:scale-105 flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-base font-extrabold text-slate-800 tracking-tight whitespace-nowrap">Vicmar Support</span>
          </Link>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {SUPPORT_NAV_ITEMS.map((item) => {
            const isActive = activePage === item.page;
            const IconComponent = item.icon;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-[#15803d] text-white shadow-md shadow-green-700/20"
                    : "text-slate-500 hover:bg-green-50 hover:text-[#15803d]"
                }`}
              >
                <IconComponent className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-semibold whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/40 p-4">
          <div className="flex items-center rounded-xl px-3 py-2 gap-3 mb-2.5 bg-white/60">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#15803d] to-emerald-500 text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm flex-shrink-0">
              {supportAdminUser?.email?.[0] || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-slate-800 leading-none mb-1 block truncate">{supportAdminUser?.email?.split("@")[0]}</span>
              <span className="text-[10px] text-emerald-700 font-bold leading-none uppercase tracking-wider">Support Admin</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-rose-700 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white/80 backdrop-blur-xl border-b border-white/50 shadow-sm flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="p-2 -ml-2 text-slate-500 hover:bg-white/50 rounded-full transition-colors">
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to={createPageUrl("AdminMessages")} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#15803d] to-emerald-500 flex items-center justify-center text-white shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-base font-bold text-slate-800">Vicmar Support</span>
          </Link>
        </div>
      </header>

      {isMobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 animate-in fade-in duration-200" onClick={() => setIsMobileNavOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl animate-in slide-in-from-left duration-300 flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 h-14 px-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-[#15803d] flex items-center justify-center text-white shadow-sm">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-slate-800">Vicmar Support</span>
            </div>

            <nav className="flex-1 py-3 px-3 space-y-1">
              {SUPPORT_NAV_ITEMS.map((item) => {
                const isActive = activePage === item.page;
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setIsMobileNavOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                      isActive
                        ? "bg-[#15803d] text-white shadow-md shadow-green-700/20"
                        : "text-slate-600 hover:bg-green-50 hover:text-[#15803d]"
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 p-3">
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileNavOpen(false);
                }}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-screen lg:ml-[240px] relative z-10">
        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-10 pb-10">
          <div className="mb-8 hidden md:flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{pageContent.title}</h1>
              {pageContent.subtitle && <p className="text-sm font-medium text-slate-500 mt-1.5">{pageContent.subtitle}</p>}
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
