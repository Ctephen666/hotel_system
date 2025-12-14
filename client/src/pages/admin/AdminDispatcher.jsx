import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Badge, List, Space, Statistic, Row, Col, Progress, Typography } from 'antd';
import { ClockCircleOutlined, SyncOutlined, FireOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Text } = Typography;

const AdminDispatcher = () => {
  const [rooms, setRooms] = useState([]);
  const [serviceQueue, setServiceQueue] = useState([]); // 存ID
  const [waitQueue, setWaitQueue] = useState([]);       // 存ID
  const [stats, setStats] = useState({
    totalRooms: 0,
    runningRooms: 0,
    waitingRooms: 0,
    stoppedRooms: 0
  });
  const [capacity, setCapacity] = useState(3); 

  useEffect(() => {
    const socket = new WebSocket("ws://10.29.238.57:8080");

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'REGISTER_DISPATCHER' }));
      console.log('调度器管理端已连接');
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "SYSTEM_STATUS_UPDATE") {
        setRooms(data.payload.rooms || []);
        setServiceQueue(data.payload.serviceQueue || []);
        setWaitQueue(data.payload.waitQueue || []);
        
        // 更新统计信息
        if (data.payload.systemStatus) {
          setStats(data.payload.systemStatus);
          setCapacity(data.payload.systemStatus.maxCapacity || 3);
        }
        
        // // 计算实际服务容量（根据服务器返回的数据）
        // if (data.payload.rooms) {
        //   const runningRooms = data.payload.rooms.filter(r => r.status === "running").length;
        //   const waitingRooms = data.payload.rooms.filter(r => r.status === "waiting").length;
          
        //   // 容量 = 当前服务中房间数 + 1（如果有等待房间）
        //   if (runningRooms > 0 || waitingRooms > 0) {
        //     setCapacity(Math.max(1, runningRooms));
        //   }
        // }
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };

    socket.onclose = () => {
      console.log('调度器管理端连接已关闭');
    };

    return () => socket.close();
  }, []);

  // 辅助函数：获取房间详细对象
  const getRoom = (id) => rooms.find(r => r.roomId === id) || {};

  // 计算等待进度 (根据调度器的时间片逻辑)
  const renderWaitProgress = (roomId) => {
    const room = rooms.find(r => r.roomId === roomId);
    if (!room || room.status !== 'waiting') return null;
    
    // 获取等待队列中的位置
    const waitIndex = waitQueue.indexOf(roomId);
    if (waitIndex === -1) return null;
    
    // 根据位置估算等待时间
    const estimatedWaitTime = (waitIndex + 1) * 10; // 假设每个房间10秒
    const elapsed = waitIndex * 10; // 假设已等待时间
    
    const percent = Math.min(100, (elapsed / estimatedWaitTime) * 100);
    return (
      <div style={{ width: 120 }}>
        <Progress 
          percent={percent} 
          size="small" 
          showInfo={false} 
          status="active" 
          strokeColor="#faad14"
        />
        <div style={{ fontSize: 10, color: '#999' }}>
          队列位置: {waitIndex + 1}
        </div>
      </div>
    );
  };

  // 计算服务时长
  const renderServiceTime = (roomId) => {
    const room = rooms.find(r => r.roomId === roomId);
    if (!room || !room.runTime) return '-';
    
    // runTime 是分钟数，转换为秒显示
    const seconds = Math.floor(room.runTime * 60);
    return `${seconds}s`;
  };

  const columns = [
    { 
      title: "房间", 
      dataIndex: "roomId", 
      render: (text) => <Tag color="blue">{text}</Tag> 
    },
    { 
      title: "当前/目标温度", 
      render: (_, r) => {
        if (!r.currentTemp || !r.targetTemp) return '-';
        return `${parseFloat(r.currentTemp).toFixed(1)}°C / ${r.targetTemp}°C`;
      }
    },
    { 
      title: "风速(优先级)", 
      dataIndex: "fanSpeed", 
      render: (speed) => {
        if (!speed) return '-';
        const priorityMap = { 'high': 3, 'medium': 2, 'low': 1 };
        const priority = priorityMap[speed] || 0;
        const color = speed === 'high' ? 'red' : speed === 'medium' ? 'orange' : 'green';
        return (
          <Tag color={color}>
            {speed === 'high' ? '高' : speed === 'medium' ? '中' : '低'}({priority})
          </Tag>
        );
      }
    },
    { 
      title: "运行模式", 
      dataIndex: "mode", 
      render: (mode) => {
        if (!mode) return '-';
        return (
          <Tag color={mode === 'cool' ? 'blue' : 'red'}>
            {mode === 'cool' ? '制冷' : '制热'}
          </Tag>
        );
      }
    },
    { 
      title: "状态", 
      dataIndex: "status", 
      render: (status) => {
        if (!status) return <Badge status="default" text="未知" />;
        
        switch(status) {
          case 'running':
            return <Badge status="processing" text="服务中" color="green" />;
          case 'waiting':
            return <Badge status="warning" text="排队中" />;
          case 'stopped':
            return <Badge status="default" text="已停止" />;
          case 'off':
            return <Badge status="default" text="关机" />;
          default:
            return <Badge status="default" text="未知" />;
        }
      }
    }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="当前负载 (正在服务)" 
              value={stats.runningRooms || 0} 
              suffix={`/ ${capacity}`} 
              prefix={<ThunderboltOutlined />} 
              valueStyle={{ color: '#3f8600' }} 
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              服务容量: {capacity} 个房间
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="排队数量" 
              value={stats.waitingRooms || 0} 
              prefix={<ClockCircleOutlined />} 
              valueStyle={{ color: '#faad14' }} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="总房间数" 
              value={stats.totalRooms || 0} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="已停止" 
              value={stats.stoppedRooms || 0} 
              valueStyle={{ color: '#cf1322' }} 
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* 左侧：服务队列 */}
        <Col span={12}>
          <Card 
            title={
              <Space>
                <FireOutlined style={{ color: 'red' }} /> 
                正在服务队列 (Service Queue)
                <Tag color="green" style={{ marginLeft: 8 }}>
                  {serviceQueue.length} 个房间
                </Tag>
              </Space>
            } 
            styles={{ body: { padding: 0 } }}
            className="shadow-md"
          >
            {serviceQueue.length > 0 ? (
              <Table 
                dataSource={serviceQueue.map(id => getRoom(id)).filter(r => r.roomId)} 
                columns={columns} 
                rowKey="roomId" 
                pagination={false} 
                size="small"
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#ccc' }}>
                暂无服务中的房间
              </div>
            )}
          </Card>
        </Col>

        {/* 右侧：等待队列 */}
        <Col span={12}>
          <Card 
            title={
              <Space>
                <SyncOutlined spin style={{ color: '#1890ff' }} /> 
                等待队列 (Waiting Queue)
                <Tag color="orange" style={{ marginLeft: 8 }}>
                  {waitQueue.length} 个房间
                </Tag>
              </Space>
            } 
            styles={{ body: { padding: 0 } }}
            className="shadow-md"
          >
            {waitQueue.length > 0 ? (
              <Table 
                dataSource={waitQueue.map(id => getRoom(id)).filter(r => r.roomId)} 
                columns={[
                  ...columns,
                  { 
                    title: '等待进度', 
                    render: (_, r) => renderWaitProgress(r.roomId)
                  }
                ]} 
                rowKey="roomId" 
                pagination={false} 
                size="small"
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#ccc' }}>
                无排队房间
              </div>
            )}
          </Card>
        </Col>
      </Row>
      
      {/* 系统信息概览 */}
      <Card style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>系统信息</Text>
            </div>
            <div>
              <Text type="secondary">调度策略: </Text>
              <Text>优先级抢占 (高中低) + 最大服务时间限制 (2分钟)</Text>
            </div>
            <div>
              <Text type="secondary">服务规则: </Text>
              <Text>
                1. 按风速优先级(高:3, 中:2, 低:1)排序<br />
                2. 每次服务最多持续2分钟<br />
                3. 达到目标温度自动停止<br />
                4. 温差≥1℃时重新申请服务
              </Text>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>费用统计</Text>
            </div>
            <div>
              <Text type="secondary">总费用: </Text>
              <Text>
                ¥{
                  rooms.reduce((sum, room) => sum + (parseFloat(room.usageFee) || 0), 0).toFixed(2)
                }
              </Text>
            </div>
            <div>
              <Text type="secondary">总耗电量: </Text>
              <Text>
                {
                  rooms.reduce((sum, room) => sum + (parseFloat(room.powerConsumed) || 0), 0).toFixed(4)
                } 度
              </Text>
            </div>
            <div>
              <Text type="secondary">平均温度: </Text>
              <Text>
                {
                  rooms.length > 0 
                    ? (rooms.reduce((sum, room) => sum + (parseFloat(room.currentTemp) || 0), 0) / rooms.length).toFixed(1)
                    : 0
                }°C
              </Text>
            </div>
          </Col>
        </Row>
      </Card>
      
      <div style={{ marginTop: 20, textAlign: 'center', color: '#888', fontSize: '12px' }}>
        最后更新: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default AdminDispatcher;