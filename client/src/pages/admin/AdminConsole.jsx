import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Badge, 
  message, 
  Statistic, 
  Row, 
  Col,
  Input,
  Modal,
  Select
} from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  DashboardOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Search } = Input;

const AdminConsole = () => {
  const [ws, setWs] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [systemStats, setSystemStats] = useState({
    totalRooms: 0,
    runningRooms: 0,
    waitingRooms: 0,
    stoppedRooms: 0,
    totalPower: 0,
    avgTemperature: 0
  });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws");
    setWs(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'REGISTER_AC_ADMIN' }));
      message.success('已连接到空调管理系统');
      
      // 请求所有房间状态
      socket.send(JSON.stringify({ type: 'GET_ALL_ROOMS_STATUS' }));
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      console.log('空调管理收到消息:', data);

      switch (data.type) {
        case "ALL_ROOMS_STATUS":
          const rooms = data.payload.rooms || [];
          setAllRooms(rooms);
          setFilteredRooms(rooms);
          calculateSystemStats(rooms);
          break;
          
        case "SYSTEM_STATUS_UPDATE":
          const updatedRooms = data.payload.rooms || [];
          setAllRooms(updatedRooms);
          setFilteredRooms(updatedRooms);
          setSystemStats(data.payload.systemStatus || {});
          break;
          
        case "ROOM_STATUS_CHANGE":
          setAllRooms(prev => 
            prev.map(room => 
              room.roomId === data.roomId 
                ? { ...room, ...data.payload }
                : room
            )
          );
          break;
          
        case "CONTROL_SUCCESS":
          message.success(`房间 ${data.roomId} 控制成功`);
          // 刷新数据以获取最新状态
          socket.send(JSON.stringify({ type: 'GET_ALL_ROOMS_STATUS' }));
          break;
          
        default:
          break;
      }
    };

    socket.onerror = (error) => {
      message.error('空调管理系统连接错误');
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      message.warning('空调管理系统连接已断开');
    };

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // 计算系统统计信息
  const calculateSystemStats = (rooms) => {
    const stats = {
      totalRooms: rooms.length,
      runningRooms: rooms.filter(r => r.status === 'running').length,
      waitingRooms: rooms.filter(r => r.status === 'waiting').length,
      stoppedRooms: rooms.filter(r => r.status === 'stopped').length,
      totalPower: rooms.reduce((sum, room) => sum + (room.powerConsumption || 0), 0),
      avgTemperature: rooms.length > 0 ? 
        (rooms.reduce((sum, room) => sum + (room.currentTemp || 0), 0) / rooms.length).toFixed(1) : 0
    };
    setSystemStats(stats);
  };

  // 过滤房间
  useEffect(() => {
    let filtered = allRooms;
    
    // 按搜索文本过滤
    if (searchText) {
      filtered = filtered.filter(room => 
        room.roomId.includes(searchText) || 
        (room.guestName && room.guestName.includes(searchText))
      );
    }
    
    // 按状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(room => room.status === statusFilter);
    }
    
    setFilteredRooms(filtered);
  }, [searchText, statusFilter, allRooms]);

  // 控制空调
  const controlAC = (roomId, action, params = {}) => {
    if (!ws) {
      message.error('未连接到服务器');
      return;
    }

    const messageData = {
      type: 'CONTROL_AC',
      roomId,
      action,
      ...params
    };

    ws.send(JSON.stringify(messageData));
  };

  // 查看详情
  const showRoomDetail = (room) => {
    setSelectedRoom(room);
    setDetailModalVisible(true);
  };

  // 刷新数据
  const refreshData = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'GET_ALL_ROOMS_STATUS' }));
      message.info('数据已刷新');
    }
  };

  const columns = [
    { 
      title: "房间号", 
      dataIndex: "roomId",
      render: (roomId, record) => (
        <Button type="link" onClick={() => showRoomDetail(record)}>
          <Tag color="blue">{roomId}</Tag>
        </Button>
      )
    },
    { 
      title: "入住状态", 
      dataIndex: "guestName",
      render: (guestName) => 
        guestName ? 
          <Tag color="green">已入住</Tag> : 
          <Tag color="default">空闲</Tag>
    },
    { 
      title: "当前温度", 
      dataIndex: "currentTemp",
      render: (temp) => `${temp || '--'}°C`
    },
    { 
      title: "目标温度", 
      dataIndex: "targetTemp",
      render: (temp) => `${temp || '--'}°C`
    },
    { 
      title: "模式", 
      dataIndex: "mode",
      render: (mode) => (
        <Tag color={mode === 'cool' ? 'blue' : mode === 'heat' ? 'red' : 'default'}>
          {mode === 'cool' ? '制冷' : mode === 'heat' ? '制热' : '--'}
        </Tag>
      )
    },
    {
      title: "风速",
      dataIndex: "fanSpeed",
      render: (speed) => (
        <Tag color="purple">{speed || '自动'}</Tag>
      )
    },
    {
      title: "运行状态",
      dataIndex: "status",
      render: (status) => {
        const statusConfig = {
          'running': { color: 'green', text: '运行中' },
          'waiting': { color: 'orange', text: '等待中' },
          'stopped': { color: 'red', text: '已停止' },
          'offline': { color: 'default', text: '离线' }
        };
        
        const config = statusConfig[status] || { color: 'default', text: status || '--' };
        return <Badge status={config.color} text={config.text} />;
      }
    },
    {
      title: "运行时长",
      dataIndex: "runningTime",
      render: (time) => time ? `${time}分钟` : '-'
    },
    {
      title: "功耗",
      dataIndex: "powerConsumption",
      render: (power) => power ? `${power.toFixed(2)} kW` : '-'
    },
    {
      title: "操作",
      render: (room) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            disabled={room.status === 'running'}
            onClick={() => controlAC(room.roomId, 'start')}
          >
            启动
          </Button>
          <Button
            type="default"
            danger
            size="small"
            icon={<PauseCircleOutlined />}
            disabled={room.status !== 'running'}
            onClick={() => controlAC(room.roomId, 'stop')}
          >
            停止
          </Button>
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => showRoomDetail(room)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px' }}>
      {/* 系统概览 */}
      <Card title="空调系统概览" style={{ marginBottom: 20 }}>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic 
              title="总房间数" 
              value={systemStats.totalRooms}
              prefix={<DashboardOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="运行中" 
              value={systemStats.runningRooms}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="等待中" 
              value={systemStats.waitingRooms}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="已停止" 
              value={systemStats.stoppedRooms}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="总功耗" 
              value={systemStats.totalPower}
              precision={2}
              suffix="kW"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={4}>
            <Statistic 
              title="平均温度" 
              value={systemStats.avgTemperature}
              suffix="°C"
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 搜索和过滤 */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Search
              placeholder="搜索房间号或客人姓名"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="按状态筛选"
              style={{ width: '100%' }}
              size="large"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="all">全部状态</Option>
              <Option value="running">运行中</Option>
              <Option value="waiting">等待中</Option>
              <Option value="stopped">已停止</Option>
              <Option value="offline">离线</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />}
              onClick={refreshData}
              size="large"
            >
              刷新数据
            </Button>
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <span style={{ color: '#8c8c8c' }}>
              最后更新: {new Date().toLocaleTimeString()}
            </span>
          </Col>
        </Row>
      </Card>

      {/* 房间列表 */}
      <Card 
        title={`房间状态监控 (${filteredRooms.length})`}
        extra={
          <Badge 
            count={systemStats.runningRooms} 
            showZero 
            style={{ backgroundColor: '#52c41a' }}
          >
            <Tag color="blue">运行中: {systemStats.runningRooms}</Tag>
          </Badge>
        }
      >
        <Table
          dataSource={filteredRooms}
          columns={columns}
          rowKey="roomId"
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 房间详情模态框 */}
      <Modal
        title={`房间 ${selectedRoom?.roomId} 详情`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {selectedRoom && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>房间号:</strong> {selectedRoom.roomId}
              </Col>
              <Col span={12}>
                <strong>入住状态:</strong> 
                {selectedRoom.guestName ? 
                  <Tag color="green" style={{ marginLeft: 8 }}>已入住</Tag> : 
                  <Tag color="default" style={{ marginLeft: 8 }}>空闲</Tag>
                }
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>当前温度:</strong> {selectedRoom.currentTemp || '--'}°C
              </Col>
              <Col span={12}>
                <strong>目标温度:</strong> {selectedRoom.targetTemp || '--'}°C
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>运行模式:</strong> 
                <Tag color={selectedRoom.mode === 'cool' ? 'blue' : 'red'} style={{ marginLeft: 8 }}>
                  {selectedRoom.mode === 'cool' ? '制冷' : selectedRoom.mode === 'heat' ? '制热' : '--'}
                </Tag>
              </Col>
              <Col span={12}>
                <strong>风速:</strong> {selectedRoom.fanSpeed || '自动'}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>运行状态:</strong> 
                <Badge 
                  status={
                    selectedRoom.status === 'running' ? 'success' : 
                    selectedRoom.status === 'waiting' ? 'warning' : 
                    selectedRoom.status === 'stopped' ? 'error' : 'default'
                  } 
                  text={
                    selectedRoom.status === 'running' ? '运行中' : 
                    selectedRoom.status === 'waiting' ? '等待中' : 
                    selectedRoom.status === 'stopped' ? '已停止' : '离线'
                  }
                  style={{ marginLeft: 8 }}
                />
              </Col>
              <Col span={12}>
                <strong>运行时长:</strong> {selectedRoom.runningTime ? `${selectedRoom.runningTime}分钟` : '-'}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>当前功耗:</strong> {selectedRoom.powerConsumption ? `${selectedRoom.powerConsumption.toFixed(2)} kW` : '-'}
              </Col>
              <Col span={12}>
                <strong>累计能耗:</strong> {selectedRoom.totalEnergy ? `${selectedRoom.totalEnergy} kWh` : '-'}
              </Col>
            </Row>
            {selectedRoom.guestName && (
              <Row gutter={16}>
                <Col span={24}>
                  <strong>入住客人:</strong> {selectedRoom.guestName}
                </Col>
              </Row>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminConsole;