import React, { useState } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  message, 
  Row, 
  Col, 
  Card, 
  DatePicker, 
  Select, 
  Modal, 
  Descriptions, 
  Typography 
} from 'antd';
import { CheckCircleOutlined, IdcardOutlined, UserOutlined, PrinterOutlined } from '@ant-design/icons';
import moment from 'moment';
import { checkInAPI } from '../../api/http.js';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text: AntdText } = Typography; 

const CustomerCheckIn = () => {
  const [form] = Form.useForm();
  const [roomInfo, setRoomInfo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [roomCardInfo, setRoomCardInfo] = useState(null);
  const [showRoomCard, setShowRoomCard] = useState(false);

  const onFinish = async (values) => {
    setIsProcessing(true);
    
    try {
      const { dateRange, roomType, name, idNumber, phone, gender } = values;
      
      const checkInDate = dateRange[0];
      const checkOutDate = dateRange[1];
      const days = checkOutDate.diff(checkInDate, 'days');
      
      // 调用后端API
      const response = await checkInAPI.processCheckIn({
      name,
      idNumber,
      phone,
      gender: gender || 'M',
      roomType: roomType, 
      checkInDate: checkInDate.toISOString(),
      checkOutDate: checkOutDate.toISOString(),
      depositAmount: values.depositAmount || 300,
    });
      
      if (response.success && response.data) {
        const data = response.data;
        setRoomInfo({
        recordId: data.recordId,
        roomNumber: data.roomNumber,
        roomType: data.roomType, 
        pricePerNight: data.roomFee / days,
        checkInDate: moment(data.checkInDate).format('YYYY-MM-DD'),
        checkOutDate: moment(data.checkOutDate).format('YYYY-MM-DD'),
        days,
        accommodationFee: data.roomFee,
        deposit: data.deposit,
        totalAmount: data.totalAmount
      });
        
        message.success('入住登记成功！');
      }
    } catch (error) {
      console.error('入住失败:', error);
      message.error(error.message || '入住登记失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 获取房卡
  const handleGetRoomCard = async () => {
    if (!roomInfo || !roomInfo.recordId) {
      message.warning('请先完成入住登记');
      return;
    }
    
    try {
      const response = await checkInAPI.getRoomCard(roomInfo.recordId);
      if (response.success && response.data) {
        setRoomCardInfo(response.data);
        setShowRoomCard(true);
        message.success('房卡信息已生成');
      }
    } catch (error) {
      console.error('获取房卡失败:', error);
      message.error(error.message || '获取房卡失败');
    }
  };

  // 打印房卡
  const handlePrintRoomCard = () => {
    if (!roomCardInfo) return;
    
    const printContent = `
      <html>
        <head>
          <title>房卡 - ${roomCardInfo.roomNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .card-container { width: 350px; border: 2px solid #1890ff; border-radius: 12px; padding: 20px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .card-header { text-align: center; margin-bottom: 20px; }
            .card-header h1 { margin: 0; font-size: 24px; }
            .card-header h2 { margin: 5px 0; font-size: 18px; opacity: 0.9; }
            .card-body { background: white; color: #333; padding: 20px; border-radius: 8px; }
            .card-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; }
            .card-label { font-weight: bold; color: #666; }
            .card-value { color: #333; font-size: 16px; }
            .room-number { text-align: center; font-size: 48px; font-weight: bold; color: #1890ff; margin: 20px 0; }
            .card-number { text-align: center; font-size: 14px; color: #999; margin-top: 10px; }
            .instructions { margin-top: 20px; padding-top: 15px; border-top: 2px solid #f0f0f0; }
            .instructions h4 { margin: 0 0 10px 0; color: #666; }
            .instructions ul { margin: 0; padding-left: 20px; color: #666; font-size: 12px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="card-container">
            <div class="card-header">
              <h1>${roomCardInfo.hotelName}</h1>
              <h2>房卡</h2>
            </div>
            <div class="card-body">
              <div class="room-number">${roomCardInfo.roomNumber}</div>
              <div class="card-row">
                <span class="card-label">客人姓名：</span>
                <span class="card-value">${roomCardInfo.guestName}</span>
              </div>
              <div class="card-row">
                <span class="card-label">房型：</span>
                <span class="card-value">${roomCardInfo.roomType}</span>
              </div>
              <div class="card-row">
                <span class="card-label">入住日期：</span>
                <span class="card-value">${moment(roomCardInfo.checkInDate).format('YYYY-MM-DD')}</span>
              </div>
              <div class="card-row">
                <span class="card-label">离店日期：</span>
                <span class="card-value">${roomCardInfo.checkOutDate ? moment(roomCardInfo.checkOutDate).format('YYYY-MM-DD') : '-'}</span>
              </div>
              <div class="card-row">
                <span class="card-label">有效期至：</span>
                <span class="card-value">${moment(roomCardInfo.validUntil).format('YYYY-MM-DD HH:mm')}</span>
              </div>
              <div class="card-number">房卡号：${roomCardInfo.cardNumber}</div>
              <div class="instructions">
                <h4>使用说明：</h4>
                <ul>
                  ${roomCardInfo.instructions.map(inst => `<li>${inst}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // 验证身份证号
  const validateIdCard = (_, value) => {
    if (!value) {
      return Promise.reject(new Error('请输入身份证号'));
    }
    const idCardReg = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    if (!idCardReg.test(value)) {
      return Promise.reject(new Error('身份证号格式不正确'));
    }
    return Promise.resolve();
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 30, color: '#1890ff' }}>
        <UserOutlined /> 顾客入住登记
      </h2>
      
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            roomType: 'standard'
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="姓名"
                name="name"
                rules={[{ required: true, message: '请输入姓名!' }]}
              >
                <Input 
                  placeholder="请输入姓名" 
                  prefix={<UserOutlined />}
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="身份证号"
                name="idNumber"
                rules={[{ validator: validateIdCard }]}
              >
                <Input 
                  placeholder="请输入身份证号" 
                  prefix={<IdcardOutlined />}
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="联系电话"
                name="phone"
                rules={[
                  { required: true, message: '请输入联系电话!' },
                  { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
                ]}
              >
                <Input placeholder="请输入手机号码" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="性别"
                name="gender"
              >
                <Select size="large">
                  <Option value="M">男</Option>
                  <Option value="F">女</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="roomType" label="选择房型" rules={[{ required: true, message: '请选择房型' }]}>
                <Select placeholder="请选择房型">
                  <Option value="标准间">标准间</Option>
                  <Option value="豪华间">豪华间</Option>
                  <Option value="商务间">商务间</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            label="入住日期"
            name="dateRange"
            rules={[{ required: true, message: '请选择入住日期!' }]}
          >
            <RangePicker 
              style={{ width: '100%' }}
              size="large"
              disabledDate={(current) => current && current < moment().startOf('day')}
              presents={{
                '今天': [moment(), moment()],
                '本周': [moment().startOf('week'), moment().endOf('week')],
              }}
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={isProcessing} 
              block
              size="large"
              style={{ height: 50, fontSize: '1.1rem' }}
            >
              <CheckCircleOutlined /> 提交入住申请
            </Button>
          </Form.Item>
        </Form>
        
        {roomInfo && (
          <div style={{ 
            marginTop: 30, 
            padding: 24, 
            backgroundColor: '#f6ffed', 
            borderRadius: 12,
            border: '1px solid #b7eb8f'
          }}>
            <h3 style={{ color: '#52c41a', textAlign: 'center', marginBottom: 20 }}>
              <CheckCircleOutlined /> 入住成功！
            </h3>
            
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#595959' }}>房号</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {roomInfo.roomNumber}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#595959' }}>房型</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold' }}>{roomInfo.roomType}</div>
                </div>
              </Col>
            </Row>
            
            <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>住宿费用:</span>
                <span>¥{roomInfo.pricePerNight} × {roomInfo.days}晚 = ¥{roomInfo.accommodationFee}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>押金:</span>
                <span>¥{roomInfo.deposit} (可退)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                <span>总计:</span>
                <span style={{ color: '#ff4d4f', fontSize: '1.1em' }}>¥{roomInfo.totalAmount}</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <Button 
                type="primary" 
                style={{ marginRight: 12 }} 
                size="large"
                onClick={handleGetRoomCard}
              >
                获取房卡
              </Button>
              <Button type="default" size="large">
                查看空调使用说明
              </Button>
            </div>
            
            <div style={{ marginTop: 16, padding: 12, background: '#e6f7ff', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#1890ff', textAlign: 'center' }}>
                入住时间: {roomInfo.checkInDate} 14:00 | 离店时间: {roomInfo.checkOutDate} 12:00
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 房卡模态框 */}
      <Modal
        title="房卡信息"
        open={showRoomCard}
        onCancel={() => setShowRoomCard(false)}
        footer={[
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrintRoomCard}>
            打印房卡
          </Button>,
          <Button key="close" onClick={() => setShowRoomCard(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {roomCardInfo && (
          <div>
            <Card 
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                marginBottom: 20
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h2 style={{ color: 'white', margin: 0 }}>{roomCardInfo.hotelName}</h2>
                <div style={{ fontSize: 48, fontWeight: 'bold', color: 'white', margin: '20px 0' }}>
                  {roomCardInfo.roomNumber}
                </div>
                <div style={{ fontSize: 14, opacity: 0.9 }}>房卡</div>
              </div>
            </Card>

            <Descriptions bordered column={1}>
              <Descriptions.Item label="房卡号">
                {/* 🚀 修改点 2: 替换 Text 为 AntdText */}
                <AntdText strong style={{ fontSize: '1.1em', color: '#1890ff' }}>
                  {roomCardInfo.cardNumber}
                </AntdText>
              </Descriptions.Item>
              <Descriptions.Item label="客人姓名">{roomCardInfo.guestName}</Descriptions.Item>
              <Descriptions.Item label="房型">{roomCardInfo.roomType}</Descriptions.Item>
              <Descriptions.Item label="入住日期">
                {moment(roomCardInfo.checkInDate).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="离店日期">
                {roomCardInfo.checkOutDate ? moment(roomCardInfo.checkOutDate).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="有效期至">
                {moment(roomCardInfo.validUntil).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Card title="使用说明" style={{ marginTop: 20 }}>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {roomCardInfo.instructions.map((inst, index) => (
                  <li key={index} style={{ marginBottom: 8 }}>{inst}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomerCheckIn;