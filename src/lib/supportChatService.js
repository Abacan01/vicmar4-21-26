import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

const SUPPORT_CHATS_COLLECTION = "supportChats";
const SUPPORT_CHAT_CONFIG_COLLECTION = "supportChatConfig";
const SUPPORT_CHAT_CONFIG_DOC = "faqAssistant";
const SUPPORT_ACTIVE_SESSION_KEY = "vicmar_support_active_session";
const SUPPORT_VISITOR_ID_KEY = "vicmar_support_visitor_id";
const SUPPORT_CHATS_FALLBACK_KEY = "vicmar_support_chats_fallback";
const SUPPORT_CHAT_CONFIG_FALLBACK_KEY = "vicmar_support_chat_config_fallback";
const SUPPORT_FORCE_FALLBACK_UNTIL_KEY = "vicmar_support_force_fallback_until";
const LOCAL_CHANGE_EVENT = "vicmar-support-chat-updated";
const LOCAL_CONFIG_CHANGE_EVENT = "vicmar-support-chat-config-updated";
const MAX_SUPPORT_MESSAGE_LENGTH = 320;
const FORCE_FALLBACK_DURATION_MS = 0;
export const SUPPORT_CHAT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const FIRESTORE_RETRY_DELAY_MS = 250;

export const DEFAULT_SUPPORT_WELCOME_MESSAGE = "Hi! I am Vicmar assistant. Choose a question below or type your own question.";
export const DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE = "Assistance requested. An admin will reply here soon.";

export const DEFAULT_SUPPORT_FAQ_ITEMS = [
  {
    id: "faq-payment-methods",
    question: "What payment methods are available?",
    answer: "We offer flexible payment options including bank financing, Pag-IBIG financing, in-house financing, and spot cash payments with discounts. Our sales team can help you find the best payment plan that suits your budget.",
  },
  {
    id: "faq-amenities",
    question: "What amenities are included in the community?",
    answer: "Vicmar Homes features communal greenways with food gardens, vermicompost areas, playgrounds, and open spaces. Each home includes garden space for food and herb production, with options for vertical gardens, aquaponics, and rainwater tanks.",
  },
  {
    id: "faq-purchase-process",
    question: "How does the purchase process work?",
    answer: "The process starts with a site visit and property selection. After choosing your home, you will complete the reservation with a minimal fee, submit requirements for financing, and upon approval, sign the contract to sell. Our team guides you through every step.",
  },
  {
    id: "faq-maintenance-fees",
    question: "Are there maintenance fees?",
    answer: "Yes, there are association dues for the upkeep of common areas including the greenways, communal gardens, and shared facilities. These fees ensure the sustainable features of the community are properly maintained for all residents.",
  },
];

export const DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER = "Thanks for your question. I can help with payment options, amenities, purchase process, and fees. If you need more help, tap Need Assistance.";

const CONTACT_PROMPT = "Before I connect you to assistance, please provide your full name and email (example: Name: Juan Dela Cruz, Email: juan@example.com). Our admin will follow up if there are additional concerns.";

let supportSessionsCache = [];
let supportAuthPromise = null;

