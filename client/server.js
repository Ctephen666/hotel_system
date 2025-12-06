import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// === 配置常量 ===
const MAX_SERVICE_CAPACITY = 3; // 服务对象上限：最多同时给3个房间送风
const TIME_SLICE = 10;          // 时间片：10秒 (为了演示效果设短一点，实际可为120秒)
const FAN_PRIORITY = { 'low': 1, 'medium': 2, 'high': 3 }; // 风速优先级映射

// === 内存数据存储 ===
// 房间连接映射
const connections = {
    rooms: new Map(),      // roomId -> ws
    dispatchers: new Set(),
    acAdmins: new Set()
};

// 房间状态数据结构
// Room Object: { roomId, status, mode, temp, target, fanSpeed, priority, startTime, waitStartTime, power... }
const roomData = new Map();

// === 调度器核心逻辑 ===
class Scheduler {
    constructor() {
        this.serviceQueue = []; // 正在服务的房间 [roomId]
        this.waitQueue = [];    // 等待服务的房间 [roomId]
        
        // 启动时间片检查定时器 (每秒检查一次)
        setInterval(() => this.checkTimeSlice(), 1000);
    }

    // 处理送风请求
    handleRequest(roomId, payload) {
        const priority = FAN_PRIORITY[payload.fanSpeed] || 2;
        
        // 更新或初始化房间数据
        const room = roomData.get(roomId) || {};
        roomData.set(roomId, {
            ...room,
            roomId,
            mode: payload.mode,
            targetTemp: payload.targetTemp,
            fanSpeed: payload.fanSpeed,
            priority: priority,
            currentTemp: room.currentTemp || 26,
            status: 'waiting', // 初始状态设为等待
            waitStartTime: Date.now() // 开始等待计时
        });

        // 如果已经在服务队列中（修改参数），更新参数并保持服务
        if (this.isInService(roomId)) {
            // 如果修改了风速导致优先级变化，可能需要重新调度，这里简化为更新参数
            this.broadcastUpdate();
            return;
        }

        // 如果已经在等待队列中，更新参数
        if (this.isInWaiting(roomId)) {
            this.broadcastUpdate();
            return; // 已经在排队了，不重复添加，但可能因为优先级改变影响排序
        }

        // === 调度策略 1: 服务未满 ===
        if (this.serviceQueue.length < MAX_SERVICE_CAPACITY) {
            this.startService(roomId);
            return;
        }

        // === 调度策略 2: 服务已满，启动调度 ===
        this.performPriorityScheduling(roomId);
    }

    // 优先级调度策略 (对应图示 2.1)
    performPriorityScheduling(newRoomId) {
        const newRoom = roomData.get(newRoomId);
        
        // 找出服务队列中优先级最低的房间列表
        let minPriority = 999;
        this.serviceQueue.forEach(id => {
            const r = roomData.get(id);
            if (r.priority < minPriority) minPriority = r.priority;
        });

        // 策略 2.1: 请求风速 > 服务对象风速 (存在比新请求优先级低的服务对象)
        if (newRoom.priority > minPriority) {
            // 找出所有最低优先级的房间
            const lowPriorityRooms = this.serviceQueue.filter(id => roomData.get(id).priority === minPriority);
            
            let targetRoomId = null;

            // 策略 2.1.1 & 2.1.2: 找出这些低优先级房间中，服务时长最长的
            // (如果没有记录startTime，就默认它是最早的)
            targetRoomId = lowPriorityRooms.sort((a, b) => {
                const roomA = roomData.get(a);
                const roomB = roomData.get(b);
                return (roomB.startTime || 0) - (roomA.startTime || 0); // 降序：时间越小(越早开始) -> 差值越大? 不，Date.now是增长的。
                // 应该用 (Now - StartTime) 比大小。StartTime 越小，服务时间越长。
                // 所以按 StartTime 升序排列，第一个就是服务时间最长的。
            }).sort((a, b) => (roomData.get(a).startTime || 0) - (roomData.get(b).startTime || 0))[0];

            console.log(`[优先级调度] 房间 ${newRoomId} (P:${newRoom.priority}) 抢占 房间 ${targetRoomId} (P:${minPriority})`);
            
            // 执行抢占
            this.stopService(targetRoomId, 'priority_preempt'); // 停止旧的
            this.addToWaitQueue(targetRoomId); // 旧的进等待队列
            this.startService(newRoomId);      // 启动新的
        } 
        // 策略 2.2: 请求风速 <= 服务对象风速
        else {
            console.log(`[调度] 房间 ${newRoomId} 优先级不足，进入等待队列`);
            this.addToWaitQueue(newRoomId);
        }
    }

