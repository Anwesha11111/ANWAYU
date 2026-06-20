// ─── Shared domain types for the GramGyan backend ──────────────────────────

export type DemographicZone = 'RURAL' | 'URBAN' | 'SEMI_URBAN';
export type OperationType   = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
export type SyncStatus      = 'PENDING' | 'APPLIED' | 'CONFLICT' | 'REJECTED';
export type KybStatus       = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type NetworkProfile  = 'WiFi' | '4G' | '3G' | '2G';

// ── User Profile ──────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  display_name: string;
  avatar_url?: string;
  preferred_language: string;

  // Geolocation
  geo_latitude?: number;
  geo_longitude?: number;
  geo_accuracy_m?: number;
  geo_updated_at?: Date;
  demographic_zone: DemographicZone;
  state_code?: string;
  district?: string;
  pin_code?: string;

  // Study Timer
  active_study_timer_s: number;
  last_session_start?: Date;
  total_study_time_s: number;

  // Streak Analytics
  current_streak: number;
  longest_streak: number;
  last_active_timestamp?: Date;
  grace_cushion_used: boolean;
  grace_cushion_resets_at?: Date;
  streak_freeze_count: number;

  // Meta
  is_active: boolean;
  is_email_verified: boolean;
  role: 'student' | 'mentor' | 'admin';
  created_at: Date;
  updated_at: Date;
}

// ── Competency Ledger ─────────────────────────────────────────────────────────
export interface CompetencyRecord {
  id: string;
  user_id: string;
  module_id: string;
  module_name: string;
  subject_area?: string;
  difficulty_level?: number;

  is_verified: boolean;
  verified_at?: Date;
  verified_by: string;
  completion_percentage?: number;

  raw_score?: number;
  threshold_score: number;
  attempts: number;
  passed: boolean;

  // Anti-gaming telemetry
  tab_switches: number;
  submission_speed_ms: number;
  copy_paste_events: number;
  focus_lost_events: number;
  suspicious_flag: boolean;
  flag_reason?: string;

  // Crypto
  verification_hash?: string;
  hash_algorithm: string;

  started_at?: Date;
  submitted_at?: Date;
  created_at: Date;
}

// ── Offline Sync Journal ──────────────────────────────────────────────────────
export interface SyncJournalEntry {
  id: string;
  user_id: string;
  device_id: string;

  operation_type: OperationType;
  target_table: string;
  resource_id?: string;
  payload: Record<string, unknown>;

  vector_clock: Record<string, number>; // { deviceId: lamportTimestamp }
  client_timestamp: Date;
  server_timestamp?: Date;

  sync_status: SyncStatus;
  conflict_resolution?: string;
  retry_count: number;
  error_message?: string;

  created_at: Date;
  applied_at?: Date;
}

// ── Sync Delta API shapes ─────────────────────────────────────────────────────
export interface ClientSyncPayload {
  device_id: string;
  client_vector_clock: Record<string, number>;
  operations: Omit<SyncJournalEntry, 'id' | 'sync_status' | 'server_timestamp' | 'applied_at' | 'created_at'>[];
}

export interface ServerDeltaPack {
  server_vector_clock: Record<string, number>;
  applied: string[];       // op IDs accepted
  conflicts: string[];     // op IDs that conflicted (LWW applied)
  rejected: string[];      // op IDs rejected with reason
  server_mutations: SyncJournalEntry[]; // What client is missing
}

// ── AI Routing ────────────────────────────────────────────────────────────────
export type AIRouteMode =
  | 'standard_dialogue'
  | 'project_guidance'
  | 'stem_reasoning'
  | 'vision_ocr'
  | 'scam_detection';

export interface AIQueryRequest {
  mode: AIRouteMode;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  image_base64?: string;   // For vision_ocr mode
  stream?: boolean;
  language?: string;       // BCP-47 for voice hook
  max_tokens?: number;
}

export interface AIQueryResponse {
  model_used: string;
  mode: AIRouteMode;
  content: string;
  tokens_used: { prompt: number; completion: number; total: number };
  latency_ms: number;
  finish_reason: string;
}

// ── Scam Detection ────────────────────────────────────────────────────────────
export interface ScamAnalysisResult {
  is_scam: boolean;
  confidence_score: number; // 0.0 → 1.0
  flags: string[];           // ['MLM', 'phishing_template', 'upfront_payment']
}

// ── KYB / Corporate ──────────────────────────────────────────────────────────
export interface CorporateClient {
  id: string;
  company_name: string;
  gstin?: string;
  corporate_domain: string;
  website_url?: string;
  contact_email: string;
  contact_name?: string;
  kyb_status: KybStatus;
  kyb_verified_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ── Anti-Phishing ─────────────────────────────────────────────────────────────
export interface RedactedItem {
  type: 'phone' | 'email' | 'checkout_link' | 'external_url';
  original: string;
  replaced_with: string;
}

// ── Health Check ──────────────────────────────────────────────────────────────
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime_s: number;
  services: {
    database: { status: 'healthy' | 'unhealthy'; latency_ms: number; pool_total: number; pool_idle: number };
    redis:    { status: 'healthy' | 'unhealthy'; latency_ms: number };
    memory:   { status: 'healthy' | 'unhealthy'; used_mb: number; threshold_mb: number };
  };
}

// ── Standard API Response wrapper ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message, timestamp: new Date().toISOString() };
}

export function apiError(error: string, message?: string): ApiResponse<never> {
  return { success: false, error, message, timestamp: new Date().toISOString() };
}