function safeParse(value, fallbackValue) {
  if (!value) {
    return fallbackValue;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
}

function isPermissionDeniedError(error) {
  return error?.code === "permission-denied" || String(error?.message ?? "").includes("Missing or insufficient permissions");
}

function getForcedFallbackUntil() {
  const rawValue = localStorage.getItem(SUPPORT_FORCE_FALLBACK_UNTIL_KEY);
  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function isFirestoreTemporarilyDisabled() {
  return getForcedFallbackUntil() > Date.now();
}

function enableTemporaryFallback() {
  localStorage.setItem(
    SUPPORT_FORCE_FALLBACK_UNTIL_KEY,
    String(Date.now() + FORCE_FALLBACK_DURATION_MS),
  );
}

function disableTemporaryFallback() {
  localStorage.removeItem(SUPPORT_FORCE_FALLBACK_UNTIL_KEY);
}

function logUnexpectedError(error) {
  if (isPermissionDeniedError(error)) {
    enableTemporaryFallback();
    return;
  }

  if (!isPermissionDeniedError(error)) {
    console.error(error);
  }
}

async function ensureSupportAuth(allowAnonymous = true) {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (!allowAnonymous) {
    throw new Error("Support chat requires authenticated user.");
  }

  if (supportAuthPromise) {
    return supportAuthPromise;
  }

  supportAuthPromise = signInAnonymously(auth)
    .then((credential) => credential.user)
    .catch((error) => {
      throw error;
    })
    .finally(() => {
      supportAuthPromise = null;
    });

  return supportAuthPromise;
}

function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFaqEntry(rawEntry, index = 0) {
  const question = String(rawEntry?.question ?? "").trim();
  const answer = String(rawEntry?.answer ?? "").trim();
  if (!question || !answer) {
    return null;
  }

  return {
    id: String(rawEntry?.id ?? `faq-${index + 1}`),
    question,
    answer,
  };
}

function normalizeSupportChatConfig(rawConfig) {
  const nextFallbackReply = String(rawConfig?.fallbackReply ?? "").trim() || DEFAULT_SUPPORT_BOT_FALLBACK_ANSWER;
  const nextFaqItems = Array.isArray(rawConfig?.faqItems)
    ? rawConfig.faqItems
      .map((entry, index) => sanitizeFaqEntry(entry, index))
      .filter(Boolean)
    : [];
  const nextWelcomeMessage = String(rawConfig?.automationMessages?.welcomeMessage ?? "").trim() || DEFAULT_SUPPORT_WELCOME_MESSAGE;
  const nextLiveAgentRequestedMessage = String(rawConfig?.automationMessages?.liveAgentRequestedMessage ?? "").trim() || DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE;

  return {
    faqItems: nextFaqItems.length > 0 ? nextFaqItems : DEFAULT_SUPPORT_FAQ_ITEMS,
    fallbackReply: nextFallbackReply,
    automationMessages: {
      welcomeMessage: nextWelcomeMessage,
      liveAgentRequestedMessage: nextLiveAgentRequestedMessage,
    },
    updatedAt: String(rawConfig?.updatedAt ?? nowIso()),
  };
}

function getFallbackSupportChatConfig() {
  const rawValue = localStorage.getItem(SUPPORT_CHAT_CONFIG_FALLBACK_KEY);
  return normalizeSupportChatConfig(safeParse(rawValue, {}));
}

function saveFallbackSupportChatConfig(config, shouldBroadcast = true) {
  localStorage.setItem(SUPPORT_CHAT_CONFIG_FALLBACK_KEY, JSON.stringify(normalizeSupportChatConfig(config)));
  if (shouldBroadcast) {
    window.dispatchEvent(new Event(LOCAL_CONFIG_CHANGE_EVENT));
  }
}

function getFallbackSessions() {
  const rawValue = localStorage.getItem(SUPPORT_CHATS_FALLBACK_KEY);
  const parsedValue = safeParse(rawValue, []);
  return Array.isArray(parsedValue) ? parsedValue : [];
}

function saveFallbackSessions(sessions, shouldBroadcast = true) {
  localStorage.setItem(SUPPORT_CHATS_FALLBACK_KEY, JSON.stringify(sessions));
  if (shouldBroadcast) {
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sortByUpdatedAtDesc(sessions) {
  return [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function syncCacheFromSessions(sessions) {
  supportSessionsCache = sortByUpdatedAtDesc(sessions);
  return supportSessionsCache;
}

function createBotMessage(text) {
  return {
    id: generateId("msg"),
    sender: "bot",
    text,
    createdAt: nowIso(),
  };
}

function getOrCreateVisitorId() {
  const storedVisitorId = localStorage.getItem(SUPPORT_VISITOR_ID_KEY);
  if (storedVisitorId) {
    return storedVisitorId;
  }

  const nextVisitorId = generateId("visitor");
  localStorage.setItem(SUPPORT_VISITOR_ID_KEY, nextVisitorId);
  return nextVisitorId;
}

function getFallbackSessionById(chatId) {
  return getFallbackSessions().find((session) => session.id === chatId) ?? null;
}

function upsertFallbackSession(session, shouldBroadcast = true) {
  const nextSessions = [
    ...getFallbackSessions().filter((item) => item.id !== session.id),
    session,
  ];

  saveFallbackSessions(nextSessions, shouldBroadcast);
  syncCacheFromSessions(nextSessions);
  return session;
}

function deleteFallbackSession(chatId, shouldBroadcast = true) {
  const nextSessions = getFallbackSessions().filter((session) => session.id !== chatId);
  saveFallbackSessions(nextSessions, shouldBroadcast);
  syncCacheFromSessions(nextSessions);
}

function mutateFallbackSession(chatId, mutator) {
  const existing = getFallbackSessionById(chatId);
  if (!existing) {
    return null;
  }

  const nextSession = mutator(existing);
  if (!nextSession) {
    return null;
  }

  return upsertFallbackSession(nextSession);
}

function normalizeMessage(rawMessage, index = 0) {
  return {
    id: String(rawMessage?.id ?? generateId(`msg-${index}`)),
    sender: String(rawMessage?.sender ?? "bot"),
    text: String(rawMessage?.text ?? ""),
    adminName: rawMessage?.adminName ? String(rawMessage.adminName) : undefined,
    createdAt: String(rawMessage?.createdAt ?? nowIso()),
  };
}

function toWritableMessage(rawMessage, index = 0) {
  const writableMessage = {
    id: String(rawMessage?.id ?? generateId(`msg-${index}`)),
    sender: String(rawMessage?.sender ?? "bot"),
    text: String(rawMessage?.text ?? ""),
    createdAt: String(rawMessage?.createdAt ?? nowIso()),
  };

  const adminName = String(rawMessage?.adminName ?? "").trim();
  if (adminName) {
    writableMessage.adminName = adminName;
  }

  return writableMessage;
}

function normalizeSession(sessionId, rawSession) {
  const visitorId = String(rawSession?.visitorId ?? "");
  const normalizedMessages = Array.isArray(rawSession?.messages)
    ? rawSession.messages.map((message, index) => normalizeMessage(message, index))
    : [];

  return {
    id: sessionId,
    createdAt: String(rawSession?.createdAt ?? nowIso()),
    updatedAt: String(rawSession?.updatedAt ?? rawSession?.createdAt ?? nowIso()),
    closedReason: String(rawSession?.closedReason ?? "").trim(),
    status: String(rawSession?.status ?? "bot"),
    liveAgentRequested: Boolean(rawSession?.liveAgentRequested),
    visitorId,
    visitorLabel: String(rawSession?.visitorLabel ?? `Visitor ${(visitorId || sessionId).slice(-4).toUpperCase()}`),
    typing: {
      user: Boolean(rawSession?.typing?.user),
      admin: Boolean(rawSession?.typing?.admin),
      updatedAt: String(rawSession?.typing?.updatedAt ?? rawSession?.updatedAt ?? nowIso()),
    },
    activity: {
      userAt: String(rawSession?.activity?.userAt ?? rawSession?.updatedAt ?? rawSession?.createdAt ?? nowIso()),
      adminAt: String(rawSession?.activity?.adminAt ?? rawSession?.updatedAt ?? rawSession?.createdAt ?? nowIso()),
    },
    messages: normalizedMessages,
  };
}

function stripSessionForWrite(session) {
  return {
    createdAt: String(session.createdAt ?? nowIso()),
    updatedAt: String(session.updatedAt ?? session.createdAt ?? nowIso()),
    closedReason: String(session.closedReason ?? "").trim(),
    status: String(session.status ?? "bot"),
    liveAgentRequested: session.liveAgentRequested,
    visitorId: String(session.visitorId ?? ""),
    visitorLabel: String(session.visitorLabel ?? "Visitor"),
    typing: {
      user: Boolean(session.typing?.user),
      admin: Boolean(session.typing?.admin),
      updatedAt: String(session.typing?.updatedAt ?? session.updatedAt ?? session.createdAt ?? nowIso()),
    },
    activity: {
      userAt: String(session.activity?.userAt ?? session.updatedAt ?? session.createdAt ?? nowIso()),
      adminAt: String(session.activity?.adminAt ?? session.updatedAt ?? session.createdAt ?? nowIso()),
    },
    messages: Array.isArray(session.messages)
      ? session.messages.map((message, index) => toWritableMessage(message, index))
      : [],
  };
}

function createSessionObject(visitorId, welcomeMessage = DEFAULT_SUPPORT_WELCOME_MESSAGE) {
  const resolvedVisitorId = String(visitorId || getOrCreateVisitorId());
  const sessionId = generateId("chat");
  const createdAt = nowIso();

  return {
    id: sessionId,
    createdAt,
    updatedAt: createdAt,
    closedReason: "",
    status: "bot",
    liveAgentRequested: false,
    visitorId: resolvedVisitorId,
    visitorLabel: `Visitor ${resolvedVisitorId.slice(-4).toUpperCase()}`,
    typing: {
      user: false,
      admin: false,
      updatedAt: createdAt,
    },
    activity: {
      userAt: createdAt,
      adminAt: createdAt,
    },
    messages: [
      createBotMessage(String(welcomeMessage ?? "").trim() || DEFAULT_SUPPORT_WELCOME_MESSAGE),
    ],
  };
}

async function mutateSession(chatId, mutator, options = {}) {
  const sessionRef = doc(db, SUPPORT_CHATS_COLLECTION, chatId);
  const fallbackSession = getFallbackSessionById(chatId);
  const allowAnonymous = options.allowAnonymous ?? true;
  const forceFirestore = options.forceFirestore === true;
  const fallbackOnError = options.fallbackOnError !== false;

  if (isFirestoreTemporarilyDisabled() && !forceFirestore) {
    return mutateFallbackSession(chatId, mutator);
  }

  try {
    const user = await ensureSupportAuth(allowAnonymous);
    const authUid = user?.uid ?? "";

    const nextSession = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(sessionRef);
      if (!snapshot.exists() && !fallbackSession) {
        return null;
      }

      let currentSession = snapshot.exists()
        ? normalizeSession(snapshot.id, snapshot.data())
        : normalizeSession(chatId, fallbackSession);

      if (!snapshot.exists() && authUid) {
        currentSession = {
          ...currentSession,
          visitorId: authUid,
          visitorLabel: `Visitor ${authUid.slice(-4).toUpperCase()}`,
        };
      }

      const mutatedSession = mutator(currentSession);
      if (!mutatedSession) {
        return null;
      }

      transaction.set(sessionRef, stripSessionForWrite(mutatedSession), { merge: true });
      return mutatedSession;
    });

    disableTemporaryFallback();

    if (nextSession) {
      upsertFallbackSession(nextSession, false);
    }

    return nextSession;
  } catch (error) {
    logUnexpectedError(error);
    if (!fallbackOnError) {
      throw error;
    }
    return mutateFallbackSession(chatId, mutator);
  }
}

export async function getOrCreateActiveSupportSession() {
  const activeId = localStorage.getItem(SUPPORT_ACTIVE_SESSION_KEY);
  if (activeId) {
    const cachedSession = supportSessionsCache.find((session) => session.id === activeId);
    if (cachedSession) {
      return cachedSession;
    }

    const fallbackSession = getFallbackSessionById(activeId);
    let fallbackCandidate = fallbackSession;

    if (!isFirestoreTemporarilyDisabled()) {
      try {
        await ensureSupportAuth();
        const snapshot = await getDoc(doc(db, SUPPORT_CHATS_COLLECTION, activeId));
        if (snapshot.exists()) {
          const nextSession = normalizeSession(snapshot.id, snapshot.data());
          upsertFallbackSession(nextSession, false);
          disableTemporaryFallback();
          return nextSession;
        }
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          enableTemporaryFallback();
          if (localStorage.getItem(SUPPORT_ACTIVE_SESSION_KEY) === activeId) {
            localStorage.removeItem(SUPPORT_ACTIVE_SESSION_KEY);
          }
          deleteFallbackSession(activeId, false);
          fallbackCandidate = null;
        } else {
          logUnexpectedError(error);
        }
      }
    }

    if (fallbackCandidate) {
      return fallbackCandidate;
    }
  }

  return await createSupportSession();
}

export async function createSupportSession() {
  let authVisitorId = "";
  const supportConfig = await getSupportChatConfig({ allowAnonymous: true });
  const welcomeMessage = supportConfig?.automationMessages?.welcomeMessage ?? DEFAULT_SUPPORT_WELCOME_MESSAGE;

  try {
    const user = await ensureSupportAuth();
    authVisitorId = user?.uid ?? "";
    if (authVisitorId) {
      localStorage.setItem(SUPPORT_VISITOR_ID_KEY, authVisitorId);
    }
  } catch (error) {
    logUnexpectedError(error);
    throw error;
  }

  if (!authVisitorId) {
    throw new Error("Unable to create chat session because user authentication is missing.");
  }

  const newSession = createSessionObject(authVisitorId, welcomeMessage);

  if (!isFirestoreTemporarilyDisabled()) {
    try {
      if (!auth.currentUser) {
        await ensureSupportAuth();
      }

      await setDoc(
        doc(db, SUPPORT_CHATS_COLLECTION, newSession.id),
        stripSessionForWrite(newSession),
        { merge: true },
      );
      disableTemporaryFallback();
    } catch (error) {
      logUnexpectedError(error);
    }
  }

  upsertFallbackSession(newSession);
  localStorage.setItem(SUPPORT_ACTIVE_SESSION_KEY, newSession.id);

  return newSession;
}

export function getSupportSession(chatId) {
  return supportSessionsCache.find((session) => session.id === chatId)
    ?? getFallbackSessionById(chatId)
    ?? null;
}

export function getAllSupportSessions() {
  if (supportSessionsCache.length === 0) {
    syncCacheFromSessions(getFallbackSessions());
  }

  return sortByUpdatedAtDesc(supportSessionsCache);
}

function subscribeToFallbackSessions(onChange, options = {}) {
  const scopedChatId = options.chatId ? String(options.chatId) : "";

  const notify = () => {
    const nextSessions = syncCacheFromSessions(getFallbackSessions());
    if (scopedChatId) {
      onChange(nextSessions.filter((session) => session.id === scopedChatId));
      return;
    }

    onChange(nextSessions);
  };

  const handleStorage = (event) => {
    if (event.key && event.key !== SUPPORT_CHATS_FALLBACK_KEY) {
      return;
    }

    notify();
  };

  notify();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(LOCAL_CHANGE_EVENT, notify);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_CHANGE_EVENT, notify);
  };
}

export function subscribeToSupportSessions(onChange, onError, options = {}) {
  const allowAnonymous = options.allowAnonymous ?? true;
  const scopedChatId = options.chatId ? String(options.chatId) : "";
  const useFallback = allowAnonymous !== false;
  const unsubscribeFallback = useFallback
    ? subscribeToFallbackSessions(onChange, { chatId: scopedChatId })
    : () => {};
  let unsubscribeFirestore = () => {};
  let retryTimerId = null;

  let fallbackEnabled = false;

  const enableFallbackOnly = (error) => {
    if (fallbackEnabled) {
      return;
    }

    fallbackEnabled = true;
    logUnexpectedError(error);
    if (onError) {
      onError(error);
    }
  };

  let isCancelled = false;

  const startFirestoreSync = async () => {
    if (isFirestoreTemporarilyDisabled()) {
      retryTimerId = window.setTimeout(() => {
        startFirestoreSync();
      }, FIRESTORE_RETRY_DELAY_MS);
      return;
    }

    try {
      await ensureSupportAuth(allowAnonymous);
      if (isCancelled) {
        return;
      }

      if (scopedChatId) {
        const sessionDocRef = doc(db, SUPPORT_CHATS_COLLECTION, scopedChatId);
        unsubscribeFirestore = onSnapshot(
          sessionDocRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              deleteFallbackSession(scopedChatId, false);
              onChange([]);
              return;
            }

            const nextSession = normalizeSession(snapshot.id, snapshot.data());
            upsertFallbackSession(nextSession, false);
            disableTemporaryFallback();
            onChange([nextSession]);
          },
          (error) => {
            enableFallbackOnly(error);
          },
        );
      } else {
        const collectionRef = collection(db, SUPPORT_CHATS_COLLECTION);
        unsubscribeFirestore = onSnapshot(
          collectionRef,
          (snapshot) => {
            const nextSessions = [];

            snapshot.forEach((sessionDoc) => {
              nextSessions.push(normalizeSession(sessionDoc.id, sessionDoc.data()));
            });

            supportSessionsCache = sortByUpdatedAtDesc(nextSessions);
            saveFallbackSessions(supportSessionsCache, false);
            disableTemporaryFallback();
            onChange(supportSessionsCache);
          },
          (error) => {
            enableFallbackOnly(error);
          },
        );
      }
    } catch (error) {
      enableFallbackOnly(error);
    }
  };

  startFirestoreSync();

  return () => {
    isCancelled = true;
    if (retryTimerId) {
      window.clearTimeout(retryTimerId);
    }
    unsubscribeFallback();
    unsubscribeFirestore();
  };
}

export async function appendUserMessage(chatId, text) {
  const trimmed = String(text ?? "").trim().slice(0, MAX_SUPPORT_MESSAGE_LENGTH);
  if (!trimmed) {
    return null;
  }

  const currentSession = getSupportSession(chatId);
  if (!currentSession) {
    return null;
  }

  const createdAt = nowIso();
  const message = {
    id: generateId("msg"),
    sender: "user",
    text: trimmed,
    createdAt,
  };

  const nextSession = normalizeSession(chatId, {
    ...currentSession,
    updatedAt: createdAt,
    typing: {
      ...(currentSession.typing ?? {}),
      user: false,
      updatedAt: createdAt,
    },
    activity: {
      ...(currentSession.activity ?? {}),
      userAt: createdAt,
    },
    messages: [
      ...(currentSession.messages ?? []),
      message,
    ],
  });

  upsertFallbackSession(nextSession, false);

  try {
    await ensureSupportAuth(true);
    await setDoc(
      doc(db, SUPPORT_CHATS_COLLECTION, chatId),
      {
        updatedAt: createdAt,
        typing: nextSession.typing,
        activity: nextSession.activity,
        messages: arrayUnion(toWritableMessage(message)),
      },
      { merge: true },
    );
    disableTemporaryFallback();
  } catch (error) {
    logUnexpectedError(error);
  }

  // After saving the user message, check if we're expecting contact info and handle it.
  try {
    const currentSession = getSupportSession(chatId);
    // Use the raw trimmed text to detect contact info
    await handlePotentialContactInfo(chatId, trimmed, currentSession);
  } catch (e) {
    // non-fatal
    console.error('handlePotentialContactInfo error', e);
  }

  return nextSession;
}

// After appending a user message, if the last system prompt asked for contact info,
// capture name/email and proceed to request assistance automatically.
async function handlePotentialContactInfo(chatId, userText, currentSession) {
  if (!currentSession) return;
  const lastSystem = (currentSession.messages || []).slice().reverse().find(m => m.sender === 'system');
  if (!lastSystem || String(lastSystem.text ?? '').trim() !== CONTACT_PROMPT) return;

  // Try to extract an email
  const emailMatch = userText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const email = emailMatch ? emailMatch[1].toLowerCase() : null;

  // Derive name: remove email from text and look for 'name:' prefix
  let name = userText.replace(emailMatch ? emailMatch[0] : '', '').replace(/\bname\s*[:\-]/i, '').replace(/[,\n]/g, ' ').trim();
  if (!name) {
    // fallback to first two words
    const parts = userText.split(/\s+/).filter(Boolean).slice(0, 2);
    name = parts.join(' ') || null;
  }

  const visitorLabel = name ? name : (email ? `Visitor ${email.split('@')[0]}` : currentSession.visitorLabel);

  // If we found at least an email, persist visitorLabel and add a confirmation system message, then request assistance.
  if (email) {
    const createdAt = nowIso();
    try {
      // Persist visitorLabel and an internal visitorEmail as a system confirmation message (visitorEmail not stored in top-level fields)
      await mutateSession(chatId, (session) => {
        const next = {
          ...session,
          visitorLabel: visitorLabel,
          updatedAt: createdAt,
          messages: [
            ...(session.messages ?? []),
            {
              id: generateId('msg'),
              sender: 'system',
              text: `Contact details saved: ${visitorLabel} · ${email}`,
              createdAt,
            },
          ],
        };

        return next;
      }, { forceFirestore: true, fallbackOnError: false });

      // Now actually request live agent / assistance
      await requestLiveAgent(chatId);
    } catch (e) {
      console.error('Failed to persist contact info or request assistance:', e);
    }
  } else {
    // If no email found, ask user to include a valid email
    try {
      await appendBotMessage(chatId, 'Please include a valid email address so our admin can follow up (example: name@example.com).');
    } catch (e) {
      console.error('Failed to send follow-up bot message:', e);
    }
  }
}

export async function appendBotMessage(chatId, text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const currentSession = getSupportSession(chatId);
  if (!currentSession) {
    return null;
  }

  const createdAt = nowIso();
  const message = {
    ...createBotMessage(trimmed),
    createdAt,
  };

  const nextSession = normalizeSession(chatId, {
    ...currentSession,
    updatedAt: createdAt,
    messages: [
      ...(currentSession.messages ?? []),
      message,
    ],
  });

  upsertFallbackSession(nextSession, false);

  try {
    await ensureSupportAuth(true);
    await setDoc(
      doc(db, SUPPORT_CHATS_COLLECTION, chatId),
      {
        updatedAt: createdAt,
        messages: arrayUnion(toWritableMessage(message)),
      },
      { merge: true },
    );
    disableTemporaryFallback();
  } catch (error) {
    logUnexpectedError(error);
  }

  return nextSession;
}

export async function requestLiveAgent(chatId) {
  const supportConfig = await getSupportChatConfig({ allowAnonymous: true });
  const liveAgentRequestedMessage = String(
    supportConfig?.automationMessages?.liveAgentRequestedMessage ?? DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE,
  ).trim() || DEFAULT_SUPPORT_LIVE_AGENT_REQUESTED_MESSAGE;

  let nextSession = null;

  try {
    nextSession = await mutateSession(chatId, (session) => {
      if (session.liveAgentRequested) {
        return session;
      }

      const createdAt = nowIso();

      // If this is an early request and we don't have a visitor label (anonymous visitor),
      // first ask for contact details (name + email) so admin can follow up. Do not mark
      // the session as awaiting-agent yet.
      const messageCount = Array.isArray(session.messages) ? session.messages.length : 0;
      const isAnonymousVisitor = String(session.visitorLabel || "").toLowerCase().startsWith("visitor");

      if (messageCount <= 2 && isAnonymousVisitor) {
        return {
          ...session,
          updatedAt: createdAt,
          messages: [
            ...(session.messages ?? []),
            {
              id: generateId("msg"),
              sender: "system",
              text: CONTACT_PROMPT,
              createdAt,
            },
          ],
        };
      }

      return {
        ...session,
        updatedAt: createdAt,
        closedReason: "",
        status: "awaiting-agent",
        liveAgentRequested: true,
        activity: {
          ...(session.activity ?? {}),
          userAt: createdAt,
        },
        typing: {
          ...(session.typing ?? {}),
          user: false,
          updatedAt: createdAt,
        },
        messages: [
          ...(session.messages ?? []),
          {
            id: generateId("msg"),
            sender: "system",
            text: liveAgentRequestedMessage,
            createdAt,
          },
        ],
      };
    }, { forceFirestore: true, fallbackOnError: false });
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }

    const authUser = await ensureSupportAuth(true);
    const authUid = String(authUser?.uid ?? "").trim();
    if (!authUid) {
      throw error;
    }

    const fallbackSession = getFallbackSessionById(chatId);
    const createdAt = nowIso();
    const baseMessages = Array.isArray(fallbackSession?.messages)
      ? fallbackSession.messages.map((message, index) => normalizeMessage(message, index))
      : [];

    const hasLiveAgentSystemMessage = baseMessages.some(
      (message) => message.sender === "system" && String(message.text ?? "").trim() === liveAgentRequestedMessage,
    );

    const mergedMessages = hasLiveAgentSystemMessage
      ? baseMessages
      : [
          ...baseMessages,
          {
            id: generateId("msg"),
            sender: "system",
            text: liveAgentRequestedMessage,
            createdAt,
          },
        ];

    nextSession = normalizeSession(chatId, {
      ...(fallbackSession ?? {}),
      createdAt: fallbackSession?.createdAt ?? createdAt,
      updatedAt: createdAt,
      closedReason: "",
      status: "awaiting-agent",
      liveAgentRequested: true,
      visitorId: authUid,
      visitorLabel: fallbackSession?.visitorLabel ?? `Visitor ${authUid.slice(-4).toUpperCase()}`,
      typing: {
        ...(fallbackSession?.typing ?? {}),
        user: false,
        admin: false,
        updatedAt: createdAt,
      },
      activity: {
        ...(fallbackSession?.activity ?? {}),
        userAt: createdAt,
        adminAt: String(fallbackSession?.activity?.adminAt ?? createdAt),
      },
      messages: mergedMessages,
    });

    await setDoc(
      doc(db, SUPPORT_CHATS_COLLECTION, chatId),
      stripSessionForWrite(nextSession),
      { merge: true },
    );

    upsertFallbackSession(nextSession, false);
    disableTemporaryFallback();
  }

  if (!nextSession) {
    throw new Error("Unable to request assistance right now. Please try again.");
  }

  return nextSession;
}

