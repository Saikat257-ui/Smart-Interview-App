import React, { useCallback, useMemo } from 'react';
import { Layout, Tabs, Typography } from 'antd';
import { UserOutlined, DashboardOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import IntervieweePage from '../pages/IntervieweePage';
import InterviewerPage from '../pages/InterviewerPage';

const { Header, Content } = Layout;
const { Title } = Typography;

const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabChange = useCallback((key: string) => {
    navigate(key === 'interviewee' ? '/' : '/interviewer');
  }, [navigate]);

  const activeKey = useMemo(() => {
    return location.pathname === '/interviewer' ? 'interviewer' : 'interviewee';
  }, [location.pathname]);

  const tabItems = useMemo(() => [
    {
      key: 'interviewee',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <UserOutlined style={{ fontSize: '16px' }} />
          Interviewee
        </span>
      ),
      children: <IntervieweePage />,
    },
    {
      key: 'interviewer',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <DashboardOutlined style={{ fontSize: '16px' }} />
          Interviewer Dashboard
        </span>
      ),
      children: <InterviewerPage />,
    },
  ], []);

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Header style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '0 32px',
        borderBottom: 'none',
        boxShadow: '0 2px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            AI
          </div>
          <Title level={3} style={{ 
            margin: 0, 
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700
          }}>
            Interview Assistant
          </Title>
        </div>
      </Header>
      <Content style={{ 
        padding: '32px',
        background: 'transparent'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <Tabs
            activeKey={activeKey}
            onChange={handleTabChange}
            size="large"
            style={{ margin: 0 }}
            items={tabItems}
            tabBarStyle={{
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
              margin: 0,
              padding: '16px 32px',
              borderBottom: '1px solid rgba(102, 126, 234, 0.1)'
            }}
          />
        </div>
      </Content>
    </Layout>
  );
};

export default MainLayout;
