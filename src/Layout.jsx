import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { createPageUrl } from "./utils";
import { Menu, X, Phone, Mail, MapPin, Facebook, Instagram, Youtube, ChevronDown, HelpCircle, ChevronUp, MessageCircle, SendHorizontal } from "lucide-react";
import vicmarLogo from "@/images/logos/transparent-vicmar-logo.png";
import vicmarLogoFooter from "@/images/logos/vicmar-logo-footer.png";
import {
  appendBotMessage,
  appendUserMessage,
  closeSupportSession,
  createSupportSession,
  DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
  DEFAULT_SUPPORT_FAQ_ITEMS,
  DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
  DEFAULT_SUPPORT_WELCOME_MESSAGE,
  endSupportSession,
  getSupportSessionIdleExpiration,
  getOrCreateActiveSupportSession,
  requestLiveAgent,
  setSupportTypingState,
  subscribeToSupportChatConfig,
  subscribeToSupportSessions,
  SUPPORT_CHAT_IDLE_TIMEOUT_MS,
  touchSupportActivity,
} from "@/lib/supportChatService";
import { buildVicinitySlots, getAllVicinityProperties } from "@/lib/vicinitySlots";
import { normalizeSlotStatus } from "@/lib/slotStatus";
import { subscribeToSlotStatuses } from "@/lib/slotStatusService";
const CHAT_MAX_CHARACTERS = 320;
const CHAT_MAX_WORDS = 60;
const CHAT_MAX_WORD_LENGTH = 42;
const CHAT_MIN_SEND_INTERVAL_MS = 0;
const CHAT_BURST_WINDOW_MS = 0;
const CHAT_BURST_MAX_MESSAGES = 0;

function detectPropertyTypeIntent(question) {
  const q = String(question ?? "").toLowerCase();
  if (q.includes("duplex")) return "duplex";
  if (q.includes("triplex")) return "triplex";
  if (q.includes("corner")) return "corner";
  if (q.includes("compound")) return "compound";
  if (q.includes("economic")) return "economic";
  if (q.includes("socialized")) return "socialized";
  if (q.includes("rowhouse") || q.includes("row house")) return "rowhouse";
  return "";
}

function normalizeTypeForMatch(rawType) {
  return String(rawType ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function typeMatches(rawType, requestedType) {
  if (!requestedType) return true;
  const normalizedType = normalizeTypeForMatch(rawType);
  if (!normalizedType) return false;
  if (requestedType === "rowhouse") {
    return normalizedType.includes("rowhouse") || normalizedType.includes("row house");
  }
  return normalizedType.includes(requestedType);
}

function summarizeAvailability(slots, requestedType = "") {
  const filteredSlots = slots.filter((slot) => typeMatches(slot.type, requestedType));
  if (filteredSlots.length === 0) {
    return null;
  }

  const available = filteredSlots.filter((slot) => slot.status === "available").length;
  const reserved = filteredSlots.filter((slot) => slot.status === "reserved").length;
  const notAvailable = filteredSlots.filter((slot) => slot.status === "not_available").length;

  return {
    total: filteredSlots.length,
    available,
    reserved,
    notAvailable,
  };
}

function summarizeArea(slots, requestedType = "") {
  const areas = slots
    .filter((slot) => typeMatches(slot.type, requestedType))
    .map((slot) => Number(slot.lotArea))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (areas.length === 0) {
    return null;
  }

  return {
    min: Math.min(...areas),
    max: Math.max(...areas),
  };
}

function summarizeTypes(slots) {
  const typeCounts = new Map();

  slots.forEach((slot) => {
    const type = String(slot.type ?? "").trim() || "Unit";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  });

  return [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type} (${count})`)
    .slice(0, 6)
    .join(", ");
}

function summarizePrice(slots, requestedType = "") {
  const prices = slots
    .filter((slot) => typeMatches(slot.type, requestedType))
    .map((slot) => Number(slot.price))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (prices.length === 0) {
    return null;
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function isLiveAgentIntent(question) {
  const q = String(question ?? "").toLowerCase();
  return (
    q.includes("live agent") ||
    q.includes("contact agent") ||
    q.includes("contact live agent") ||
    q.includes("talk to agent") ||
    q.includes("speak to agent") ||
    q.includes("chat with agent") ||
    q.includes("human agent")
  );
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function getRuleBasedBotReply(question, slots, assistantConfig) {
  const q = String(question ?? "").toLowerCase();
  const requestedType = detectPropertyTypeIntent(q);

  if (containsAny(q, ["hello", "hi", "good morning", "good afternoon", "good evening", "hey"])) {
  return "Hello. I can help with unit availability, prices, lot sizes, financing, and site visit scheduling. Ask anything or tap Need Assistance for direct help.";
  }

  if (containsAny(q, ["thank you", "thanks", "tnx", "salamat"])) {
    return "You are welcome. If you want, I can also check current availability or pricing by unit type right now.";
  }

  const asksAvailability =
    q.includes("available") ||
    q.includes("availability") ||
    q.includes("vacant") ||
    q.includes("how many") ||
    q.includes("count") ||
    q.includes("units left") ||
    q.includes("remaining");

  if (asksAvailability) {
    const summary = summarizeAvailability(slots, requestedType);
    if (summary) {
      const scopeLabel = requestedType ? `${requestedType} units` : "all units";
      return `Current ${scopeLabel} status: ${summary.available} available, ${summary.reserved} reserved, and ${summary.notAvailable} not available (total ${summary.total}). For exact lot numbers, please open Subdivision Plan or ask for assistance.`;
    }
  }

  const asksArea = q.includes("lot area") || q.includes("sqm") || q.includes("square meter") || q.includes("size");
  if (asksArea) {
    const areaSummary = summarizeArea(slots, requestedType);
    if (areaSummary) {
      const scopeLabel = requestedType ? `${requestedType} units` : "our units";
      return `For ${scopeLabel}, lot areas currently range around ${areaSummary.min} sqm to ${areaSummary.max} sqm based on the latest map configuration.`;
    }
  }

  const asksPrice =
    q.includes("how much") ||
    q.includes("price") ||
    q.includes("cost") ||
    q.includes("monthly") ||
    q.includes("downpayment") ||
    q.includes("dp");
  if (asksPrice) {
    const priceSummary = summarizePrice(slots, requestedType);
    if (priceSummary) {
      const scopeLabel = requestedType ? `${requestedType} units` : "units";
      const priceText = priceSummary.min === priceSummary.max
        ? `${formatPrice(priceSummary.min)}`
        : `${formatPrice(priceSummary.min)} to ${formatPrice(priceSummary.max)}`;

      return `Based on current slot pricing data, ${scopeLabel} are around ${priceText}. Final pricing can vary by lot, promo, and financing terms.`;
    }

    if (requestedType) {
      return `I do not have a confirmed price value yet for ${requestedType} units in the current live data. Tap Need Assistance so we can provide an updated quotation.`;
    }

    return "I can help with estimated pricing, but I need the unit type first (for example: duplex, triplex, rowhouse).";
  }

  if (q.includes("what units") || q.includes("unit types") || q.includes("types available")) {
    const typesText = summarizeTypes(slots);
    if (typesText) {
      return `Current mapped unit types include: ${typesText}. Ask me for availability of a specific type (example: duplex, triplex, rowhouse).`;
    }
  }

  if (q.includes("payment") || q.includes("financing") || q.includes("pag ibig") || q.includes("pag-ibig") || q.includes("loan")) {
    return "We support flexible payment options including bank financing, Pag-IBIG, in-house financing, and spot cash options. I can connect you to assistance to discuss exact computations and requirements.";
  }

  if (containsAny(q, ["requirement", "requirements", "documents", "docs", "what do i need", "requirements for"] )) {
    return "Typical requirements include valid IDs, proof of billing/address, proof of income, and financing-specific forms. Exact requirements depend on your chosen financing option, so assistance can send a complete checklist.";
  }

  if (containsAny(q, ["site visit", "tripping", "visit", "schedule", "appointment"])) {
    return "We can help schedule your site visit. Please share your preferred date and time, or tap Need Assistance so we can finalize your appointment quickly.";
  }

  if (containsAny(q, ["promo", "discount", "discounts", "offer", "offers", "special offer"])) {
    return "Promos and discounts can vary by unit type and payment terms. For the latest active promos and exact computation, tap Need Assistance and we will assist you directly.";
  }

  if (containsAny(q, ["turnover", "move in", "move-in", "ready for occupancy", "rfo", "occupancy"])) {
    return "Turnover timelines depend on the selected unit and project schedule. Assistance can confirm the most updated expected turnover for your preferred lot.";
  }

  if (containsAny(q, ["contact", "phone", "email", "call", "reach"] )) {
    return "You can use the Contact Us page for direct details, or tap Need Assistance here and an admin will continue the conversation in this chat.";
  }

  if (q.includes("amenit") || q.includes("garden") || q.includes("playground") || q.includes("community")) {
    return "Vicmar Homes includes community greenways, food gardens, playground areas, and shared open spaces designed for sustainable living.";
  }

  if (q.includes("location") || q.includes("where") || q.includes("vicinity") || q.includes("map")) {
    return "You can explore exact lot placement in the Subdivision Plan page for block, phase, and unit-level details. If you need guided recommendations, tap Need Assistance.";
  }

  const matchedItem = assistantConfig.faqItems.find((item) => {
    const prompt = String(item?.question ?? "").toLowerCase();
    return prompt.includes(q) || q.includes(prompt);
  });

  if (matchedItem?.answer) {
    return matchedItem.answer;
  }

  return assistantConfig.fallbackReply;
}

function normalizeChatMessage(rawValue) {
  return String(rawValue ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function validateChatMessage(rawValue) {
  const normalized = normalizeChatMessage(rawValue);

  if (!normalized) {
    return { ok: false, value: "", reason: "Please type a message first." };
  }

  if (normalized.length > CHAT_MAX_CHARACTERS) {
    return { ok: false, value: normalized, reason: `Message is too long (max ${CHAT_MAX_CHARACTERS} characters).` };
  }

  const words = normalized.split(" ").filter(Boolean);
  if (words.length > CHAT_MAX_WORDS) {
    return { ok: false, value: normalized, reason: `Please keep message up to ${CHAT_MAX_WORDS} words.` };
  }

  if (words.some((word) => word.length > CHAT_MAX_WORD_LENGTH)) {
    return { ok: false, value: normalized, reason: `A word is too long (max ${CHAT_MAX_WORD_LENGTH} characters per word).` };
  }

  return { ok: true, value: normalized, reason: "" };
}

function isPermissionError(error) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  return code === "permission-denied" || message.includes("missing or insufficient permissions");
}

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [quickQuestionsOpen, setQuickQuestionsOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatInputError, setChatInputError] = useState("");
  const [activeChatId, setActiveChatId] = useState("");
  const [chatSession, setChatSession] = useState(null);
  const [assistantConfig, setAssistantConfig] = useState({
    faqItems: DEFAULT_SUPPORT_FAQ_ITEMS,
    fallbackReply: DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
    automationMessages: {
      welcomeMessage: DEFAULT_SUPPORT_WELCOME_MESSAGE,
      liveAgentRequestedMessage: DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
    },
  });
  const [slotStatuses, setSlotStatuses] = useState({});
  const faqPanelRef = useRef(null);
  const faqBtnRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const lastUserSendAtRef = useRef(0);
  const recentUserSendsRef = useRef([]);
  const typingDebounceRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        faqPanelRef.current && !faqPanelRef.current.contains(e.target) &&
        faqBtnRef.current && !faqBtnRef.current.contains(e.target)
      ) {
        setFaqOpen(false);
      }
    };
    if (faqOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [faqOpen]);

  useEffect(() => {
    if (!faqOpen) {
      setQuickQuestionsOpen(false);
    }
  }, [faqOpen]);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      const session = await getOrCreateActiveSupportSession();
      if (!isMounted) {
        return;
      }

      setActiveChatId(session.id);
      setChatSession(session);
    };

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const mappedSlots = useMemo(() => {
    const baseSlots = buildVicinitySlots(getAllVicinityProperties());
    return baseSlots.map((slot) => {
      const override = slotStatuses[slot.slotId];
      const status = normalizeSlotStatus(override?.status ?? slot.defaultStatus);

      return {
        ...slot,
        status,
      };
    });
  }, [slotStatuses]);

  useEffect(() => {
    const unsubscribe = subscribeToSlotStatuses(
      (statuses) => {
        setSlotStatuses(statuses ?? {});
      },
      () => undefined,
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSupportChatConfig(
      (config) => {
        setAssistantConfig({
          faqItems: Array.isArray(config?.faqItems) && config.faqItems.length > 0
            ? config.faqItems
            : DEFAULT_SUPPORT_FAQ_ITEMS,
          fallbackReply: String(config?.fallbackReply ?? "").trim() || DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER,
          automationMessages: {
            welcomeMessage: String(config?.automationMessages?.welcomeMessage ?? "").trim() || DEFAULT_SUPPORT_WELCOME_MESSAGE,
            liveAgentRequestedMessage: String(config?.automationMessages?.liveAgentRequestedMessage ?? "").trim() || DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
          },
        });
      },
      () => undefined,
      { allowAnonymous: true },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeChatId) {
      return;
    }

    const unsubscribe = subscribeToSupportSessions((sessions) => {
      const currentSession = sessions[0] ?? null;
      setChatSession(currentSession);
    }, undefined, { chatId: activeChatId });

    return unsubscribe;
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId || chatSession !== null) {
      return;
    }

    let isMounted = true;

    const recoverDeletedSession = async () => {
      const nextSession = await createSupportSession();
      if (!isMounted) {
        return;
      }

      setActiveChatId(nextSession.id);
      setChatSession(nextSession);
      setChatInput("");
    };

    recoverDeletedSession();

    return () => {
      isMounted = false;
    };
  }, [activeChatId, chatSession]);

  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) {
        window.clearTimeout(typingDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!chatMessagesRef.current) {
      return;
    }

    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
  }, [faqOpen, chatSession?.messages?.length]);

  useEffect(() => {
    if (!activeChatId || !chatSession) {
      return;
    }

    if (chatSession.status === "closed") {
      return;
    }

    if (!chatSession.liveAgentRequested) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const expiration = getSupportSessionIdleExpiration(chatSession);
      if (!expiration) {
        return;
      }

      await closeSupportSession(activeChatId, {
        reason: "expired",
        actor: "system",
        message: "Chat expired due to inactivity. You can review this chat and delete it when done.",
      });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeChatId, chatSession]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const ensureActiveSession = async () => {
    if (activeChatId) {
      return activeChatId;
    }

    const session = await getOrCreateActiveSupportSession();
    setActiveChatId(session.id);
    setChatSession(session);
    return session.id;
  };

  const handleSendQuestion = async (rawQuestion) => {
    const validation = validateChatMessage(rawQuestion);
    if (!validation.ok) {
      setChatInputError(validation.reason);
      return;
    }

    const question = validation.value;
    setChatInputError("");

    const sessionId = await ensureActiveSession();
    if (!sessionId) {
      return;
    }

    if (chatSession?.status === "closed") {
      setChatInputError("This chat is closed. Start a new chat to continue.");
      return;
    }

    const now = Date.now();
    const normalizedQuestion = question.toLowerCase();
    const lastUserMessage = [...(chatSession?.messages ?? [])]
      .reverse()
      .find((message) => message.sender === "user");
    if (lastUserMessage && normalizeChatMessage(lastUserMessage.text).toLowerCase() === normalizedQuestion) {
      setChatInputError("You just sent the same message. Please edit it before sending again.");
      return;
    }

    lastUserSendAtRef.current = now;
    recentUserSendsRef.current.push(now);

    await appendUserMessage(sessionId, question);
  void touchSupportActivity(sessionId, "user");
  void setSupportTypingState(sessionId, "user", false);

    if (isLiveAgentIntent(question)) {
      try {
        await requestLiveAgent(sessionId);
      } catch (error) {
        if (isPermissionError(error)) {
          try {
            const nextSession = await createSupportSession();
            setActiveChatId(nextSession.id);
            setChatSession(nextSession);
            await requestLiveAgent(nextSession.id);
            toast.success("Chat session refreshed. Live agent request sent.");
            return;
          } catch (retryError) {
            const retryMessage = String(retryError?.message ?? "Unable to request assistance right now.");
            setChatInputError(retryMessage);
            toast.error(retryMessage);
            return;
          }
        }

        const message = String(error?.message ?? "Unable to request assistance right now.");
        setChatInputError(message);
        toast.error(message);
      }
      return;
    }

    if (chatSession?.status === "awaiting-agent" || chatSession?.status === "agent-connected") {
      return;
    }

    const botReply = getRuleBasedBotReply(question, mappedSlots, assistantConfig);

    await appendBotMessage(sessionId, botReply);
  };

  const handleSubmitChatInput = async (e) => {
    e.preventDefault();
    const validation = validateChatMessage(chatInput);
    if (!validation.ok) {
      setChatInputError(validation.reason);
      return;
    }

    setChatInput("");
    await handleSendQuestion(validation.value);
  };

  const handleRequestLiveAgent = async () => {
    const sessionId = await ensureActiveSession();
    if (!sessionId) {
      return;
    }

    try {
      await touchSupportActivity(sessionId, "user");
      await requestLiveAgent(sessionId);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          const nextSession = await createSupportSession();
          setActiveChatId(nextSession.id);
          setChatSession(nextSession);
          await requestLiveAgent(nextSession.id);
          toast.success("Chat session refreshed. Live agent request sent.");
          return;
        } catch (retryError) {
          const retryMessage = String(retryError?.message ?? "Unable to request assistance right now.");
          setChatInputError(retryMessage);
          toast.error(retryMessage);
          return;
        }
      }

      const message = String(error?.message ?? "Unable to request assistance right now.");
      setChatInputError(message);
      toast.error(message);
    }
  };

  const handleEndChat = async () => {
    if (!activeChatId) {
      return;
    }

    if (!chatSession?.liveAgentRequested) {
      setChatInputError("End chat is available after requesting a live agent.");
      return;
    }

    await closeSupportSession(activeChatId, {
      reason: "user-ended",
      actor: "user",
      message: "Chat ended by user. You can review this chat and delete it when done.",
    });
  };

  const handleDeleteClosedChat = async () => {
    if (!activeChatId) {
      return;
    }

    await endSupportSession(activeChatId);

    const nextSession = await createSupportSession();
    setActiveChatId(nextSession.id);
    setChatSession(nextSession);
    setChatInput("");
    setChatInputError("");
    setQuickQuestionsOpen(false);
    lastUserSendAtRef.current = 0;
    recentUserSendsRef.current = [];
    if (typingDebounceRef.current) {
      window.clearTimeout(typingDebounceRef.current);
    }
  };

  const isChatClosed = chatSession?.status === "closed";
  const isAdminTyping = chatSession?.typing?.admin && chatSession?.status === "agent-connected";
  const idleLimitMinutes = Math.floor(SUPPORT_CHAT_IDLE_TIMEOUT_MS / 60000);
  const navLinks = [
    { name: "Home", page: "Home" },
    { name: "Properties", page: "Properties" },
    { name: "Subdivision Plan", page: "VicinityMap" },
    { name: "Amenities", page: "Amenities" },
    { name: "About Us", page: "AboutUs" },
  ];

  const aboutDropdownLinks = [
    { name: "Mission & Philosophy", to: createPageUrl("AboutUs") + "#mission" },
    { name: "Core Values", to: createPageUrl("AboutUs") + "#core-values" },
    { name: "Corporate Culture", to: createPageUrl("AboutUs") + "#corporate-culture" },
  ];

  const amenitiesDropdownLinks = [
    { name: "Community Amenities", to: createPageUrl("Amenities") + "#community-amenities" },
    { name: "Live the Vicmar Lifestyle", to: createPageUrl("Amenities") + "#vicmar-lifestyle" },
    { name: "Community Gallery", to: createPageUrl("Amenities") + "#community-gallery" },
  ];

  const propertiesDropdownLinks = [
    { name: "Duplex Units", to: createPageUrl("Properties") + "#duplex" },
    { name: "Triplex Units", to: createPageUrl("Properties") + "#triplex" },
    { name: "Rowhouse Units", to: createPageUrl("Properties") + "#rowhouse" },
  ];

  const handleDropdownClick = (e, targetHash, pageName) => {
    // If already on the same page, scroll to section
    if (currentPageName === pageName) {
      e.preventDefault();
      const element = document.getElementById(targetHash);
      if (element) {
        const navHeight = document.querySelector("nav")?.offsetHeight ?? 80;
        const top = element.getBoundingClientRect().top + window.scrollY - navHeight - 8;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
    // Otherwise, let React Router navigate normally and the hash will be handled by the target page
  };

  return (
    <div className="min-h-screen flex flex-col">
      <style>{`
        :root {
          --primary-green: #16a34a;
          --primary-light-green: #16a34a;
          --primary-light-green-hover: #22c55e;
        }

        .nav-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 1rem;
          right: 1rem;
          height: 2px;
          background-color: #16a34a;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }

        .nav-link:hover {
          transform: translateY(-2px);
          color: #16a34a;
        }

        .nav-link:hover::after {
          transform: scaleX(1);
        }

        .nav-link.active {
          background-color: #16a34a;
          color: white;
        }

        .nav-link.active::after {
          display: none;
        }

        @keyframes pulse-border {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(22, 163, 74, 0);
          }
        }

        @keyframes subtle-scale {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes grow-once {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.08);
          }
        }

        .find-property-btn {
          transition: all 0.3s ease;
        }

        .find-property-btn:hover {
          animation: grow-once 0.3s ease-out forwards;
        }
      `}</style>

      {/* Top Bar */}
      <div className="bg-[#15803d] text-white py-2 px-4 text-sm hidden md:block">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <a href="tel:+63432332050" className="flex items-center gap-2 hover:text-[#86efac] transition-colors">
              <Phone className="w-4 h-4" />
              (043) 233-2050
            </a>
            <a href="mailto:info@vicmarhomes.com" className="flex items-center gap-2 hover:text-[#86efac] transition-colors">
              <Mail className="w-4 h-4" />
              info@vicmarhomes.com
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[#86efac] transition-colors"><Facebook className="w-4 h-4" /></a>
            <a href="#" className="hover:text-[#86efac] transition-colors"><Instagram className="w-4 h-4" /></a>
            <a href="#" className="hover:text-[#86efac] transition-colors"><Youtube className="w-4 h-4" /></a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            {/* Logo */}
            <Link to={createPageUrl("Home")} className="flex items-center overflow-visible">
              <img src={vicmarLogo} alt="Vicmar Homes" className="h-16 w-auto object-contain" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                link.page === "AboutUs" || link.page === "Amenities" || link.page === "Properties" ? (
                  <div key={link.page} className="relative group">
                    <Link
                      to={createPageUrl(link.page)}
                      className={`nav-link ${
                        currentPageName === link.page ? "active" : "text-gray-700"
                      }`}
                    >
                      {link.name}
                      <ChevronDown className="w-4 h-4" />
                    </Link>
                    <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-in-out z-50">
                      <div className="bg-white border border-gray-200 rounded-md shadow-lg min-w-[240px] transform origin-top scale-95 group-hover:scale-100 transition-transform duration-200">
                        {(link.page === "AboutUs"
                          ? aboutDropdownLinks
                          : link.page === "Amenities"
                            ? amenitiesDropdownLinks
                            : propertiesDropdownLinks).map((item, index) => {
                          const hash = item.to.split('#')[1];
                          return (
                            <Link
                              key={item.name}
                              to={item.to}
                              onClick={(e) => hash && handleDropdownClick(e, hash, link.page)}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-[#16a34a] hover:pl-5 first:rounded-t-md last:rounded-b-md transition-all duration-150 ease-in-out"
                              style={{ transitionDelay: `${index * 30}ms` }}
                            >
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={link.page}
                    to={createPageUrl(link.page)}
                    className={`nav-link ${
                      currentPageName === link.page ? "active" : "text-gray-700"
                    }`}
                  >
                    {link.name}
                  </Link>
                )
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                to={createPageUrl("AdminLogin")}
                className="find-property-btn border border-[#16a34a] text-[#16a34a] hover:bg-green-50 px-6 py-2.5 rounded-full text-sm font-semibold"
              >
                LOGIN
              </Link>
              <Link
                to={createPageUrl("ContactUs")}
                className="find-property-btn bg-[#16a34a] hover:bg-[#22c55e] text-white px-6 py-2.5 rounded-full text-sm font-semibold"
              >
                CONTACT US
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-700"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.page}
                  to={createPageUrl(link.page)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-md text-sm font-medium transition-all ${
                    currentPageName === link.page
                      ? "bg-[#16a34a] text-white"
                      : "text-gray-700 hover:bg-green-50 hover:translate-x-1"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              <Link
                to={createPageUrl("AdminLogin")}
                onClick={() => setMobileMenuOpen(false)}
                className="find-property-btn block border border-[#16a34a] text-[#16a34a] hover:bg-green-50 px-4 py-3 rounded-md text-sm font-semibold text-center mt-4"
              >
                LOGIN
              </Link>
              <Link
                to={createPageUrl("ContactUs")}
                onClick={() => setMobileMenuOpen(false)}
                className="find-property-btn block bg-[#16a34a] hover:bg-[#22c55e] text-white px-4 py-3 rounded-md text-sm font-semibold text-center mt-4"
              >
                CONTACT US
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="relative text-white bg-[#15803d]">
        {/* Top accent line */}
        <div className="h-1 bg-gradient-to-r from-[#86efac] via-[#22c55e] to-[#86efac]" />

        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

            {/* Logo & About */}
            <div className="md:col-span-1">
              <img src={vicmarLogoFooter} alt="Vicmar Homes" className="h-14 w-auto" />
              <p className="mt-4 text-white/60 text-sm leading-relaxed">
                Your trusted partner in finding the perfect home. Quality living starts with Vicmar Homes.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Youtube className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-white mb-5">Quick Links</h4>
              <ul className="space-y-3">
                {navLinks.map((link) => (
                  <li key={link.page}>
                    <Link
                      to={createPageUrl(link.page)}
                      className="text-white/60 hover:text-[#86efac] transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-white mb-5">Contact Us</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#86efac] flex-shrink-0 mt-0.5" />
                  <span className="text-white/60">San Jose Sico, Batangas City</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#86efac] flex-shrink-0 mt-0.5" />
                  <div className="text-white/60 leading-relaxed">
                    <p className="text-white font-semibold uppercase tracking-wider text-[11px] mb-1">Satellite Office</p>
                    <p>
                      3rd Floor, VICMAR Bldg, P Burgos St,<br />
                      Barangay 10 Batangas City,<br />
                      Philippines 4200
                    </p>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#86efac] flex-shrink-0" />
                  <a href="tel:+63432332050" className="text-white/60 hover:text-white transition-colors">(043) 233-2050</a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#86efac] flex-shrink-0" />
                  <a href="mailto:info@vicmarhomes.com" className="text-white/60 hover:text-white transition-colors">info@vicmarhomes.com</a>
                </li>
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-white mb-5">Stay Updated</h4>
              <p className="text-white/60 text-sm mb-4">Subscribe for the latest property updates.</p>
              <div className="flex border border-white/20 rounded-full">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 min-w-0 px-4 py-2.5 bg-white/10 text-white placeholder-white/40 text-sm focus:outline-none rounded-l-full"
                />
                <button className="px-5 py-2.5 bg-white text-[#16a34a] hover:bg-[#f0fdf4] text-sm font-semibold transition-colors whitespace-nowrap rounded-r-full">
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/10 mt-14 pt-8 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-white/40 text-xs">
              &copy; {new Date().getFullYear()} Vicmar Homes. All rights reserved.
            </p>
            <p className="text-white/40 text-xs">
              Sustainable Living in Batangas City
            </p>
          </div>
        </div>
      </footer>

      {/* ── Floating Buttons ── */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(80px) scale(0.8); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes faqPanelIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .float-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .float-btn:hover {
          transform: translateY(-3px) scale(1.08);
          box-shadow: 0 12px 28px rgba(22,101,52,0.35);
        }
        .float-btn:active {
          transform: scale(0.95);
        }
        .faq-item-answer {
          overflow: hidden;
          transition: max-height 0.35s ease, opacity 0.3s ease;
        }

        .chat-scrollbar::-webkit-scrollbar {
          width: 7px;
        }

        .chat-scrollbar::-webkit-scrollbar-thumb {
          background: #bbf7d0;
          border-radius: 9999px;
        }
      `}</style>

      {/* FAQ floating panel */}
      {faqOpen && (
        <div
          className="fixed inset-0 z-[60] pointer-events-none"
          style={{ animation: "fadeIn 0.2s ease" }}
        >
          <div
            ref={faqPanelRef}
            className="pointer-events-auto absolute bottom-28 right-6 w-[340px] sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            style={{ animation: "faqPanelIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            {/* Panel header */}
            <div className="bg-[#15803d] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#86efac]" />
                <span className="text-white font-bold text-base tracking-wide">FAQ Chat</span>
              </div>
              <button
                onClick={() => setFaqOpen(false)}
                className="text-white/60 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={chatMessagesRef} className="chat-scrollbar max-h-[290px] min-h-[220px] overflow-y-auto px-4 py-3 space-y-2 bg-[#f8faf8]">
              {(chatSession?.messages ?? []).map((message) => {
                const isUser = message.sender === "user";
                const isAdmin = message.sender === "admin";
                const isSystem = message.sender === "system";

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        isUser
                          ? "bg-[#15803d] text-white"
                          : isAdmin
                            ? "bg-white border border-blue-100 text-slate-700"
                            : isSystem
                              ? "bg-amber-50 border border-amber-200 text-amber-700"
                              : "bg-white border border-gray-100 text-gray-700"
                      }`}
                    >
                      {isAdmin ? <p className="text-[10px] font-semibold text-blue-600 mb-1">Live agent</p> : null}
                      <p className="break-words [overflow-wrap:anywhere]">{message.text}</p>
                    </div>
                  </div>
                );
              })}

              {isAdminTyping ? (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed bg-blue-50 border border-blue-100 text-blue-700">
                    <p className="text-[10px] font-semibold text-blue-600 mb-1">Live agent</p>
                    <p>is typing...</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 bg-white space-y-3">
              <div className="flex items-center justify-end gap-3">
                <div className="flex items-center gap-2">
                  {isChatClosed ? (
                    <button
                      type="button"
                      onClick={handleDeleteClosedChat}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    >
                      Delete chat
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleRequestLiveAgent}
                        disabled={chatSession?.liveAgentRequested}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-55 disabled:cursor-not-allowed"
                      >
                        {chatSession?.liveAgentRequested ? "Assistance requested" : "Need Assistance"}
                      </button>
                      <button
                        type="button"
                        onClick={handleEndChat}
                        disabled={!chatSession?.liveAgentRequested}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:hover:bg-slate-100 disabled:cursor-not-allowed"
                      >
                        End chat
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  disabled={isChatClosed}
                  onClick={() => setQuickQuestionsOpen((open) => !open)}
                  className="w-full rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-lime-50 px-3 py-2.5 text-left transition-all hover:shadow-sm disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-700/80 font-semibold">Quick shortcuts</p>
                      <p className="text-sm text-slate-700 font-medium truncate">Quick questions ({assistantConfig.faqItems.length})</p>
                    </div>
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-emerald-200 text-emerald-700 transition-transform ${quickQuestionsOpen ? "rotate-180" : "rotate-0"}`}>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </div>
                </button>

                <div className={`grid transition-all duration-300 ease-out ${quickQuestionsOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"}`}>
                  <div className="overflow-hidden">
                    <div className="rounded-xl border border-emerald-100 bg-white p-2.5 shadow-sm max-h-40 overflow-y-auto chat-scrollbar">
                      <div className="flex flex-wrap gap-2">
                        {assistantConfig.faqItems.map((item) => (
                          <button
                            key={item.id ?? item.question}
                            type="button"
                            onClick={() => {
                              setQuickQuestionsOpen(false);
                              handleSendQuestion(item.question);
                            }}
                            disabled={isChatClosed}
                            className="text-xs px-3 py-1.5 rounded-full border border-green-200 bg-green-50 text-[#15803d] hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {item.question}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitChatInput} className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (nextValue.length <= CHAT_MAX_CHARACTERS) {
                      setChatInput(nextValue);
                    }
                    if (chatInputError) {
                      setChatInputError("");
                    }

                    if (activeChatId && !isChatClosed) {
                      void setSupportTypingState(activeChatId, "user", nextValue.trim().length > 0);
                      void touchSupportActivity(activeChatId, "user");
                      if (typingDebounceRef.current) {
                        window.clearTimeout(typingDebounceRef.current);
                      }
                      typingDebounceRef.current = window.setTimeout(() => {
                        setSupportTypingState(activeChatId, "user", false);
                      }, 1200);
                    }
                  }}
                  disabled={isChatClosed}
                  placeholder="Type your question"
                  maxLength={CHAT_MAX_CHARACTERS}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16a34a]/30 disabled:bg-slate-100 disabled:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={isChatClosed}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-[#16a34a] text-white hover:bg-[#15803d] transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </form>

              <div className="flex items-center justify-between">
                <p className={`text-[11px] ${chatInputError ? "text-rose-600" : "text-gray-400"}`}>
                  {chatInputError || `Max ${CHAT_MAX_CHARACTERS} characters`}
                </p>
                <p className="text-[11px] text-gray-400">{chatInput.length}/{CHAT_MAX_CHARACTERS}</p>
              </div>

              <p className="text-[11px] text-gray-400 text-center">Need direct help? <Link to={createPageUrl("ContactUs")} onClick={() => setFaqOpen(false)} className="text-[#16a34a] font-semibold hover:underline">Contact us</Link></p>
              {chatSession?.liveAgentRequested && !isChatClosed ? (
                <p className="text-[11px] text-gray-400 text-center">This live chat auto-expires after about {idleLimitMinutes} minutes of inactivity.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right floating stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
        {/* Scroll to top */}
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="float-btn w-12 h-12 rounded-full bg-white border-2 border-[#16a34a] text-[#16a34a] flex items-center justify-center shadow-lg"
          style={{
            animation: showScrollTop ? "slideInRight 0.35s cubic-bezier(0.34,1.56,0.64,1) both" : undefined,
            opacity: showScrollTop ? 1 : 0,
            pointerEvents: showScrollTop ? "auto" : "none",
            transition: "opacity 0.25s ease",
          }}
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        {/* FAQ button */}
        <button
          ref={faqBtnRef}
          onClick={() => { setFaqOpen((v) => !v); }}
          aria-label="Toggle FAQ chat"
          className={`float-btn w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-white ${
            faqOpen ? "bg-[#22c55e]" : "bg-[#16a34a]"
          }`}
          style={{ animation: "slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          <HelpCircle className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