export async function setConversationStatus(chatId, status) {
  const updatedAt = nowIso();
  const currentSession = getSupportSession(chatId);
  const hasAcceptedMessage = (currentSession?.messages ?? []).some(
    (message) => message.sender === "system" && String(message.text ?? "").trim() === "Live agent accepted your request. You are now connected.",
  );

  const acceptedMessage = {
    id: generateId("msg"),
    sender: "system",
    text: "Live agent accepted your request. You are now connected.",
    createdAt: updatedAt,
  };

  const writePayload = {
    status,
    closedReason: status === "closed" ? String(currentSession?.closedReason ?? "").trim() : "",
    updatedAt,
    activity: {
      ...(currentSession?.activity ?? {}),
      adminAt: updatedAt,
    },
    typing: {
      ...(currentSession?.typing ?? {}),
      admin: false,
      updatedAt,
    },
    ...(status === "agent-connected"
      ? {
          liveAgentRequested: true,
          ...(!hasAcceptedMessage
            ? { messages: arrayUnion(toWritableMessage(acceptedMessage)) }
            : {}),
        }
      : {}),
  };

  await setDoc(doc(db, SUPPORT_CHATS_COLLECTION, chatId), writePayload, { merge: true });

  if (currentSession) {
    const nextSession = normalizeSession(chatId, {
      ...currentSession,
      status,
      closedReason: status === "closed" ? String(currentSession.closedReason ?? "").trim() : "",
      liveAgentRequested: status === "agent-connected" ? true : currentSession.liveAgentRequested,
      updatedAt,
      activity: {
        ...(currentSession.activity ?? {}),
        adminAt: updatedAt,
      },
      typing: {
        ...(currentSession.typing ?? {}),
        admin: false,
        updatedAt,
      },
      messages: hasAcceptedMessage || status !== "agent-connected"
        ? [...(currentSession.messages ?? [])]
        : [
            ...(currentSession.messages ?? []),
            acceptedMessage,
          ],
    });

    upsertFallbackSession(nextSession, false);
    return nextSession;
  }

  return null;
}

