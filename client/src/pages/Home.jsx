import React from 'react'; 
import { Button, Card, Row, Col, Typography } from 'antd'; 
import { 
  UserOutlined, 
  TeamOutlined,
  HomeOutlined,        
  EnvironmentOutlined,
  WifiOutlined,
  SafetyCertificateOutlined,
  BankOutlined,        
  CheckCircleOutlined,
  ControlOutlined
} from '@ant-design/icons';


const { Title, Paragraph } = Typography;


const Home = ({ onLogin, onOpenCustomerModal }) => { // 接收 onOpenCustomerModal Prop

  const handleCustomerClick = () => {
    onOpenCustomerModal(); 
  };

  const handleEmployeeLogin = (role) => {
    onLogin(role);
  };

  return (
    <div className="home-container" style={{ padding: '60px 20px', background: '#f0f2f5', minHeight: 'calc(100vh - 134px)' }}>
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        {/* 欢迎标语 (保持不变) */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <Title 
            level={1} 
            className="welcome-title"
            style={{ 
              marginBottom: 16,
              fontSize: '3rem',
              fontWeight: 700,
            }}
          >
            波普特酒店管理系统
          </Title>
          <Paragraph 
            className="welcome-subtitle"
            style={{ 
              fontSize: '1.2rem',
              maxWidth: 600,
              margin: '0 auto',
              lineHeight: 1.6
            }}
          >
            位于京城五环外大学城附近，环境优美清幽，为您提供舒适便捷的住宿体验
          </Paragraph>
        </div>

        {/* 特色卡片  */}
        <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card">
              <HomeOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={4}>舒适住宿</Title>
              <Paragraph type="secondary">精心设计的客房，现代化设施，为您提供舒适的住宿体验</Paragraph>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card">
              <EnvironmentOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={4}>优越位置</Title>
              <Paragraph type="secondary">大学城附近，交通便利，周边设施齐全</Paragraph>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card">
              <WifiOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={4}>智能空调</Title>
              <Paragraph type="secondary">先进的空调控制系统，按使用计费，节能环保</Paragraph>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card">
              <UserOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={4}>贴心服务</Title>
              <Paragraph type="secondary">24小时前台服务，专业团队随时为您服务</Paragraph>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card">
              <SafetyCertificateOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={4}>安全保障</Title>
              <Paragraph type="secondary">全方位的安全保障措施，让您住得安心</Paragraph>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card className="feature-card">
              <BankOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={4}>高效管理</Title>
              <Paragraph type="secondary">智能化管理系统，提升运营效率</Paragraph>
            </Card>
          </Col>
        </Row>

        {/* 登录按钮区域 */}
        <Card className="login-card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <Title level={3} style={{ marginBottom: 32, color: '#1890ff' }}>选择登录身份</Title>
          <Paragraph style={{ marginBottom: 32, color: '#595959' }}>
            请根据您的身份选择相应的登录方式
          </Paragraph>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button 
              type="primary" 
              size="large" 
              onClick={handleCustomerClick} // 现在调用 onOpenCustomerModal
              style={{
                height: 50,
                padding: '0 32px',
                fontSize: '1.1rem',
                minWidth: 160
              }}
              icon={<UserOutlined />}
            >
              顾客登录
            </Button>
            <Button 
              type="primary" 
              size="large" 
              onClick={() => handleEmployeeLogin('front-desk')} 
              style={{
                height: 50,
                padding: '0 32px',
                fontSize: '1.1rem',
                minWidth: 160,
                background: '#52c41a',
                borderColor: '#52c41a'
              }}
              icon={<TeamOutlined />}
            >
              前台登录
            </Button>
            <Button 
              type="primary" 
              size="large" 
              onClick={() => handleEmployeeLogin('ac-admin')} 
              style={{
                height: 50,
                padding: '0 32px',
                fontSize: '1.1rem',
                minWidth: 160,
                background: '#fa8c16',
                borderColor: '#fa8c16'
              }}
              icon={<ControlOutlined />}
            >
              空调管理员
            </Button>
          </div>
          <div style={{ marginTop: 24, padding: 16, background: '#f6ffed', borderRadius: 8 }}>
            <Paragraph style={{ margin: 0, color: '#52c41a', textAlign: 'left' }}>
              <CheckCircleOutlined style={{ marginRight: 8 }} />
              温馨提示：顾客登录后可控制房间空调和查看个人账单，前台登录后可办理入住、结账管理和查看运营数据
            </Paragraph>
          </div>
        </Card>
      </div>

    </div>
  );
};

export default Home;