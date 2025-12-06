import React, { useState } from 'react';
import { Form, Input, Button, message, Row, Col, Card, DatePicker, InputNumber, Select } from 'antd';
import { CheckCircleOutlined, IdcardOutlined, UserOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Option } = Select;
const { RangePicker } = DatePicker;

const CustomerCheckIn = () => {
  const [form] = Form.useForm();
  const [roomInfo, setRoomInfo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onFinish = (values) => {
    setIsProcessing(true);
    
    // 模拟API调用
    setTimeout(() => {
      // 模拟随机分配房间
      const roomNumber = `10${Math.floor(Math.random() * 20) + 1}`;
      const { dateRange, roomType } = values;
      
      // 计算住宿天数
      const checkInDate = dateRange[0];
      const checkOutDate = dateRange[1];
      const days = checkOutDate.diff(checkInDate, 'days');
      
      // 根据房型计算价格
      const pricePerNight = roomType === 'standard' ? 150 : 200;
      const accommodationFee = days * pricePerNight;
      const deposit = 300; // 固定押金

      setRoomInfo({
        roomNumber,
        roomType: roomType === 'standard' ? '标准间' : '大床房',
        pricePerNight,
        checkInDate: checkInDate.format('YYYY-MM-DD'),
        checkOutDate: checkOutDate.format('YYYY-MM-DD'),
        days,
        accommodationFee,
        deposit,
        totalAmount: accommodationFee + deposit
      });
      
      message.success('入住登记成功！');
      setIsProcessing(false);
    }, 1500);
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
                label="房型选择"
                name="roomType"
                rules={[{ required: true, message: '请选择房型!' }]}
              >
                <Select size="large">
                  <Option value="standard">标准间 - ¥150/晚</Option>
                  <Option value="double">大床房 - ¥200/晚</Option>
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
              <Button type="primary" style={{ marginRight: 12 }} size="large">
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
    </div>
  );
};

export default CustomerCheckIn;