export async function appendAdminMessage(chatId, text, adminName = "Admin") {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const currentSession = getSupportSession(chatId);
  if (!currentSession) {
    return null;
  }

  const createdAt = nowIso();
  const message = {
    id: generateId("msg"),
    sender: "admin",
    text: trimmed,
    adminName,
    createdAt,
  };

  const nextSession = normalizeSession(chatId, {
    ...currentSession,
    status: "agent-connected",
    closedReason: "",
    liveAgentRequested: true,
    updatedAt: createdAt,
    typing: {
      ...(currentSession.typing ?? {}),
      admin: false,
      updatedAt: createdAt,
    },
    activity: {
      ...(currentSession.activity ?? {}),
      adminAt: createdAt,
    },
    messages: [
      ...(currentSession.messages ?? []),
      message,
    ],
  });

  upsertFallbackSession(nextSession, false);

  try {
    await ensureSupportAuth(true);
    await setDoc(
      doc(db, SUPPORT_CHATS_COLLECTION, chatId),
      {
        status: "agent-connected",
        closedReason: "",
        liveAgentRequested: true,
        updatedAt: createdAt,
        typing: nextSession.typing,
        activity: nextSession.activity,
        messages: arrayUnion(toWritableMessage(message)),
      },
      { merge: true },
    );
    disableTemporaryFallback();
  } catch (error) {
    logUnexpectedError(error);
  }

  return nextSession;
}

export async function endSupportSession(chatId) {
  try {
    await ensureSupportAuth();
    await deleteDoc(doc(db, SUPPORT_CHATS_COLLECTION, chatId));
  } catch (error) {
    logUnexpectedError(error);
  }

  if (localStorage.getItem(SUPPORT_ACTIVE_SESSION_KEY) === chatId) {
    localStorage.removeItem(SUPPORT_ACTIVE_SESSION_KEY);
  }

  deleteFallbackSession(chatId);
  return null;
}

export async function closeSupportSession(chatId, options = {}) {
  const reason = String(options.reason ?? "closed").trim() || "closed";
  const messageText = String(options.message ?? "").trim();
  const actor = String(options.actor ?? "system").trim().toLowerCase();

  const session = getSupportSession(chatId);
  if (!session) {
    return null;
  }

  if (session.status === "closed" && session.closedReason === reason) {
    return session;
  }

  const updatedAt = nowIso();
  const systemMessage = messageText
    ? {
        id: generateId("msg"),
        sender: "system",
        text: messageText,
        createdAt: updatedAt,
      }
    : null;

  const nextSession = normalizeSession(chatId, {
    ...session,
    status: "closed",
    closedReason: reason,
    updatedAt,
    typing: {
      ...(session.typing ?? {}),
      user: false,
      admin: false,
      updatedAt,
    },
    activity: {
      ...(session.activity ?? {}),
      userAt: actor === "user" ? updatedAt : (session.activity?.userAt ?? updatedAt),
      adminAt: actor === "admin" ? updatedAt : (session.activity?.adminAt ?? updatedAt),
    },
    messages: systemMessage
      ? [
          ...(session.messages ?? []),
          systemMessage,
        ]
      : [...(session.messages ?? [])],
  });

  upsertFallbackSession(nextSession, false);

  try {
    await ensureSupportAuth(true);
    await setDoc(
      doc(db, SUPPORT_CHATS_COLLECTION, chatId),
      {
        status: "closed",
        closedReason: reason,
        updatedAt,
        typing: nextSession.typing,
        activity: nextSession.activity,
        ...(systemMessage ? { messages: arrayUnion(toWritableMessage(systemMessage)) } : {}),
      },
      { merge: true },
    );
    disableTemporaryFallback();
  } catch (error) {
    logUnexpectedError(error);
  }

  return nextSession;
}

export async function setSupportTypingState(chatId, actor, isTyping) {
  const normalizedActor = String(actor ?? "").trim().toLowerCase();
  if (normalizedActor !== "user" && normalizedActor !== "admin") {
    return null;
  }

  const session = getSupportSession(chatId);
  if (!session || session.status === "closed") {
    return session ?? null;
  }

  const updatedAt = nowIso();
  const nextSession = normalizeSession(chatId, {
    ...session,
    updatedAt,
    typing: {
      ...(session.typing ?? {}),
      [normalizedActor]: Boolean(isTyping),
      updatedAt,
    },
    activity: {
      ...(session.activity ?? {}),
      ...(isTyping ? { [`${normalizedActor}At`]: updatedAt } : {}),
    },
  });

  upsertFallbackSession(nextSession, false);

  try {
    await setDoc(
      doc(db, SUPPORT_CHATS_COLLECTION, chatId),
      {
        updatedAt,
        typing: nextSession.typing,
        activity: nextSession.activity,
      },
      { merge: true },
    );
  } catch (error) {
    logUnexpectedError(error);
  }

  return nextSession;
}

