"use client";

/**
 * Compatibility stub.
 * A previous HMR/service-worker graph still asked for this module after it was
 * removed. Keep a no-op export so stale clients can resolve the factory.
 */
export function AdminHubModal(_props: {
  open: boolean;
  onClose: () => void;
}) {
  return null;
}
