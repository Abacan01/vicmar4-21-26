import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut, updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  PhilippinePeso,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { isPrimaryAdminUser } from "@/lib/adminAccess";
import { createPageUrl } from "@/utils";
import ModernLoader from "@/components/ModernLoader";
import { subscribeToAdminNotifications } from "@/lib/notificationService";
import * as Dialog from "@radix-ui/react-dialog";
import { Toaster, toast } from "sonner";
import { MapPinned as MapPinIcon, MessageCircle as MsgIcon } from "lucide-react";

const ADMIN_NAV_ITEMS = [
  {
    page: "AdminDashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    page: "AdminSlots",
    label: "Slot Management",
    icon: MapPinned,
  },
  {
    page: "AdminPropertyPricing",
    label: "Unit Pricing",
    icon: PhilippinePeso,
  },
];

const READ_NOTIFICATIONS_STORAGE_KEY = "vicmar_admin_read_notifications";
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = "vicmar_admin_dismissed_notifications";
const CLEARED_NOTIFICATIONS_AT_STORAGE_KEY = "vicmar_admin_notifications_cleared_at";

function readStoredStringArray(storageKey) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch (error) {
    return [];
  }
}

function writeStoredStringArray(storageKey, values) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set(values))));
  } catch (error) {
    // Ignore storage write errors.
  }
}

function readStoredNumber(storageKey) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    return 0;
  }
}

function writeStoredNumber(storageKey, value) {
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch (error) {
    // Ignore storage write errors.
  }
}

export default function AdminLayout({ currentPageName, children }) {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState(() => readStoredStringArray(READ_NOTIFICATIONS_STORAGE_KEY));
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => readStoredStringArray(DISMISSED_NOTIFICATIONS_STORAGE_KEY));
  const [clearedNotificationsAt, setClearedNotificationsAt] = useState(() => readStoredNumber(CLEARED_NOTIFICATIONS_AT_STORAGE_KEY));
  const [settingsTab, setSettingsTab] = useState("password");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!adminUser) return;
    const unsubscribe = subscribeToAdminNotifications(
      (notifs) => setNotifications(notifs),
      (err) => console.error("Notification error:", err)
    );
    return unsubscribe;
  }, [adminUser]);

  const visibleNotifications = useMemo(() => {
    const dismissedIds = new Set(dismissedNotificationIds);

    return notifications.filter((notification) => {
      if (dismissedIds.has(notification.id)) {
        return false;
      }

      if (!clearedNotificationsAt) {
        return true;
      }

      const timestamp = new Date(notification.timestamp).getTime();
      return !Number.isFinite(timestamp) || timestamp > clearedNotificationsAt;
    });
  }, [notifications, dismissedNotificationIds, clearedNotificationsAt]);

  const unreadCount = useMemo(() => {
    const readIds = new Set(readNotificationIds);
    return visibleNotifications.filter((notification) => !notification.read && !readIds.has(notification.id)).length;
  }, [visibleNotifications, readNotificationIds]);

  const markAllRead = () => {
    const idsToRead = visibleNotifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (!idsToRead.length) {
      return;
    }

    setReadNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, ...idsToRead]));
      writeStoredStringArray(READ_NOTIFICATIONS_STORAGE_KEY, next);
      return next;
    });
  };

  const removeNotification = (notificationId) => {
    if (!notificationId) {
      return;
    }

    setDismissedNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, notificationId]));
      writeStoredStringArray(DISMISSED_NOTIFICATIONS_STORAGE_KEY, next);
      return next;
    });
  };

  const clearAllNotifications = () => {
    const now = Date.now();
    setClearedNotificationsAt(now);
    writeStoredNumber(CLEARED_NOTIFICATIONS_AT_STORAGE_KEY, now);

    const visibleIds = visibleNotifications.map((notification) => notification.id);
    if (visibleIds.length > 0) {
      setReadNotificationIds((prev) => {
        const next = Array.from(new Set([...prev, ...visibleIds]));
        writeStoredStringArray(READ_NOTIFICATIONS_STORAGE_KEY, next);
        return next;
      });
    }
  };

  const formatTimeAgo = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const validAdminUser = isPrimaryAdminUser(user) ? user : null;
      setAdminUser(validAdminUser);
      setIsCheckingAuth(false);

      if (!validAdminUser) {
        if (user) {
          signOut(auth).catch((error) => console.error(error));
        }
        navigate(createPageUrl("AdminLogin"), { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  const activePage = useMemo(() => currentPageName ?? "AdminDashboard", [currentPageName]);

  const pageContent = useMemo(() => {
    switch (activePage) {
      case "AdminDashboard": return { title: "Overview", subtitle: "Monitor your system metrics, manage properties, and support customers." };
      case "AdminSlots": return { title: "Slot Management", subtitle: "Update lot status, lot details, and slot pricing" };
      case "AdminPropertyPricing": return { title: "Unit Pricing", subtitle: "Update prices shown in Properties, Listings, and Property Detail pages" };
      default: return { title: "Administration", subtitle: "" };
    }
  }, [activePage]);

  const { title, subtitle } = pageContent;

  const handleLogout = async () => {
    await signOut(auth);
    navigate(createPageUrl("AdminLogin"), { replace: true });
  };

  const resetSettingsForms = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewEmail("");
    setEmailCurrentPassword("");
    setSettingsTab("password");
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSettingsLoading(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success("Password updated successfully!");
      resetSettingsForms();
      setIsSettingsOpen(false);
    } catch (error) {
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        toast.error("Current password is incorrect.");
      } else {
        toast.error(error.message || "Failed to update password.");
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!emailCurrentPassword || !newEmail) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(newEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSettingsLoading(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, emailCurrentPassword);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail);
      toast.success("Email updated successfully!");
      resetSettingsForms();
      setIsSettingsOpen(false);
    } catch (error) {
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        toast.error("Current password is incorrect.");
      } else if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already in use.");
      } else {
        toast.error(error.message || "Failed to update email.");
      }
    } finally {
      setSettingsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <ModernLoader
        title="Loading administration panel"
        subtitle="Validating secure admin session..."
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#f0f9ff]/30 to-emerald-50/60 font-sans selection:bg-[#15803d]/20 selection:text-[#15803d] flex relative overflow-hidden">
      {/* Abstract Background Shapes for Glassmorphism to pop */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-[#15803d]/5 rounded-full blur-3xl pointer-events-none" />

      {/* ─── Left Sidebar ─── */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen z-50 bg-white/70 backdrop-blur-xl border-r border-white/50 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? "w-[72px]" : "w-[240px]"
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center h-20 border-b border-white/40 px-4 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
          <Link to={createPageUrl("AdminDashboard")} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#15803d] to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-green-700/20 transition-transform group-hover:scale-105 flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            {!isSidebarCollapsed && (
              <span className="text-base font-extrabold text-slate-800 tracking-tight whitespace-nowrap animate-in fade-in duration-200">
                Vicmar Homes
              </span>
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = activePage === item.page;
            const IconComponent = item.icon;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl transition-all duration-200 group relative ${
                  isSidebarCollapsed ? "justify-center px-0 py-3" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-[#15803d] text-white shadow-md shadow-green-700/20"
                    : "text-slate-500 hover:bg-green-50 hover:text-[#15803d]"
                }`}
              >
                <IconComponent className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
                {!isSidebarCollapsed && (
                  <span className="text-sm font-semibold whitespace-nowrap animate-in fade-in duration-200">
                    {item.label}
                  </span>
                )}
                {/* Active Indicator for collapsed mode */}
                {isActive && isSidebarCollapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-white rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto border-t border-white/40 p-4 space-y-2">
          {/* Collapse Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`flex items-center gap-3 w-full rounded-xl py-2.5 text-slate-400 hover:text-[#15803d] hover:bg-green-50 transition-all duration-200 ${
              isSidebarCollapsed ? "justify-center px-0" : "px-3"
            }`}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!isSidebarCollapsed && <span className="text-sm font-medium animate-in fade-in duration-200">Collapse</span>}
          </button>

          {/* Settings - Uses Radix Dialog for Modal */}
          <Dialog.Root open={isSettingsOpen} onOpenChange={(open) => { setIsSettingsOpen(open); if (!open) resetSettingsForms(); }}>
            <Dialog.Trigger asChild>
              <button
                className={`flex items-center gap-3 w-full rounded-xl py-2.5 text-slate-400 hover:text-[#15803d] hover:bg-green-50 transition-all duration-200 ${
                  isSidebarCollapsed ? "justify-center px-0" : "px-3"
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && <span className="text-sm font-medium animate-in fade-in duration-200">Settings</span>}
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 animate-in fade-in" />
              <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
                  <div>
                    <Dialog.Title className="text-lg font-bold text-slate-900">Account Settings</Dialog.Title>
                    <Dialog.Description className="text-sm text-slate-500 mt-1">Update your password or email address.</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button className="rounded-full p-2 hover:bg-slate-100 transition-colors">
                      <X className="w-5 h-5 text-slate-500" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
                  <button
                    onClick={() => setSettingsTab("password")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      settingsTab === "password"
                        ? "bg-white text-[#15803d] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => setSettingsTab("email")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      settingsTab === "email"
                        ? "bg-white text-[#15803d] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Change Email
                  </button>
                </div>

                {/* Change Password Form */}
                {settingsTab === "password" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                        placeholder="At least 6 characters"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                        placeholder="Re-enter new password"
                      />
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={settingsLoading}
                      className="w-full rounded-xl bg-[#15803d] px-4 py-3 text-sm font-bold text-white hover:bg-[#166534] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {settingsLoading ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating...</>
                      ) : "Update Password"}
                    </button>
                  </div>
                )}

                {/* Change Email Form */}
                {settingsTab === "email" && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-medium text-slate-500">Current email</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{adminUser?.email}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Current Password</label>
                      <input
                        type="password"
                        value={emailCurrentPassword}
                        onChange={(e) => setEmailCurrentPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                        placeholder="Verify your identity"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">New Email Address</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d]"
                        placeholder="newemail@example.com"
                      />
                    </div>
                    <button
                      onClick={handleChangeEmail}
                      disabled={settingsLoading}
                      className="w-full rounded-xl bg-[#15803d] px-4 py-3 text-sm font-bold text-white hover:bg-[#166534] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {settingsLoading ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating...</>
                      ) : "Update Email"}
                    </button>
                  </div>
                )}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* User Profile & Sign Out */}
          <div className={`flex items-center rounded-xl py-2 ${isSidebarCollapsed ? "justify-center px-0" : "px-3 gap-3"}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#15803d] to-emerald-400 text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm flex-shrink-0">
              {adminUser?.email?.[0] || "A"}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                <span className="text-sm font-bold text-slate-800 leading-none mb-1 block truncate">{adminUser?.email?.split("@")[0]}</span>
                <span className="text-[10px] text-emerald-600 font-bold leading-none uppercase tracking-wider">Administrator</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign out"
              className={`flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 flex-shrink-0 ${
                isSidebarCollapsed ? "w-9 h-9 mt-2" : "w-8 h-8"
              }`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Top Bar ─── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-sm flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="p-2 -ml-2 text-slate-500 hover:bg-white/50 rounded-full transition-colors">
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to={createPageUrl("AdminDashboard")} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#15803d] to-emerald-500 flex items-center justify-center text-white shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-base font-bold text-slate-800">Vicmar Homes</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile Notifications */}
          <div className="relative">
              <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="w-9 h-9 relative flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors focus:outline-none">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white px-1">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)}></div>
                  <div className="absolute right-0 top-12 z-50 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 outline-none animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">Notifications {unreadCount > 0 && <span className="text-xs text-white bg-red-500 rounded-full px-1.5 py-0.5 ml-1">{unreadCount}</span>}</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-[10px] font-bold text-[#15803d] uppercase tracking-wider hover:underline">
                            Mark all read
                          </button>
                        )}
                        {visibleNotifications.length > 0 && (
                          <button onClick={clearAllNotifications} className="text-[10px] font-bold text-rose-600 uppercase tracking-wider hover:underline">
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {visibleNotifications.length === 0 ? (
                        <div className="p-3 text-center py-8">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner"><Bell className="w-5 h-5 text-slate-300" /></div>
                          <p className="text-sm font-bold text-slate-700">No notifications yet</p>
                          <p className="text-xs font-medium text-slate-500 mt-1">Activity will appear here.</p>
                        </div>
                      ) : (
                        visibleNotifications.slice(0, 10).map((n) => {
                          const isRead = n.read || readNotificationIds.includes(n.id);

                          return (
                          <div key={n.id} className={`px-4 py-3 border-b border-slate-50 last:border-0 flex items-start gap-3 transition-colors ${isRead ? 'bg-white' : 'bg-green-50/40'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${n.icon === 'message' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-600'}`}>
                              {n.icon === 'message' ? <MsgIcon className="w-4 h-4" /> : <MapPinIcon className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800">{n.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{formatTimeAgo(n.timestamp)}</p>
                            </div>
                            <div className="flex items-start gap-2 mt-1">
                              {!isRead && <div className="w-2 h-2 rounded-full bg-[#15803d] mt-1 flex-shrink-0" />}
                              <button
                                onClick={() => removeNotification(n.id)}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                                aria-label="Remove notification"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {isMobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 animate-in fade-in duration-200" onClick={() => setIsMobileNavOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl animate-in slide-in-from-left duration-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 h-14 px-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-[#15803d] flex items-center justify-center text-white shadow-sm">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-slate-800">Vicmar Homes</span>
            </div>
            <nav className="flex-1 py-3 px-3 space-y-1">
              {ADMIN_NAV_ITEMS.map((item) => {
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
                onClick={() => { handleLogout(); setIsMobileNavOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div
        className={`flex-1 min-h-screen transition-all duration-300 ease-in-out relative z-10 ${
          isSidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[240px]"
        }`}
      >
        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-10 pb-10">
          {/* Main Title Area (Desktop) */}
          <div className="mb-8 hidden md:flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title ?? "Administration"}</h1>
              {subtitle && <p className="text-sm font-medium text-slate-500 mt-1.5">{subtitle}</p>}
            </div>
            
            <div className="flex items-center gap-4 z-50">
              {/* Desktop Notifications */}
              <div className="relative">
                  <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="w-10 h-10 relative flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-md border border-white/60 text-slate-500 hover:bg-white hover:text-[#15803d] hover:shadow-md transition-all duration-300 shadow-sm focus:outline-none">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#f1f5f9] px-1">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                  </button>
                  
                  {isNotificationsOpen && (
                    <>
                      <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsNotificationsOpen(false)}></div>
                      <div className="absolute right-0 top-14 z-50 w-96 bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 outline-none animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/40 bg-white/40 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-800">Notifications {unreadCount > 0 && <span className="text-xs text-white bg-red-500 rounded-full px-1.5 py-0.5 ml-1">{unreadCount}</span>}</h3>
                          <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                              <button className="text-[10px] font-bold text-[#15803d] uppercase tracking-wider hover:underline" onClick={() => { markAllRead(); }}>
                                Mark all read
                              </button>
                            )}
                            {visibleNotifications.length > 0 && (
                              <button className="text-[10px] font-bold text-rose-600 uppercase tracking-wider hover:underline" onClick={() => { clearAllNotifications(); }}>
                                Clear all
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {visibleNotifications.length === 0 ? (
                            <div className="p-3 text-center py-12 bg-white/20">
                              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner"><Bell className="w-6 h-6 text-slate-300" /></div>
                              <p className="text-sm font-bold text-slate-700">No notifications yet</p>
                              <p className="text-xs font-medium text-slate-500 mt-1">Slot changes and chat requests will appear here.</p>
                            </div>
                          ) : (
                            visibleNotifications.slice(0, 15).map((n) => {
                              const isRead = n.read || readNotificationIds.includes(n.id);

                              return (
                              <div key={n.id} className={`px-5 py-3.5 border-b border-slate-50/80 last:border-0 flex items-start gap-3 transition-colors hover:bg-slate-50/50 cursor-default ${isRead ? '' : 'bg-green-50/30'}`}>
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${n.icon === 'message' ? 'bg-blue-50 text-blue-500 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                  {n.icon === 'message' ? <MsgIcon className="w-4 h-4" /> : <MapPinIcon className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-800">{n.title}</p>
                                    <p className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{formatTimeAgo(n.timestamp)}</p>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                                </div>
                                <div className="flex items-start gap-2 mt-0.5">
                                  {!isRead && <div className="w-2 h-2 rounded-full bg-[#15803d] mt-2 flex-shrink-0" />}
                                  <button
                                    onClick={() => removeNotification(n.id)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors"
                                    aria-label="Remove notification"
                                    title="Remove"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
              </div>
            </div>
          </div>

          {/* Mobile Title */}
          <div className="mb-6 md:hidden animate-in fade-in duration-300">
            <h1 className="text-xl font-bold text-slate-900">{title ?? "Administration"}</h1>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
            {children}
          </div>
        </main>
      </div>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
