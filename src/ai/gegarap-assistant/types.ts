export interface DiagnosisState {
  category: string | null;
  symptoms: string[];
  questionsAsked: string[];
  suspectedCauses: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  bookingEligible: boolean;
}

export interface ConversationMemory {
  issueSummary: string;
  answeredQuestions: string[];
  category: string | null;
  risk: string;
  causes: string[];
  questionHistory: string[];
}

export interface RecoItem {
  id: string;
  nama: string;
  layanan: string;
  estimasi_harga: string;
  rating: string;
  alasan: string;
  highlight: string;
}

export interface AssistantProvider {
  id: string;
  name: string;
  category: string;
  categories?: string[];
  districts?: string[];
  rating: number;
  ratingCount: number;
  dailyRate: number;
  completedJobs: number;
  fraudBadge?: 'baru' | null;
  bio?: string | null;
}

export interface AssistantResponse {
  message: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidenceLevel: 'low' | 'medium' | 'high';
  bookingEligible: boolean;
  suggestedNextAction: string;
  quickReplies?: string[];
  debug?: Record<string, unknown>;

  pesan: string;
  rekomendasi: RecoItem[];
  catatan: string;
  cta: string;
}

export interface SafetyAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  keyword: string;
}

export interface AssistantRequest {
  query: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  providers: AssistantProvider[];
}
