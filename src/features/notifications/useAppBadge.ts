import { useEffect } from "react";

import { useNotifications } from "./useNotifications";

// The Badging API lives on Navigator but isn't in every TS lib version, so
// we narrow to an optional shape and feature-detect at runtime.
type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Mirrors the inbox unread count onto the installed-app icon badge (the red
 * dot/number on the macOS Dock, taskbar, or home screen) via the Badging
 * API. Driven by the same realtime-backed unread count as the in-app inbox
 * bell, so it updates live while the app is open.
 *
 * Caveats by design (this is the "while open" version):
 * - The badge only actually renders when the app is INSTALLED as a PWA. In a
 *   normal browser tab the calls are harmless no-ops.
 * - It does NOT update while the app is fully closed — that needs a service
 *   worker + Web Push to wake in the background.
 * - Unsupported browsers (e.g. Firefox) are skipped via feature detection.
 *
 * Mounted once in AppShell so it runs across every authenticated route.
 */
export function useAppBadge() {
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge || !nav.clearAppBadge) return;

    // setAppBadge(0) clears per spec, but be explicit. Both calls return a
    // promise that can reject on surfaces where badging isn't permitted
    // (e.g. an uninstalled tab) — swallow it, the badge is best-effort.
    if (unread > 0) {
      nav.setAppBadge(unread).catch(() => {});
    } else {
      nav.clearAppBadge().catch(() => {});
    }
  }, [unread]);

  // Clear the badge when the shell unmounts (sign-out) so a stale count
  // doesn't linger on the dock icon after the user leaves.
  useEffect(() => {
    return () => {
      (navigator as BadgeNavigator).clearAppBadge?.().catch(() => {});
    };
  }, []);
}