export async function touchSupportActivity(chatId, actor) {
  const normalizedActor = String(actor ?? "").trim().toLowerCase();
  if (normalizedActor !== "user" && normalizedActor !== "admin") {
    return null;
  }

  const session = getSupportSession(chatId);
  if (!session || session.status === "closed") {
    return session ?? null;
  }

  const updatedAt = nowIso();
  const nextSession = normalizeSession(chatId, {
    ...session,
    updatedAt,
    activity: {
      ...(session.activity ?? {}),
      [`${normalizedActor}At`]: updatedAt,
    },
  });

  upsertFallbackSession(nextSession, false);

  try {
    await setDoc(
      doc(db, SUPPORT_CHATS_COLLECTION, chatId),
      {
        updatedAt,
        activity: nextSession.activity,
      },
      { merge: true },
    );
  } catch (error) {
    logUnexpectedError(error);
  }

  return nextSession;
}

export function getSupportSessionIdleExpiration(session, now = Date.now()) {
  const userAt = new Date(session?.activity?.userAt ?? 0).getTime();
  const adminAt = new Date(session?.activity?.adminAt ?? 0).getTime();

  if (!Number.isFinite(userAt) || !Number.isFinite(adminAt)) {
    return null;
  }

  const userIdleMs = now - userAt;
  const adminIdleMs = now - adminAt;
  const isExpired = userIdleMs >= SUPPORT_CHAT_IDLE_TIMEOUT_MS || adminIdleMs >= SUPPORT_CHAT_IDLE_TIMEOUT_MS;
  if (!isExpired) {
    return null;
  }

  const reason = userIdleMs >= SUPPORT_CHAT_IDLE_TIMEOUT_MS && adminIdleMs >= SUPPORT_CHAT_IDLE_TIMEOUT_MS
    ? "inactivity-both"
    : userIdleMs >= SUPPORT_CHAT_IDLE_TIMEOUT_MS
      ? "inactivity-user"
      : "inactivity-admin";

  return {
    reason,
    userIdleMs,
    adminIdleMs,
  };
}

export async function getSupportChatConfig(options = {}) {
  const allowAnonymous = options.allowAnonymous ?? true;
  const fallbackConfig = getFallbackSupportChatConfig();

  if (isFirestoreTemporarilyDisabled()) {
    return fallbackConfig;
  }

  try {
    await ensureSupportAuth(allowAnonymous);
    const snapshot = await getDoc(doc(db, SUPPORT_CHAT_CONFIG_COLLECTION, SUPPORT_CHAT_CONFIG_DOC));
    if (snapshot.exists()) {
      const nextConfig = normalizeSupportChatConfig(snapshot.data());
      saveFallbackSupportChatConfig(nextConfig, false);
      disableTemporaryFallback();
      return nextConfig;
    }
  } catch (error) {
    logUnexpectedError(error);
  }

  return fallbackConfig;
}

export function subscribeToSupportChatConfig(onChange, onError, options = {}) {
  const allowAnonymous = options.allowAnonymous ?? true;
  let unsubscribeFirestore = () => {};
  let isCancelled = false;
  let retryTimerId = null;

  const notifyFallback = () => {
    onChange(getFallbackSupportChatConfig());
  };

  const handleStorage = (event) => {
    if (event.key && event.key !== SUPPORT_CHAT_CONFIG_FALLBACK_KEY) {
      return;
    }
    notifyFallback();
  };

  notifyFallback();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(LOCAL_CONFIG_CHANGE_EVENT, notifyFallback);

  const startFirestoreSync = async () => {
    if (isFirestoreTemporarilyDisabled()) {
      retryTimerId = window.setTimeout(() => {
        startFirestoreSync();
      }, FIRESTORE_RETRY_DELAY_MS);
      return;
    }

    try {
      await ensureSupportAuth(allowAnonymous);
      if (isCancelled) {
        return;
      }

      const configDocRef = doc(db, SUPPORT_CHAT_CONFIG_COLLECTION, SUPPORT_CHAT_CONFIG_DOC);
      unsubscribeFirestore = onSnapshot(
        configDocRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            const defaultConfig = normalizeSupportChatConfig({});
            saveFallbackSupportChatConfig(defaultConfig, false);
            onChange(defaultConfig);
            return;
          }

          const nextConfig = normalizeSupportChatConfig(snapshot.data());
          saveFallbackSupportChatConfig(nextConfig, false);
          disableTemporaryFallback();
          onChange(nextConfig);
        },
        (error) => {
          logUnexpectedError(error);
          if (onError) {
            onError(error);
          }
        },
      );
    } catch (error) {
      logUnexpectedError(error);
      if (onError) {
        onError(error);
      }
    }
  };

  startFirestoreSync();

  return () => {
    isCancelled = true;
    if (retryTimerId) {
      window.clearTimeout(retryTimerId);
    }
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_CONFIG_CHANGE_EVENT, notifyFallback);
    unsubscribeFirestore();
  };
}

export async function saveSupportChatConfig(rawConfig, options = {}) {
  const allowAnonymous = options.allowAnonymous ?? false;
  const normalizedConfig = normalizeSupportChatConfig({
    ...rawConfig,
    updatedAt: nowIso(),
  });

  if (isFirestoreTemporarilyDisabled()) {
    saveFallbackSupportChatConfig(normalizedConfig);
    return normalizedConfig;
  }

  try {
    await ensureSupportAuth(allowAnonymous);
    await setDoc(doc(db, SUPPORT_CHAT_CONFIG_COLLECTION, SUPPORT_CHAT_CONFIG_DOC), normalizedConfig, { merge: true });
    disableTemporaryFallback();
  } catch (error) {
    logUnexpectedError(error);
    throw error;
  }

  saveFallbackSupportChatConfig(normalizedConfig);
  return normalizedConfig;
}
