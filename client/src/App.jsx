import Home from './pages/Home';
import CustomerCheckIn from './pages/customer/CustomerCheckIn';
import CustomerCheckOut from './pages/customer/CustomerCheckOut';
import CustomerACControl from './pages/customer/CustomerACControl';
import AdminDispatcher from './pages/admin/AdminDispatcher';
import AdminConsole from './pages/admin/AdminConsole';
import RoomSelection from './pages/customer/RoomSelection';
import React, { useState } from 'react'; 
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Space, message, Modal, Form, Input, Typography } from 'antd'; 
import { 
  HomeOutlined, 
  UserOutlined, 
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  DollarOutlined,
  TeamOutlined,
  ControlOutlined,
  DeploymentUnitOutlined,
  LockOutlined, 
  PhoneOutlined 
} from '@ant-design/icons';
import './App.css';

const API_BASE_URL = '/api';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const CustomerLoginForm = ({ isOpen, onClose, onLogin }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false); // 新增加载状态

    const onFinish = async (values) => { // 标记为 async
        setLoading(true);
        const { room_no, phone } = values;

        try {
            // 【调用后端登录 API】
            const response = await fetch(`${API_BASE_URL}/customer/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ room_no, phone }),
            });
            const result = await response.json();

            if (result.success) {
                const { userName, roomNo, recordId } = result.data;
                message.success(`登录成功！欢迎 ${userName}，正在进入房间 ${roomNo} 控制界面...`);
                
                onClose();
                // 【将 recordId 传递给 onLogin 函数】
                onLogin('customer', userName, roomNo, recordId); 

            } else {
                // 后端返回的错误信息
                message.error(result.message);
                form.resetFields();
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            message.error('网络连接错误，请稍后重试。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={<Title level={4} style={{ textAlign: 'center', margin: 0 }}>顾客登录</Title>}
            open={isOpen}
            onCancel={() => {
                form.resetFields(); // 关闭时清空表单
                onClose();
            }}
            footer={null}
            centered
            width={380}
            styles={{ body: { padding: '32px 24px 24px' } }}
        >
            <Form
                form={form}
                name="customer_login"
                onFinish={onFinish}
                layout="vertical"
            >
                {/* 房间号输入 */}
                <Form.Item
                    label="房间号"
                    name="room_no"
                    rules={[{ required: true, message: '请输入您的房间号!' }]}
                >
                    <Input 
                        prefix={<LockOutlined className="site-form-item-icon" />} 
                        placeholder="例: 101" 
                        size="large"
                    />
                </Form.Item>

                {/* 手机号输入 */}
                <Form.Item
                    label="手机号"
                    name="phone"
                    rules={[
                        { required: true, message: '请输入您的手机号!' },
                        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码!' }
                    ]}
                >
                    <Input
                        prefix={<PhoneOutlined className="site-form-item-icon" />}
                        placeholder="手机号 (作为密码)"
                        size="large"
                        type="number"
                        maxLength={11}
                    />
                </Form.Item>

                {/* 登录按钮 */}
                <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                    <Button 
                        type="primary" 
                        htmlType="submit" 
                        block
                        size="large"
                        loading={loading} 
                        style={{
                            borderRadius: '8px',
                            fontWeight: 600,
                            height: '45px',
                            backgroundColor: '#1890ff'
                        }}
                    >
                        {loading ? '登录中...' : '立即登录'}
                    </Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};


function App() {
  const [currentRole, setCurrentRole] = React.useState('customer');
  const [currentUser, setCurrentUser] = React.useState(null);
  const [currentRoomNo, setCurrentRoomNo] = React.useState(null); 
  const [currentRecordId, setCurrentRecordId] = React.useState(null);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false); 
  
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setCurrentRole(user.role || 'customer');
        setCurrentRoomNo(user.roomNo || null);
        setCurrentRecordId(user.recordId || null);
      } catch (e) {
        console.error('解析本地用户信息失败:', e);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLogout = () => {
    setCurrentRole('customer');
    setCurrentUser(null);
    setCurrentRoomNo(null); 
    setCurrentRecordId(null);

    localStorage.removeItem('currentUser'); 
    navigate('/');
    message.success('已成功退出登录');
  };

  // 【打开模态框函数】
  const openCustomerLoginModal = () => {
    setIsCustomerModalOpen(true);
  };

  // 【关闭模态框函数】
  const closeCustomerLoginModal = () => {
    setIsCustomerModalOpen(false);
  };


  // 模拟登录状态
  const handleLogin = (role, userName = '', roomNo = '', recordId = null) => {
    setCurrentRole(role);
    setCurrentRoomNo(roomNo || null); 
    setCurrentRecordId(recordId || null);
    
    let finalUserName = '';
    let targetPath = '/';
    let userObject = { name: '', role, roomNo: null, recordId: null };

    if (role === 'customer') {
      finalUserName = userName; 
      targetPath = `/ac-control/${roomNo}`; 
      userObject = { name: finalUserName, role, roomNo, recordId };
    } else if (role === 'front-desk') {
      finalUserName = '前台员工';
      targetPath = '/check-in'; 
      userObject = { name: finalUserName, role };
    } else if (role === 'ac-admin') {
      finalUserName = '空调管理员';
      targetPath = '/ac-management'; 
      userObject = { name: finalUserName, role };
    }
    
    setCurrentUser(userObject);
    localStorage.setItem('currentUser', JSON.stringify(userObject));
    navigate(targetPath);
  };


  // 构建菜单项
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
            label: <Link to={`/ac-control/${currentUser.roomNo}`}>空调控制 ({currentUser.roomNo})</Link>, 
          },
          {
            key: '/check-out',
            icon: <DollarOutlined />,
            label: <Link to={`/check-out?roomNo=${currentUser.roomNo}`}>我的结账</Link>,
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
            key: '/room-selection',
            icon: <DeploymentUnitOutlined />,
            label: <Link to="/room-selection">房间选择</Link>,
          },
          {
            key: '/dispatcher', 
            icon: <ControlOutlined />,
            label: <Link to="/dispatcher">空调调度</Link>,
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
                onClick={openCustomerLoginModal} // 直接打开模态框
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
              {/* 员工/管理员登录按钮保持不变 */}
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
      <Header style={{ 
        height: '64px',
        padding: '0 50px',
        position: 'fixed',
        zIndex: 1,
        width: '100%',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        background: '#fff',
      }}>
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
        minHeight: 'calc(100vh - 64px - 70px)',
        background: 'transparent'
      }}>
        <Routes>
          <Route path="/" element={<Home 
            onLogin={handleLogin} 
            onOpenCustomerModal={openCustomerLoginModal} 
          />} />
          
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
          <Route path="/room-selection" element={
            currentUser?.role === 'front-desk' ? 
            <RoomSelection /> : 
            <Navigate to="/" replace />
          } />
          <Route path="/ac-control/:roomId" element={
            currentUser?.role === 'customer' ? 
            <CustomerACControl /> : 
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

      {/* 【关键修改：在 App.jsx 底部渲染 CustomerLoginForm】 */}
      <CustomerLoginForm 
        isOpen={isCustomerModalOpen}
        onClose={closeCustomerLoginModal}
        onLogin={handleLogin}
      />

      <Footer style={{ 
        textAlign: 'center', 
        padding: '24px 50px', 
        borderTop: '1px solid #f0f0f0',
        background: '#fff', 
        height: '70px',
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

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;