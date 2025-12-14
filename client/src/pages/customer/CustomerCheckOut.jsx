import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Table, Card, Typography, Space, message, Descriptions, Divider, Statistic, Row, Col, Input} from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, DollarOutlined, SearchOutlined,PrinterOutlined,ReloadOutlined } from '@ant-design/icons';
import { checkOutAPI } from '../../api/http.js';
import { useNavigate } from 'react-router-dom';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const { Title, Text } = Typography;

const CustomerCheckOut = () => {
  const [form] = Form.useForm();
  const [billData, setBillData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const navigate = useNavigate();
  const billRef = useRef(null);

  // 从URL参数或localStorage获取房间号
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomNoFromUrl = urlParams.get('roomNo');
    const roomNoFromStorage = localStorage.getItem('currentRoomNo');
    const room = roomNoFromUrl || roomNoFromStorage || '';
    
    if (room) {
      setRoomNo(room);
      loadBillData(room);
    }
  }, []);

  const loadBillData = async (room) => {
    if (!room) {
      setBillData(false); 
      setIsLoadingBill(false);
      return;
    }
    
    setIsLoadingBill(true);
    setBillData(null); // 在开始加载前清空数据
    
    try {
        const res = await checkOutAPI.getActiveRecordByRoomNo(room);
        
        if (res.success && res.data) {
            setBillData(res.data);
            // 成功加载后，将房间号存入 localStorage 以备后用
            localStorage.setItem('currentRoomNo', room); 
        } else {
            // 后端返回 success: false (例如：未找到在住记录)
            message.warning(res.message || `未找到房间 ${room} 的在住记录或已退房。`);
            setBillData(false); // **关键：设置成非 null 的值，表示加载结束但数据为空**
        }
    } catch (error) {
        // 网络请求失败
        message.error('网络请求失败：' + error.message);
        setBillData(false); // **关键：设置成非 null 的值，表示加载结束但失败**
    } finally {
        setIsLoadingBill(false);
    }
  };

  const handleSearch = () => {
    if (!roomNo.trim()) {
      message.warning('请输入房间号');
      return;
    }
    loadBillData(roomNo.trim());
  };

  const onFinish = async (values) => {
    if (!paymentMethod) {
      message.error('请选择支付方式');
      return;
    }

    if (!billData || !billData.recordId) {
      message.error('账单数据异常，请重新加载');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await checkOutAPI.processCheckOut(billData.recordId, paymentMethod);
      if (response.success) {
        const paymentMethodText = paymentMethod === 'alipay' ? '支付宝' : 
                                  paymentMethod === 'wechat' ? '微信' : '现金';
        message.success(`结账成功！${paymentMethodText}支付¥${(parseFloat(billData.finalAmount) || 0).toFixed(2)}，感谢您的入住！`);
        
        // 清除房间号缓存
        localStorage.removeItem('currentRoomNo');
        
        // 延迟跳转到首页
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error) {
      console.error('结账失败:', error);
      message.error(error.message || '结账失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method);
  };

  const handlePrint = async () => {
    const input = billRef.current;
    if (!input) {
      message.error('无法找到账单内容区域');
      return;
    }

    setIsPrinting(true);
    message.loading({ content: '正在生成 PDF 文件...', key: 'pdfGen' });

    // 确保明细是展开的，否则截图将不包含明细
    // 注意：这里的处理方式需要根据您的实际需求调整，如果不需要详单，可以跳过。
    // 为了满足“账单和空调详单文件”的要求，我们默认展开。
    const detailWasHidden = !showDetail;
    if (detailWasHidden) {
      setShowDetail(true);
      // 给 DOM 渲染留出时间，否则截图会缺失内容
      await new Promise(resolve => setTimeout(resolve, 50)); 
    }

    try {
      const canvas = await html2canvas(input, {
        scale: 2, // 提高截图清晰度
        logging: true,
        useCORS: true, // 如果图片来自外部，需要设置
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps= pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const fileName = `房间${billData.roomNumber}_结账账单_${billData.checkOutDate}.pdf`;
      pdf.save(fileName);
      
      message.success({ content: `PDF 文件 ${fileName} 生成成功！`, key: 'pdfGen', duration: 3 });

    } catch (error) {
      console.error('生成 PDF 失败:', error);
      message.error({ content: '生成 PDF 失败，请重试', key: 'pdfGen' });
    } finally {
      setIsPrinting(false);
      // 如果之前是隐藏的，打印完后恢复隐藏状态
      if (detailWasHidden) {
        setShowDetail(false); 
      }
    }
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
      render: (fee) => {
        const feeValue = parseFloat(fee) || 0;
        return (
          <Text strong style={{ color: '#ff4d4f' }}>¥{feeValue.toFixed(2)}</Text>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 30, color: '#1890ff' }}>
        <DollarOutlined /> 酒店结账
      </Title>
      
      <div style={{ textAlign: 'right', marginBottom: 10 }}>
        <Button
          type="default"
          onClick={() => loadBillData(roomNo)}
          icon={<ReloadOutlined />}
        >
          刷新账单
        </Button>
      </div>

      {/* 房间号输入 */}
      {!billData && (
        <Card style={{ marginBottom: 20 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="请输入房间号"
              size="large"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
              onPressEnter={handleSearch}
              style={{ flex: 1 }}
            />
            <Button 
              type="primary" 
              size="large"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={isLoadingBill}
            >
              查询账单
            </Button>
          </Space.Compact>
        </Card>
      )}
      
      {isLoadingBill ? (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Text type="secondary">正在加载账单信息...</Text>
        </div>
      ) : billData ? (
        <Card>
          {/* **新增：打印按钮** */}
          <div style={{ textAlign: 'right', marginBottom: 10 }}>
              <Button 
                  icon={<PrinterOutlined />} 
                  onClick={handlePrint} 
                  loading={isPrinting}
              >
                  打印账单/详单 (PDF)
              </Button>
          </div>
          
          {/* **重要：用 ref 包裹需要打印的整个区域** */}
          <div ref={billRef}> 
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
                      value={(parseFloat(billData.accommodationFee) || 0).toFixed(2)}
                      prefix="¥"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="空调使用费"
                      value={(parseFloat(billData.acUsageFee) || 0).toFixed(2)}
                      prefix="¥"
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title={(parseFloat(billData.depositRefund) || 0) > 0 ? "押金退还" : "押金"}
                      value={(parseFloat(billData.depositRefund) || 0) > 0 ? (parseFloat(billData.depositRefund) || 0).toFixed(2) : (parseFloat(billData.deposit) || 0).toFixed(2)}
                      prefix="¥"
                      valueStyle={{ color: (parseFloat(billData.depositRefund) || 0) > 0 ? '#52c41a' : '#595959' }}
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
                    (总费用 ¥{(parseFloat(billData.totalFee) || 0).toFixed(2)} - 押金 ¥{(parseFloat(billData.deposit) || 0).toFixed(2)})
                    {(parseFloat(billData.depositRefund) || 0) > 0 && (
                      <span style={{ color: '#52c41a', marginLeft: 8 }}>
                        (退还押金 ¥{(parseFloat(billData.depositRefund) || 0).toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
                <Text strong style={{ fontSize: '2em', color: '#ff4d4f' }}>
                  ¥{(parseFloat(billData.finalAmount) || 0).toFixed(2)}
                </Text>
              </div>
            </div>
            
            {/* 空调使用明细 - 打印时默认展开 */}
            <div style={{ marginBottom: 24 }}>
              <Button 
                type="link" 
                onClick={() => setShowDetail(!showDetail)}
                icon={<InfoCircleOutlined />}
                style={{ padding: 0, fontSize: '1em' }}
              >
                {showDetail ? '隐藏' : '显示'}空调使用明细
              </Button>
              
              {/* 当 showDetail 为 true 时，Table 会被渲染 */}
              {showDetail && (
                <Table 
                  dataSource={billData.acUsageDetails} 
                  columns={columns} 
                  pagination={false}
                  rowKey="id"
                  style={{ marginTop: 16 }}
                  title={() => <Text strong>空调使用详单</Text>} 
                  summary={() => (
                    <Table.Summary>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Text strong>合计</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                          <Text strong style={{ color: '#ff4d4f' }}>¥{(parseFloat(billData.acUsageFee) || 0).toFixed(2)}</Text> 
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              )}
            </div>
            <Divider style={{ margin: '8px 0' }} /> 
          </div> 
          {/* **ref 区域结束** */}


          {/* 支付方式 - 结账功能不受打印影响 */}
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
          <Text type="secondary">未找到房间 {roomNo || '（请查询）'} 的在住记录或已退房。</Text>
        </div>
      )}
    </div>
  );
};

export default CustomerCheckOut;