    // 时间片轮转检查 (对应图示 2.2)
    checkTimeSlice() {
        if (this.waitQueue.length === 0) return;

        const now = Date.now();

        // 遍历等待队列，看是否有房间等待超时
        // 我们只处理等待时间最长的一个，避免同时切换震荡
        // 按照等待时间排序（等待最久的在前）
        const sortedWaitQueue = [...this.waitQueue].sort((a, b) => {
             return roomData.get(a).waitStartTime - roomData.get(b).waitStartTime;
        });

        for (const waitingRoomId of sortedWaitQueue) {
            const waitingRoom = roomData.get(waitingRoomId);
            const waitDurationSeconds = (now - waitingRoom.waitStartTime) / 1000;

            if (waitDurationSeconds >= TIME_SLICE) {
                // 找到了一个等待超时的房间，尝试去替换一个同优先级的服务房间
                
                // 找出服务队列中，优先级 == 等待房间优先级 的房间
                const samePriorityRunningRooms = this.serviceQueue.filter(id => 
                    roomData.get(id).priority === waitingRoom.priority
                );

                if (samePriorityRunningRooms.length > 0) {
                    // 策略 2.2.1: 找出服务时长最长的
                    const targetRoomId = samePriorityRunningRooms.sort((a, b) => 
                        (roomData.get(a).startTime || 0) - (roomData.get(b).startTime || 0)
                    )[0];

                    console.log(`[时间片调度] 房间 ${waitingRoomId} 等待超时(${waitDurationSeconds.toFixed(1)}s)，轮换 房间 ${targetRoomId}`);

                    this.stopService(targetRoomId, 'time_slice');
                    this.addToWaitQueue(targetRoomId); // 旧的去排队
                    
                    // 从等待队列移除并开始服务
                    this.removeFromWaitQueue(waitingRoomId);
                    this.startService(waitingRoomId);
                    return; // 一次只做一个轮换
                }
            }
        }
    }

    // === 辅助动作函数 ===

