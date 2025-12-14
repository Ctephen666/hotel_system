import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import checkInRoutes from './routes/checkIn.js';
import reportRoutes from './routes/reports.js';
import customerLoginRoutes from './routes/login.js';


// === HTTP 服务器配置 ===
const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', checkInRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/customer', customerLoginRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动 HTTP 服务器
app.listen(HTTP_PORT, () => {
  console.log(`HTTP 服务器运行在端口 ${HTTP_PORT}`);
});

// === WebSocket 服务器配置 ===
const WS_PORT = process.env.WS_PORT || 8080;
const wss = new WebSocketServer({ 
    port: WS_PORT,
    perMessageDeflate: false // 禁用压缩以避免某些连接问题
});

// WebSocket 服务器启动事件
wss.on('listening', () => {
    console.log(`WebSocket 服务器运行在端口 ${WS_PORT}`);
});

// === 配置常量 ===
const MAX_SERVICE_CAPACITY = 3; // 服务对象上限：最多同时给3个房间送风
const TIME_SLICE = 10;          // 时间片：10秒
const FAN_PRIORITY = { 'low': 1, 'medium': 2, 'high': 3 }; // 风速优先级映射

// === 内存数据存储 ===
const connections = {
    rooms: new Map(),      // roomId -> ws
    dispatchers: new Set(),
    acAdmins: new Set()
};

const roomData = new Map();

// === 调度器核心逻辑 ===
class Scheduler {
    constructor() {
        this.serviceQueue = [];
        this.waitQueue = [];
        setInterval(() => this.checkTimeSlice(), 1000);
    }

    handleRequest(roomId, payload) {
        const priority = FAN_PRIORITY[payload.fanSpeed] || 2;
        
        const room = roomData.get(roomId) || {};
        roomData.set(roomId, {
            ...room,
            roomId,
            mode: payload.mode,
            targetTemp: payload.targetTemp,
            fanSpeed: payload.fanSpeed,
            priority: priority,
            currentTemp: room.currentTemp || 26,
            status: 'waiting',
            waitStartTime: Date.now()
        });

        if (this.isInService(roomId)) {
            this.broadcastUpdate();
            return;
        }

        if (this.isInWaiting(roomId)) {
            this.broadcastUpdate();
            return;
        }

        if (this.serviceQueue.length < MAX_SERVICE_CAPACITY) {
            this.startService(roomId);
            return;
        }

        this.performPriorityScheduling(roomId);
    }

    performPriorityScheduling(newRoomId) {
        const newRoom = roomData.get(newRoomId);
        
        let minPriority = 999;
        this.serviceQueue.forEach(id => {
            const r = roomData.get(id);
            if (r.priority < minPriority) minPriority = r.priority;
        });

        if (newRoom.priority > minPriority) {
            const lowPriorityRooms = this.serviceQueue.filter(id => roomData.get(id).priority === minPriority);
            
            const targetRoomId = lowPriorityRooms.sort((a, b) => {
                const roomA = roomData.get(a);
                const roomB = roomData.get(b);
                return (roomData.get(a).startTime || 0) - (roomData.get(b).startTime || 0);
            })[0];

            console.log(`[优先级调度] 房间 ${newRoomId} (P:${newRoom.priority}) 抢占 房间 ${targetRoomId} (P:${minPriority})`);
            
            this.stopService(targetRoomId, 'priority_preempt');
            this.addToWaitQueue(targetRoomId);
            this.startService(newRoomId);
        } else {
            console.log(`[调度] 房间 ${newRoomId} 优先级不足，进入等待队列`);
            this.addToWaitQueue(newRoomId);
        }
    }

