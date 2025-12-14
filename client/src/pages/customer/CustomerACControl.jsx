import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Row, Col, Tag, Space, Statistic, message, Alert } from 'antd';
import {
  ThunderboltOutlined,
  SettingOutlined,
  PoweroffOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import '../../assets/icons/iconfonts.css';

const { Title, Text } = Typography;

const ACControl = () => {
  const { roomId: roomNo } = useParams(); // roomId 实际上是房间号（room_no）
  const navigate = useNavigate();

  // 房间状态（UI显示）
  const [roomData, setRoomData] = useState({
    currentTemp: 26,
    targetTemp: 25,
    fanSpeed: '中',
    mode: 'cool',
    status: 'off',
    uiStatus: '关机',
    usageFee: 0,
    powerConsumed: 0,
    timeElapsed: 0,
    scheduleStatus: 'idle',
    initialTemp: 26,
  });

  // 添加房间ID状态
  const [realRoomId, setRealRoomId] = useState(null); // 数据库中的房间ID（room_id）
  const [roomInfo, setRoomInfo] = useState({ roomId: null, roomNo: null });

  // 记录ID及开始时间等
  const [recordId, setRecordId] = useState(null); // 当前入住记录ID（来自后端）
  const [logStartTime, setLogStartTime] = useState(null); // 用于触发 UI 更新
  const logStartTimeRef = useRef(null); // 用于异步/闭包内可靠读取
  const prevStatusRef = useRef(roomData.status); // 保存上一次的状态（用于比较）
  const recordIdRef = useRef(null); // 添加ref同步recordId

  // 温度历史
  const [tempHistory, setTempHistory] = useState([]);

  // WebSocket 管理
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // ----- 辅助映射函数 -----
  const mapFanSpeed = (serverSpeed) => {
    switch (serverSpeed) {
      case 'low': return '低';
      case 'medium': return '中';
      case 'high': return '高';
      default: return '中';
    }
  };

  const mapUiStatus = (serverStatus) => {
    switch (serverStatus) {
      case 'running': return '运行中';
      case 'waiting': return '等待调度';
      case 'stopped': return '停止(回温中)';
      case 'off': return '关机';
      default: return '异常状态';
    }
  };

  const getRewarmRate = () => 0.5;

  // 当前温度变化速率（度/分钟）
const getCurrentTempChangeRate = () => {
  const { status, fanSpeed } = roomData;

  // 送风状态：按风速计算降温/升温速率
  if (status === 'running') {
    const baseRate = 0.5; // 中风速参考 0.5 度/分钟
    switch (fanSpeed) {
      case '高':
        return baseRate * 2;      // 1.0
      case '低':
        return baseRate * 2 / 3;  // ≈0.33
      default:
        return baseRate;          // 中
    }
  }

  // 停止送风 / 等待调度 / 关机：都认为是在“回温中”
  if (status === 'stopped' || status === 'waiting' || status === 'off') {
    return getRewarmRate();
  }

  // 其他异常状态
  return 0;
};

  const getScheduleStatus = (status) => {
    switch (status) {
      case 'running': return 'serving';
      case 'waiting': return 'waiting';
      default: return 'idle';
    }
  };

  // ----- 将房间号转换为房间ID -----
  const fetchRoomIdFromRoomNo = async () => {
    try {
      console.log('正在将房间号转换为房间ID,roomNo:', roomNo);

      const response = await fetch(`/api/customer/convert-no?room_no=${roomNo}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      console.log('房间转换响应状态:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('房间转换结果:', result);

        if (result.success && result.data) {
          const { roomId, roomNo: realRoomNo, initialTemp} = result.data;
          setRealRoomId(roomId);
          setRoomInfo({ roomId, roomNo: realRoomNo });

          if (initialTemp) {
            const parsedInitialTemp = parseFloat(initialTemp);
            setRoomData(prev => ({
                ...prev,
                currentTemp: parsedInitialTemp,
                initialTemp: parsedInitialTemp,
            }));
        }

          console.log('房间转换成功:', { roomId, roomNo: realRoomNo });
          return roomId;
        } else {
          console.warn('房间转换API返回success: false', result);
          message.error(`房间 ${roomNo} 不存在或转换失败`);
          return null;
        }
      } else {
        console.warn('房间转换API请求失败', response.status);
        message.error(`房间转换失败: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('房间号转换失败:', error);
      message.error('房间号转换失败，请检查网络连接');
      return null;
    }
  };

  // ----- 获取当前入住记录 -----
  const fetchCurrentRecord = async (roomId) => {
    try {
      console.log('正在获取入住记录roomNo:', roomNo);

      const response = await fetch(`/api/customer/room-records/current?room_no=${roomNo}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      console.log('入住记录响应状态:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('入住记录解析:', result);

        if (result.success && result.data) {
          const rid = result.data.recordId;
          if (rid) {
            setRecordId(rid);
            recordIdRef.current = rid; // 同步到ref
            console.log('当前入住记录ID:', rid);
            return rid;
          } else {
            console.warn('API返回成功但未找到recordId字段', result);
            message.warning('该房间当前没有入住记录');
          }
        } else {
          console.warn('API返回success: false', result);
        }
      } else {
        console.warn('API请求失败', response.status);
      }
      return null;
    } catch (error) {
      console.error('获取入住记录失败:', error);
      return null;
    }
  };

  // ----- 初始化：获取房间ID和入住记录 -----
  useEffect(() => {
    const initialize = async () => {
      // 1. 将房间号转换为房间ID
      const roomId = await fetchRoomIdFromRoomNo();
      if (roomId) {
        // 2. 获取入住记录
        await fetchCurrentRecord(roomId);
      }
    };
    
    initialize();
  }, [roomNo]);

  // ----- WebSocket 初始化 -----
  useEffect(() => {
    // 如果没有房间ID，不创建WebSocket
    if (!realRoomId) {
      console.log('等待房间ID，暂不创建WebSocket');
      return;
    }

    // 如果已经有 ws 且 open 就不重复创建
    if (ws && ws.readyState === WebSocket.OPEN) {
      return;
    }

    const socket = new WebSocket('ws://10.29.238.57:8080');
    setWs(socket);

    socket.onopen = async () => {
      console.log('房间连接已建立，房间ID:', realRoomId);
      setIsConnected(true);

      // 等待 recordId 可用（上限约 2 秒）
      let waitCount = 0;
      while (!recordIdRef.current && waitCount < 20) {
        await new Promise(res => setTimeout(res, 100));
        waitCount++;
      }

      if (!recordIdRef.current) {
        console.warn('[WebSocket] recordId 仍为空，跳过 REGISTER_ROOM');
        message.warning('未检测到入住记录，已建立连接但无法立即注册房间');
      } else {
        socket.send(JSON.stringify({
          type: 'REGISTER_ROOM',
          payload: {
            roomId: realRoomId, // 使用真实的房间ID
            recordId: recordIdRef.current,
            initialTemp: roomData.initialTemp 
          }
        }));
        console.log('已发送 REGISTER_ROOM', { 
          roomId: realRoomId, 
          recordId: recordIdRef.current ,
          initialTemp: roomData.initialTemp 
        });
      }
    };

    socket.onmessage = async (msg) => {
      try {
        const data = JSON.parse(msg.data);
        // console.log('房间收到消息:', data);

        if (data.type === 'ROOM_STATUS_UPDATE') {
          const serverRoomData = data.payload;
          if (!serverRoomData) return;

          // 安全解析字段
          const currentTemp = parseFloat(serverRoomData.currentTemp) || 26;
          const targetTemp = serverRoomData.targetTemp != null ? Number(serverRoomData.targetTemp) : 24;
          const newStatus = serverRoomData.status || 'off';
          const newMode = serverRoomData.mode || 'cool';
          const newFanSpeed = mapFanSpeed(serverRoomData.fanSpeed);

          // prevStatus 从 ref 读取，避免闭包问题
          const prevStatus = prevStatusRef.current;

          // 更新 UI
          setRoomData(prev => ({
            ...prev,
            currentTemp,
            targetTemp,
            fanSpeed: newFanSpeed,
            mode: newMode,
            status: newStatus,
            uiStatus: mapUiStatus(newStatus),
            usageFee: parseFloat(serverRoomData.usageFee) || prev.usageFee || 0,
            powerConsumed: parseFloat(serverRoomData.powerConsumed) || prev.powerConsumed || 0,
            timeElapsed: serverRoomData.timeElapsed != null ? serverRoomData.timeElapsed : prev.timeElapsed,
            scheduleStatus: getScheduleStatus(newStatus),
          }));
          
          /**
           * ================== 日志与计费核心逻辑 ==================
           * 1）非 running -> running：开始一段新的计费周期
           * 2）running -> stopped：达到目标温度，自动保存 auto_stop
           * 3）running -> off：用户关机，保存 user_off
           * 4）running -> waiting：调度器抢占，保存 preempted
           */
          
          // 1. 进入 running：记录开始时间
          if (newStatus === 'running' && prevStatus !== 'running') {
            const now = new Date();
            setLogStartTime(now);
            logStartTimeRef.current = now;
            setTempHistory([{ time: now, temp: currentTemp }]);
            console.log('[状态流转] 进入 running，记录 logStartTime', now);
          }
          
          // 2. running -> stopped：自动停止送风，保存一次自动记录
          if (prevStatus === 'running' && newStatus === 'stopped') {
            if (logStartTimeRef.current) {
              console.log('[状态流转] running -> stopped，尝试保存日志 auto_stop');
              await saveACUsageLog('auto_stop', newFanSpeed);
            } else {
              console.warn('[状态流转] running -> stopped，但 logStartTimeRef 为空，跳过保存');
            }
          }
          
          // 3. running -> off：用户关机
          if (prevStatus === 'running' && newStatus === 'off') {
            if (logStartTimeRef.current) {
              console.log('[状态流转] running -> off，尝试保存日志 user_off');
              await saveACUsageLog('user_off', newFanSpeed);
            } else {
              console.warn('[状态流转] running -> off，但 logStartTimeRef 为空，跳过保存');
            }
          }
          
          // 4. running -> waiting：被调度器抢占 / 暂停服务
          if (prevStatus === 'running' && newStatus === 'waiting') {
            if (logStartTimeRef.current) {
              console.log('[状态流转] running -> waiting（调度抢占），尝试保存日志 preempted');
              await saveACUsageLog('preempted', newFanSpeed);
            } else {
              console.warn('[状态流转] running -> waiting，但 logStartTimeRef 为空，跳过保存');
            }
          }
          
          // 更新 prevStatusRef
          prevStatusRef.current = newStatus;
          
          /**
           * ================== 额外 UI 提示：达到目标温度 ==================
           */
          let shouldAutoStop = false;
          let stopMessage = '';
          if (newStatus === 'running') {
            if (newMode === 'cool' && currentTemp <= targetTemp) {
              shouldAutoStop = true;
              stopMessage = `达到目标温度 ${targetTemp}°C，自动停止送风`;
            } else if (newMode === 'heat' && currentTemp >= targetTemp) {
              shouldAutoStop = true;
              stopMessage = `达到目标温度 ${targetTemp}°C，自动停止送风`;
            }
          }
          if (shouldAutoStop && isConnected) {
            message.info(stopMessage);
          }
        }
      } catch (error) {
        console.error('解析消息失败:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      message.error('连接服务器失败');
      setIsConnected(false);
    };

    socket.onclose = () => {
      console.log('房间连接已关闭');
      setRoomData(prev => ({
        ...prev,
        uiStatus: '离线',
        status: 'off'
      }));
      setIsConnected(false);
    };

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [realRoomId]); // 依赖 realRoomId，当房间ID获取到后再建立连接

  // 如果 recordId 后到，则补发 REGISTER_ROOM
  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN && recordIdRef.current && realRoomId) {
      try {
        ws.send(JSON.stringify({
          type: 'REGISTER_ROOM',
          payload: { 
            roomId: realRoomId, 
            recordId: recordIdRef.current 
          }
        }));
        console.log('补发 REGISTER_ROOM', { 
          roomId: realRoomId, 
          recordId: recordIdRef.current 
        });
        message.success('房间已注册（recordId 到位）');
      } catch (e) {
        console.warn('补发 REGISTER_ROOM 失败', e);
      }
    }
  }, [recordId, ws, realRoomId]);

  // ----- 保存空调使用记录 -----
  const saveACUsageLog = async (operationType, fanSpeedOverride = null) => {
    // 使用 ref 读取以确保在异步里可读
    const startTime = logStartTimeRef.current;
    const currentRecordId = recordIdRef.current;
    
    if (!currentRecordId || !startTime) {
      console.warn('无法保存记录：缺少 recordId 或 logStartTime', { 
        recordId: currentRecordId, 
        startTime 
      });
      return;
    }

    try {
      // const endTime = new Date();
      // const durationMinutes = (endTime - startTime) / (1000 * 60);

      const endTime = new Date();

      // 真实分钟
      const realDurationMinutes = (endTime - startTime) / (1000 * 60);

      // 时间加速因子：和 TimeHelper 保持一致
      const TIME_ACCELERATION_FACTOR = 6;

      // 模拟分钟（计费用）
      const durationMinutes = realDurationMinutes * TIME_ACCELERATION_FACTOR;
      const duration = Math.max(0, durationMinutes);

      // 计算能耗和费用（示例）
      const feePerMinute = {
        '低': 0.333,
        '中': 0.5,
        '高': 1.0
      };
      const actualFanSpeed = fanSpeedOverride || roomData.fanSpeed;
      const fanSpeedKey = actualFanSpeed || '中'; 
      // const duration = Math.max(0, durationMinutes);
      const fee = (feePerMinute[fanSpeedKey] || feePerMinute['中']) * duration;
      const energyUsed = fee; 

      const logData = {
        record_id: currentRecordId,
        room_no: roomNo, // 使用真实的房间ID
        start_time: startTime.toISOString().slice(0, 19).replace('T', ' '),
        end_time: endTime.toISOString().slice(0, 19).replace('T', ' '),
        fan_speed:actualFanSpeed === '低' ? 'low' : actualFanSpeed === '中' ? 'medium' : 'high',
        mode: roomData.mode,
        target_temp: Number(roomData.targetTemp),
        current_temp: Number(roomData.currentTemp),
        target_temp_diff: Number(Math.abs(roomData.currentTemp - roomData.targetTemp)),
        energy_used: Number(energyUsed.toFixed(3)),
        fee: Number(fee.toFixed(3)),
        operation_type: operationType
      };

      console.log('Attempting to insert AC Log. Values:', [
        logData.room_no,
        logData.record_id,
        logData.start_time,
        logData.end_time,
        logData.fan_speed,
        logData.mode,
        logData.target_temp,
        logData.current_temp,
        logData.target_temp_diff,
        logData.energy_used,
        logData.fee,
        logData.operation_type
      ]);

      const response = await fetch('/api/acUsage/ac-usage-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('空调使用记录已保存:', result);

        // 清理 start time / history
        setLogStartTime(null);
        logStartTimeRef.current = null;
        setTempHistory([]);
      } else {
        // 尝试读取返回的错误信息，帮助排查外键问题
        let errText = await response.text().catch(() => '');
        console.error('[数据库] 保存空调使用记录失败:', response.status, response.statusText, errText);
        message.error(`保存空调使用记录失败（房间 ${roomNo}）: ${response.status}`);
      }
    } catch (error) {
      console.error('保存空调使用记录失败:', error);
      message.error('保存空调使用记录失败（网络或服务器错误）');
    }
  };

  // ----- 发送控制请求 -----
  const sendControlRequest = async (targetTemp, fanSpeed, mode) => {
    // 必须有 recordId 才能发送（服务器侧需要 recordId 来关联日志）
    const currentRecordId = recordIdRef.current;
    if (!currentRecordId) {
      message.error('尚未获取入住记录，无法执行空调控制。');
      console.warn('sendControlRequest: recordId 为空，阻止发送', { roomNo });
      return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      // 若之前为 off（即即将从关机开启），确保 logStartTime 已被初始化
      const prevStatus = prevStatusRef.current;
      if (prevStatus === 'off' && !logStartTimeRef.current) {
        const now = new Date();
        setLogStartTime(now);
        logStartTimeRef.current = now;
      }

      ws.send(JSON.stringify({
        type: 'CUSTOMER_CONTROL',
        payload: {
          roomId: realRoomId, // 使用真实的房间ID
          targetTemp,
          fanSpeed: fanSpeed === '低' ? 'low' : fanSpeed === '中' ? 'medium' : 'high',
          mode,
          recordId: currentRecordId
        }
      }));
      console.log('发送控制请求:', { 
        roomId: realRoomId, 
        targetTemp, 
        fanSpeed, 
        mode, 
        recordId: currentRecordId 
      });

      message.success('控制指令已发送');
    } else {
      message.error('未连接到服务器');
    }
  };

  // ----- 发送关机请求 -----
  const sendPowerOff = async () => {
    const currentRecordId = recordIdRef.current;
    if (!currentRecordId) {
      message.error('尚未获取入住记录，无法执行关机。');
      return;
    }

    if (!logStartTimeRef.current) {
      const now = new Date();
      setLogStartTime(now);
      logStartTimeRef.current = now;
      console.log('[关机] 初始化 logStartTime', now);
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'CUSTOMER_POWER_OFF',
        payload: { 
          roomId: realRoomId, // 使用真实的房间ID
          recordId: currentRecordId 
        }
      }));
      console.log('发送关机请求', { 
        roomId: realRoomId, 
        recordId: currentRecordId 
      });

      // // 关机时，如果之前在运行，应保存日志（但后端状态更新也会触发一次保存，双保险）
      // if (prevStatusRef.current === 'running') {
      //   await saveACUsageLog('user_off',);
      //   setLogStartTime(null);
      //   logStartTimeRef.current = null;
      //   setTempHistory([]);
      // }

      message.success('关机指令已发送');
    } else {
      message.error('未连接到服务器');
    }
  };

  // ----- 控制器（按钮点击） -----
  const handlePowerToggle = async () => {
    if (roomData.status === 'off') {
      // 开启空调（向调度器请求）
      await sendControlRequest(roomData.targetTemp, roomData.fanSpeed, roomData.mode);
      message.info('已向调度器发送请求，请等待分配服务');
    } else {
      // 关闭空调
      await sendPowerOff();
    }
  };

  const handleFanSpeedChange = async (speed) => {
    const newFanSpeed = speed;

     // 更新本地 UI 状态
     setRoomData(prev => ({
      ...prev,
      fanSpeed: newFanSpeed
    }));

    // 如果没有记录开始时间，则先初始化，否则保存一次 user_control
    if (!logStartTimeRef.current) {
      const now = new Date();
      setLogStartTime(now);
      logStartTimeRef.current = now;
      setTempHistory([{ time: now, temp: roomData.currentTemp }]);
    } else {
      // 只有在空调实际处于服务中时才保存 user_control
      if (roomData.status !== 'off' && roomData.status !== 'waiting') {
        await saveACUsageLog('user_control',roomData.fanSpeed);
        // 保存后重新把 startTime 设为现在以继续记录新一段
        const now = new Date();
        setLogStartTime(now);
        logStartTimeRef.current = now;
        setTempHistory([{ time: now, temp: roomData.currentTemp }]);
      }
    }

    // 发送控制请求（如果连着还是在运行中）
    if (roomData.status !== 'off') {
      sendControlRequest(roomData.targetTemp, newFanSpeed, roomData.mode);
    }

    message.success(`风速已调整为${speed}风`);
  };

  const handleModeChange = async (newMode) => {
    const newTargetTemp = newMode === 'cool' ? 25 : 23;

    if (!logStartTimeRef.current) {
      const now = new Date();
      setLogStartTime(now);
      logStartTimeRef.current = now;
      setTempHistory([{ time: now, temp: roomData.currentTemp }]);
    } else {
      if (roomData.status !== 'off' && roomData.status !== 'waiting') {
        await saveACUsageLog('user_control',roomData.fanSpeed);
        const now = new Date();
        setLogStartTime(now);
        logStartTimeRef.current = now;
        setTempHistory([{ time: now, temp: roomData.currentTemp }]);
      }
    }

    setRoomData(prev => ({
      ...prev,
      mode: newMode,
      targetTemp: newTargetTemp
    }));

    if (roomData.status !== 'off') {
      sendControlRequest(newTargetTemp, roomData.fanSpeed, newMode);
    }

    message.success(`模式已切换为${newMode === 'cool' ? '制冷' : '制热'}`);
  };


const handleTempChange = async (direction) => {
  const newTemp = direction === 'up'
    ? Math.min(roomData.targetTemp + 1, roomData.mode === 'cool' ? 28 : 25)
    : Math.max(roomData.targetTemp - 1, roomData.mode === 'cool' ? 18 : 18);

  // 检查是否为 'off' 状态
  const isOffStatus = roomData.status === 'off';

  // 只有在非 'off' 状态，且非 'waiting' 状态时，才保存日志并重置 startTime
  if (!isOffStatus && roomData.status !== 'waiting') {
    if (!logStartTimeRef.current) {
      const now = new Date();
      setLogStartTime(now);
      logStartTimeRef.current = now;
      setTempHistory([{ time: now, temp: roomData.currentTemp }]);
    } else {
      await saveACUsageLog('user_control', roomData.fanSpeed);
      const now = new Date();
      setLogStartTime(now);
      logStartTimeRef.current = now;
      setTempHistory([{ time: now, temp: roomData.currentTemp }]);
    }
  }

  setRoomData(prev => ({
    ...prev,
    targetTemp: newTemp
  }));

  if (!isOffStatus) {
    sendControlRequest(newTemp, roomData.fanSpeed, roomData.mode);
    message.success(`目标温度已调整为${newTemp}°C`);
  } else {
    // 状态是 'off' 时，只更新本地 UI
    message.success(`目标温度已调整为${newTemp}°C (将在下次开机时生效)`);
  }
};

  // ----- UI 辅助 -----
  const ScheduleStatusTag = () => {
    const { scheduleStatus } = roomData;

    const statusConfig = {
      serving: { color: 'green', text: '服务中', icon: <CheckCircleOutlined /> },
      waiting: { color: 'orange', text: '等待调度', icon: <SyncOutlined spin /> },
      idle: { color: 'default', text: '未调度', icon: <ClockCircleOutlined /> }
    };

    const config = statusConfig[scheduleStatus] || statusConfig.idle;

    return (
      <Tag color={config.color} style={{ marginLeft: 8 }}>
        <Space size={4}>
          {config.icon}
          <span>{config.text}</span>
        </Space>
      </Tag>
    );
  };

  const getFanSpeedColor = (speed) => {
    switch (speed) {
      case '低': return '#52c41a';
      case '中': return '#faad14';
      case '高': return '#ff4d4f';
      default: return '#1890ff';
    }
  };

  const handleGoToCheckout = () => {
    navigate(`/check-out?roomNo=${roomNo}`);
  };

  // 如果还没有获取到房间信息，显示加载状态
  if (!realRoomId) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px', textAlign: 'center' }}>
        <Title level={2}>加载中...</Title>
        <Text>正在获取房间信息...</Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <Title level={2} style={{ textAlign: 'center', color: '#1890ff' }}>
        <SettingOutlined /> 房间空调控制（房间号: {roomNo} | 房间ID: {realRoomId}）
      </Title>

      {/* 显示房间信息 */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Tag color="blue">房间号: {roomNo}</Tag>
        <Tag color="green">房间ID: {realRoomId}</Tag>
        <Tag color="orange">入住记录ID: {recordId || '无'}</Tag>
      </div>

      {/* 连接状态 */}
      {!isConnected && (
        <Alert
          message="连接断开"
          description="无法连接到空调服务器，请检查网络连接"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 关机回温状态提示 */}
      {roomData.status === 'off' && roomData.currentTemp !== roomData.initialTemp && (
        <Alert
          message="空调已关机，正在回温"
          description={
            <div>
              <div>当前温度: {roomData.currentTemp.toFixed(2)}°C</div>
              <div>目标温度: {roomData.initialTemp.toFixed(2)}°C (初始温度)</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                空调关闭后，温度将逐渐恢复到初始温度
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {roomData.status === 'stopped' && (
        <Alert
          message="空调已停止送风"
          description={
            <div>
              <div>当前温度: {roomData.currentTemp.toFixed(2)}°C</div>
              <div>目标温度: {roomData.targetTemp}°C</div>
              <div>回温速率: {getCurrentTempChangeRate().toFixed(2)}度/分钟</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                温度超过目标值1℃时将自动重新启动
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        {/* 状态概览 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title="状态"
              value={roomData.uiStatus}
              valueStyle={{
                color: roomData.status === 'running' ? '#3f8600' :
                  roomData.status === 'waiting' ? '#faad14' :
                    roomData.status === 'stopped' ? '#722ed1' : '#8c8c8c'
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="当前温度"
              value={roomData.currentTemp.toFixed(2)}
              suffix="°C"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="目标温度"
              value={roomData.targetTemp}
              suffix="°C"
            />
          </Col>
          <Statistic
            title={roomData.status === 'running' ? '温度变化率' : '回温速率'}
            value={getCurrentTempChangeRate().toFixed(2)}
            suffix="度/分钟"
          />
        </Row>

        {/* 调度状态 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Text strong>调度状态：</Text>
          <ScheduleStatusTag />
        </div>

        {/* 温差显示 */}
        {roomData.status === 'stopped' && (
          <div style={{ textAlign: 'center', marginBottom: 16, padding: '8px', backgroundColor: '#f6ffed', borderRadius: '4px' }}>
            <Text>
              当前温差: <Text strong>{Math.abs(roomData.currentTemp - roomData.targetTemp).toFixed(2)}°C</Text>
              {Math.abs(roomData.currentTemp - roomData.targetTemp) >= 1.0 ?
                <Tag color="orange" style={{ marginLeft: '8px' }}>可重新启动</Tag> :
                <Tag color="green" style={{ marginLeft: '8px' }}>等待回温</Tag>
              }
            </Text>
          </div>
        )}

        {/* 运行模式控制 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Text strong style={{ marginRight: 16 }}>运行模式:</Text>
          <Space>
            <Button
              type={roomData.mode === 'cool' ? 'primary' : 'default'}
              onClick={() => handleModeChange('cool')}
              disabled={!isConnected}
              icon={<i className="iconfont icon-xuehua" style={{ fontSize: '16px' }} />}
            >
              制冷
            </Button>
            <Button
              type={roomData.mode === 'heat' ? 'primary' : 'default'}
              onClick={() => handleModeChange('heat')}
              disabled={!isConnected}
              icon={<i className="iconfont icon-kongzhizhire" style={{ fontSize: '16px' }} />}
            >
              制热
            </Button>
          </Space>
        </div>

        {/* 温度调节 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Text strong>温度调节:</Text>
        <Space style={{ marginLeft: 16 }}>
          <Button
            onClick={() => handleTempChange('down')}
            disabled={!isConnected} 
          >
            -
          </Button>
          <Text strong style={{ fontSize: '1.2em', minWidth: 40 }}>
            {roomData.targetTemp}°C
          </Text>
          <Button
            onClick={() => handleTempChange('up')}
            disabled={!isConnected}
          >
            +
          </Button>
        </Space>
      </div>

        {/* 风速控制 */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Text strong>风速:</Text>
            <Space style={{ marginLeft: 8 }}>
              {['低', '中', '高'].map(speed => (
                <Button
                  key={speed}
                  type={roomData.fanSpeed === speed ? 'primary' : 'default'}
                  style={{
                    background: roomData.fanSpeed === speed ? getFanSpeedColor(speed) : undefined,
                    borderColor: roomData.fanSpeed === speed ? getFanSpeedColor(speed) : undefined
                  }}
                  onClick={() => handleFanSpeedChange(speed)}
                  disabled={!isConnected}
                >
                  {speed}
                </Button>
              ))}
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Statistic
              title="已使用费用"
              value={roomData.usageFee.toFixed(2)}
              precision={2}
              prefix="¥"
            />
          </Col>
        </Row>

        {/* 能耗信息 */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={12}>
            <Statistic
              title="已消耗电量"
              value={roomData.powerConsumed.toFixed(4)}
              precision={4}
              suffix="度"
            />
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Statistic
              title="运行时间"
              value={(roomData.timeElapsed / 60).toFixed(2)}
              suffix="分钟"
            />
          </Col>
        </Row>

        {/* 电源控制 */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Button
            type={roomData.status !== 'off' ? 'default' : 'primary'}
            danger={roomData.status !== 'off'}
            onClick={handlePowerToggle}
            size="large"
            style={{ width: 200 }}
            icon={roomData.status !== 'off' ? <PoweroffOutlined /> : <ThunderboltOutlined />}
            disabled={!isConnected}
          >
            {roomData.status !== 'off' ? '关闭空调' : '开启空调'}
          </Button>
        </div>
        {/* 结账跳转按钮 */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Button type="primary" onClick={handleGoToCheckout}>
           去结账
          </Button>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', color: '#8c8c8c', fontSize: '12px' }}>
          提示: 空调使用记录将自动保存到数据库，用于结账时生成详单
        </div>
      </Card>
    </div>
  );
};

export default ACControl;