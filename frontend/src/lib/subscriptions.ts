import { api } from "./api";

export type SubscriptionStatus = "NEW" | "DISMISSED" | "TRACKED";

export interface DetectedSubscription {
  id: string;
  merchantKey: string;
  displayName: string;
  amount: string;
  lastChargedDate: string;
  occurrenceCount: number;
  status: SubscriptionStatus;
  notifiedAt: string | null;
}

export function fetchSubscriptions() {
  return api.get<DetectedSubscription[]>("/api/subscriptions").then((r) => r.data);
}

export function dismissSubscription(id: string) {
  return api.post(`/api/subscriptions/${id}/dismiss`);
}

export function trackSubscription(id: string) {
  return api.post(`/api/subscriptions/${id}/track`);
}