    checkTimeSlice() {
        if (this.waitQueue.length === 0) return;

        const now = Date.now();
        const sortedWaitQueue = [...this.waitQueue].sort((a, b) => {
             return roomData.get(a).waitStartTime - roomData.get(b).waitStartTime;
        });

        for (const waitingRoomId of sortedWaitQueue) {
            const waitingRoom = roomData.get(waitingRoomId);
            const waitDurationSeconds = (now - waitingRoom.waitStartTime) / 1000;

            if (waitDurationSeconds >= TIME_SLICE) {
                const samePriorityRunningRooms = this.serviceQueue.filter(id => 
                    roomData.get(id).priority === waitingRoom.priority
                );

                if (samePriorityRunningRooms.length > 0) {
                    const targetRoomId = samePriorityRunningRooms.sort((a, b) => 
                        (roomData.get(a).startTime || 0) - (roomData.get(b).startTime || 0)
                    )[0];

                    console.log(`[时间片调度] 房间 ${waitingRoomId} 等待超时(${waitDurationSeconds.toFixed(1)}s)，轮换 房间 ${targetRoomId}`);

                    this.stopService(targetRoomId, 'time_slice');
                    this.addToWaitQueue(targetRoomId);
                    this.removeFromWaitQueue(waitingRoomId);
                    this.startService(waitingRoomId);
                    return;
                }
            }
        }
    }

    startService(roomId) {
        const room = roomData.get(roomId);
        room.status = 'running';
        room.startTime = Date.now();
        room.waitStartTime = null;
        roomData.set(roomId, room);

        if (!this.serviceQueue.includes(roomId)) {
            this.serviceQueue.push(roomId);
        }

        const ws = connections.rooms.get(roomId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'AC_POWER_ON',
                mode: room.mode,
                targetTemp: room.targetTemp,
                fanSpeed: room.fanSpeed
            }));
        }

        this.broadcastUpdate();
    }

    stopService(roomId, reason = 'scheduler') {
        const room = roomData.get(roomId);
        if(!room) return;
        
        room.status = reason === 'user_stop' ? 'stopped' : 'waiting';
        roomData.set(roomId, room);

        this.serviceQueue = this.serviceQueue.filter(id => id !== roomId);

        const ws = connections.rooms.get(roomId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'AC_POWER_OFF', reason }));
        }
        
        this.broadcastUpdate();
    }

    addToWaitQueue(roomId) {
        if (!this.waitQueue.includes(roomId)) {
            this.waitQueue.push(roomId);
            const room = roomData.get(roomId);
            room.status = 'waiting';
            room.waitStartTime = Date.now(); 
            roomData.set(roomId, room);
        }
        this.broadcastUpdate();
    }

    removeFromWaitQueue(roomId) {
        this.waitQueue = this.waitQueue.filter(id => id !== roomId);
    }

    handleUserStop(roomId) {
        this.stopService(roomId, 'user_stop');
        this.removeFromWaitQueue(roomId);
        this.checkBacklog();
    }

    checkBacklog() {
        if (this.serviceQueue.length < MAX_SERVICE_CAPACITY && this.waitQueue.length > 0) {
            this.waitQueue.sort((a, b) => {
                const rA = roomData.get(a);
                const rB = roomData.get(b);
                if (rA.priority !== rB.priority) return rB.priority - rA.priority;
                return rA.waitStartTime - rB.waitStartTime;
            });

            const nextRoomId = this.waitQueue.shift();
            console.log(`[资源释放] 自动补位: 房间 ${nextRoomId}`);
            this.startService(nextRoomId);
        }
    }
    
    isInService(roomId) { return this.serviceQueue.includes(roomId); }
    isInWaiting(roomId) { return this.waitQueue.includes(roomId); }

    broadcastUpdate() {
        const allRooms = Array.from(roomData.values());
        const systemStats = {
            totalRooms: allRooms.length,
            runningRooms: this.serviceQueue.length,
            waitingRooms: this.waitQueue.length,
            capacity: MAX_SERVICE_CAPACITY
        };

        const msg = JSON.stringify({
            type: 'SYSTEM_STATUS_UPDATE',
            payload: {
                systemStatus: systemStats,
                rooms: allRooms,
                serviceQueue: this.serviceQueue,
                waitQueue: this.waitQueue
            }
        });

        connections.dispatchers.forEach(ws => ws.readyState === 1 && ws.send(msg));
        connections.acAdmins.forEach(ws => ws.readyState === 1 && ws.send(msg));
    }
}

function handleAdminControl(roomId, action) {
  if (action === 'stop') {
      scheduler.stopService(roomId, 'admin_force_stop');
  } else if (action === 'start') {
      const room = roomData.get(roomId);
      if (room) {
          scheduler.handleRequest(roomId, {
              mode: room.mode || 'cool',
              targetTemp: room.targetTemp || 25,
              fanSpeed: room.fanSpeed || 'medium'
          });
      }
  }
}

