import React, { useState, useEffect } from 'react'; // 👈 1. 引入 useEffect
import { useNavigate } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Input, 
  Select, 
  Space, 
  Typography, 
  message,
  Badge,
  Alert,
  Spin // 引入 Spin 组件用于加载指示
} from 'antd';
import {
  HomeOutlined,
  ArrowRightOutlined,
  SearchOutlined,
  FilterOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const API_BASE_URL = 'http://localhost:3000/api'; 

const fetchRooms = async () => {
  try {
      const response = await fetch(`${API_BASE_URL}/rooms`);
      const result = await response.json();
      
      if (!result.success) {
          // 后端返回 success: false 时抛出错误
          throw new Error(result.message || '获取房间数据失败');
      }
      return result.data;
  } catch (error) {
      console.error("Fetch Rooms Error:", error);
      throw error; // 重新抛出错误，以便 useEffect 捕获
  }
};

const RoomSelection = () => {
  const navigate = useNavigate();
  
  const [rooms, setRooms] = useState([]); 
  const [loading, setLoading] = useState(true); 

  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState('');
  // 筛选条件
  const [filters, setFilters] = useState({
    floor: 'all',
    type: 'all',
    status: 'available'
  });
  
  useEffect(() => {
    const loadRooms = async () => {
      try {
        setLoading(true);
        const data = await fetchRooms(); 
        // 假设 data 结构为: { id, roomNo, name, type, floor, status: ('available'/'occupied'/'maintenance'), basePrice }
        setRooms(data);
      } catch (error) {
        // 捕获错误并提示
        message.error(`加载房间列表失败: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    loadRooms();
  }, []); // 仅在组件挂载时运行一次

  // 筛选房间
  const filteredRooms = rooms.filter(room => {
    // 搜索过滤
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      // 搜索房间号 (roomNo) 或名称 (name)
      if (!room.roomNo.toLowerCase().includes(keyword) && 
          !room.name.toLowerCase().includes(keyword)) {
        return false;
      }
    }
    
    // 楼层过滤
    // 确保这里的 room.floor 格式和 Option value 格式一致 ('1楼', '2楼')
    if (filters.floor !== 'all' && room.floor !== filters.floor) {
      return false;
    }
    
    // 房型过滤
    if (filters.type !== 'all' && room.type !== filters.type) {
      return false;
    }
    
    // 状态过滤
    if (filters.status !== 'all' && room.status !== filters.status) {
      return false;
    }
    
    return true;
  });

  // 进入房间控制页面
  const handleEnterRoom = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (room && room.status === 'available') {
      navigate(`/ac-control/${roomId}`);
      message.success(`进入房间 ${room.roomNo} 控制页面`);
    } else {
      message.warning(`房间 ${room ? room.roomNo : roomId} 当前不可用`);
    }
  };

  // 获取房间状态标签
  const getRoomStatusTag = (status) => {
    switch(status) {
      case 'available':
        return <Badge status="success" text="可用" />;
      case 'occupied':
        return <Badge status="error" text="已入住" />;
      case 'maintenance':
        return <Badge status="warning" text="待清理/维护" />;
      default:
        return <Badge status="default" text="未知" />;
    }
  };

  // 获取房型颜色
  const getRoomTypeColor = (type) => {
    switch(type) {
      case '标准间':
        return '#1890ff';
      case '豪华间':
        return '#722ed1';
      case '商务间':
        return '#52c41a';
      default:
        return '#8c8c8c';
    }
  };

  // 统计信息
  const stats = {
    totalRooms: rooms.length,
    availableRooms: rooms.filter(r => r.status === 'available').length,
    occupiedRooms: rooms.filter(r => r.status === 'occupied').length,
  };

  // -----------------------------------------------------
  // 筛选器选项动态生成：获取所有独特的房型和楼层，以适应数据库数据
  // -----------------------------------------------------
  const uniqueTypes = [...new Set(rooms.map(r => r.type))];
  const uniqueFloors = [...new Set(rooms.map(r => r.floor))];


  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Row gutter={16} align="middle" justify="space-between">
          <Col>
            <Space size="large">
              <HomeOutlined style={{ fontSize: '32px', color: 'white' }} />
              <Title level={2} style={{ margin: 0, color: 'white' }}>
                请选择您的房间
              </Title>
            </Space>
          </Col>
          <Col>
            <Text style={{ color: 'white' }}>
              当前可用房间: {stats.availableRooms} / {stats.totalRooms}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Search
              placeholder="搜索房间号或名称"
              allowClear
              onChange={(e) => setSearchKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              value={filters.floor}
              onChange={(value) => setFilters({...filters, floor: value})}
              style={{ width: '100%' }}
              placeholder="选择楼层"
            >
              <Option value="all">所有楼层</Option>
              {/* 动态生成楼层选项 */}
              {uniqueFloors.map(floor => <Option key={floor} value={floor}>{floor}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              value={filters.type}
              onChange={(value) => setFilters({...filters, type: value})}
              style={{ width: '100%' }}
              placeholder="选择房型"
            >
              <Option value="all">所有房型</Option>
              {/* 动态生成房型选项 */}
              {uniqueTypes.map(type => <Option key={type} value={type}>{type}</Option>)}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              value={filters.status}
              onChange={(value) => setFilters({...filters, status: value})}
              style={{ width: '100%' }}
              placeholder="选择状态"
            >
              <Option value="all">所有状态</Option>
              <Option value="available">可用</Option>
              <Option value="occupied">已入住</Option>
              <Option value="maintenance">待清理/维护</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button 
              onClick={() => setFilters({ floor: 'all', type: 'all', status: 'available' })}
              style={{ width: '100%' }}
              icon={<FilterOutlined />}
            >
              重置筛选
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 房间列表 */}
      <Card title={`房间列表 (${filteredRooms.length} 个)`}>
        {loading ? ( // 5. 显示加载状态
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <Title level={4} style={{ marginTop: 16 }}>正在加载房间数据...</Title>
            <Text type="secondary">请确保后端服务和数据库已启动</Text>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <HomeOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
            <Title level={4}>未找到匹配的房间</Title>
            <Text type="secondary">请调整搜索条件</Text>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {filteredRooms.map(room => (
              // 注意：这里使用 room.roomNo 作为 key 更稳定
              <Col key={room.roomNo} xs={24} sm={12} md={8} lg={6}> 
                <Card
                  hoverable
                  style={{
                    // 样式根据实时状态决定
                    border: room.status === 'available' ? '2px solid #52c41a' : '1px solid #d9d9d9',
                    opacity: room.status === 'available' ? 1 : 0.7
                  }}
                  actions={[
                    <Button 
                      type="primary" 
                      icon={<ArrowRightOutlined />}
                      onClick={() => handleEnterRoom(room.id)}
                      disabled={room.status !== 'available'} // 只有可用房间才能进入控制
                      block
                    >
                      进入控制
                    </Button>
                  ]}
                >
                  <div style={{ textAlign: 'center' }}>
                    <HomeOutlined style={{ 
                      fontSize: '48px', 
                      color: getRoomTypeColor(room.type),
                      marginBottom: '12px' 
                    }} />
                    <Title level={3} style={{ marginBottom: '8px' }}>
                      {room.roomNo} {/* 使用 roomNo 作为主要标识 */}
                    </Title>
                    <Text strong style={{ 
                      color: getRoomTypeColor(room.type),
                      display: 'block',
                      marginBottom: '8px'
                    }}>
                      {room.name}
                    </Text>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">房型:</Text>
                        <Text strong>{room.type}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">楼层:</Text>
                        <Text strong>{room.floor}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">状态:</Text>
                        {getRoomStatusTag(room.status)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">基础价:</Text>
                        <Text strong>¥{room.basePrice ? room.basePrice.toFixed(2) : 'N/A'}</Text>
                      </div>
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* 操作提示 */}
      <Alert
        message="操作说明"
        description={
          <div>
            <Text>
              1. 选择可用房间（绿色边框）点击"进入控制"进入空调控制页面<br/>
              2. 使用搜索框可按房间号或名称查找房间<br/>
              3. 使用筛选器可按楼层、房型和状态筛选房间<br/>
              4. 只有"可用"状态的房间可以进入控制
            </Text>
          </div>
        }
        type="info"
        showIcon
        style={{ marginTop: '20px' }}
      />
    </div>
  );
};

export default RoomSelection;