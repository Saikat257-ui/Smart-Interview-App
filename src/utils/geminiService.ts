import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Question } from '../types';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';

if (!API_KEY) {
  console.warn('REACT_APP_GEMINI_API_KEY not found in environment variables');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export const generateQuestionsFromResume = async (resumeText: string): Promise<Question[]> => {
  console.log('Gemini API Key present:', !!API_KEY);
  if (!API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  try {
    console.log('Calling Gemini API with resume text length:', resumeText.length);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
Based on the following resume content, generate exactly 6 technical interview questions:
- 2 EASY questions (20 seconds each) - basic concepts related to their skills
- 2 MEDIUM questions (60 seconds each) - intermediate level problems
- 2 HARD questions (120 seconds each) - advanced scenarios and problem-solving

Resume content:
${resumeText}

Return ONLY a JSON array with this exact structure:
[
  {
    "id": "easy-1",
    "text": "question text here",
    "difficulty": "easy",
    "timeLimit": 20
  },
  {
    "id": "easy-2", 
    "text": "question text here",
    "difficulty": "easy",
    "timeLimit": 20
  },
  {
    "id": "medium-1",
    "text": "question text here", 
    "difficulty": "medium",
    "timeLimit": 60
  },
  {
    "id": "medium-2",
    "text": "question text here",
    "difficulty": "medium", 
    "timeLimit": 60
  },
  {
    "id": "hard-1",
    "text": "question text here",
    "difficulty": "hard",
    "timeLimit": 120
  },
  {
    "id": "hard-2",
    "text": "question text here",
    "difficulty": "hard",
    "timeLimit": 120
  }
]

Focus on technologies, frameworks, and skills mentioned in the resume. Make questions specific and relevant to their experience level.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('Gemini API response length:', text.length);
    console.log('Gemini API response preview:', text.substring(0, 200));
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini API');
    }

    const questions: Question[] = JSON.parse(jsonMatch[0]);
    console.log('Parsed questions:', questions);
    
    // Validate structure
    if (!Array.isArray(questions) || questions.length !== 6) {
      throw new Error('Invalid questions format received');
    }

    return questions;
  } catch (error) {
    console.error('Error generating questions from Gemini:', error);
    if (error instanceof Error) {
      throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error('Failed to generate questions from resume content');
  }
};

export interface AnswerEvaluation {
  score: number;
  feedback: string;
  evaluationMethod: 'ai' | 'fallback';
}

export const evaluateAnswer = async (
  question: string,
  answer: string,
  difficulty: 'easy' | 'medium' | 'hard',
  resumeText?: string
): Promise<AnswerEvaluation> => {
  // If answer is empty or too short, return low score immediately
  if (!answer || answer.trim().length < 10) {
    return {
      score: 0,
      feedback: 'Answer is too short or empty. Please provide a more detailed response.',
      evaluationMethod: 'fallback',
    };
  }

  if (!API_KEY) {
    console.warn('Gemini API key not available, using fallback scoring');
    return fallbackScoring(answer, difficulty);
  }

  try {
    console.log('Evaluating answer with Gemini AI...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an expert technical interviewer evaluating a candidate's answer to an interview question.

**Question (${difficulty.toUpperCase()} difficulty):**
${question}

**Candidate's Answer:**
${answer}

${resumeText ? `**Candidate's Resume Context:**\n${resumeText.substring(0, 500)}...\n` : ''}

Please evaluate this answer based on the following criteria:
1. **Correctness**: Is the answer technically accurate and factually correct?
2. **Relevance**: Does the answer directly address the question asked?
3. **Depth**: Is the explanation thorough and appropriate for a ${difficulty} level question?
4. **Technical Quality**: Does it demonstrate proper understanding of concepts?

Provide your evaluation in the following JSON format:
{
  "score": <number between 0-100>,
  "feedback": "<2-3 sentences of constructive feedback>"
}

**Scoring Guidelines:**
- EASY questions (20s): 80-100 for clear, accurate basics; 60-79 for partial understanding; below 60 for incorrect/incomplete
- MEDIUM questions (60s): 80-100 for thorough, well-explained answers; 60-79 for good but lacking depth; below 60 for weak/incorrect
- HARD questions (120s): 80-100 for comprehensive, insightful solutions; 60-79 for decent approach with gaps; below 60 for poor understanding

Be fair but rigorous. Consider the difficulty level and time limit when scoring.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Gemini evaluation response:', text);

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Invalid response format from Gemini, using fallback');
      return fallbackScoring(answer, difficulty);
    }

    const evaluation = JSON.parse(jsonMatch[0]);
    
    // Validate the response
    if (typeof evaluation.score !== 'number' || !evaluation.feedback) {
      console.warn('Invalid evaluation structure, using fallback');
      return fallbackScoring(answer, difficulty);
    }

    // Ensure score is within bounds
    const score = Math.max(0, Math.min(100, Math.round(evaluation.score)));

    return {
      score,
      feedback: evaluation.feedback,
      evaluationMethod: 'ai',
    };
  } catch (error) {
    console.error('Error evaluating answer with Gemini:', error);
    return fallbackScoring(answer, difficulty);
  }
};

// Fallback scoring function (original length-based algorithm)
const fallbackScoring = (answer: string, difficulty: 'easy' | 'medium' | 'hard'): AnswerEvaluation => {
  const length = answer.trim().length;
  let baseScore: number;

  switch (difficulty) {
    case 'easy':
      baseScore = length > 50 ? 80 + Math.min((length - 50) * 0.4, 20) : Math.max(length * 1.6, 20);
      break;
    case 'medium':
      baseScore = length > 100 ? 75 + Math.min((length - 100) * 0.25, 25) : Math.max(length * 0.75, 30);
      break;
    case 'hard':
      baseScore = length > 150 ? 70 + Math.min((length - 150) * 0.2, 30) : Math.max(length * 0.47, 25);
      break;
    default:
      baseScore = 50;
  }

  const score = Math.min(Math.round(baseScore), 100);

  return {
    score,
    feedback: 'Answer evaluated based on length and completeness. AI evaluation unavailable.',
    evaluationMethod: 'fallback',
  };
};
