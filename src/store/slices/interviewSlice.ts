import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { InterviewState, Candidate, Answer, Question } from '../../types';
import { generateQuestions, calculateScore, generateSummary } from '../../utils/interviewUtils';

// Validation helpers
const isValidEmail = (email?: string) => !!email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
const isValidPhone = (phone?: string) => !!phone && /^\+?[\d\s\-()]{7,}$/.test(phone);
const isValidName = (name?: string) => !!name && name.trim().length >= 2;

interface ExtendedInterviewState extends InterviewState {
  questions: Question[];
  questionsLoading: boolean;
}

const initialState: ExtendedInterviewState = {
  currentCandidate: null,
  candidates: [],
  questions: [],
  isLoading: false,
  questionsLoading: false,
  error: null,
};

export const generateInterviewQuestions = createAsyncThunk(
  'interview/generateQuestions',
  async (resumeText?: string) => {
    console.log('Generating questions with resume text:', resumeText ? 'Present' : 'Not provided');
    const questions = await generateQuestions(resumeText);
    console.log('Generated questions:', questions);
    return questions;
  }
);

export const submitAnswerAsync = createAsyncThunk(
  'interview/submitAnswer',
  async (
    payload: { answer: string; timeSpent: number },
    { getState }
  ) => {
    const state = getState() as { interview: ExtendedInterviewState };
    const { currentCandidate, questions } = state.interview;

    if (!currentCandidate || !questions.length) {
      throw new Error('No active interview or questions available');
    }

    const currentQuestion = questions[currentCandidate.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error('Invalid question index');
    }

    // Import evaluateAnswer dynamically to avoid circular dependencies
    const { evaluateAnswer } = await import('../../utils/geminiService');
    
    // Evaluate the answer using AI
    const evaluation = await evaluateAnswer(
      currentQuestion.text,
      payload.answer,
      currentQuestion.difficulty,
      currentCandidate.resumeText
    );

    return {
      answer: payload.answer,
      timeSpent: payload.timeSpent,
      questionText: currentQuestion.text,
      difficulty: currentQuestion.difficulty,
      score: evaluation.score,
      feedback: evaluation.feedback,
      evaluationMethod: evaluation.evaluationMethod,
    };
  }
);

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    createCandidate: (state, action: PayloadAction<{ name: string; email: string; phone: string; text?: string; resumeFileName?: string }>) => {
      const { name, email, phone, text, resumeFileName } = action.payload;

      // Validate fields
      if (!isValidName(name)) {
        state.error = 'Invalid name. Name must be at least 2 characters.';
        return;
      }
      if (!isValidEmail(email)) {
        state.error = 'Invalid email address.';
        return;
      }
      if (!isValidPhone(phone)) {
        state.error = 'Invalid phone number.';
        return;
      }

      // Prevent duplicate email addresses (case-insensitive)
      const emailLower = email!.toLowerCase();
      const existing = state.candidates.find(c => c.email.toLowerCase() === emailLower);
      if (existing) {
        state.error = 'A candidate with this email already exists.';
        return;
      }

      const newCandidate: Candidate = {
        id: crypto.randomUUID(),
        name,
        email,
        phone,
        fileName: resumeFileName,
        resumeText: text,
        status: 'pending',
        currentQuestionIndex: 0,
        answers: [],
        scores: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.currentCandidate = newCandidate;
      state.candidates.push(newCandidate);
      state.error = null;
    },
    updateCandidateInfo: (state, action: PayloadAction<{ name?: string; email?: string; phone?: string }>) => {
      if (state.currentCandidate) {
        const updates = action.payload;
        // Validate fields if present
        if (updates.name !== undefined && !isValidName(updates.name)) {
          state.error = 'Invalid name. Name must be at least 2 characters.';
          return;
        }
        if (updates.email !== undefined && !isValidEmail(updates.email)) {
          state.error = 'Invalid email address.';
          return;
        }
        if (updates.phone !== undefined && !isValidPhone(updates.phone)) {
          state.error = 'Invalid phone number.';
          return;
        }

          // If updating email, ensure it's not duplicate (case-insensitive) among other candidates
          if (updates.email !== undefined) {
            const newEmailLower = updates.email.toLowerCase();
            const dup = state.candidates.find(c => c.id !== state.currentCandidate!.id && c.email.toLowerCase() === newEmailLower);
            if (dup) {
              state.error = 'Another candidate already uses this email address.';
              return;
            }
          }

        state.currentCandidate = {
          ...state.currentCandidate,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        // Update in candidates array too
        const index = state.candidates.findIndex(c => c.id === state.currentCandidate!.id);
        if (index !== -1) {
          state.candidates[index] = state.currentCandidate;
        }
        state.error = null;
      }
    },
    startInterview: (state) => {
      if (state.currentCandidate) {
        state.currentCandidate.status = 'in-progress';
        state.currentCandidate.updatedAt = new Date().toISOString();

        // Update in candidates array
        const index = state.candidates.findIndex(c => c.id === state.currentCandidate!.id);
        if (index !== -1) {
          state.candidates[index] = state.currentCandidate;
        }
      }
    },
    setCurrentCandidate: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null) {
        state.currentCandidate = null;
        // Clear questions when clearing candidate
        state.questions = [];
        state.questionsLoading = false;
      } else {
        const candidate = state.candidates.find(c => c.id === action.payload);
        state.currentCandidate = candidate || null;
      }
    },
    resetInterview: (state) => {
      if (state.currentCandidate) {
        state.currentCandidate.status = 'pending';
        state.currentCandidate.currentQuestionIndex = 0;
        state.currentCandidate.answers = [];
        state.currentCandidate.scores = [];
        state.currentCandidate.finalScore = undefined;
        state.currentCandidate.summary = undefined;
        state.currentCandidate.updatedAt = new Date().toISOString();

        // Update in candidates array
        const index = state.candidates.findIndex(c => c.id === state.currentCandidate!.id);
        if (index !== -1) {
          state.candidates[index] = state.currentCandidate;
        }
      }
      // Clear questions when resetting
      state.questions = [];
      state.questionsLoading = false;
    },
    deleteCandidate: (state, action: PayloadAction<string>) => {
      const candidateId = action.payload;
      console.log('Redux deleteCandidate action received for:', candidateId);
      console.log('Candidates before deletion:', state.candidates.length);
      
      const initialLength = state.candidates.length;
      state.candidates = state.candidates.filter(c => c.id !== candidateId);
      
      console.log('Candidates after deletion:', state.candidates.length);
      console.log('Deletion successful:', initialLength > state.candidates.length);
      
      // If the deleted candidate was the current candidate, clear it
      if (state.currentCandidate?.id === candidateId) {
        state.currentCandidate = null;
        console.log('Current candidate cleared');
      }
    },
    loadPersistedData: (state, action: PayloadAction<{ candidates: Candidate[]; currentCandidateId?: string }>) => {
      state.candidates = action.payload.candidates;
      if (action.payload.currentCandidateId) {
        state.currentCandidate = state.candidates.find(c => c.id === action.payload.currentCandidateId) || null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateInterviewQuestions.pending, (state) => {
        state.questionsLoading = true;
        state.error = null;
      })
      .addCase(generateInterviewQuestions.fulfilled, (state, action) => {
        state.questionsLoading = false;
        state.questions = action.payload;
        console.log('Questions stored in Redux state:', action.payload);
      })
      .addCase(generateInterviewQuestions.rejected, (state, action) => {
        state.questionsLoading = false;
        state.error = action.error.message || 'Failed to generate questions';
      })
      .addCase(submitAnswerAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(submitAnswerAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        
        if (!state.currentCandidate) return;

        const newAnswer: Answer = {
          question: action.payload.questionText,
          answer: action.payload.answer,
          timeSpent: action.payload.timeSpent,
          score: action.payload.score,
          difficulty: action.payload.difficulty,
          timestamp: new Date().toISOString(),
          feedback: action.payload.feedback,
          evaluationMethod: action.payload.evaluationMethod,
        };

        state.currentCandidate.answers.push(newAnswer);
        state.currentCandidate.scores.push(action.payload.score);
        state.currentCandidate.currentQuestionIndex += 1;
        state.currentCandidate.updatedAt = new Date().toISOString();

        // Check if interview is complete
        if (state.currentCandidate.currentQuestionIndex >= state.questions.length) {
          state.currentCandidate.status = 'completed';
          state.currentCandidate.finalScore = Math.round(
            state.currentCandidate.scores.reduce((sum, score) => sum + score, 0) / state.currentCandidate.scores.length
          );
          state.currentCandidate.summary = generateSummary(state.currentCandidate.answers);
        }

        // Update in candidates array
        const index = state.candidates.findIndex(c => c.id === state.currentCandidate!.id);
        if (index !== -1) {
          state.candidates[index] = state.currentCandidate;
        }
      })
      .addCase(submitAnswerAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to submit answer';
        console.error('Error submitting answer:', action.error);
      });
  },
});

export const {
  setLoading,
  setError,
  createCandidate,
  updateCandidateInfo,
  startInterview,
  setCurrentCandidate,
  resetInterview,
  deleteCandidate,
  loadPersistedData,
} = interviewSlice.actions;

export default interviewSlice.reducer;