const scheduler = new Scheduler();

// WebSocket 服务器错误处理
wss.on('error', (error) => {
    console.error('WebSocket 服务器错误:', error);
});

// WebSocket 连接处理
wss.on('connection', (ws, req) => {
    console.log(`新的 WebSocket 连接: ${req.socket.remoteAddress}:${req.socket.remotePort}`);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'REGISTER_ROOM') {
                connections.rooms.set(data.roomId, ws);
                if (!roomData.has(data.roomId)) {
                    roomData.set(data.roomId, { roomId: data.roomId, status: 'stopped', currentTemp: 26 });
                }
                console.log(`房间 ${data.roomId} 已注册`);
                scheduler.broadcastUpdate();
            }
            else if (data.type === 'REGISTER_DISPATCHER') {
                connections.dispatchers.add(ws);
                console.log('调度器已注册');
                scheduler.broadcastUpdate();
            }
            else if (data.type === 'REGISTER_AC_ADMIN') {
                connections.acAdmins.add(ws);
                console.log('空调管理员已注册');
                scheduler.broadcastUpdate();
            }
            else if (data.type === 'REQUEST_AIR') {
                console.log(`房间 ${data.roomId} 请求送风`);
                scheduler.handleRequest(data.roomId, data.payload);
            }
            else if (data.type === 'STOP_REQUEST') {
                console.log(`房间 ${data.roomId} 停止/暂停`);
                scheduler.handleUserStop(data.roomId);
            }
            else if (data.type === 'ROOM_STATUS_UPDATE') {
                const current = roomData.get(data.roomId) || {};
                roomData.set(data.roomId, {
                    ...current,
                    ...data.payload,
                    status: (current.status === 'stopped') ? 'stopped' : current.status 
                });
                scheduler.broadcastUpdate();
            }
            else if (data.type === 'GET_ALL_ROOMS_STATUS') {
              const allRooms = Array.from(roomData.values());
              const systemStats = {
                 totalRooms: allRooms.length,
                 runningRooms: scheduler.serviceQueue.length,
                 waitingRooms: scheduler.waitQueue.length,
                 stoppedRooms: allRooms.filter(r => r.status === 'stopped').length,
                 totalPower: allRooms.reduce((sum, r) => sum + (r.powerConsumption || 0), 0),
                 avgTemperature: allRooms.length > 0 ? (allRooms.reduce((sum, r) => sum + (r.currentTemp || 26), 0) / allRooms.length).toFixed(1) : 0
              };
              
              ws.send(JSON.stringify({
                 type: 'SYSTEM_STATUS_UPDATE',
                 payload: { systemStatus: systemStats, rooms: allRooms }
              }));
            }
            else if (data.type === 'CONTROL_AC') {
              console.log(`管理员控制房间 ${data.roomId}: ${data.action}`);
              handleAdminControl(data.roomId, data.action);
              ws.send(JSON.stringify({ type: 'CONTROL_SUCCESS', roomId: data.roomId }));
              scheduler.broadcastUpdate();
            }
            
        } catch (e) { 
            console.error('处理 WebSocket 消息错误:', e);
            try {
                ws.send(JSON.stringify({ type: 'ERROR', message: e.message }));
            } catch (sendError) {
                console.error('发送错误消息失败:', sendError);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket 连接错误:', error);
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket 连接关闭: code=${code}, reason=${reason}`);
        // 清理连接
        connections.dispatchers.delete(ws);
        connections.acAdmins.delete(ws);
        // 清理房间连接
        for (const [roomId, roomWs] of connections.rooms.entries()) {
            if (roomWs === ws) {
                connections.rooms.delete(roomId);
                console.log(`房间 ${roomId} 连接已断开`);
                break;
            }
        }
        scheduler.broadcastUpdate();
    });

    // 发送欢迎消息
    try {
        ws.send(JSON.stringify({ type: 'CONNECTED', message: 'WebSocket 连接已建立' }));
    } catch (error) {
        console.error('发送欢迎消息失败:', error);
    }
});


