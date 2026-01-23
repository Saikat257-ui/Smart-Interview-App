export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  fileName?: string;
  resumeText?: string;
  status: 'pending' | 'in-progress' | 'completed';
  currentQuestionIndex: number;
  answers: Answer[];
  scores: number[];
  finalScore?: number;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Answer {
  question: string;
  answer: string;
  timeSpent: number;
  score?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timestamp: string;
  feedback?: string;
  evaluationMethod?: 'ai' | 'fallback';
}

export interface Question {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number; // in seconds
}

export interface InterviewState {
  currentCandidate: Candidate | null;
  candidates: Candidate[];
  isLoading: boolean;
  error: string | null;
}

export interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    questionId?: string;
    timeRemaining?: number;
    isTimeout?: boolean;
  };
}

export interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  text?: string;
}
