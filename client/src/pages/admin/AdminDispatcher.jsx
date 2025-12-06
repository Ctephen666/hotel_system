import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Badge, List, Space, Statistic, Row, Col, Progress, Typography } from 'antd';
import { ClockCircleOutlined, SyncOutlined, FireOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Text } = Typography;

const AdminDispatcher = () => {
  const [rooms, setRooms] = useState([]);
  const [serviceQueue, setServiceQueue] = useState([]); // 存ID
  const [waitQueue, setWaitQueue] = useState([]);       // 存ID
  const [stats, setStats] = useState({});

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws");

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'REGISTER_DISPATCHER' }));
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === "SYSTEM_STATUS_UPDATE") {
        setRooms(data.payload.rooms);
        setServiceQueue(data.payload.serviceQueue);
        setWaitQueue(data.payload.waitQueue);
        setStats(data.payload.systemStatus);
      }
    };

    return () => socket.close();
  }, []);

  // 辅助函数：获取房间详细对象
  const getRoom = (id) => rooms.find(r => r.roomId === id) || {};

  // 计算等待进度 (假设时间片为10秒)
  const renderWaitProgress = (startTime) => {
    if (!startTime) return null;
    const elapsed = (Date.now() - startTime) / 1000;
    const percent = Math.min(100, (elapsed / 10) * 100); // 10秒时间片
    return (
      <div style={{ width: 100 }}>
        <Progress percent={percent} size="small" showInfo={false} status="active" strokeColor="#faad14"/>
        <div style={{ fontSize: 10, color: '#999' }}>等待: {elapsed.toFixed(0)}s</div>
      </div>
    );
  };

  const columns = [
    { title: "房间", dataIndex: "roomId", render: t => <Tag color="blue">{t}</Tag> },
    { title: "当前/目标", render: (_, r) => `${r.currentTemp}°C / ${r.targetTemp}°C` },
    { title: "风速(优先级)", dataIndex: "fanSpeed", 
      render: (s) => {
        const color = s === 'high' ? 'red' : s === 'medium' ? 'orange' : 'green';
        return <Tag color={color}>{s === 'high' ? '高(3)' : s === 'medium' ? '中(2)' : '低(1)'}</Tag>
      }
    },
    { title: "状态", dataIndex: "status", 
      render: (s) => {
        if(s === 'running') return <Badge status="processing" text="服务中" color="green" />;
        if(s === 'waiting') return <Badge status="warning" text="排队中" />;
        return <Badge status="default" text="已停止" />;
      }
    }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
            <Card>
                <Statistic title="当前负载 (正在服务)" value={stats.runningRooms} suffix={`/ ${stats.capacity}`} prefix={<ThunderboltOutlined />} valueStyle={{ color: '#3f8600' }} />
            </Card>
        </Col>
        <Col span={8}>
            <Card>
                <Statistic title="排队数量" value={stats.waitingRooms} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
            </Card>
        </Col>
        <Col span={8}>
             <Card>
                <Statistic title="总房间数" value={stats.totalRooms} />
            </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* 左侧：服务队列 */}
        <Col span={12}>
          <Card title={<Space><FireOutlined style={{color:'red'}}/> 正在服务队列 (Service Queue)</Space>} 
                className="shadow-md" bodyStyle={{ padding: 0 }}>
            <Table 
                dataSource={serviceQueue.map(id => getRoom(id))} 
                columns={[...columns, { 
                    title: '服务时长', 
                    render: (_, r) => r.startTime ? `${((Date.now() - r.startTime)/1000).toFixed(0)}s` : '-' 
                }]} 
                rowKey="roomId" pagination={false} size="small"
            />
          </Card>
        </Col>

        {/* 右侧：等待队列 */}
        <Col span={12}>
          <Card title={<Space><SyncOutlined spin style={{color:'#1890ff'}}/> 等待队列 (Waiting Queue)</Space>} 
                className="shadow-md" bodyStyle={{ padding: 0 }}>
             <Table 
                dataSource={waitQueue.map(id => getRoom(id))} 
                columns={[...columns, { 
                    title: '时间片', 
                    render: (_, r) => renderWaitProgress(r.waitStartTime)
                }]} 
                rowKey="roomId" pagination={false} size="small"
            />
            {waitQueue.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#ccc' }}>无排队房间</div>}
          </Card>
        </Col>
      </Row>
      
      <div style={{ marginTop: 20, textAlign: 'center', color: '#888' }}>
         调度策略: 优先级抢占 (高中低) + 同级时间片轮转 (10s)
      </div>
    </div>
  );
};

export default AdminDispatcher;