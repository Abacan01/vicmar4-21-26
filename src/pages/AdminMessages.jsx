import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { AlertCircle, ArrowDown, ArrowUp, Bot, MessageCircle, MoreHorizontal, Plus, Save, SendHorizontal, Trash2 } from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import {
  appendAdminMessage,
   closeSupportSession,
   DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
   DEFAULT_SUPPORT_FAQ_ITEMS,
   DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
   DEFAULT_SUPPORT_WELCOME_MESSAGE,
  endSupportSession,
   getSupportSessionIdleExpiration,
   saveSupportChatConfig,
   setSupportTypingState,
  setConversationStatus,
   SUPPORT_CHAT_IDLE_TIMEOUT_MS,
   subscribeToSupportChatConfig,
  subscribeToSupportSessions,
   touchSupportActivity,
} from "@/lib/supportChatService";

const ADMIN_AGENT_NAME_KEY = "vicmar_admin_agent_name";
const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;

function getSessionContactDetails(session) {
   if (!session) {
      return {
         displayName: "Visitor",
         name: "",
         email: "",
      };
   }

   const directName = String(session.visitorName ?? "").trim();
   const directEmail = String(session.visitorEmail ?? "").trim().toLowerCase();

   if (directName || directEmail) {
      return {
         displayName: directName || session.visitorLabel || "Visitor",
         name: directName,
         email: directEmail,
      };
   }

   const systemMessages = Array.isArray(session.messages) ? [...session.messages].reverse() : [];

   for (const message of systemMessages) {
      if (message.sender !== "system") {
         continue;
      }

      const text = String(message.text ?? "").trim();
      if (!text.toLowerCase().startsWith("contact details saved:")) {
         continue;
      }

      const detailsText = text.replace(/^contact details saved:\s*/i, "").trim();
      const emailMatch = detailsText.match(EMAIL_PATTERN);
      const parsedEmail = emailMatch ? emailMatch[1].toLowerCase() : "";
      const parsedName = detailsText
         .replace(parsedEmail, "")
         .replace(/[\u00B7|,-]\s*$/, "")
         .trim();

      return {
         displayName: parsedName || session.visitorLabel || "Visitor",
         name: parsedName,
         email: parsedEmail,
      };
   }

   return {
      displayName: session.visitorLabel || "Visitor",
      name: "",
      email: "",
   };
}

