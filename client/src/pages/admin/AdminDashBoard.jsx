import React, { useState, useEffect } from 'react';
import { 
  DashboardOutlined, 
  UserOutlined, 
  CheckCircleOutlined, 
  BarChartOutlined,
  InfoCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  HomeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Button, 
  Typography, 
  Tag, 
  DatePicker,
  Space,
  Progress,
  List
} from 'antd';
import moment from 'moment';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AdminDashboard = () => {
  const [dateRange, setDateRange] = useState([moment().startOf('month'), moment()]);
  const [loading, setLoading] = useState(false);
  const [hotelStats, setHotelStats] = useState({
    totalRooms: 40,
    occupiedRooms: 25,
    occupancyRate: 62.5,
    todayRevenue: 3200,
    monthlyRevenue: 85600,
    acUsage: 1520,
    acRevenue: 760,
    customerCount: 128
  });

  const [roomStatus, setRoomStatus] = useState([
    { roomNumber: '101', status: 'occupied', customer: '张三', checkIn: '2024-05-01', checkOut: '2024-05-03', roomType: '标准间' },
    { roomNumber: '102', status: 'vacant', customer: '-', checkIn: '-', checkOut: '-', roomType: '标准间' },
    { roomNumber: '103', status: 'occupied', customer: '李四', checkIn: '2024-05-02', checkOut: '2024-05-05', roomType: '大床房' },
    { roomNumber: '104', status: 'vacant', customer: '-', checkIn: '-', checkOut: '-', roomType: '标准间' },
    { roomNumber: '105', status: 'occupied', customer: '王五', checkIn: '2024-05-01', checkOut: '2024-05-04', roomType: '标准间' },
    { roomNumber: '106', status: 'maintenance', customer: '-', checkIn: '-', checkOut: '-', roomType: '标准间' },
  ]);

  const [recentActivities, setRecentActivities] = useState([
    { time: '10:30', action: '入住登记', room: '101', customer: '张三' },
    { time: '11:15', action: '空调开启', room: '105', customer: '王五' },
    { time: '12:00', action: '结账离店', room: '108', customer: '赵六' },
    { time: '14:20', action: '入住登记', room: '103', customer: '李四' },
    { time: '15:45', action: '风速调整', room: '105', customer: '王五' },
  ]);

  // 模拟获取数据
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 800);
  }, [dateRange]);

  const roomStatusColumns = [
    {
      title: '房号',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      width: 80,
    },
    {
      title: '房型',
      dataIndex: 'roomType',
      key: 'roomType',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          occupied: { color: 'green', text: '已入住' },
          vacant: { color: 'blue', text: '空闲' },
          maintenance: { color: 'orange', text: '维护中' }
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '入住客户',
      dataIndex: 'customer',
      key: 'customer',
      width: 100,
    },
    {
      title: '入住日期',
      dataIndex: 'checkIn',
      key: 'checkIn',
      width: 120,
    },
    {
      title: '离店日期',
      dataIndex: 'checkOut',
      key: 'checkOut',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'occupied' && (
            <Button type="link" size="small">查看详情</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>
        <DashboardOutlined /> 酒店运营仪表盘
      </Title>
      
      {/* 日期选择器 */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>数据统计周期:</Text>
        <RangePicker 
          value={dateRange}
          onChange={(dates) => setDateRange(dates)}
          style={{ width: 300 }}
        />
      </div>
      
      {/* 核心指标 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic 
              title="总房间数" 
              value={hotelStats.totalRooms} 
              prefix={<HomeOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">已入住: {hotelStats.occupiedRooms}间</Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic 
              title="今日入住率" 
              value={hotelStats.occupancyRate} 
              suffix="%"
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress 
              percent={hotelStats.occupancyRate} 
              size="small" 
              status="active"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic 
              title="今日收入" 
              value={hotelStats.todayRevenue} 
              prefix="¥"
              valueStyle={{ color: '#cf1322' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                <ArrowUpOutlined style={{ color: '#cf1322' }} /> 较昨日 +12%
              </Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic 
              title="累计客户" 
              value={hotelStats.customerCount} 
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">本月新增: 28人</Text>
            </div>
          </Card>
        </Col>
      </Row>
      
      {/* 第二行指标 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Card title="空调使用情况" loading={loading}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic 
                  title="今日使用量" 
                  value={hotelStats.acUsage} 
                  suffix="分钟" 
                  valueStyle={{ color: '#1890ff' }}
                />
                <div style={{ marginTop: 16 }}>
                  <Statistic 
                    title="空调收入" 
                    value={hotelStats.acRevenue} 
                    prefix="¥"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <Text strong>节能效果</Text>
                  <Progress 
                    type="circle" 
                    percent={75} 
                    width={100}
                    format={percent => `${percent}%`}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />
                </div>
                <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                  相比传统模式节能25%
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="实时动态" loading={loading}>
            <List
              size="small"
              dataSource={recentActivities}
              renderItem={item => (
                <List.Item>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <Text type="secondary">[{item.time}]</Text>
                    <Text>{item.action}</Text>
                    <Text strong>{item.room}</Text>
                    <Text type="secondary">{item.customer}</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
      
      {/* 房间状态表格 */}
      <Card 
        title={
          <Space>
            <CheckCircleOutlined />
            <span>当前房间状态</span>
          </Space>
        }
        loading={loading}
        extra={
          <Space>
            <Button type="primary">刷新数据</Button>
            <Button>导出报表</Button>
          </Space>
        }
      >
        <Table 
          dataSource={roomStatus} 
          columns={roomStatusColumns} 
          rowKey="roomNumber"
          pagination={false}
          size="middle"
        />
      </Card>
      
      {/* 系统提示 */}
      <Card 
        title={
          <Space>
            <InfoCircleOutlined />
            <span>系统提示</span>
          </Space>
        }
        style={{ marginTop: 20 }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ul>
              <li>系统已实现空调温控计费模式，支持多用多付出，少用少付出，不用不付出</li>
              <li>顾客可随时查看已消费金额，做到心中有数节省开支</li>
              <li>本系统已响应政府绿色环保经营理念</li>
            </ul>
          </Col>
          <Col span={12}>
            <ul>
              <li>空调管理员可监控各房间的空调使用状态</li>
              <li>系统支持实时数据统计和报表生成</li>
              <li>如需技术支持，请联系系统管理员</li>
            </ul>
          </Col>
        </Row>
        
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#f6ffed', 
          borderRadius: 6,
          border: '1px solid #b7eb8f'
        }}>
          <Text type="success">
            <InfoCircleOutlined /> 当前系统运行正常，所有服务均可用
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;