const DEFAULT_ADMIN_EMAILS = ["vicmar@homes.com"];
const ADMIN_UID_STORAGE_KEY = "vicmar_primary_admin_uid";

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function parseEnvList(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const configuredAdminUids = new Set([
  ...parseEnvList(import.meta.env.VITE_ADMIN_UIDS),
  ...parseEnvList(import.meta.env.VITE_PRIMARY_ADMIN_UID),
]);

const configuredAdminEmails = new Set([
  ...DEFAULT_ADMIN_EMAILS,
  ...parseEnvList(import.meta.env.VITE_ADMIN_EMAILS).map(normalizeEmail),
]);

function getRememberedAdminUid() {
  try {
    return String(window.localStorage.getItem(ADMIN_UID_STORAGE_KEY) ?? "").trim();
  } catch (error) {
    return "";
  }
}

function rememberAdminUid(uid) {
  if (!uid) {
    return;
  }

  try {
    window.localStorage.setItem(ADMIN_UID_STORAGE_KEY, uid);
  } catch (error) {
    // Ignore storage errors and continue using configured checks.
  }
}

export function isAuthorizedAdminUser(user) {
  if (!user || user.isAnonymous) {
    return false;
  }

  const rememberedAdminUid = getRememberedAdminUid();
  if (rememberedAdminUid && rememberedAdminUid === user.uid) {
    return true;
  }

  if (configuredAdminUids.has(user.uid)) {
    rememberAdminUid(user.uid);
    return true;
  }

  const isAllowedByEmail = configuredAdminEmails.has(normalizeEmail(user.email));
  if (isAllowedByEmail) {
    rememberAdminUid(user.uid);
    return true;
  }

  return false;
}

export function getAdminLoginErrorMessage() {
  if (configuredAdminUids.size > 0) {
    return "This account is not authorized for the admin dashboard.";
  }

  return "Only the authorized admin account can access this dashboard.";
}
