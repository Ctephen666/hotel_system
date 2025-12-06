import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Typography, Row, Col, Progress, Tag, Space, Statistic, Alert, message } from 'antd';
import { 
  ThunderboltOutlined, 
  SettingOutlined,
  PoweroffOutlined
} from '@ant-design/icons';
import '../../assets/icons/iconfonts.css';

const { Title, Text } = Typography;

const roomId = 105; // 房间号，每个房间不同

const ACControl = () => {
  // 温控状态
  const [currentTemp, setCurrentTemp] = useState(26);
  const [targetTemp, setTargetTemp] = useState(24);
  const [fanSpeed, setFanSpeed] = useState('中');
  const [mode, setMode] = useState('cool');

  // 空调开关与暂停状态
  const [isOn, setIsOn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // UI 状态：待调度 / 运行中 / 暂停中
  const [uiStatus, setUiStatus] = useState('待调度');

  // WebSocket
  const [ws, setWs] = useState(null);

  // 温度变化率配置
  const tempChangeRateConfig = { '低': 0.4, '中': 0.5, '高': 0.6 };
  
  // 耗电速率配置（度/秒）
  const powerConsumptionRateConfig = { 
    '低': 1 / (3 * 60),  // 低风：1度/3分钟 = 1/(3*60) 度/秒
    '中': 1 / (2 * 60),  // 中风：1度/2分钟 = 1/(2*60) 度/秒
    '高': 1 / (1 * 60)   // 高风：1度/1分钟 = 1/(1*60) 度/秒
  };

  // 计费
  const [usageFee, setUsageFee] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [powerConsumed, setPowerConsumed] = useState(0); 

  // 初始化 WebSocket
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080/ws');
    setWs(socket);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'REGISTER_ROOM', roomId }));
      console.log('房间连接已建立');
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      console.log('房间收到消息:', data);

      // 处理所有消息类型
      switch(data.type){
        case 'AC_POWER_ON':  // 服务器发送的开启消息
          setIsOn(true);
          setIsPaused(false);
          setUiStatus('运行中');
          message.success('中央空调已为本房开启送风');
          console.log('空调已开启');
          break;
          
        case 'AC_POWER_OFF':  // 服务器发送的关闭消息
          setIsOn(false);
          setIsPaused(false);
          setUiStatus('待调度');
          message.info('中央空调已停止本房送风');
          console.log('空调已关闭');
          break;
          
        case 'ADMIN_START': 
          setIsOn(true);
          setIsPaused(false);
          setUiStatus('运行中');
          message.success('中央空调已为本房开启送风');
          break;
          
        case 'ADMIN_STOP': 
          setIsOn(false);
          setIsPaused(false);
          setUiStatus('待调度');
          message.info('中央空调已停止本房送风');
          break;
          
        default:
          break;
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      message.error('连接服务器失败');
    };

    socket.onclose = () => {
      console.log('房间连接已关闭');
    };

    return () => {
      if (socket) socket.close();
    };
  }, []);

  // 发送请求给前台调度
  const sendToDispatcher = (type, payload={}) => {
    if(ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, roomId, payload }));
      console.log('发送消息:', { type, roomId, payload });
    } else {
      message.error('未连接到服务器');
    }
  };

  // 用户点击"开启空调" -> 发送调度请求
  const handlePowerToggle = () => {
    if(isOn){
      sendToDispatcher('STOP_REQUEST');
      setUiStatus('待调度');
      message.info('已发送停止请求');
    } else {
      sendToDispatcher('REQUEST_AIR', { 
        mode, 
        targetTemp,
        fanSpeed: fanSpeed === '低' ? 'low' : fanSpeed === '中' ? 'medium' : 'high'
      });
      message.info('已向前台提交送风申请，请等待调度批准');
      setUiStatus('等待批准');
    }
  };

  // 风速控制
  const handleFanSpeedChange = (speed) => {
    setFanSpeed(speed);
    message.info(`风速已调整为${speed}风`);
    // 如果空调已开启且未暂停，重新发送调度请求更新风速参数
    if (isOn && !isPaused) {
      sendToDispatcher('REQUEST_AIR', { 
        mode, 
        targetTemp,
        fanSpeed: speed === '低' ? 'low' : speed === '中' ? 'medium' : 'high' // 使用新的风速
      });
      message.info('已发送新的风速调度请求');
    }
    // 【新增结束】
  };

  // 模式切换
  const handleModeChange = (newMode) => {
    setMode(newMode);
    // 修正了原代码中制冷制热目标温度相同的问题，这里使用24/25作为默认值
    const newTargetTemp = newMode === 'cool' ? 24 : 25; 
    setTargetTemp(newTargetTemp);
    message.info(`模式已切换为${newMode==='cool'?'制冷':'制热'}`);
    // 如果空调已开启且未暂停，重新发送调度请求更新模式和目标温度
    if (isOn && !isPaused) {
      sendToDispatcher('REQUEST_AIR', { 
        mode: newMode, 
        targetTemp: newTargetTemp,
        fanSpeed: fanSpeed === '低' ? 'low' : fanSpeed === '中' ? 'medium' : 'high'
      });
      message.info('已发送新的模式调度请求');
    }

  };

  // 温度调节
  const handleTempChange = (direction) => { 
    const newTemp = direction === 'up' 
      ? Math.min(targetTemp + 1, mode === 'cool' ? 25 : 30)
      : Math.max(targetTemp - 1, mode === 'cool' ? 18 : 25);  
    setTargetTemp(newTemp);
  };
  

  useEffect(() => {
    // 只有在空调开启时处理
    if (isOn) {
        const payload = { 
            mode, 
            targetTemp, 
            fanSpeed: fanSpeed === '低' ? 'low' : fanSpeed === '中' ? 'medium' : 'high'
        };
        
        // 如果空调在运行中（未暂停），则向服务器发送新参数
        if (!isPaused) {
            sendToDispatcher('REQUEST_AIR', payload);
            message.info(`目标温度已调整为${targetTemp}°C,已发送新的调度请求`);
        } 
        // 如果空调已暂停，修改目标温度后，系统会继续回温，直到满足重启条件（由定时器处理）
        else {
            message.info(`目标温度已调整为${targetTemp}°C,当前处于暂停/回温状态`);
        }
    }
    // 当 targetTemp 或其他关键运行参数改变时触发
  }, [targetTemp, isOn, isPaused, mode, fanSpeed]); 


  // ***** 统一的温度模拟、计费与自然回温逻辑  *****
  useEffect(() => {
      let timer;
      const ambientTemp = 26.0; // 默认环境温度/初始温度
      const recoveryRate = 0.5 / 60; // 回温速率：每分钟0.5度
      
      // 统一的定时器逻辑：无论开关/暂停状态，每秒都运行一次
      timer = setInterval(() => {
          // 在计算新的状态之前，先获取当前的状态
          let nextCurrentTemp = currentTemp;
          let nextIsPaused = isPaused;
          let nextPowerConsumed = powerConsumed;
          let nextUsageFee = usageFee;
          let nextTimeElapsed = timeElapsed;

          // 使用函数式更新来确保状态基于最新值
          setCurrentTemp(prev => {
              let newTemp = prev;

              // --- 1. 温度变化：运行中 (isOn=true, isPaused=false) ---
              if (isOn && !isPaused) {
                  const rate = tempChangeRateConfig[fanSpeed] / 60; // 转换为每秒变化率
                  newTemp = mode === 'cool' ? prev - rate : prev + rate;

                  // 达到目标自动暂停
                  if ((mode === 'cool' && newTemp <= targetTemp) || (mode === 'heat' && newTemp >= targetTemp)) {
                      newTemp = targetTemp;
                      // 副作用：设置暂停状态并发送停止请求
                      nextIsPaused = true; // 标记下一个状态为暂停
                      setUiStatus('暂停中');
                      sendToDispatcher('STOP_REQUEST', { reason: 'reach_target' });
                  }
              } 
              // --- 2. 温度变化：关闭或暂停 (Natural Recovery / 回温) ---
              // 只要不在运行状态（isOn=false 或 isPaused=true），就执行回温
              else {
                  // 向环境温度靠拢
                  if (prev > ambientTemp) {
                      newTemp = Math.max(ambientTemp, prev - recoveryRate);
                  } else if (prev < ambientTemp) {
                      newTemp = Math.min(ambientTemp, prev + recoveryRate);
                  }
              }
              
              // --- 3. 自动重启检测 (仅在“开机且暂停”状态下检测) ---
              if ((isOn && nextIsPaused) || !isOn) { 
                // 检查是否超出容忍范围 (目标温度±1度)
                if ((mode === 'cool' && newTemp >= targetTemp + 1) || 
                    (mode === 'heat' && newTemp <= targetTemp - 1)) {
                    
                    // 副作用：触发重新申请
                    nextIsPaused = false; // 无论是重启还是开启，都不再是暂停状态
                    setUiStatus('等待批准');
                    sendToDispatcher('REQUEST_AIR', { 
                        mode, 
                        targetTemp, 
                        fanSpeed: fanSpeed === '低' ? 'low' : fanSpeed === '中' ? 'medium' : 'high'
                    });
                }
            }
              nextCurrentTemp = parseFloat(newTemp.toFixed(2));
              return nextCurrentTemp;
          });

          // --- 4. 计费逻辑 (仅在运行且未暂停时) ---
          if (isOn && !isPaused) {
              const powerRate = powerConsumptionRateConfig[fanSpeed]; // 度/秒
              nextPowerConsumed = parseFloat((powerConsumed + powerRate).toFixed(4));
              nextUsageFee = parseFloat((usageFee + powerRate).toFixed(4)); // 1元/度
              nextTimeElapsed = timeElapsed + 1;

              setPowerConsumed(nextPowerConsumed);
              setUsageFee(nextUsageFee);
              setTimeElapsed(nextTimeElapsed);
          }

          // 使用在函数外部计算得到的新状态来更新其他状态
          setIsPaused(nextIsPaused);
          
          // 向服务器上报实时状态
          if (ws && ws.readyState === WebSocket.OPEN) {
            // 确保上报最新的状态
            ws.send(JSON.stringify({
                type: 'ROOM_STATUS_UPDATE',
                roomId,
                payload: {
                    currentTemp: nextCurrentTemp,
                    targetTemp: targetTemp,
                    mode: mode,
                    fanSpeed: fanSpeed === '低' ? 'low' : fanSpeed === '中' ? 'medium' : 'high',
                    status: !isOn ? 'stopped' : (nextIsPaused ? 'paused' : 'running'), // 使用 nextIsPaused
                    powerConsumption: powerConsumed, // 上报当前的功耗
                    totalEnergy: nextPowerConsumed, // 假设 totalEnergy 为累计能耗
                    acUsageFee: nextUsageFee,
                    runningTime: Math.floor(nextTimeElapsed / 60) // 分钟
                }
            }));
        }
      }, 1000);

      return () => {
        if (timer) clearInterval(timer);
      };
  }, [isOn, isPaused, fanSpeed, mode, targetTemp, currentTemp, powerConsumed, usageFee, timeElapsed]); // 【修改】增加了所有依赖项，以确保定时器内部能访问到最新值

  const getCurrentTempChangeRate = () => {
    if(!isOn) return 0.5;
    if(isPaused) return 0;
    return tempChangeRateConfig[fanSpeed];
  };

  const getFanSpeedColor = (speed) => {
    switch(speed){
      case '低': return '#52c41a';
      case '中': return '#faad14';
      case '高': return '#ff4d4f';
      default: return '#1890ff';
    }
  };

  return (
    <div style={{ maxWidth:800, margin:'0 auto' }}>
      <Title level={2} style={{ textAlign:'center', color:'#1890ff' }}>
        <SettingOutlined /> 房间空调控制（{roomId}）
      </Title>
      <Card>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Statistic title="状态" value={uiStatus} /></Col>
          <Col span={6}><Statistic title="当前温度" value={currentTemp} suffix="°C"/></Col>
          <Col span={6}><Statistic title="目标温度" value={targetTemp} suffix="°C"/></Col>
          <Col span={6}><Statistic title="温度变化率" value={getCurrentTempChangeRate()} suffix="度/分钟"/></Col>
        </Row>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <Text strong style={{ marginRight:16 }}>运行模式:</Text>
          <Space>
            <Button 
              type={mode==='cool'?'primary':'default'} 
              onClick={()=>handleModeChange('cool')} 
              disabled={false}
              icon={<i className="iconfont icon-xuehua" style={{ fontSize: '16px' }} />}
            >
              制冷
            </Button>
            <Button 
              type={mode==='heat'?'primary':'default'} 
              onClick={()=>handleModeChange('heat')} 
              disabled={false}
              icon={<i className="iconfont icon-kongzhizhire" style={{ fontSize: '16px' }} />}
            >
              制热
            </Button>
          </Space>
        </div>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <Text strong>温度调节:</Text>
          <Space>
            <Button onClick={()=>handleTempChange('down')}>-</Button>
            <Text strong style={{ fontSize:'1.2em', minWidth:40 }}>{targetTemp}°C</Text>
            <Button onClick={()=>handleTempChange('up')}>+</Button>
          </Space>
        </div>

        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}><Text strong>风速:</Text>
            <Space style={{ marginLeft:8 }}>
              {['低','中','高'].map(speed=>(
                <Button key={speed} type={fanSpeed===speed?'primary':'default'}
                  style={{
                    background: fanSpeed===speed?getFanSpeedColor(speed):undefined,
                    borderColor: fanSpeed===speed?getFanSpeedColor(speed):undefined
                  }}
                  onClick={()=>handleFanSpeedChange(speed)}
                >{speed}</Button>
              ))}
            </Space>
          </Col>
          <Col span={12} style={{ textAlign:'right' }}>
            <Statistic title="已使用费用" value={usageFee} precision={2} prefix="¥"/>
          </Col>
        </Row>
        
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Statistic title="已消耗电量" value={powerConsumed} precision={4} suffix="度"/>
          </Col>
          <Col span={12} style={{ textAlign:'right' }}>
            <Statistic title="运行时间" value={timeElapsed} suffix="秒"/>
          </Col>
        </Row>

        <div style={{ textAlign:'center', marginTop:20 }}>
          <Button 
            type={isOn?'default':'primary'} 
            danger={isOn} 
            onClick={handlePowerToggle} 
            size="large" 
            style={{ width:200 }}
            icon={isOn ? <PoweroffOutlined /> : <ThunderboltOutlined />}
          >
            {isOn?'关闭空调':'开启空调'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ACControl;