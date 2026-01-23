import React, { useState } from 'react';
import { useInterviewState, useAppDispatch } from '../store/hooks';
import { deleteCandidate } from '../store/slices/interviewSlice';
import { Table, Card, Input, Select, Space, Tag, Button, Modal, Typography } from 'antd';
import { SearchOutlined, EyeOutlined, TrophyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Candidate } from '../types';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const InterviewerPage: React.FC = () => {
  const { candidates } = useInterviewState();
  const dispatch = useAppDispatch();
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'email' | 'phone' | 'date'>('score');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);

  const handleDeleteCandidate = (candidateId: string) => {
    console.log('Delete button clicked for candidate:', candidateId);
    console.log('Current candidates:', candidates);
    try {
      dispatch(deleteCandidate(candidateId));
      console.log('Delete action dispatched successfully');
    } catch (error) {
      console.error('Error dispatching delete action:', error);
    }
  };

  const confirmDelete = () => {
    if (!candidateToDelete) return;
    handleDeleteCandidate(candidateToDelete.id);
    setCandidateToDelete(null);
    setConfirmModalVisible(false);
  };

  const filteredCandidates = candidates
    .filter((candidate: Candidate) => {
      if (!searchText) return true;
      const text = searchText.toLowerCase();
      return (
        candidate.name.toLowerCase().includes(text) ||
        candidate.email.toLowerCase().includes(text) ||
        (candidate.phone && candidate.phone.toLowerCase().includes(text))
      );
    })
    .sort((a: Candidate, b: Candidate) => {
      switch (sortBy) {
        case 'score':
          return (b.finalScore || 0) - (a.finalScore || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'email':
          return a.email.localeCompare(b.email);
        case 'phone':
          return (a.phone || '').localeCompare(b.phone || '');
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'in-progress':
        return 'blue';
      default:
        return 'orange';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      default:
        return 'Pending';
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Candidate, b: Candidate) => a.name.localeCompare(b.name),
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a: Candidate, b: Candidate) => a.email.localeCompare(b.email),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      sorter: (a: Candidate, b: Candidate) => (a.phone || '').localeCompare(b.phone || ''),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
      sorter: (a: Candidate, b: Candidate) => a.status.localeCompare(b.status),
    },
    {
      title: 'Final Score',
      dataIndex: 'finalScore',
      key: 'finalScore',
      render: (score: number | undefined) => score ? (
        <span style={{ color: score >= 70 ? '#52c41a' : score >= 50 ? '#faad14' : '#ff4d4f' }}>
          <TrophyOutlined /> {score}/100
        </span>
      ) : '-',
      sorter: (a: Candidate, b: Candidate) => (b.finalScore || 0) - (a.finalScore || 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Candidate) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedCandidate(record);
              setDetailModalVisible(true);
            }}
            style={{
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              border: 'none',
              borderRadius: '20px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
            }}
          >
            View
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            style={{
              borderRadius: '20px',
              fontWeight: 500
            }}
            onClick={(e) => {
              e.stopPropagation();
              setCandidateToDelete(record);
              setConfirmModalVisible(true);
            }}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
        }}>
          <TrophyOutlined style={{ fontSize: 36, color: 'white' }} />
        </div>
        <Title level={1} style={{ 
          marginBottom: 12,
          background: 'linear-gradient(45deg, #667eea, #764ba2)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: '2.5rem'
        }}>
          Candidate Dashboard
        </Title>
        <p style={{ fontSize: '18px', color: '#666', margin: 0 }}>Manage and review all interview candidates</p>
      </div>

      <Card style={{
        borderRadius: '20px',
        border: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
          <Search
            placeholder="Search candidates by name, email, or phone"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ 
              width: 350,
              borderRadius: '25px'
            }}
            prefix={<SearchOutlined />}
            size="large"
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ 
              width: 200,
              borderRadius: '25px'
            }}
            size="large"
          >
            <Option value="score">Sort by Score</Option>
            <Option value="name">Sort by Name</Option>
            <Option value="email">Sort by Email</Option>
            <Option value="phone">Sort by Phone</Option>
            <Option value="date">Sort by Date</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredCandidates}
          rowKey="id"
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} candidates`
          }}
          locale={{ emptyText: 'No candidates found' }}
          style={{
            borderRadius: '12px',
            overflow: 'hidden'
          }}
        />
        <Modal
          title="Confirm Delete"
          open={confirmModalVisible}
          onOk={confirmDelete}
          onCancel={() => { setCandidateToDelete(null); setConfirmModalVisible(false); }}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <p>Are you sure you want to delete <strong>{candidateToDelete?.name}</strong>? This action cannot be undone.</p>
        </Modal>
      </Card>

      <Modal
        title={`Candidate Details: ${selectedCandidate?.name}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        style={{ borderRadius: '20px' }}
        footer={[
          <Button 
            key="close" 
            onClick={() => setDetailModalVisible(false)}
            style={{
              borderRadius: '20px',
              height: '40px',
              paddingLeft: '24px',
              paddingRight: '24px'
            }}
          >
            Close
          </Button>,
        ]}
      >
        {selectedCandidate && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <p><strong>Email:</strong> {selectedCandidate.email}</p>
              <p><strong>Phone:</strong> {selectedCandidate.phone}</p>
              <p><strong>Status:</strong> <Tag color={getStatusColor(selectedCandidate.status)}>{getStatusText(selectedCandidate.status)}</Tag></p>
              {selectedCandidate.finalScore && (
                <p><strong>Final Score:</strong> <span style={{ color: '#1890ff', fontSize: '18px' }}>{selectedCandidate.finalScore}/100</span></p>
              )}
              {selectedCandidate.summary && (
                <div style={{ marginTop: 16 }}>
                  <strong>AI Summary:</strong>
                  <p>{selectedCandidate.summary}</p>
                </div>
              )}
            </div>

            {selectedCandidate.answers.length > 0 && (
              <div>
                <Title level={4}>Interview Responses</Title>
                {selectedCandidate.answers.map((answer, index) => (
                  <Card key={`${answer.question}-${index}`} size="small" style={{ 
                    marginBottom: 16,
                    borderRadius: '12px',
                    border: '1px solid rgba(102, 126, 234, 0.1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}>
                    <p><strong>Q{index + 1} ({answer.difficulty}):</strong> {answer.question}</p>
                    <p><strong>Answer:</strong> {answer.answer}</p>
                    <p><strong>Time Spent:</strong> {Math.floor(answer.timeSpent / 60)}:{(answer.timeSpent % 60).toString().padStart(2, '0')}</p>
                    {answer.score && (
                      <p>
                        <strong>Score:</strong> {answer.score}/100
                        {answer.evaluationMethod && (
                          <Tag 
                            color={answer.evaluationMethod === 'ai' ? 'blue' : 'orange'} 
                            style={{ marginLeft: 8 }}
                          >
                            {answer.evaluationMethod === 'ai' ? '🤖 AI Evaluated' : '📏 Fallback Scoring'}
                          </Tag>
                        )}
                      </p>
                    )}
                    {answer.feedback && (
                      <div style={{ 
                        marginTop: 12, 
                        padding: '12px', 
                        background: 'rgba(102, 126, 234, 0.05)',
                        borderRadius: '8px',
                        borderLeft: '3px solid #667eea'
                      }}>
                        <strong style={{ color: '#667eea' }}>AI Feedback:</strong>
                        <p style={{ margin: '8px 0 0 0', color: '#555' }}>{answer.feedback}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InterviewerPage;
