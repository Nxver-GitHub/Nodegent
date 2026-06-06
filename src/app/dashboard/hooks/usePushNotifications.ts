"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(storedSubscription?: string | null) {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const saveSub = useMutation(api.push.savePushSubscription);
  const removeSub = useMutation(api.push.removePushSubscription);

  // Sync permission state and detect existing subscription on mount
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    const perm = Notification.permission as PushPermission;
    setPermission(perm);

    if (perm === "granted" && storedSubscription) {
      // Verify the local SW subscription matches what we have stored
      navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
        if (!reg) return;
        const activeSub = await reg.pushManager.getSubscription();
        if (activeSub) setSubscribed(true);
      });
    }
  }, [storedSubscription]);

  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("VAPID public key not configured");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      await saveSub({ subscription: JSON.stringify(sub) });
      setSubscribed(true);
    } catch {
      // Permission denied or subscription failed — stay unsubscribed
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      await removeSub({});
      setSubscribed(false);
    } catch {
      // Ignore cleanup errors
    } finally {
      setLoading(false);
    }
  }

  return { permission, subscribed, loading, subscribe, unsubscribe };
}
