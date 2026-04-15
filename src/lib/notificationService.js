import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SLOT_STATUS_COLLECTION = "slotStatuses";
const SUPPORT_CHATS_COLLECTION = "supportChats";

/**
 * Creates a real-time notification feed from Firestore events.
 * Listens to slot status changes and support chat requests.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToAdminNotifications(onNotificationsChange, onError) {
  const notifications = [];
  let slotSnapshots = null;
  let chatSnapshots = null;
  let isFirstSlotSnapshot = true;
  let isFirstChatSnapshot = true;

  const emitAll = () => {
    // Sort by timestamp descending and limit to latest 30
    const sorted = [...notifications]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 30);
    onNotificationsChange(sorted);
  };

  // ── Listen to slot status changes ──
  const slotUnsubscribe = onSnapshot(
    collection(db, SLOT_STATUS_COLLECTION),
    (snapshot) => {
      if (isFirstSlotSnapshot) {
        // On first load, generate notifications for recently updated slots (last 24 hours)
        isFirstSlotSnapshot = false;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        snapshot.forEach((doc) => {
          const data = doc.data();
          const updatedAt = data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : null);

          if (updatedAt && updatedAt > oneDayAgo) {
            notifications.push({
              id: `slot-init-${doc.id}`,
              type: "slot_update",
              title: "Slot Updated",
              message: `Lot ${data.lotNum || doc.id} was changed to "${data.status || "unknown"}" by ${data.updatedBy || "admin"}`,
              timestamp: updatedAt.toISOString(),
              read: true, // Mark initial ones as read
              icon: "map",
            });
          }
        });

        emitAll();
        return;
      }

      // On subsequent changes, generate live notifications
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified" || change.type === "added") {
          const data = change.doc.data();
          const updatedAt = data.updatedAt?.toDate?.() || new Date();
          const notifId = `slot-${change.doc.id}-${updatedAt.getTime()}`;

          // Avoid duplicates
          if (notifications.some((n) => n.id === notifId)) return;

          notifications.push({
            id: notifId,
            type: "slot_update",
            title: change.type === "added" ? "New Slot Added" : "Slot Status Changed",
            message: `Lot ${data.lotNum || change.doc.id} is now "${data.status || "unknown"}"${data.updatedBy ? ` — by ${data.updatedBy}` : ""}`,
            timestamp: updatedAt.toISOString(),
            read: false,
            icon: "map",
          });
        }
      });

      emitAll();
    },
    (error) => {
      console.error("Slot notification listener error:", error);
      if (onError) onError(error);
    }
  );

  // ── Listen to support chat sessions ──
  const chatUnsubscribe = onSnapshot(
    collection(db, SUPPORT_CHATS_COLLECTION),
    (snapshot) => {
      if (isFirstChatSnapshot) {
        isFirstChatSnapshot = false;

        // Generate notifications for active chats requesting live agent
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.liveAgentRequested && data.status !== "resolved") {
            const updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
            notifications.push({
              id: `chat-init-${doc.id}`,
              type: "chat_request",
              title: "Live Agent Requested",
              message: `${data.visitorLabel || "A visitor"} is waiting for support`,
              timestamp: updatedAt.toISOString(),
              read: false,
              icon: "message",
            });
          }
        });

        emitAll();
        return;
      }

      // Real-time chat changes
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();

        if (change.type === "added") {
          const notifId = `chat-new-${change.doc.id}`;
          if (notifications.some((n) => n.id === notifId)) return;

          notifications.push({
            id: notifId,
            type: "chat_new",
            title: "New Chat Session",
            message: `${data.visitorLabel || "A visitor"} started a conversation`,
            timestamp: updatedAt.toISOString(),
            read: false,
            icon: "message",
          });
        }

        if (change.type === "modified") {
          // Check if a new message was added
          const messages = data.messages || [];
          const lastMsg = messages[messages.length - 1];

          if (lastMsg && lastMsg.sender === "user") {
            const notifId = `chat-msg-${change.doc.id}-${lastMsg.id}`;
            if (notifications.some((n) => n.id === notifId)) return;

            notifications.push({
              id: notifId,
              type: "chat_message",
              title: "New Message",
              message: `${data.visitorLabel || "Visitor"} sent a new chat message`,
              timestamp: lastMsg.createdAt || updatedAt.toISOString(),
              read: false,
              icon: "message",
            });
          }

          // Live agent request
          if (data.liveAgentRequested && data.status === "awaiting-agent") {
            const notifId = `chat-agent-${change.doc.id}`;
            if (notifications.some((n) => n.id === notifId)) return;

            notifications.push({
              id: notifId,
              type: "chat_request",
              title: "Live Agent Requested",
              message: `${data.visitorLabel || "A visitor"} needs support assistance`,
              timestamp: updatedAt.toISOString(),
              read: false,
              icon: "message",
            });
          }
        }
      });

      emitAll();
    },
    (error) => {
      console.error("Chat notification listener error:", error);
      if (onError) onError(error);
    }
  );

  return () => {
    slotUnsubscribe();
    chatUnsubscribe();
  };
}
