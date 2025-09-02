
export interface MeetingSummary {
  summary: string;
  actionItems: string[];
  keyTopics: string[];
}

export interface SalesSuggestion {
  type: string;
  suggestion: string;
}

export interface SalesAnalysisResult {
    diarizedTranscript: string;
    suggestions: SalesSuggestion[];
}

export interface SalesCallSummary {
  painPoints: string[];
  proposedSolutions: string[];
  offeredBenefits: string[];
  nextSteps: string[];
  internalRecommendations: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}
