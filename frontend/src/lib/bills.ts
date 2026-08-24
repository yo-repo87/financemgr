import { api } from "./api";

export type BillRecurrence = "ONE_TIME" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "YEARLY";

export interface Bill {
  id: string;
  name: string;
  amount: string;
  category: string | null;
  recurrence: BillRecurrence;
  anchorDueDate: string;
  autoDetectKeyword: string | null;
  currentCycle: { dueDate: string; isPaid: boolean; isOverdue: boolean } | null;
}

export interface UpcomingBill {
  billId: string;
  name: string;
  amount: string;
  dueDate: string;
  isOverdue: boolean;
}

export interface BillPayment {
  id: string;
  dueDate: string;
  paidAt: string | null;
  amountPaid: string | null;
  transactionId: string | null;
  transaction: { name: string; merchantName: string | null } | null;
}

export interface BillInput {
  name: string;
  amount: string | number;
  category?: string;
  recurrence: BillRecurrence;
  anchorDueDate: string;
  autoDetectKeyword?: string;
}

export function fetchBills() {
  return api.get<Bill[]>("/api/bills").then((r) => r.data);
}

export function fetchUpcomingBills(days = 30) {
  return api.get<UpcomingBill[]>("/api/bills/upcoming", { params: { days } }).then((r) => r.data);
}

export function createBill(input: BillInput) {
  return api.post<Bill>("/api/bills", input).then((r) => r.data);
}

export function updateBill(id: string, input: BillInput) {
  return api.put<Bill>(`/api/bills/${id}`, input).then((r) => r.data);
}

export function deleteBill(id: string) {
  return api.delete(`/api/bills/${id}`);
}

export function fetchBillPayments(billId: string) {
  return api.get<BillPayment[]>(`/api/bills/${billId}/payments`).then((r) => r.data);
}

export function markBillPaid(billId: string, dueDate: string, amountPaid?: string) {
  return api.post(`/api/bills/${billId}/payments`, { dueDate, amountPaid });
}

export function markBillUnpaid(billId: string, dueDate: string) {
  return api.delete(`/api/bills/${billId}/payments/${dueDate}`);
}