    startService(roomId) {
        // 更新数据
        const room = roomData.get(roomId);
        room.status = 'running';
        room.startTime = Date.now();
        room.waitStartTime = null; // 清除等待时间
        roomData.set(roomId, room);

        // 加入服务队列
        if (!this.serviceQueue.includes(roomId)) {
            this.serviceQueue.push(roomId);
        }

        // 发送物理指令
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
        // 更新数据
        const room = roomData.get(roomId);
        if(!room) return;
        
        room.status = reason === 'user_stop' ? 'stopped' : 'waiting'; // 如果是用户关机则是stopped，如果是被调度则是waiting
        roomData.set(roomId, room);

        // 从服务队列移除
        this.serviceQueue = this.serviceQueue.filter(id => id !== roomId);

        // 发送物理指令
        const ws = connections.rooms.get(roomId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'AC_POWER_OFF', reason }));
        }
        
        this.broadcastUpdate();
    }

    addToWaitQueue(roomId) {
        if (!this.waitQueue.includes(roomId)) {
            this.waitQueue.push(roomId);
            // 重置等待开始时间
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
        // 用户主动关机，释放资源
        this.stopService(roomId, 'user_stop');
        this.removeFromWaitQueue(roomId); // 也不在等待队列了

        // 资源释放了，检查等待队列是否有可以上位的
        this.checkBacklog();
    }

    // 资源释放后，检查是否可以让等待的房间上位
    checkBacklog() {
        if (this.serviceQueue.length < MAX_SERVICE_CAPACITY && this.waitQueue.length > 0) {
            // 简单的策略：取等待队列中优先级最高的，如果优先级相同，取等待最久的
            // 先按优先级降序，再按等待时间升序（最早开始等待的在）
            this.waitQueue.sort((a, b) => {
                const rA = roomData.get(a);
                const rB = roomData.get(b);
                if (rA.priority !== rB.priority) return rB.priority - rA.priority;
                return rA.waitStartTime - rB.waitStartTime;
            });

            const nextRoomId = this.waitQueue.shift(); // 取出第一个
            console.log(`[资源释放] 自动补位: 房间 ${nextRoomId}`);
            this.startService(nextRoomId);
        }
    }
    
    isInService(roomId) { return this.serviceQueue.includes(roomId); }
    isInWaiting(roomId) { return this.waitQueue.includes(roomId); }

    // 广播状态给前台和管理员
    broadcastUpdate() {
        const allRooms = Array.from(roomData.values());
        const systemStats = {
            totalRooms: allRooms.length,
            runningRooms: this.serviceQueue.length,
            waitingRooms: this.waitQueue.length,
            capacity: MAX_SERVICE_CAPACITY
        };

        const msg = JSON.stringify({
            type: 'SYSTEM_STATUS_UPDATE', // 统一使用这个类型
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
      // 管理员强制启动，使用默认参数或读取当前房间参数
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

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // === 注册类消息 ===
            if (data.type === 'REGISTER_ROOM') {
                connections.rooms.set(data.roomId, ws);
                // 初始化房间数据
                if (!roomData.has(data.roomId)) {
                    roomData.set(data.roomId, { roomId: data.roomId, status: 'stopped', currentTemp: 26 });
                }
                scheduler.broadcastUpdate();
            }
            else if (data.type === 'REGISTER_DISPATCHER') {
                connections.dispatchers.add(ws);
                scheduler.broadcastUpdate();
            }
            else if (data.type === 'REGISTER_AC_ADMIN') {
                connections.acAdmins.add(ws);
                scheduler.broadcastUpdate();
            }

            // === 业务逻辑消息 ===
            
            // 1. 房间请求送风 (自动进入调度，不再需要人工批准)
            else if (data.type === 'REQUEST_AIR') {
                console.log(`房间 ${data.roomId} 请求送风`);
                scheduler.handleRequest(data.roomId, data.payload);
            }

            // 2. 房间停止/温控暂停
            else if (data.type === 'STOP_REQUEST') {
                console.log(`房间 ${data.roomId} 停止/暂停`);
                scheduler.handleUserStop(data.roomId);
            }

            // 3. 房间实时状态更新 (温度、费用等)
            else if (data.type === 'ROOM_STATUS_UPDATE') {
                const current = roomData.get(data.roomId) || {};
                roomData.set(data.roomId, {
                    ...current,
                    ...data.payload,
                    // 保持调度器维护的状态位，除非是关机
                    status: (current.status === 'stopped') ? 'stopped' : current.status 
                });
                // 这里不频繁广播，可以用节流优化，或者依靠调度器的动作触发广播
                // 为了演示效果，我们暂且广播，但实际生产中应减少频率
                scheduler.broadcastUpdate();
            }

            else if (data.type === 'GET_ALL_ROOMS_STATUS') {
              // 立即发送当前系统状态给该连接
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
              
              // 反馈操作成功
              ws.send(JSON.stringify({ type: 'CONTROL_SUCCESS', roomId: data.roomId }));
              // 广播最新状态
              scheduler.broadcastUpdate();
            }
            
        } catch (e) { console.error(e); }
    });

    ws.on('close', () => {
        // 清理连接
        connections.dispatchers.delete(ws);
        connections.acAdmins.delete(ws);
        // Room连接断开通常不删除数据，只标记离线
    });
});

console.log('自动调度服务器运行中... Capacity:', MAX_SERVICE_CAPACITY, 'TimeSlice:', TIME_SLICE);