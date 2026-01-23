import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Input, Button, Typography, Progress, Tag, Space, Divider } from 'antd';
import { SendOutlined, ClockCircleOutlined, CheckCircleOutlined, DashboardOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';
import { useInterviewState, useAppDispatch } from '../store/hooks';
import { submitAnswerAsync, resetInterview, generateInterviewQuestions } from '../store/slices/interviewSlice';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../utils/interviewUtils';
import type { Message } from '../types';
import CandidateInfoForm from './CandidateInfoForm';

const { Title, Text } = Typography;
const { TextArea } = Input;

const InterviewChat: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentCandidate, questions, questionsLoading } = useInterviewState();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isAnswering, setIsAnswering] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [candidateInfo, setCandidateInfo] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [infoComplete, setInfoComplete] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastSubmittedRef = useRef<number | null>(null);

  // Only generate questions if we don't have any and candidate is in-progress
  useEffect(() => {
    if (currentCandidate?.status === 'in-progress' && questions.length === 0 && !questionsLoading) {
      dispatch(generateInterviewQuestions(currentCandidate.resumeText));
    }
  }, [currentCandidate?.status, currentCandidate?.resumeText, questions.length, questionsLoading, dispatch]);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 740 : false);
  const startedRef = useRef(false);
  const addMessageIfNotExists = (msg: Message) => {
    setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
  };
  const currentQuestionIndex = currentCandidate?.currentQuestionIndex || 0;
  const currentQuestion = questions[currentQuestionIndex];
  
  // Debug logging
  useEffect(() => {
    console.log('InterviewChat - Questions in state:', questions);
    console.log('InterviewChat - Current question:', currentQuestion);
    console.log('InterviewChat - Questions loading:', questionsLoading);
  }, [questions, currentQuestion, questionsLoading]);

  // Show loading state while questions are being generated for in-progress interviews
  // (rendered later to ensure hooks are always called in the same order)

  const handleViewResults = () => {
    navigate('/interviewer');
  };

  const handleStartNewInterview = () => {
    dispatch(resetInterview());
    // Reset local state and clear current candidate to allow new resume upload
    setMessages([]);
    setCurrentAnswer('');
    setTimeRemaining(0);
    setIsAnswering(false);
    setInterviewCompleted(false);
    setCandidateInfo({});
    setInfoComplete(false);
    // Navigate to home to show resume upload
    navigate('/');
  };

  const handleGoHome = () => {
    navigate('/');
    dispatch(resetInterview());
  };

  // Handles answer submission
  const handleSubmitAnswer = useCallback((answer: string): void => {
    if (!currentCandidate || !currentQuestion) return;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const answerMessage: Message = {
      id: `answer-${currentQuestionIndex}`,
      type: 'user',
      content: answer || '(No answer provided)',
      timestamp: new Date().toISOString(),
    };
    // Add answer message only if not already present (idempotent)
    setMessages(prev => (prev.some(m => m.id === answerMessage.id) ? prev : [...prev, answerMessage]));
    setCurrentAnswer('');
    setIsAnswering(false);
    // Mark this question as submitted to prevent duplicate submissions (timeout vs manual)
    lastSubmittedRef.current = currentQuestionIndex;
    // Dispatch async answer evaluation to Redux
    dispatch(submitAnswerAsync({ answer, timeSpent }));
    // Do not manually append next-question/completion messages here. The interview reducer
    // updates currentCandidate.currentQuestionIndex which will cause the main effect to
    // append the next question message (idempotently). This prevents duplicate messages
    // when both the effect and this handler try to append the same question.
  }, [currentCandidate, currentQuestion, currentQuestionIndex, dispatch]);

  // Check for missing fields after resume upload or on mount
  useEffect(() => {
    if (currentCandidate) {
      const { name, email, phone } = currentCandidate;
      if (!name || !email || !phone) {
        setCandidateInfo({ name, email, phone });
        setInfoComplete(false);
      } else {
        setInfoComplete(true);
      }
    }
  }, [currentCandidate]);

  // Track small screens so floating timer can be hidden on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = () => setIsMobile(window.innerWidth < 740);
    mq();
    window.addEventListener('resize', mq);
    return () => window.removeEventListener('resize', mq);
  }, []);

  // Timer and answer submission logic in a single useEffect
  useEffect(() => {
    if (currentCandidate?.status === 'in-progress' && currentQuestion) {
      const questionMessage: Message = {
        id: `question-${currentQuestionIndex}`,
        type: 'bot',
        content: `**Question ${currentQuestionIndex + 1}** (${currentQuestion.difficulty.toUpperCase()}): ${currentQuestion.text}`,
        timestamp: new Date().toISOString(),
      };

      if (!startedRef.current) {
        // First time starting interview
        startedRef.current = true;
        const welcomeMessage: Message = {
          id: 'welcome',
          type: 'bot',
          content: `Welcome to your AI-powered interview! Let's begin with the questions. I'll ask you ${questions.length} questions of varying difficulty levels.`,
          timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage, questionMessage]);
      } else {
        // Subsequent questions: append if not already present
        addMessageIfNotExists(questionMessage);
      }

      // Reset timer for the current question
      setTimeRemaining(currentQuestion.timeLimit);
      startTimeRef.current = Date.now();
      setIsAnswering(true);
    } else if (currentCandidate?.status === 'completed') {
      setInterviewCompleted(true);
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      startedRef.current = false;
    }
  }, [currentCandidate?.status, currentQuestionIndex, currentQuestion, questions.length]);

  useEffect(() => {
    if (!isAnswering) return;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timeout logic - dispatch directly to avoid circular dependency
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Prevent duplicate timeout submissions for the same question
          if (currentCandidate && currentQuestion && lastSubmittedRef.current !== currentQuestionIndex) {
            const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
            lastSubmittedRef.current = currentQuestionIndex;
            setIsAnswering(false);
            dispatch(submitAnswerAsync({ answer: '', timeSpent }));

            const timeoutMessageId = `timeout-${currentQuestionIndex}`;
            const timeoutMessage: Message = {
              id: timeoutMessageId,
              type: 'system',
              content: 'Time is up! Your answer has been submitted automatically.',
              timestamp: new Date().toISOString(),
              metadata: { isTimeout: true },
            };
            setMessages(prevMsgs => (prevMsgs.some(m => m.id === timeoutMessageId) ? prevMsgs : [...prevMsgs, timeoutMessage]));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAnswering, currentQuestionIndex, currentCandidate, currentQuestion, dispatch]);

  // Scroll messages container to bottom whenever messages change
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    // Slight delay to allow new message to render
    const id = setTimeout(() => {
      try {
        const el = messagesContainerRef.current!;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } catch (e) {
        // ignore scroll errors
      }
    }, 50);
    return () => clearTimeout(id);
  }, [messages]);

  const progress = currentCandidate ? ((currentCandidate.currentQuestionIndex) / questions.length) * 100 : 0;

  if (interviewCompleted) {
    return (
      <Card style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
        <Title level={2} style={{ color: '#52c41a' }}>Interview Completed!</Title>
        <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
          Thank you for completing the interview. Your responses have been recorded and scored.
          You can view your detailed results in the Interviewer Dashboard.
        </Text>

        <Divider />

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            icon={<DashboardOutlined />}
            onClick={handleViewResults}
            block
          >
            View Results in Dashboard
          </Button>

          <Button
            size="large"
            icon={<ReloadOutlined />}
            onClick={handleStartNewInterview}
            block
          >
            Start New Interview
          </Button>

          <Button
            size="large"
            icon={<HomeOutlined />}
            onClick={handleGoHome}
            block
          >
            Back to Home
          </Button>
        </Space>
      </Card>
    );
  }

  if (!infoComplete) {
    return (
      <CandidateInfoForm
        initialData={candidateInfo}
        onUpdate={setCandidateInfo}
        onStartInterview={() => setInfoComplete(true)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
      <Card style={{
        borderRadius: '20px',
        border: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={3} style={{ 
              margin: 0,
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Interview Progress
            </Title>
            <Tag style={{
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </Tag>
          </div>
          <Progress
            percent={progress}
            showInfo={false}
            strokeColor={{
              '0%': '#667eea',
              '100%': '#764ba2',
            }}
            trailColor="rgba(102, 126, 234, 0.1)"
            strokeWidth={8}
            style={{ marginBottom: 8 }}
          />
        </div>

        {/* old sticky timer (hidden in favor of floating pill) */}
        <div style={{ marginBottom: 24, display: 'none' }}>
          <div style={{ 
            position: 'sticky',
            top: 86,
            zIndex: 10,
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            background: timeRemaining > 30 ? 'rgba(82, 196, 26, 0.1)' : timeRemaining > 10 ? 'rgba(250, 173, 20, 0.1)' : 'rgba(255, 77, 79, 0.1)',
            padding: '12px 20px',
            borderRadius: '12px',
            border: `2px solid ${timeRemaining > 30 ? 'rgba(82, 196, 26, 0.2)' : timeRemaining > 10 ? 'rgba(250, 173, 20, 0.2)' : 'rgba(255, 77, 79, 0.2)'}`
          }}>
            <ClockCircleOutlined style={{ 
              fontSize: '18px',
              color: timeRemaining > 30 ? '#52c41a' : timeRemaining > 10 ? '#faad14' : '#ff4d4f'
            }} />
            <Text strong style={{ fontSize: '16px' }}>Time Remaining:</Text>
            <Tag style={{
              background: timeRemaining > 30 ? '#52c41a' : timeRemaining > 10 ? '#faad14' : '#ff4d4f',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 12px',
              fontSize: '16px',
              fontWeight: 600
            }}>
              {formatTime(timeRemaining)}
            </Tag>
          </div>
        </div>

        {/* Floating timer pill - fixed position on desktop */}
        {isAnswering && !isMobile && (
          <div aria-live="polite" style={{
            position: 'fixed',
            right: 28,
            bottom: 120,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            borderRadius: 12,
            background: timeRemaining > 30 ? 'rgba(82,196,26,0.95)' : timeRemaining > 10 ? 'rgba(250,173,20,0.95)' : 'rgba(255,77,79,0.95)',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }}>
            <ClockCircleOutlined style={{ fontSize: 18, color: '#fff' }} />
            <div style={{ fontWeight: 600 }}>Time Remaining</div>
            <Tag style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontWeight: 700 }}>
              {formatTime(timeRemaining)}
            </Tag>
          </div>
        )}

        <div ref={messagesContainerRef} style={{ 
          minHeight: 300, 
          maxHeight: 420, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          marginBottom: 24, 
          padding: 20, 
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)', 
          borderRadius: 16,
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  maxWidth: '80%',
                  padding: '12px 18px',
                  borderRadius: 16,
                  background: message.type === 'user' 
                    ? 'linear-gradient(45deg, #667eea, #764ba2)' 
                    : message.type === 'system' 
                    ? 'linear-gradient(45deg, #ffeaa7, #fab1a0)' 
                    : 'white',
                  color: message.type === 'user' ? '#fff' : '#333',
                  border: message.type === 'system' ? 'none' : '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  fontSize: '15px',
                  lineHeight: '1.5',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}>{message.content}</div>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Text>
              </div>
            </div>
          ))}
        </div>

  {/* Auto-scroll to bottom when messages change */}
        

        {isAnswering && (
          <div>
            <TextArea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Type your answer here..."
              rows={4}
              style={{ marginBottom: 8 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSubmitAnswer(currentAnswer)}
              disabled={!currentAnswer.trim()}
              block
            >
              Submit Answer
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default InterviewChat;
