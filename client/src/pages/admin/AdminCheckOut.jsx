import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Typography, Space, message, Button, Input, Select, Modal, 
  Descriptions, Tag, Statistic, Row, Col, DatePicker 
} from 'antd';
import { 
  SearchOutlined, DollarOutlined, CheckCircleOutlined, 
  EyeOutlined, PrinterOutlined, DownloadOutlined 
} from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AdminCheckOut = () => {
  const [loading, setLoading] = useState(false);
  const [checkOutData, setCheckOutData] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchParams, setSearchParams] = useState({
    roomNumber: '',
    status: 'all',
    dateRange: [moment().startOf('day'), moment().endOf('day')]
  });

  // 模拟结账数据
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const mockData = [
        {
          id: 1,
          roomNumber: '105',
          customerName: '张三',
          idNumber: '110101199001011234',
          phone: '13800138000',
          checkInDate: '2024-05-01',
          checkOutDate: '2024-05-03',
          roomType: '标准间',
          accommodationFee: 300,
          acUsageFee: 45.5,
          deposit: 300,
          totalFee: 645.5,
          finalAmount: 45.5,
          status: 'completed',
          paymentMethod: 'alipay',
          checkOutTime: '2024-05-03 12:30'
        },
        {
          id: 2,
          roomNumber: '103',
          customerName: '李四',
          idNumber: '110101199002022345',
          phone: '13900139000',
          checkInDate: '2024-05-02',
          checkOutDate: '2024-05-05',
          roomType: '大床房',
          accommodationFee: 600,
          acUsageFee: 78.2,
          deposit: 300,
          totalFee: 978.2,
          finalAmount: 678.2,
          status: 'pending',
          paymentMethod: '',
          checkOutTime: ''
        },
        {
          id: 3,
          roomNumber: '108',
          customerName: '王五',
          idNumber: '110101199003033456',
          phone: '13700137000',
          checkInDate: '2024-05-01',
          checkOutDate: '2024-05-04',
          roomType: '标准间',
          accommodationFee: 450,
          acUsageFee: 32.1,
          deposit: 300,
          totalFee: 782.1,
          finalAmount: 482.1,
          status: 'completed',
          paymentMethod: 'wechat',
          checkOutTime: '2024-05-04 11:45'
        }
      ];
      setCheckOutData(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  const handleSearch = (value) => {
    setSearchParams(prev => ({ ...prev, roomNumber: value }));
  };

  const handleStatusChange = (value) => {
    setSearchParams(prev => ({ ...prev, status: value }));
  };

  const handleDateChange = (dates) => {
    setSearchParams(prev => ({ ...prev, dateRange: dates }));
  };

  const showDetail = (record) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };

  const handleCheckOut = (record) => {
    Modal.confirm({
      title: '确认结账',
      content: `确定要为房间 ${record.roomNumber} 的客户 ${record.customerName} 办理结账吗？`,
      onOk() {
        setLoading(true);
        setTimeout(() => {
          message.success(`房间 ${record.roomNumber} 结账成功！`);
          setCheckOutData(prev => 
            prev.map(item => 
              item.id === record.id 
                ? { ...item, status: 'completed', paymentMethod: 'cash', checkOutTime: moment().format('YYYY-MM-DD HH:mm') }
                : item
            )
          );
          setLoading(false);
        }, 1000);
      }
    });
  };

  const exportReport = () => {
    message.success('结账报表导出成功！');
  };

  const columns = [
    {
      title: '房号',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      width: 80,
    },
    {
      title: '客户姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 100,
    },
    {
      title: '身份证号',
      dataIndex: 'idNumber',
      key: 'idNumber',
      width: 180,
      render: (text) => text.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2')
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: '入住日期',
      dataIndex: 'checkInDate',
      key: 'checkInDate',
      width: 110,
    },
    {
      title: '离店日期',
      dataIndex: 'checkOutDate',
      key: 'checkOutDate',
      width: 110,
    },
    {
      title: '住宿费',
      dataIndex: 'accommodationFee',
      key: 'accommodationFee',
      width: 100,
      render: (fee) => `¥${fee}`
    },
    {
      title: '空调费',
      dataIndex: 'acUsageFee',
      key: 'acUsageFee',
      width: 100,
      render: (fee) => `¥${fee}`
    },
    {
      title: '应付金额',
      dataIndex: 'finalAmount',
      key: 'finalAmount',
      width: 100,
      render: (amount) => <Text strong style={{ color: '#ff4d4f' }}>¥{amount}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          pending: { color: 'orange', text: '待结账' },
          completed: { color: 'green', text: '已结账' }
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (method) => {
        const methodConfig = {
          alipay: '支付宝',
          wechat: '微信',
          cash: '现金',
          '': '-'
        };
        return methodConfig[method] || method;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => showDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Button 
              type="link" 
              size="small" 
              icon={<CheckCircleOutlined />}
              onClick={() => handleCheckOut(record)}
            >
              结账
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const filteredData = checkOutData.filter(record => {
    const matchesRoom = !searchParams.roomNumber || 
      record.roomNumber.includes(searchParams.roomNumber);
    const matchesStatus = searchParams.status === 'all' || 
      record.status === searchParams.status;
    
    if (searchParams.dateRange && searchParams.dateRange[0] && searchParams.dateRange[1]) {
      const recordDate = moment(record.checkOutDate);
      const inDateRange = recordDate.isBetween(
        searchParams.dateRange[0], 
        searchParams.dateRange[1],
        'day',
        '[]'
      );
      return matchesRoom && matchesStatus && inDateRange;
    }
    
    return matchesRoom && matchesStatus;
  });

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>
        <DollarOutlined /> 结账管理
      </Title>
      
      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 20 }}>
        <Space size="large" wrap>
          <div>
            <Text strong style={{ marginRight: 8 }}>房号搜索:</Text>
            <Space.Compact> 
                <Input
                placeholder="输入房号"
                style={{ width: 160 }}
                onChange={(e) => setSearchParams(prev => ({ ...prev, roomNumber: e.target.value }))}
                onPressEnter={() => handleSearch(searchParams.roomNumber)}
                />
                <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={() => handleSearch(searchParams.roomNumber)}
                >
                搜索
                </Button>
            </Space.Compact>
          </div>
          
          <div>
            <Text strong style={{ marginRight: 8 }}>状态筛选:</Text>
            <Select 
              defaultValue="all" 
              style={{ width: 120 }}
              onChange={handleStatusChange}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">待结账</Option>
              <Option value="completed">已结账</Option>
            </Select>
          </div>
          
          <div>
            <Text strong style={{ marginRight: 8 }}>离店日期:</Text>
            <RangePicker 
              value={searchParams.dateRange}
              onChange={handleDateChange}
            />
          </div>
          
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={exportReport}
          >
            导出报表
          </Button>
        </Space>
      </Card>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日结账数量"
              value={filteredData.filter(item => item.status === 'completed').length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日总收入"
              value={filteredData
                .filter(item => item.status === 'completed')
                .reduce((sum, item) => sum + item.finalAmount, 0)}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待结账数量"
              value={filteredData.filter(item => item.status === 'pending').length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="空调收入占比"
              value={(
                filteredData
                  .filter(item => item.status === 'completed')
                  .reduce((sum, item) => sum + item.acUsageFee, 0) /
                filteredData
                  .filter(item => item.status === 'completed')
                  .reduce((sum, item) => sum + item.finalAmount, 0) * 100
              ).toFixed(1)}
              suffix="%"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 结账列表 */}
      <Card 
        title="结账记录"
        extra={
          <Text strong>
            共 {filteredData.length} 条记录
          </Text>
        }
      >
        <Table 
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title={`结账详情 - 房间 ${selectedRecord?.roomNumber}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="print" icon={<PrinterOutlined />}>
            打印账单
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {selectedRecord && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="客户姓名">{selectedRecord.customerName}</Descriptions.Item>
            <Descriptions.Item label="身份证号">{selectedRecord.idNumber}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{selectedRecord.phone}</Descriptions.Item>
            <Descriptions.Item label="房型">{selectedRecord.roomType}</Descriptions.Item>
            <Descriptions.Item label="入住日期">{selectedRecord.checkInDate}</Descriptions.Item>
            <Descriptions.Item label="离店日期">{selectedRecord.checkOutDate}</Descriptions.Item>
            <Descriptions.Item label="住宿费">¥{selectedRecord.accommodationFee}</Descriptions.Item>
            <Descriptions.Item label="空调使用费">¥{selectedRecord.acUsageFee}</Descriptions.Item>
            <Descriptions.Item label="押金">¥{selectedRecord.deposit}</Descriptions.Item>
            <Descriptions.Item label="总费用">¥{selectedRecord.totalFee}</Descriptions.Item>
            <Descriptions.Item label="应付金额" span={2}>
              <Text strong style={{ fontSize: '1.2em', color: '#ff4d4f' }}>
                ¥{selectedRecord.finalAmount}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="支付状态">
              <Tag color={selectedRecord.status === 'completed' ? 'green' : 'orange'}>
                {selectedRecord.status === 'completed' ? '已结账' : '待结账'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="支付方式">
              {selectedRecord.paymentMethod ? 
                (selectedRecord.paymentMethod === 'alipay' ? '支付宝' : 
                 selectedRecord.paymentMethod === 'wechat' ? '微信' : '现金') : 
                '-'}
            </Descriptions.Item>
            {selectedRecord.checkOutTime && (
              <Descriptions.Item label="结账时间" span={2}>
                {selectedRecord.checkOutTime}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AdminCheckOut;