import type { ContactStatus } from "./relationshipScore.ts";

// ============================================================
// TIPURI CONTACT — modul curat, fără dependențe de UI/React.
// Atât clientul (Dashboard, CRM) cât și Edge Functions (Deno)
// pot importa aceste tipuri fără a trage cod de browser.
// ============================================================

export interface ContactTimeline {
  date: string;
  label: string;
  type: "offer" | "followup" | "email" | "whatsapp" | "event";
  amount?: string;
  offerId?: string;
  // Ofertă logată manual (marcată ca trimisă pe alt canal): fără produse / total 0.
  external?: boolean;
  sentVia?: string;
}

export interface LastOfferInfo {
  id: string;
  sentAt: string;
  productCount: number;
  totalEur: number;
  productNames: string[];
  // Marcată ca trimisă extern (WhatsApp/telefon/alt canal), fără produse.
  external?: boolean;
  sentVia?: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: ContactStatus;
  notes?: string;
  source?: string | null;
  language_code?: string | null;
  created_at: string;
  updated_at?: string | null;
  first_offer_at?: string | null;
  last_activity_at?: string | null;
  followup_count?: number;
  followup_opted_out?: boolean;
  last_followup_at?: string | null;
  offers_count?: number;
  total_eur?: number;
  manual_high_interest?: boolean;
  manual_business_interest?: boolean;
  email_opens?: number | null;
  email_clicks?: number | null;
  offer_products?: string[];
  // Communication controls
  email_opt_out?: boolean;
  email_opt_out_at?: string | null;
  communication_blocked?: boolean;
  communication_blocked_at?: string | null;
  communication_blocked_reason?: string | null;
  last_offer?: LastOfferInfo | null;
  timeline?: ContactTimeline[];
  // UI helpers (populate doar pe client, în enrichContact)
  avatarBg?: string;
  avatarColor?: string;
  statusLabel?: string;
  statusBg?: string;
  statusColor?: string;
  urgentLabel?: string;
  urgencyDays?: number;
  urgencyLabel?: string;
  urgencyColor?: string;
  barColor?: string;
  actionText?: string;
}
