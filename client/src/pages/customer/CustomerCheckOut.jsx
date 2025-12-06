import React, { useState, useEffect } from 'react';
import { Form, Button, Table, Card, Typography, Space, message, Descriptions, Divider, Statistic, Row, Col} from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, DollarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const CustomerCheckOut = () => {
  const [form] = Form.useForm();
  const [billData, setBillData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');

  // 模拟结账数据
  useEffect(() => {
    setTimeout(() => {
      setBillData({
        roomNumber: '105',
        roomType: '标准间',
        checkInDate: '2024-05-01',
        checkOutDate: '2024-05-03',
        actualDays: 2,
        accommodationFee: 300,
        acUsageFee: 45.5,
        deposit: 300,
        depositRefund: 300,
        totalFee: 345.5,
        finalAmount: 45.5, // 总费用 - 押金
        acUsageDetails: [
          { id: 1, time: '2024-05-01 14:00-15:30', duration: '1小时30分', fanSpeed: '中', fee: 12.5 },
          { id: 2, time: '2024-05-01 16:00-18:00', duration: '2小时', fanSpeed: '高', fee: 20 },
          { id: 3, time: '2024-05-02 09:00-12:00', duration: '3小时', fanSpeed: '低', fee: 13 },
          { id: 4, time: '2024-05-02 15:00-17:00', duration: '2小时', fanSpeed: '中', fee: 10 },
        ]
      });
    }, 800);
  }, []);

  const onFinish = (values) => {
    if (!paymentMethod) {
      message.error('请选择支付方式');
      return;
    }

    setIsLoading(true);
    
    // 模拟结账提交
    setTimeout(() => {
      message.success(`结账成功！${paymentMethod}支付¥${billData.finalAmount}，感谢您的入住！`);
      setIsLoading(false);
      // 在实际应用中这里可以跳转到首页或其他页面
    }, 1500);
  };

  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method);
  };

  const columns = [
    {
      title: '时间段',
      dataIndex: 'time',
      key: 'time',
      width: 200,
    },
    {
      title: '使用时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
    },
    {
      title: '风速',
      dataIndex: 'fanSpeed',
      key: 'fanSpeed',
      width: 80,
      render: (speed) => (
        <span style={{ 
          color: speed === '高' ? '#ff4d4f' : speed === '中' ? '#faad14' : '#52c41a',
          fontWeight: 'bold'
        }}>
          {speed}
        </span>
      ),
    },
    {
      title: '费用',
      dataIndex: 'fee',
      key: 'fee',
      width: 100,
      render: (fee) => (
        <Text strong style={{ color: '#ff4d4f' }}>¥{fee}</Text>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 30, color: '#1890ff' }}>
        <DollarOutlined /> 酒店结账
      </Title>
      
      {billData ? (
        <Card>
          {/* 基本信息 */}
          <Descriptions 
            title="住宿信息" 
            bordered 
            column={2}
            style={{ marginBottom: 24 }}
          >
            <Descriptions.Item label="房号">{billData.roomNumber}</Descriptions.Item>
            <Descriptions.Item label="房型">{billData.roomType}</Descriptions.Item>
            <Descriptions.Item label="入住日期">{billData.checkInDate}</Descriptions.Item>
            <Descriptions.Item label="离店日期">{billData.checkOutDate}</Descriptions.Item>
            <Descriptions.Item label="实际住宿天数" span={2}>
              {billData.actualDays} 天
            </Descriptions.Item>
          </Descriptions>

          {/* 费用统计 */}
          <div style={{ marginBottom: 24 }}>
            <Title level={4}>费用明细</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="住宿费"
                    value={billData.accommodationFee}
                    prefix="¥"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="空调使用费"
                    value={billData.acUsageFee}
                    prefix="¥"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="押金退还"
                    value={billData.depositRefund}
                    prefix="¥"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>
          </div>

          {/* 总费用 */}
          <div style={{ 
            background: '#f6ffed', 
            padding: 16, 
            borderRadius: 8, 
            marginBottom: 24,
            border: '1px solid #b7eb8f'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong style={{ fontSize: '1.1em' }}>应付金额:</Text>
                <div style={{ fontSize: '0.9em', color: '#595959' }}>
                  (总费用 ¥{billData.totalFee} - 押金退还 ¥{billData.depositRefund})
                </div>
              </div>
              <Text strong style={{ fontSize: '2em', color: '#ff4d4f' }}>
                ¥{billData.finalAmount}
              </Text>
            </div>
          </div>
          
          {/* 空调使用明细 */}
          <div style={{ marginBottom: 24 }}>
            <Button 
              type="link" 
              onClick={() => setShowDetail(!showDetail)}
              icon={<InfoCircleOutlined />}
              style={{ padding: 0, fontSize: '1em' }}
            >
              {showDetail ? '隐藏' : '显示'}空调使用明细
            </Button>
            
            {showDetail && (
              <Table 
                dataSource={billData.acUsageDetails} 
                columns={columns} 
                pagination={false}
                rowKey="id"
                style={{ marginTop: 16 }}
                summary={() => (
                  <Table.Summary>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}>
                        <Text strong>合计</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>
                        <Text strong style={{ color: '#ff4d4f' }}>¥{billData.acUsageFee}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            )}
          </div>
          
          <Divider />
          
          {/* 支付方式 */}
          <Form form={form} onFinish={onFinish}>
            <Form.Item
              label={<Text strong style={{ fontSize: '1.1em' }}>选择支付方式</Text>}
              style={{ marginBottom: 24 }}
            >
              <Space size="middle" style={{ marginTop: 8 }}>
                <Button
                  type={paymentMethod === 'alipay' ? 'primary' : 'default'}
                  size="large"
                  style={{ 
                    width: 120,
                    background: paymentMethod === 'alipay' ? '#1677ff' : '#f0f0f0',
                    borderColor: paymentMethod === 'alipay' ? '#1677ff' : '#d9d9d9'
                  }}
                  onClick={() => handlePaymentMethodSelect('alipay')}
                >
                  支付宝
                </Button>
                <Button
                  type={paymentMethod === 'wechat' ? 'primary' : 'default'}
                  size="large"
                  style={{ 
                    width: 120,
                    background: paymentMethod === 'wechat' ? '#52c41a' : '#f0f0f0',
                    borderColor: paymentMethod === 'wechat' ? '#52c41a' : '#d9d9d9'
                  }}
                  onClick={() => handlePaymentMethodSelect('wechat')}
                >
                  微信
                </Button>
                <Button
                  type={paymentMethod === 'cash' ? 'primary' : 'default'}
                  size="large"
                  style={{ width: 120 }}
                  onClick={() => handlePaymentMethodSelect('cash')}
                >
                  现金
                </Button>
              </Space>
            </Form.Item>
            
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={isLoading} 
                block
                size="large"
                style={{ height: 50, fontSize: '1.1rem' }}
                disabled={!paymentMethod}
              >
                <CheckCircleOutlined /> 确认结账支付
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Text type="secondary">正在加载结账信息...</Text>
        </div>
      )}
    </div>
  );
};

export default CustomerCheckOut;