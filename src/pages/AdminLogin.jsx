import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getAdminLoginErrorMessage, isAuthorizedAdminUser } from "@/lib/adminAccess";
import { createPageUrl } from "../utils";
import heroImg from "@/images/hero-properties.jpg";
import logoImg from "@/images/logos/transparent-vicmar-logo.png";

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-not-found": "No admin account was found for this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many login attempts. Please try again later.",
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isAuthorizedAdminUser(user)) {
        navigate(createPageUrl("AdminDashboard"), { replace: true });
        return;
      }

      setIsCheckingSession(false);
    });

    return unsubscribe;
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);

      if (!isAuthorizedAdminUser(credential.user)) {
        setErrorMessage(getAdminLoginErrorMessage());
        await auth.signOut();
        return;
      }

      navigate(createPageUrl("AdminDashboard"), { replace: true });
    } catch (error) {
      const friendlyMessage = AUTH_ERROR_MESSAGES[error.code] ?? "Login failed. Please try again.";
      setErrorMessage(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate(createPageUrl("Home"), { replace: true });
  };

  // ── Loading / Authenticating Screen ──
  if (isCheckingSession) {
    return (
      <div className="h-screen w-screen bg-[#0a1f14] flex flex-col items-center justify-center overflow-hidden relative">
        {/* Animated gradient orbs */}
        <div className="absolute w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[140px] animate-pulse pointer-events-none" style={{ animationDuration: '3s' }} />
        <div className="absolute w-[300px] h-[300px] bg-[#15803d]/20 rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />

        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Logo */}
          <img src={logoImg} alt="Vicmar Homes" className="h-16 object-contain opacity-90 animate-in fade-in zoom-in duration-700" />
          
          {/* Loading bar */}
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-[#15803d] rounded-full animate-loading-bar" />
          </div>
          
          <p className="text-sm text-emerald-300/70 font-medium tracking-widest uppercase animate-in fade-in duration-1000">
            Loading Dashboard
          </p>
        </div>

        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; transform: translateX(0); }
            50% { width: 70%; }
            100% { width: 100%; transform: translateX(0); }
          }
          .animate-loading-bar {
            animation: loading-bar 1.8s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden relative">

      {/* Left Branding Side - Background image with green overlay */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        {/* Background Image */}
        <img 
          src={heroImg} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        {/* Green Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#15803d]/90 via-[#15803d]/85 to-emerald-800/90" />
        
        {/* Content on top */}
        <div className="relative z-10 flex flex-col justify-between p-12 lg:p-20 w-full">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="mb-12 text-emerald-100/80 hover:text-white hover:bg-white/10 -ml-4 rounded-lg px-4 py-2 flex items-center transition-all text-sm font-medium backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Website
            </button>
            
            {/* Logo */}
            <img 
              src={logoImg} 
              alt="Vicmar Homes" 
              className="h-20 lg:h-24 object-contain mb-8 drop-shadow-2xl brightness-0 invert"
            />
            
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 tracking-tight leading-tight">
              Admin Portal
            </h2>
            <p className="text-emerald-100/70 leading-relaxed font-medium max-w-sm text-base">
              Secure administration portal for managing subdivision plans, slot pricing, and handling customer support channels.
            </p>
          </div>

          <div className="text-emerald-200/40 text-xs font-medium">
            &copy; {new Date().getFullYear()} Vicmar Homes. Secure Access.
          </div>
        </div>
      </div>

      {/* Right Form Side */}
      <div className="w-full md:w-1/2 bg-white flex flex-col justify-center items-center p-8 md:p-16 lg:p-24">
        <div className="w-full max-w-md">
        
          {/* Mobile Back Button + Logo */}
          <div className="md:hidden mb-8">
            <button
              type="button"
              onClick={handleBack}
              className="self-start mb-4 text-slate-500 hover:bg-slate-100 -ml-4 rounded-md px-4 py-2 flex items-center transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return
            </button>
            <img src={logoImg} alt="Vicmar Homes" className="h-12 object-contain" />
          </div>

          <div className="mb-10">
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              Enter your authorized credentials to access the admin portal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] hover:border-slate-300"
                  placeholder="Enter your admin email"
                  required
                />
                <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Password</label>
              <div className="relative">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-4 text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] hover:border-slate-300"
                  placeholder="Enter your password"
                  required
                />
                <LockKeyhole className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {errorMessage && (
              <div className="animate-in fade-in slide-in-from-top-2 p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                 <p className="text-sm font-medium text-red-700 leading-relaxed">{errorMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#15803d] hover:bg-[#166534] text-white py-5 rounded-xl font-bold text-[15px] shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:bg-[#15803d] disabled:active:scale-100 mt-4 group relative overflow-hidden flex items-center justify-center"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In Securely"
                )}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}