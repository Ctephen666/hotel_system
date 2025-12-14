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
    const socket = new WebSocket("ws://10.29.238.57:8080");
    setWs(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'REGISTER_AC_ADMIN' }));
      message.success('已连接到空调管理系统');
      
      // 请求所有房间状态
      socket.send(JSON.stringify({ type: 'GET_ALL_ROOMS_STATUS' }));
    };

    socket.onmessage = (msg) => {
      try {
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
      } catch (error) {
        console.error('解析消息失败:', error);
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
      totalPower: rooms.reduce((sum, room) => sum + (parseFloat(room.usageFee) || 0), 0).toFixed(2),
      avgTemperature: rooms.length > 0 ? 
        (rooms.reduce((sum, room) => sum + (parseFloat(room.currentTemp) || 0), 0) / rooms.length).toFixed(1) : 0
    };
    setSystemStats(stats);
  };

  // 过滤房间
  useEffect(() => {
    let filtered = allRooms;
    
    // 按搜索文本过滤
    if (searchText) {
      filtered = filtered.filter(room => 
        String(room.roomId).includes(searchText) || 
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

  // 处理搜索
  const handleSearch = () => {
    // 搜索逻辑已经在useEffect中处理
    console.log('搜索:', searchText);
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
      title: "当前温度", 
      dataIndex: "currentTemp",
      render: (temp) => temp ? `${parseFloat(temp).toFixed(2)}°C` : '--°C'
    },
    { 
      title: "目标温度", 
      dataIndex: "targetTemp",
      render: (temp) => temp ? `${temp}°C` : '--°C'
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
      render: (speed) => {
        if (!speed) return <Tag color="purple">自动</Tag>;
        const color = speed === 'high' ? 'red' : speed === 'medium' ? 'orange' : 'green';
        return (
          <Tag color={color}>
            {speed === 'high' ? '高' : speed === 'medium' ? '中' : '低'}
          </Tag>
        );
      }
    },
    {
      title: "运行状态",
      dataIndex: "status",
      render: (status) => {
        const statusConfig = {
          'running': { color: 'green', text: '运行中' },
          'waiting': { color: 'orange', text: '等待中' },
          'stopped': { color: 'red', text: '已停止' },
          'off': { color: 'default', text: '关机' }
        };
        
        const config = statusConfig[status] || { color: 'default', text: status || '--' };
        return <Badge status={config.color} text={config.text} />;
      }
    },
    {
      title: "运行时长",
      dataIndex: "timeElapsed",
      render: (time) => time ? `${parseFloat(time/60).toFixed(1)}分钟` : '-'
    },
    {
      title: "使用费用",
      dataIndex: "usageFee",
      render: (fee) => fee ? `¥${parseFloat(fee).toFixed(2)}` : '-'
    },
    {
      title: "耗电量",
      dataIndex: "powerConsumed",
      render: (power) => power ? `${parseFloat(power).toFixed(4)}度` : '-'
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
        </Row>
      </Card>

      {/* 搜索和过滤 */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="搜索房间号"
                allowClear
                size="large"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                搜索
              </Button>
            </Space.Compact>
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
              <Option value="off">关机</Option>
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
          scroll={{ x: 1500 }}
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
                <strong>运行状态:</strong> 
                <Tag 
                  color={
                    selectedRoom.status === 'running' ? 'green' : 
                    selectedRoom.status === 'waiting' ? 'orange' : 
                    selectedRoom.status === 'stopped' ? 'red' : 'default'
                  } 
                  style={{ marginLeft: 8 }}
                >
                  {selectedRoom.status === 'running' ? '运行中' : 
                   selectedRoom.status === 'waiting' ? '等待中' : 
                   selectedRoom.status === 'stopped' ? '已停止' : '关机'}
                </Tag>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>当前温度:</strong> {selectedRoom.currentTemp ? `${parseFloat(selectedRoom.currentTemp).toFixed(2)}°C` : '--°C'}
              </Col>
              <Col span={12}>
                <strong>目标温度:</strong> {selectedRoom.targetTemp ? `${selectedRoom.targetTemp}°C` : '--°C'}
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
                <strong>风速:</strong> 
                <Tag color="purple" style={{ marginLeft: 8 }}>
                  {selectedRoom.fanSpeed === 'high' ? '高' : 
                   selectedRoom.fanSpeed === 'medium' ? '中' : 
                   selectedRoom.fanSpeed === 'low' ? '低' : '自动'}
                </Tag>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>运行时长:</strong> {selectedRoom.timeElapsed ? `${parseFloat(selectedRoom.timeElapsed/60).toFixed(2)}分钟` : '-'}
              </Col>
              <Col span={12}>
                <strong>使用费用:</strong> {selectedRoom.usageFee ? `¥${parseFloat(selectedRoom.usageFee).toFixed(2)}` : '-'}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <strong>耗电量:</strong> {selectedRoom.powerConsumed ? `${parseFloat(selectedRoom.powerConsumed).toFixed(4)}度` : '-'}
              </Col>
              <Col span={12}>
                <strong>优先级:</strong> 
                <Tag color={
                  selectedRoom.fanSpeed === 'high' ? 'red' : 
                  selectedRoom.fanSpeed === 'medium' ? 'orange' : 'green'
                } style={{ marginLeft: 8 }}>
                  {selectedRoom.fanSpeed === 'high' ? '高(3)' : 
                   selectedRoom.fanSpeed === 'medium' ? '中(2)' : '低(1)'}
                </Tag>
              </Col>
            </Row>
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f6ffed', borderRadius: 4 }}>
              <div><strong>调度信息:</strong></div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {selectedRoom.status === 'running' ? '正在被调度器服务中' :
                 selectedRoom.status === 'waiting' ? '正在等待调度器分配服务' :
                 selectedRoom.status === 'stopped' ? '已达到目标温度，暂停服务' :
                 '空调已关机，不参与调度'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminConsole;