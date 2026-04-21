const DEFAULT_PRIMARY_ADMIN_EMAILS = ["vicmar@homes.com"];
const DEFAULT_SUPPORT_ADMIN_EMAILS = ["support@vicmar.com"];

const PRIMARY_ADMIN_UID_STORAGE_KEY = "vicmar_primary_admin_uid";
const SUPPORT_ADMIN_UID_STORAGE_KEY = "vicmar_support_admin_uid";

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function parseEnvList(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const configuredPrimaryAdminUids = new Set([
  ...parseEnvList(import.meta.env.VITE_ADMIN_UIDS),
  ...parseEnvList(import.meta.env.VITE_PRIMARY_ADMIN_UID),
]);

const configuredSupportAdminUids = new Set([
  ...parseEnvList(import.meta.env.VITE_SUPPORT_ADMIN_UIDS),
  ...parseEnvList(import.meta.env.VITE_SUPPORT_ADMIN_UID),
]);

const configuredPrimaryAdminEmails = new Set([
  ...DEFAULT_PRIMARY_ADMIN_EMAILS,
  ...parseEnvList(import.meta.env.VITE_ADMIN_EMAILS).map(normalizeEmail),
]);

const configuredSupportAdminEmails = new Set([
  ...DEFAULT_SUPPORT_ADMIN_EMAILS,
  ...parseEnvList(import.meta.env.VITE_SUPPORT_ADMIN_EMAILS).map(normalizeEmail),
]);

function getRememberedUid(storageKey) {
  try {
    return String(window.localStorage.getItem(storageKey) ?? "").trim();
  } catch (error) {
    return "";
  }
}

function rememberUid(storageKey, uid) {
  if (!uid) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, uid);
  } catch (error) {
    // Ignore storage errors and continue using configured checks.
  }
}

function isAuthenticatedUser(user) {
  if (!user || user.isAnonymous) {
    return false;
  }

  return true;
}

export function isSupportAdminUser(user) {
  if (!isAuthenticatedUser(user)) {
    return false;
  }

  const rememberedSupportAdminUid = getRememberedUid(SUPPORT_ADMIN_UID_STORAGE_KEY);
  if (rememberedSupportAdminUid && rememberedSupportAdminUid === user.uid) {
    return true;
  }

  if (configuredSupportAdminUids.has(user.uid)) {
    rememberUid(SUPPORT_ADMIN_UID_STORAGE_KEY, user.uid);
    return true;
  }

  const isAllowedByEmail = configuredSupportAdminEmails.has(normalizeEmail(user.email));
  if (isAllowedByEmail) {
    rememberUid(SUPPORT_ADMIN_UID_STORAGE_KEY, user.uid);
    return true;
  }

  return false;
}

export function isPrimaryAdminUser(user) {
  if (!isAuthenticatedUser(user)) {
    return false;
  }

  const normalizedEmail = normalizeEmail(user.email);
  if (configuredSupportAdminEmails.has(normalizedEmail)) {
    return false;
  }

  const rememberedPrimaryAdminUid = getRememberedUid(PRIMARY_ADMIN_UID_STORAGE_KEY);
  if (rememberedPrimaryAdminUid && rememberedPrimaryAdminUid === user.uid) {
    return true;
  }

  if (configuredPrimaryAdminUids.has(user.uid)) {
    rememberUid(PRIMARY_ADMIN_UID_STORAGE_KEY, user.uid);
    return true;
  }

  const isAllowedByEmail = configuredPrimaryAdminEmails.has(normalizedEmail);
  if (isAllowedByEmail) {
    rememberUid(PRIMARY_ADMIN_UID_STORAGE_KEY, user.uid);
    return true;
  }

  return false;
}

export function isAuthorizedAdminUser(user) {
  return isPrimaryAdminUser(user) || isSupportAdminUser(user);
}

export function getAdminLoginErrorMessage() {
  if (configuredPrimaryAdminUids.size > 0) {
    return "This account is not authorized for the admin dashboard.";
  }

  return "Only the authorized admin account can access this dashboard.";
}

export function getSupportAdminLoginErrorMessage() {
  if (configuredSupportAdminUids.size > 0) {
    return "This account is not authorized for support chat dashboard.";
  }

  return "Only the support admin account can access this dashboard.";
}
