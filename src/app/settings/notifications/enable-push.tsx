"use client";
import { useEffect, useState } from "react";
import { savePushSubscriptionAction } from "../actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function EnablePush({ vapidKey }: { vapidKey: string }) {
  const [status, setStatus] = useState<"unsupported" | "default" | "granted" | "denied" | "working">("default");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after hydration
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) setStatus("unsupported");
    else setStatus(Notification.permission as "default" | "granted" | "denied");
  }, []);

  async function enable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission as "default" | "denied");
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscriptionAction(json);
      setStatus("granted");
      setMessage(res.ok ? "Push notifications are on for this browser." : res.error);
    } catch {
      setStatus("default");
      setMessage("We couldn't turn on push notifications in this browser.");
    }
  }

  if (status === "unsupported") return <p className="text-sm text-muted">This browser doesn&apos;t support push notifications.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "granted" ? (
        <p className="text-sm">✓ Push notifications are allowed in this browser.</p>
      ) : status === "denied" ? (
        <p className="text-sm text-muted">Push notifications are blocked. You can allow them in your browser&apos;s site settings.</p>
      ) : (
        <button type="button" className="btn-secondary btn-sm" onClick={enable} disabled={status === "working"}>
          {status === "working" ? "Turning on…" : "Turn on push notifications in this browser"}
        </button>
      )}
      <p role="status" className="text-sm">{message}</p>
    </div>
  );
}