export default function AdminMessages() {
   const [activeTab, setActiveTab] = useState("live-console");
  const [syncError, setSyncError] = useState("");
   const [assistantSyncError, setAssistantSyncError] = useState("");
  const [isAdminSessionReady, setIsAdminSessionReady] = useState(false);
  const [supportSessions, setSupportSessions] = useState([]);
  const [activeSupportSessionId, setActiveSupportSessionId] = useState("");
  const [adminReply, setAdminReply] = useState("");
   const [isSavingAssistantConfig, setIsSavingAssistantConfig] = useState(false);
   const [assistantConfig, setAssistantConfig] = useState({
      faqItems: DEFAULT_SUPPORT_FAQ_ITEMS,
      fallbackReply: DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
      automationMessages: {
         welcomeMessage: DEFAULT_SUPPORT_WELCOME_MESSAGE,
         liveAgentRequestedMessage: DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
      },
   });
   const [assistantDraft, setAssistantDraft] = useState({
      faqItems: DEFAULT_SUPPORT_FAQ_ITEMS,
      fallbackReply: DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
      automationMessages: {
         welcomeMessage: DEFAULT_SUPPORT_WELCOME_MESSAGE,
         liveAgentRequestedMessage: DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
      },
   });
   const [newFaqQuestion, setNewFaqQuestion] = useState("");
   const [newFaqAnswer, setNewFaqAnswer] = useState("");
  const [adminAgentName, setAdminAgentName] = useState(() => {
    const storedName = localStorage.getItem(ADMIN_AGENT_NAME_KEY);
    return storedName ? storedName.trim() : "Admin";
  });
  
  // Pagination State for Chat Support
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const supportMessagesRef = useRef(null);
   const adminTypingDebounceRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminSessionReady(Boolean(user && !user.isAnonymous));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAdminSessionReady) return undefined;

    const unsubscribe = subscribeToSupportSessions(
      (nextSessions) => {
        const queue = nextSessions.filter((session) => session.liveAgentRequested);
        setSupportSessions(queue);
            setSyncError("");

        setActiveSupportSessionId((currentId) => {
          if (currentId && queue.some((session) => session.id === currentId)) {
            return currentId;
          }
          return queue[0]?.id ?? "";
        });
      },
      (error) => {
        console.error(error);
            const isPermissionError =
               error?.code === "permission-denied"
               || String(error?.message ?? "").includes("Missing or insufficient permissions");

            if (isPermissionError) {
               setSyncError("");
               return;
            }

            setSyncError("Live chat sync encountered a temporary issue. Retrying automatically.");
      },
      { allowAnonymous: false },
    );

    return unsubscribe;
  }, [isAdminSessionReady]);

   useEffect(() => {
      if (!isAdminSessionReady) return undefined;

      const unsubscribe = subscribeToSupportChatConfig(
         (nextConfig) => {
            const normalizedConfig = {
               faqItems: Array.isArray(nextConfig?.faqItems) && nextConfig.faqItems.length > 0
                  ? nextConfig.faqItems
                  : DEFAULT_SUPPORT_FAQ_ITEMS,
               fallbackReply: String(nextConfig?.fallbackReply ?? "").trim() || DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
               automationMessages: {
                  welcomeMessage: String(nextConfig?.automationMessages?.welcomeMessage ?? "").trim() || DEFAULT_SUPPORT_WELCOME_MESSAGE,
                  liveAgentRequestedMessage: String(nextConfig?.automationMessages?.liveAgentRequestedMessage ?? "").trim() || DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
               },
            };

            setAssistantConfig(normalizedConfig);
            setAssistantDraft(normalizedConfig);
            setAssistantSyncError("");
         },
         (error) => {
            console.error(error);
            setAssistantSyncError("Unable to sync assistant settings right now.");
         },
         { allowAnonymous: false },
      );

      return unsubscribe;
   }, [isAdminSessionReady]);

  const supportSummary = useMemo(() => {
    const result = {
      totalRequests: supportSessions.length,
      waiting: 0,
      active: 0,
      closed: 0,
    };

    supportSessions.forEach((session) => {
      if (session.status === "awaiting-agent") result.waiting += 1;
      else if (session.status === "agent-connected") result.active += 1;
      else if (session.status === "closed") result.closed += 1;
    });

    return result;
  }, [supportSessions]);

  const activeSupportSession = useMemo(
    () => supportSessions.find((session) => session.id === activeSupportSessionId) ?? null,
    [supportSessions, activeSupportSessionId],
  );

   const activeSessionContactDetails = useMemo(
      () => getSessionContactDetails(activeSupportSession),
      [activeSupportSession],
   );

  useEffect(() => {
    if (!supportMessagesRef.current) return;
    supportMessagesRef.current.scrollTop = supportMessagesRef.current.scrollHeight;
  }, [activeSupportSessionId, activeSupportSession?.messages?.length]);

   useEffect(() => {
      return () => {
         if (adminTypingDebounceRef.current) {
            window.clearTimeout(adminTypingDebounceRef.current);
         }
      };
   }, []);

   useEffect(() => {
      if (!activeSupportSessionId || !activeSupportSession) {
         return;
      }

      if (activeSupportSession.status === "closed" || !activeSupportSession.liveAgentRequested) {
         return;
      }

      const intervalId = window.setInterval(async () => {
         const expiration = getSupportSessionIdleExpiration(activeSupportSession);
         if (!expiration) {
            return;
         }

         await closeSupportSession(activeSupportSessionId, {
            reason: "expired",
            actor: "system",
            message: "Chat expired due to inactivity. You can review this chat and delete it when done.",
         });
      }, 15000);

      return () => {
         window.clearInterval(intervalId);
      };
   }, [activeSupportSession, activeSupportSessionId]);

  useEffect(() => {
    const normalizedName = adminAgentName.trim() || "Admin";
    localStorage.setItem(ADMIN_AGENT_NAME_KEY, normalizedName);
  }, [adminAgentName]);

  const adminDisplayName = useMemo(() => adminAgentName.trim() || "Admin", [adminAgentName]);
   const isAssistantDraftDirty = useMemo(
      () => JSON.stringify(assistantDraft) !== JSON.stringify(assistantConfig),
      [assistantDraft, assistantConfig],
   );

  const quickReplyTemplates = useMemo(() => {
    return [
      {
        label: "Intro",
        text: `Hello, I am ${adminDisplayName} from Vicmar Homes. How can I help you today?`,
      },
      {
        label: "Ask Details",
        text: "Thank you for contacting us. May I get your preferred property type and budget so I can assist you better?",
      },
      {
        label: "Schedule",
        text: "We can schedule your site visit. Please share your preferred date and time.",
      },
      {
        label: "Closing",
        text: "Thank you for your time. If you need more help, just send us a message anytime.",
      },
    ];
  }, [adminDisplayName]);

  const handleUseQuickReply = (text) => setAdminReply(text);

   const handleAssistantFallbackChange = (value) => {
      setAssistantDraft((currentDraft) => ({
         ...currentDraft,
         fallbackReply: value,
      }));
   };

   const handleAssistantAutoMessageChange = (field, value) => {
      setAssistantDraft((currentDraft) => ({
         ...currentDraft,
         automationMessages: {
            ...currentDraft.automationMessages,
            [field]: value,
         },
      }));
   };

   const handleAssistantFaqChange = (faqId, field, value) => {
      setAssistantDraft((currentDraft) => ({
         ...currentDraft,
         faqItems: currentDraft.faqItems.map((item) => {
            if (item.id !== faqId) {
               return item;
            }

            return {
               ...item,
               [field]: value,
            };
         }),
      }));
   };

   const handleAddAssistantFaq = () => {
      const trimmedQuestion = newFaqQuestion.trim();
      const trimmedAnswer = newFaqAnswer.trim();

      if (!trimmedQuestion || !trimmedAnswer) {
         toast.error("Please enter both question and answer.");
         return;
      }

      const nextFaqItem = {
         id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
         question: trimmedQuestion,
         answer: trimmedAnswer,
      };

      setAssistantDraft((currentDraft) => ({
         ...currentDraft,
         faqItems: [...currentDraft.faqItems, nextFaqItem],
      }));
      setNewFaqQuestion("");
      setNewFaqAnswer("");
   };

   const handleDeleteAssistantFaq = (faqId) => {
      setAssistantDraft((currentDraft) => {
         const nextFaqItems = currentDraft.faqItems.filter((item) => item.id !== faqId);
         return {
            ...currentDraft,
            faqItems: nextFaqItems.length > 0 ? nextFaqItems : currentDraft.faqItems,
         };
      });
   };

   const handleMoveAssistantFaq = (faqId, direction) => {
      setAssistantDraft((currentDraft) => {
         const currentIndex = currentDraft.faqItems.findIndex((item) => item.id === faqId);
         if (currentIndex < 0) {
            return currentDraft;
         }

         const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
         if (targetIndex < 0 || targetIndex >= currentDraft.faqItems.length) {
            return currentDraft;
         }

         const nextFaqItems = [...currentDraft.faqItems];
         const [movedItem] = nextFaqItems.splice(currentIndex, 1);
         nextFaqItems.splice(targetIndex, 0, movedItem);

         return {
            ...currentDraft,
            faqItems: nextFaqItems,
         };
      });
   };

   const handleResetAssistantDraft = () => {
      setAssistantDraft(assistantConfig);
   };

   const handleSaveAssistantConfig = async () => {
      const normalizedFaqItems = assistantDraft.faqItems
         .map((item) => ({
            ...item,
            question: String(item.question ?? "").trim(),
            answer: String(item.answer ?? "").trim(),
         }))
         .filter((item) => item.question && item.answer);

      if (normalizedFaqItems.length === 0) {
         toast.error("Please keep at least one FAQ item with both question and answer.");
         return;
      }

      const payload = {
         faqItems: normalizedFaqItems,
         fallbackReply: String(assistantDraft.fallbackReply ?? "").trim() || DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
         automationMessages: {
            welcomeMessage: String(assistantDraft.automationMessages?.welcomeMessage ?? "").trim() || DEFAULT_SUPPORT_WELCOME_MESSAGE,
            liveAgentRequestedMessage: String(assistantDraft.automationMessages?.liveAgentRequestedMessage ?? "").trim() || DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
         },
      };

      setIsSavingAssistantConfig(true);
      try {
         const savedConfig = await saveSupportChatConfig(payload, { allowAnonymous: false });
         setAssistantConfig(savedConfig);
         setAssistantDraft(savedConfig);
         toast.success("Assistant replies updated.");
      } catch (error) {
         console.error(error);
         toast.error("Unable to save assistant settings. Please try again.");
      } finally {
         setIsSavingAssistantConfig(false);
      }
   };

   const handleSendAdminReply = (event) => {
      event.preventDefault();

      const sendReply = async () => {
         const nextReply = adminReply.trim();
         if (!nextReply || !activeSupportSessionId) return;

         await appendAdminMessage(activeSupportSessionId, nextReply, adminDisplayName);
         await touchSupportActivity(activeSupportSessionId, "admin");
         await setSupportTypingState(activeSupportSessionId, "admin", false);
         setAdminReply("");
      };

      sendReply();
   };

   const handleConnectToLiveChat = async () => {
      if (!activeSupportSessionId) return;
      await setConversationStatus(activeSupportSessionId, "agent-connected");
      await touchSupportActivity(activeSupportSessionId, "admin");
   };

   const handleCloseConversation = async () => {
      if (!activeSupportSessionId) return;
      const isDeclined = activeSupportSession?.status === "awaiting-agent";
      await closeSupportSession(activeSupportSessionId, {
         reason: isDeclined ? "declined" : "admin-ended",
         actor: "admin",
         message: isDeclined
            ? "Live agent request was declined. Please start a new chat or contact us for further assistance."
            : "Chat ended by admin. You can review this chat and delete it when done.",
      });
   };

   const handleDeleteConversation = async () => {
      if (!activeSupportSessionId) return;
      await endSupportSession(activeSupportSessionId);
      toast.success("Chat deleted.");
   };

   const handleAdminReplyInputChange = async (value) => {
      setAdminReply(value);
      if (!activeSupportSessionId || activeSupportSession?.status === "closed") {
         return;
      }

      await setSupportTypingState(activeSupportSessionId, "admin", value.trim().length > 0);
      await touchSupportActivity(activeSupportSessionId, "admin");

      if (adminTypingDebounceRef.current) {
         window.clearTimeout(adminTypingDebounceRef.current);
      }

      adminTypingDebounceRef.current = window.setTimeout(() => {
         setSupportTypingState(activeSupportSessionId, "admin", false);
      }, 1200);
   };

  const getSessionStatusClassName = (status) => {
    if (status === "awaiting-agent") return "bg-amber-100 text-amber-700";
    if (status === "agent-connected") return "bg-emerald-100 text-emerald-700";
    if (status === "closed") return "bg-slate-200 text-slate-700";
    return "bg-slate-100 text-slate-600";
  };

  const getSessionStatusLabel = (status) => {
    if (status === "awaiting-agent") return "Waiting";
    if (status === "agent-connected") return "Live";
    if (status === "closed") return "Closed";
    return "Bot";
  };

  // Pagination Logic
  const totalPages = Math.ceil(supportSessions.length / itemsPerPage);
  const currentSessions = supportSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
   const idleLimitMinutes = Math.floor(SUPPORT_CHAT_IDLE_TIMEOUT_MS / 60000);

   return (
      <div className="space-y-6">
         <div className="flex justify-end">
            <div className="inline-flex rounded-2xl border border-emerald-200 bg-white p-1.5 shadow-sm w-full sm:w-auto">
               <button
                  type="button"
                  onClick={() => setActiveTab("live-console")}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                     activeTab === "live-console"
                        ? "bg-[#15803d] text-white"
                        : "text-slate-600 hover:bg-slate-50"
                  }`}
               >
                  <MessageCircle className="w-4 h-4" />
                  Live Console
               </button>
               <button
                  type="button"
                  onClick={() => setActiveTab("assistant-setup")}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                     activeTab === "assistant-setup"
                        ? "bg-[#15803d] text-white"
                        : "text-slate-600 hover:bg-slate-50"
                  }`}
               >
                  <Bot className="w-4 h-4" />
                  Assistant Setup
               </button>
            </div>
         </div>

         {activeTab === "live-console" ? (
            <>
               {syncError && (
                  <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 shadow-sm">
                     <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-500" />
                     <span className="font-medium">{syncError}</span>
                  </div>
               )}

               <div className="grid grid-cols-1 gap-5">
                  {/* Live Agent Requests Section */}
                  <section className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden h-[80vh] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-400">
             {/* Header */}
             <div className="px-6 py-4 border-b border-white/40 flex items-center justify-between bg-white/40">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-[#15803d]/10 flex items-center justify-center border border-[#15803d]/20">
                   <MessageCircle className="w-5 h-5 text-[#15803d]" />
                 </div>
                 <div>
                   <h2 className="text-base font-bold text-slate-900">Live Agent Console</h2>
                   <p className="text-xs text-slate-500 font-medium">Respond to live customer inquiries and manage active queues</p>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                 </button>
               </div>
             </div>

             {/* Grid Layout for Channels vs Chat Canvas */}
             <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                
                {/* Channels/Sessions List */}
                <div className="w-full lg:w-[320px] border-r border-white/50 flex flex-col bg-white/30 backdrop-blur-md">
                   <div className="p-4 border-b border-white/40">
                      <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                         <span>Inbox Queue</span>
                         <div className="flex items-center gap-1.5">
                           <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{supportSummary.waiting} Waiting</span>
                           <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{supportSummary.active} Active</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto w-full p-3 space-y-2">
                      {supportSessions.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                            <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-sm font-medium text-slate-500">No active requests.</p>
                         </div>
                      ) : (
                         currentSessions.map((session) => {
                           const isSelected = session.id === activeSupportSessionId;
                           const lastMessage = session.messages?.[session.messages.length - 1];
                                        const contactDetails = getSessionContactDetails(session);

                           return (
                             <button
                               key={session.id}
                               onClick={() => setActiveSupportSessionId(session.id)}
                               className={`w-full text-left rounded-2xl p-3.5 transition-all outline-none focus:ring-2 focus:ring-[#15803d]/30 ${
                                 isSelected
                                   ? "bg-white/90 border border-[#15803d]/30 shadow-sm relative before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1.5 before:bg-[#15803d] before:rounded-r-full"
                                   : "bg-transparent border border-transparent hover:bg-white/50"
                               }`}
                             >
                               <div className="flex items-center justify-between mb-1.5">
                                 <p className={`text-[13.5px] font-bold truncate pr-2 ${isSelected ? "text-slate-900" : "text-slate-700"}`}>
                                                      {contactDetails.displayName}
                                 </p>
                                 <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${getSessionStatusClassName(session.status)}`}>
                                   {getSessionStatusLabel(session.status)}
                                 </span>
                               </div>
                                              <p className="text-[11px] text-slate-500 line-clamp-1 mb-1">
                                                   {contactDetails.email || `Session ${session.id.slice(-6).toUpperCase()}`}
                                              </p>
                               <p className="text-xs text-slate-500 line-clamp-1">{lastMessage?.text ?? "Started chat..."}</p>
                             </button>
                           );
                         })
                      )}
                   </div>
                   {/* Pagination Controls */}
                   {totalPages > 1 && (
                      <div className="p-3 border-t border-white/40 flex items-center justify-between bg-white/40 text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                         <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-50 transition-colors bg-white/50"
                         >
                            Prev
                         </button>
                         <span>Page {currentPage} of {totalPages}</span>
                         <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-50 transition-colors bg-white/50"
                         >
                            Next
                         </button>
                      </div>
                   )}
                </div>

                {/* Chat Canvas Section */}
                <div className="flex-1 flex flex-col bg-slate-50/50">
                   {activeSupportSession ? (
                      <>
                         {/* Chat Header */}
                         <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10 w-full shadow-sm">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#15803d]/20 to-emerald-400/20 text-[#15803d] flex items-center justify-center font-black text-sm uppercase border border-[#15803d]/20 shadow-inner">
                                                   {activeSessionContactDetails.displayName?.[0] || 'U'}
                               </div>
                               <div>
                                                   <p className="text-[15px] font-bold text-slate-900">{activeSessionContactDetails.displayName}</p>
                                                   <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                      <p className="text-[11px] text-slate-500 font-medium tracking-wide">Session ID: {activeSupportSession.id.slice(-8).toUpperCase()}</p>
                                                      {activeSessionContactDetails.email ? (
                                                         <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                                            {activeSessionContactDetails.email}
                                                         </span>
                                                      ) : null}
                                                   </div>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               <button
                                  onClick={handleConnectToLiveChat}
                                  disabled={activeSupportSession.status === "agent-connected"}
                                  className="text-[11px] uppercase tracking-wider font-bold rounded-xl px-4 py-2.5 bg-[#15803d] text-white hover:bg-[#166534] disabled:opacity-50 shadow-sm transition-all active:scale-[0.98]"
                               >
                                  {activeSupportSession.status === "agent-connected" ? "Live Connected" : "Accept Session"}
                               </button>
                               <AlertDialog.Root>
                                  <AlertDialog.Trigger asChild>
                                     <button
                                        disabled={activeSupportSession.status === "closed"}
                                        className="text-[11px] uppercase tracking-wider font-bold rounded-xl px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-all active:scale-[0.98]"
                                     >
                                        Close Chat
                                     </button>
                                  </AlertDialog.Trigger>
                                  <AlertDialog.Portal>
                                     <AlertDialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 animate-in fade-in" />
                                     <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-6 shadow-lg sm:rounded-3xl animate-in fade-in zoom-in-95">
                                        <div className="flex flex-col space-y-2 text-center sm:text-left">
                                           <AlertDialog.Title className="text-lg font-bold text-slate-900">
                                              Close Support Session
                                           </AlertDialog.Title>
                                           <AlertDialog.Description className="text-sm text-slate-500">
                                              Are you sure you want to close this chat with <strong>{activeSupportSession.visitorLabel}</strong>? The transcript stays visible until you delete it.
                                           </AlertDialog.Description>
                                        </div>
                                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
                                           <AlertDialog.Cancel asChild>
                                              <button className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                                                 Cancel
                                              </button>
                                           </AlertDialog.Cancel>
                                           <AlertDialog.Action asChild>
                                              <button 
                                                 onClick={async () => {
                                                    await handleCloseConversation();
                                                    toast.success("Support session closed.");
                                                 }}
                                                 className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                                              >
                                                 Close Session
                                              </button>
                                           </AlertDialog.Action>
                                        </div>
                                     </AlertDialog.Content>
                                  </AlertDialog.Portal>
                               </AlertDialog.Root>
                               {activeSupportSession.status === "closed" ? (
                                  <AlertDialog.Root>
                                     <AlertDialog.Trigger asChild>
                                        <button className="text-[11px] uppercase tracking-wider font-bold rounded-xl px-4 py-2.5 border border-rose-200 text-rose-700 hover:bg-rose-50 transition-all active:scale-[0.98]">
                                           Delete Chat
                                        </button>
                                     </AlertDialog.Trigger>
                                     <AlertDialog.Portal>
                                        <AlertDialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 animate-in fade-in" />
                                        <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-6 shadow-lg sm:rounded-3xl animate-in fade-in zoom-in-95">
                                           <div className="flex flex-col space-y-2 text-center sm:text-left">
                                              <AlertDialog.Title className="text-lg font-bold text-slate-900">Delete Chat Transcript</AlertDialog.Title>
                                              <AlertDialog.Description className="text-sm text-slate-500">Delete this transcript permanently after review?</AlertDialog.Description>
                                           </div>
                                           <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
                                              <AlertDialog.Cancel asChild>
                                                 <button className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">Cancel</button>
                                              </AlertDialog.Cancel>
                                              <AlertDialog.Action asChild>
                                                 <button
                                                    onClick={handleDeleteConversation}
                                                    className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                                                 >
                                                    Delete
                                                 </button>
                                              </AlertDialog.Action>
                                           </div>
                                        </AlertDialog.Content>
                                     </AlertDialog.Portal>
                                  </AlertDialog.Root>
                               ) : null}
                            </div>
                         </div>

                         {activeSupportSession.typing?.user && activeSupportSession.status !== "closed" ? (
                            <div className="px-6 py-2 border-b border-slate-100 bg-white/70 text-[11px] text-blue-700 font-semibold">
                                 {activeSessionContactDetails.displayName} is typing...
                            </div>
                         ) : null}

                         {activeSupportSession.liveAgentRequested && activeSupportSession.status !== "closed" ? (
                            <div className="px-6 py-2 border-b border-slate-100 bg-amber-50/70 text-[11px] text-amber-700 font-medium">
                               This live chat auto-expires after about {idleLimitMinutes} minutes of inactivity from either side.
                            </div>
                         ) : null}

                         {/* Chat Messages */}
                         <div ref={supportMessagesRef} className="flex-1 p-6 overflow-y-auto bg-transparent space-y-5">
                            {(activeSupportSession.messages ?? []).map((message) => {
                               const isAdmin = message.sender === "admin";
                               const isUser = message.sender === "user";
                               const bubbleClassName = isAdmin
                               ? "bg-gradient-to-br from-[#15803d] to-emerald-600 text-white rounded-br-sm shadow-md"
                               : isUser
                                  ? "bg-white text-slate-800 border border-slate-100 rounded-bl-sm shadow-md"
                                  : "bg-amber-100 text-amber-900 rounded-bl-sm shadow-sm";

                               return (
                               <div key={message.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[75%] lg:max-w-[60%] rounded-[20px] px-5 py-3.5 text-[14px] font-medium leading-relaxed ${bubbleClassName} flex flex-col`}>
                                     {isAdmin ? <p className="text-[10px] font-bold text-emerald-200 mb-1 tracking-wider uppercase">{message.adminName ?? "Admin"}</p> : null}
                                     <p>{message.text}</p>
                                  </div>
                               </div>
                               );
                            })}
                         </div>

                         {/* Chat Input & Quick Replies */}
                         <div className="p-5 border-t border-slate-200/60 bg-white/80 backdrop-blur-xl flex flex-col gap-3">
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                               {quickReplyTemplates.map((template) => (
                                  <button
                                     key={template.label}
                                     onClick={() => handleUseQuickReply(template.text)}
                                     className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                                  >
                                     {template.label}
                                  </button>
                               ))}
                            </div>

                            <form onSubmit={handleSendAdminReply} className="flex gap-3 relative">
                               <div className="flex-1 bg-white border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-[#15803d]/30 focus-within:border-[#15803d]/50 transition-all p-3 flex flex-col shadow-sm">
                                  <input
                                     type="text"
                                     value={adminReply}
                                    onChange={(e) => {
                                       handleAdminReplyInputChange(e.target.value);
                                    }}
                                     placeholder="Type your reply here..."
                                     className="w-full bg-transparent text-[15px] focus:outline-none mb-3 font-medium placeholder:text-slate-400"
                                  />
                                  <div className="flex items-center justify-between mt-auto px-1 border-t border-slate-100 pt-2">
                                     <div className="flex items-center gap-2">
                                        <label htmlFor="agent-name" className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sending As:</label>
                                        <input
                                           id="agent-name"
                                           type="text"
                                           value={adminAgentName}
                                           onChange={(e) => setAdminAgentName(e.target.value)}
                                           className="w-24 bg-transparent border-b border-transparent hover:border-slate-200 text-xs font-bold text-slate-600 focus:outline-none focus:border-[#15803d] transition-colors px-1"
                                        />
                                     </div>
                                  </div>
                               </div>
                               <button
                                  type="submit"
                                  disabled={!adminReply.trim() || !activeSupportSessionId}
                                  className="self-end w-14 h-14 bg-[#15803d] text-white rounded-2xl flex items-center justify-center hover:bg-[#166534] disabled:opacity-50 disabled:hover:bg-[#15803d] shadow-lg shadow-green-900/10 transition-all active:scale-95 flex-shrink-0"
                               >
                                  <SendHorizontal className="w-6 h-6 ml-0.5" />
                               </button>
                            </form>
                         </div>
                      </>
                   ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
                         <MessageCircle className="w-16 h-16 mb-4 text-slate-200" />
                         <h3 className="text-xl font-bold text-slate-800 mb-2">Select a Conversation</h3>
                         <p className="max-w-xs text-sm font-medium">Choose an active support session from the queue sidebar to start helping customers.</p>
                      </div>
                   )}
                </div>
             </div>
           </section>
               </div>
            </>
         ) : (
            <section className="bg-white border border-slate-200 rounded-3xl shadow-[0_12px_38px_rgba(15,23,42,0.08)] overflow-hidden">
               <div className="px-6 py-5 border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_60%)]">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                     <div className="space-y-1">
                        <h2 className="text-xl font-black text-slate-900">FAQ Assistant Replies</h2>
                        <p className="text-sm text-slate-500">Edit quick questions and bot replies used on the customer chat modal.</p>
                     </div>
                     <div className="flex items-center gap-2">
                        <button
                           type="button"
                           onClick={handleResetAssistantDraft}
                           disabled={!isAssistantDraftDirty || isSavingAssistantConfig}
                           className="text-xs font-bold uppercase tracking-wide rounded-xl px-3.5 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
                        >
                           Discard Changes
                        </button>
                        <button
                           type="button"
                           onClick={handleSaveAssistantConfig}
                           disabled={!isAssistantDraftDirty || isSavingAssistantConfig}
                           className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide rounded-xl px-4 py-2.5 bg-[#15803d] text-white hover:bg-[#166534] disabled:opacity-50"
                        >
                           <Save className="w-3.5 h-3.5" />
                           {isSavingAssistantConfig ? "Saving..." : "Save Assistant"}
                        </button>
                     </div>
                  </div>
               </div>

               {assistantSyncError ? (
                  <div className="mx-6 mt-5 flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
                     <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-500" />
                     <span className="font-medium">{assistantSyncError}</span>
                  </div>
               ) : null}

               <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 p-6">
                  <aside className="space-y-4">
                     <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Automatic chat messages</p>

                        <label className="block text-xs font-semibold text-slate-500 mt-3 mb-1">Welcome message (first bot message)</label>
                        <textarea
                           value={assistantDraft.automationMessages?.welcomeMessage ?? ""}
                           onChange={(event) => handleAssistantAutoMessageChange("welcomeMessage", event.target.value)}
                           rows={4}
                           className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                           placeholder="Initial message shown when a new chat starts"
                        />

                        <label className="block text-xs font-semibold text-slate-500 mt-3 mb-1">Assistance requested message</label>
                        <textarea
                           value={assistantDraft.automationMessages?.liveAgentRequestedMessage ?? ""}
                           onChange={(event) => handleAssistantAutoMessageChange("liveAgentRequestedMessage", event.target.value)}
                           rows={3}
                           className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                           placeholder="System message shown after user taps Need Assistance"
                        />
                     </div>

                     <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Default fallback reply</p>
                        <textarea
                           value={assistantDraft.fallbackReply}
                           onChange={(event) => handleAssistantFallbackChange(event.target.value)}
                           rows={5}
                           className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                           placeholder="Reply when no FAQ matches the user question"
                        />
                     </div>

                     <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Add new FAQ</p>
                        <div className="space-y-2">
                           <input
                              type="text"
                              value={newFaqQuestion}
                              onChange={(event) => setNewFaqQuestion(event.target.value)}
                              placeholder="Quick question"
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/25"
                           />
                           <textarea
                              value={newFaqAnswer}
                              onChange={(event) => setNewFaqAnswer(event.target.value)}
                              rows={4}
                              placeholder="Bot answer"
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/25"
                           />
                           <button
                              type="button"
                              onClick={handleAddAssistantFaq}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#15803d] text-white text-sm font-bold py-2.5 hover:bg-[#166534]"
                           >
                              <Plus className="w-4 h-4" />
                              Add FAQ Item
                           </button>
                        </div>
                     </div>
                  </aside>

                  <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
                     {assistantDraft.faqItems.map((item, index) => (
                        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                           <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                 <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">{index + 1}</span>
                                 FAQ Item
                              </div>
                              <div className="flex items-center gap-1">
                                 <button
                                    type="button"
                                    onClick={() => handleMoveAssistantFaq(item.id, "up")}
                                    disabled={index === 0}
                                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                    aria-label="Move up"
                                 >
                                    <ArrowUp className="w-4 h-4 mx-auto" />
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => handleMoveAssistantFaq(item.id, "down")}
                                    disabled={index === assistantDraft.faqItems.length - 1}
                                    className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                    aria-label="Move down"
                                 >
                                    <ArrowDown className="w-4 h-4 mx-auto" />
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => handleDeleteAssistantFaq(item.id)}
                                    disabled={assistantDraft.faqItems.length === 1}
                                    className="w-8 h-8 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                    aria-label="Delete FAQ"
                                 >
                                    <Trash2 className="w-4 h-4 mx-auto" />
                                 </button>
                              </div>
                           </div>

                           <div className="space-y-3">
                              <div>
                                 <label className="block text-xs font-semibold text-slate-500 mb-1">Question</label>
                                 <input
                                    type="text"
                                    value={item.question}
                                    onChange={(event) => handleAssistantFaqChange(item.id, "question", event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/25"
                                 />
                              </div>
                              <div>
                                 <label className="block text-xs font-semibold text-slate-500 mb-1">Answer</label>
                                 <textarea
                                    value={item.answer}
                                    onChange={(event) => handleAssistantFaqChange(item.id, "answer", event.target.value)}
                                    rows={4}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/25"
                                 />
                              </div>
                           </div>
                        </article>
                     ))}
                  </div>
               </div>
            </section>
         )}
    </div>
  );
}
