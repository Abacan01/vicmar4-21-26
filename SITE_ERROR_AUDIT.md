Vicmar Homes Daily User-Facing Error Report
Date: 2026-04-06

Purpose
This report lists common errors that real users can face during normal daily browsing and login use. It is written in simple English and ready to copy to Google Docs.

Scope checked
- Public browsing pages
- Admin login and admin session behavior
- Contact form and support chat behavior
- Map, listing, and live data sections

==================================================
GENERAL ERRORS USERS MAY ENCOUNTER
==================================================

1) Admin login fails with wrong email or password
What users see
- Message like: Invalid email or password.
- Message like: No admin account was found for this email.

Why this happens
- The entered credentials are incorrect.
- The email is not registered in Firebase Auth.

Reference
- src/pages/AdminLogin.jsx

How to fix
- Add a short helper text below inputs: Check email spelling and password case.
- Add forgot password flow for admin.
- Keep current clear error messages.

--------------------------------------------------

2) Admin login temporarily blocked after many tries
What users see
- Message: Too many login attempts. Please try again later.

Why this happens
- Firebase rate-limits repeated failed logins.

Reference
- src/pages/AdminLogin.jsx

How to fix
- Show countdown or wait guidance in UI.
- Add a cooldown note: Try again after a few minutes.
- Add admin reset path if lockout is frequent.

--------------------------------------------------

3) User can log in but still cannot open admin dashboard
What users see
- Login succeeds, then user is rejected from admin pages.
- Message says account is not authorized.

Why this happens
- Admin access is not only login; account must be in allowed admin list.

Reference
- src/lib/adminAccess.js
- src/pages/AdminLogin.jsx
- src/components/AdminLayout.jsx

How to fix
- Maintain a clear admin allow-list process.
- Keep admin UIDs and emails updated in environment config.
- Show a support contact path in the rejection message.

--------------------------------------------------

4) Admin settings update can fail when session is expired
What users see
- Change email/password fails with technical error text.
- User may be sent back to login after failure.

Why this happens
- Sensitive actions need recent authentication.
- If current session is old, re-auth can fail.

Reference
- src/components/AdminLayout.jsx

How to fix
- Add explicit message: Please log in again before changing account settings.
- Add session check before update request starts.
- Redirect to login with a clear reason message.

--------------------------------------------------

5) Support chat may fail to start for some visitors
What users see
- Chat does not start or live-agent request fails.
- User cannot continue chat flow.

Why this happens
- Chat depends on anonymous auth and Firestore access.
- If auth fails or is blocked, session creation fails.

Reference
- src/lib/supportChatService.js
- src/Layout.jsx

How to fix
- Add visible fallback message inside chat panel: Chat is temporarily unavailable.
- Add one-click retry button.
- Add secondary fallback route to Contact Us page.

--------------------------------------------------

6) Chat history can reset when browser storage is cleared or restricted
What users see
- Previous conversation disappears.
- New session starts unexpectedly.

Why this happens
- Chat session IDs and fallback data depend on local storage.
- Storage cleanup, strict privacy mode, or browser restrictions can remove data.

Reference
- src/lib/supportChatService.js
- src/pages/AdminMessages.jsx

How to fix
- Show notice: Chat history is device/browser based.
- Persist critical chat history server-side only for active support.
- Add UI message when a new fallback session is created.

--------------------------------------------------

7) Live map or admin data can show stale/default values when sync fails
What users see
- Warnings like live sync unavailable.
- Slot statuses may look outdated temporarily.

Why this happens
- Real-time Firestore listeners can fail due network/permission issues.
- UI falls back to local/default values.

Reference
- src/pages/VicinityMap.jsx
- src/pages/AdminDashboard.jsx
- src/pages/AdminSlots.jsx
- src/pages/AdminMessages.jsx

How to fix
- Keep warning banner visible until sync is back.
- Add auto retry status indicator (Reconnecting...).
- Add timestamp: Last successful sync at HH:MM.

--------------------------------------------------

8) Social media buttons do not open real social pages
What users see
- Clicking Facebook/Instagram/Youtube buttons does not go to official profiles.
- Some clicks may jump to top of page.

Why this happens
- Links are placeholders (#) and not real URLs.

Reference
- src/Layout.jsx

How to fix
- Replace placeholder links with official social URLs.
- Open external links in new tab with safe rel attributes.

--------------------------------------------------

9) Contact page hero image may fail on slow network or blocked CDN
What users see
- Missing or blank header background image.
- Visual quality inconsistency across users.

Why this happens
- Header uses external image URL.
- If external host is blocked/slow, image load fails.

Reference
- src/pages/ContactUs.jsx

How to fix
- Move hero image to local project assets.
- Keep a local fallback image.
- Use optimized size for faster loading.

--------------------------------------------------

10) URL case mismatch can show Page Not Found
What users see
- Shared or manually typed lowercase links may open 404 page.
- Example: user types /home instead of /Home.

Why this happens
- Routes are generated with exact page key case.

Reference
- src/pages.config.js
- src/App.jsx
- src/utils/index.ts

How to fix
- Add lowercase route aliases or normalize route input.
- Redirect common lowercase paths to official route paths.

--------------------------------------------------

11) Property detail can show Property Not Found on bad or missing id link
What users see
- Property detail opens but shows not found page state.

Why this happens
- Detail page depends on id query param.
- If id is missing/invalid, no matching property is loaded.

Reference
- src/pages/PropertyDetail.jsx
- src/components/shared/PropertyCard.jsx

How to fix
- Validate id before opening detail page.
- Redirect invalid detail links to Listings with a friendly message.
- Add robust deep-link handling from shared URLs.

--------------------------------------------------

12) Filter/share experience can confuse users after page reload
What users see
- Filters may not stay exactly as expected after reload or when sharing links.

Why this happens
- Some pages read URL params only at first load and do not always keep URL in sync with every filter action.

Reference
- src/pages/Listings.jsx
- src/pages/ContactUs.jsx
- src/pages/PropertyDetail.jsx

How to fix
- Keep filter state synced to URL continuously.
- Preserve user selection in URL so links are shareable and consistent.

==================================================
LOGIN-FOCUSED QUICK LIST
==================================================

Most common login-related user errors
- Wrong credentials
- Too many attempts (temporary lock)
- Logged-in user not in admin allow-list
- Session too old for sensitive account updates

Best immediate actions
- Improve login help text and lockout guidance
- Keep admin allow-list updated
- Add clear re-login prompts for account changes
- Add retry and fallback options when auth-dependent services fail

==================================================
ONE LINE SUMMARY
==================================================

The site is usable, but daily users may face login rejections, temporary lockouts, chat start failures, stale live data moments, broken social links, and occasional routing/deep-link issues that need clearer handling and recovery UI.