import Home from './pages/Home';
import CustomerCheckIn from './pages/customer/CustomerCheckIn';
import CustomerCheckOut from './pages/customer/CustomerCheckOut';
import CustomerACControl from './pages/customer/CustomerACControl';
import AdminDashboard from './pages/admin/AdminDashBoard';
import AdminCheckOut from './pages/admin/AdminCheckout';
import AdminDispatcher from './pages/admin/AdminDispatcher';
import AdminConsole from './pages/admin/AdminConsole';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Space, message } from 'antd';
import { 
  HomeOutlined, 
  UserOutlined, 
  CheckCircleOutlined, 
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  DollarOutlined,
  TeamOutlined,
  ControlOutlined
} from '@ant-design/icons';
import './App.css';

const { Header, Content, Footer } = Layout;

function App() {
  const [currentRole, setCurrentRole] = React.useState('customer');
  const [currentUser, setCurrentUser] = React.useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    setCurrentRole('customer');
    setCurrentUser(null);
    navigate('/');
    message.success('已成功退出登录');
  };

  // 模拟登录状态
  const handleLogin = (role) => {
    setCurrentRole(role);
    const userName = role === 'customer' ? '顾客用户' : 
                    role === 'front-desk' ? '前台员工' : 
                    '空调管理员';
    
    setCurrentUser({ name: userName, role });
    
    // 根据角色跳转到对应页面
    if (role === 'customer') {
      navigate('/ac-control');
    } else if (role === 'front-desk') {
      navigate('/check-in');
    } else if (role === 'ac-admin') {
      navigate('/ac-management'); 
    }
  };

  // 构建菜单项 - 添加空调管理员菜单
  const getMenuItems = () => {
    const commonItems = [
      {
        key: '/',
        icon: <HomeOutlined />,
        label: <Link to="/">首页</Link>,
      }
    ];

    if (currentUser) {
      if (currentUser.role === 'customer') {
        return [
          ...commonItems,
          {
            key: '/ac-control',
            icon: <SettingOutlined />,
            label: <Link to="/ac-control">空调控制</Link>,
          },
          {
            key: '/check-out',
            icon: <DollarOutlined />,
            label: <Link to="/check-out">我的结账</Link>,
          },
          {
            key: 'user-info',
            icon: <UserOutlined />,
            label: (
              <span style={{ color: '#1890ff', fontWeight: 500 }}>
                {currentUser.name}
              </span>
            ),
          },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: (
              <span onClick={handleLogout} style={{ color: '#ff4d4f', cursor: 'pointer' }}>
                退出登录
              </span>
            ),
          }
        ];
      } else if (currentUser.role === 'front-desk') {
        return [
          ...commonItems,
          {
            key: '/check-in',
            icon: <UserOutlined />,
            label: <Link to="/check-in">入住登记</Link>,
          },
          {
            key: '/dispatcher', 
            icon: <ControlOutlined />,
            label: <Link to="/dispatcher">空调调度</Link>,
          },
          {
            key: '/check-out-admin',
            icon: <DollarOutlined />,
            label: <Link to="/check-out-admin">结账管理</Link>,
          },
          {
            key: '/dashboard',
            icon: <BarChartOutlined />,
            label: <Link to="/dashboard">仪表盘</Link>,
          },
          {
            key: 'user-info',
            icon: <TeamOutlined />,
            label: (
              <span style={{ color: '#1890ff', fontWeight: 500 }}>
                前台 · {currentUser.name}
              </span>
            ),
          },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: (
              <span onClick={handleLogout} style={{ color: '#ff4d4f', cursor: 'pointer' }}>
                退出登录
              </span>
            ),
          }
        ];
      } else if (currentUser.role === 'ac-admin') {
        // 空调管理员菜单
        return [
          ...commonItems,
          {
            key: '/ac-management',
            icon: <SettingOutlined />,
            label: <Link to="/ac-management">空调管理</Link>,
          },
          {
            key: 'user-info',
            icon: <UserOutlined />,
            label: (
              <span style={{ color: '#1890ff', fontWeight: 500 }}>
                空调管理 · {currentUser.name}
              </span>
            ),
          },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: (
              <span onClick={handleLogout} style={{ color: '#ff4d4f', cursor: 'pointer' }}>
                退出登录
              </span>
            ),
          }
        ];
      }
    } else {
      return [
        ...commonItems,
        {
          key: 'login-section',
          label: (
            <Space>
              <Button 
                type="primary" 
                onClick={() => handleLogin('customer')}
                style={{
                  background: '#1890ff',
                  borderColor: '#1890ff',
                  borderRadius: '8px',
                  fontWeight: 500
                }}
                icon={<UserOutlined />}
              >
                顾客登录
              </Button>
              <Button 
                type="default"
                onClick={() => handleLogin('front-desk')}
                style={{
                  borderRadius: '8px',
                  fontWeight: 500,
                  borderColor: '#52c41a',
                  color: '#52c41a'
                }}
                icon={<TeamOutlined />}
              >
                前台登录
              </Button>
              <Button 
                type="default"
                onClick={() => handleLogin('ac-admin')}
                style={{
                  borderRadius: '8px',
                  fontWeight: 500,
                  borderColor: '#722ed1',
                  color: '#722ed1'
                }}
                icon={<SettingOutlined />}
              >
                空调管理
              </Button>
            </Space>
          ),
        }
      ];
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      {/* Header部分保持不变 */}
      <Header style={{ 
        // ... 保持原有样式
      }}>
        {/* Logo区域 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="logo" style={{ 
            color: '#1890ff', 
            fontSize: '20px', 
            fontWeight: 600,
            textShadow: '0 2px 4px rgba(24, 144, 255, 0.1)',
            marginRight: '40px'
          }}>
            波普特酒店管理系统
          </div>
        </div>

        {/* 导航菜单 */}
        <Menu 
          theme="light"
          mode="horizontal" 
          selectedKeys={[location.pathname]}
          style={{ 
            lineHeight: '64px', 
            flex: 1,
            justifyContent: 'flex-end',
            border: 'none',
            background: 'transparent',
            fontSize: '14px',
            fontWeight: 500
          }}
          items={getMenuItems()}  
        />
      </Header>
      <Content style={{ 
        marginTop: 64, 
        padding: 0,
        minHeight: 'calc(100vh - 64px)',
        background: 'transparent'
      }}>
        <Routes>
          <Route path="/" element={<Home onLogin={handleLogin} />} />
          <Route path="/check-in" element={
            currentUser?.role === 'front-desk' ? 
            <CustomerCheckIn /> : 
            <Navigate to="/" replace />
          } />
          <Route path="/check-out" element={
            currentUser?.role === 'customer' ? 
            <CustomerCheckOut /> : 
            <Navigate to="/" replace />
          } />
          <Route path="/check-out-admin" element={
            currentUser?.role === 'front-desk' ? 
            <AdminCheckOut /> : 
            <Navigate to="/" replace />
          } />
          <Route path="/ac-control" element={
            currentUser?.role === 'customer' ? 
            <CustomerACControl /> : 
            <Navigate to="/" replace />
          } />
          <Route path="/dashboard" element={
            currentUser?.role === 'front-desk' ? 
            <AdminDashboard /> : 
            <Navigate to="/" replace />
          } />
          <Route path="/dispatcher" element={
            currentUser?.role === 'front-desk' || currentUser?.role === 'ac-admin' ? 
            <AdminDispatcher /> : 
            <Navigate to="/" replace />
          } />
          <Route path="/ac-management" element={
            currentUser?.role === 'ac-admin' ? 
            <AdminConsole /> : 
            <Navigate to="/" replace />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>
      <Footer style={{ 
        // ... 保持原有样式
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontWeight: 500, color: '#1890ff' }}>
            波普特酒店管理系统 ©2025
          </div>
          <div style={{ color: '#8c8c8c' }}>
            为您提供优质的住宿体验
          </div>
          <div style={{ fontSize: '12px', color: '#bfbfbf' }}>
            智能温控 · 节能环保 · 舒适体验
          </div>
        </div>
      </Footer>
    </Layout>
  );
}

// 包装组件以使用路由
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;