import { WebSocketServer } from 'ws';

import TimeHelper from './core/TimeHelper.js';
import Scheduler from './core/Scheduler.js';
import Room from './core/Room.js';
import pool from './config/db.config.js';

import express from 'express';
import cors from 'cors';
import checkInRoutes from './routes/checkIn.js';
import reportRoutes from './routes/reports.js';
import customerLoginRoutes from './routes/login.js';
import acUsageRoutes from './routes/acUsageLogs.js'
import checkOutRoutes from './routes/checkOut.js';

const PORT = 8080;
const DEFAULT_INITIAL_TEMP = 26;
const DEFAULT_PRICE_PER_NIGHT = 100;

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
app.use('/api/acUsage',acUsageRoutes);
app.use('/api/check-out',checkOutRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动 HTTP 服务器
app.listen(HTTP_PORT,'0.0.0.0', () => {
  console.log(`HTTP 服务器运行在端口 ${HTTP_PORT}`);
});


// 客户端类型常量
const CLIENT_TYPES = {
    DISPATCHER: 'REGISTER_DISPATCHER',
    CONSOLE: 'REGISTER_AC_ADMIN',
    ROOM: 'REGISTER_ROOM'
};

const systemState = {
    scheduler: new Scheduler(),
    allRooms: [],
    clients: new Map(),
    roomRecordMap: new Map() 
};

// 获取房间的入住记录ID
async function getRoomRecordId(roomId) {
    try {
        const sql = `
            SELECT record_id
            FROM accommodation_record
            WHERE room_id = ? AND status = 'checked_in'
            ORDER BY check_in_date DESC
            LIMIT 1
        `;
        
        const [rows] = await pool.execute(sql, [roomId]);
        
        if (rows.length > 0) {
            const recordId = rows[0].record_id;
            systemState.roomRecordMap.set(roomId, recordId);
            return recordId;
        }
        
        return null;
    } catch (error) {
        console.error(`[数据库] 获取房间 ${roomId} 的入住记录失败:`, error.message);
        return null;
    }
}

function getRoomDataForBroadcast(room) {
    const billing = room.billing;

    return {
        roomId: room.roomId,
        currentTemp: room.currentTemp.toFixed(2),
        targetTemp: room.targetTemp,
        fanSpeed: room.fanSpeed,
        mode: room.mode,
        status: room.status,
        usageFee: billing.totalAcFee.toFixed(2),
        powerConsumed: billing.totalEnergyConsumed.toFixed(4),
        timeElapsed: room.runTime,
        recordId: systemState.roomRecordMap.get(room.roomId) || null
    };
}

/**
 * 广播全局状态
 */
function broadcastStatus() {
    const allRoomData = systemState.allRooms.map(r => getRoomDataForBroadcast(r));

    const statusMessage = {
        type: "SYSTEM_STATUS_UPDATE",
        payload: {
            rooms: allRoomData,
            serviceQueue: systemState.scheduler.serviceQueue.map(r => r.roomId),
            waitQueue: systemState.scheduler.waitQueue.map(r => r.roomId),
            systemStatus: {
                totalRooms: systemState.allRooms.length,
                runningRooms: allRoomData.filter(r => r.status === "running").length,
                maxCapacity: systemState.scheduler.MAX_SERVICE_CAPACITY,
                waitingRooms: allRoomData.filter(r => r.status === "waiting").length,
                stoppedRooms: allRoomData.filter(r => r.status === "stopped").length
            }
        }
    };

    // 实时推送给所有客户端
    systemState.clients.forEach((info, ws) => {
        if (ws.readyState !== ws.OPEN) return;

        if (info.type === CLIENT_TYPES.DISPATCHER || info.type === CLIENT_TYPES.CONSOLE) {
            ws.send(JSON.stringify(statusMessage));
        }

        if (info.type === CLIENT_TYPES.ROOM) {
            const roomData = allRoomData.find(r => r.roomId === info.roomId);
            if (roomData) {
                ws.send(JSON.stringify({
                    type: "ROOM_STATUS_UPDATE",
                    payload: {
                        ...roomData,
                        // 添加温度变化率
                        tempChangeRate: calculateTempChangeRate(roomData),
                        // 添加调度状态
                        scheduleStatus: getScheduleStatus(info.roomId)
                    }
                }));
            }
        }
    });
}

// 添加温度变化率计算
function calculateTempChangeRate(roomData) {
    const baseRate = 0.5; // 每分钟0.5度
    let rate = baseRate;
    
    if (roomData.fanSpeed === "high") rate *= 2;
    if (roomData.fanSpeed === "low") rate *= 2/3;
    
    if (roomData.status !== "running") {
        // 非运行状态显示回温率
        return roomData.status === "off" ? 0.5 : 0.5;
    }
    
    return rate.toFixed(3);
}

// 添加调度状态获取
function getScheduleStatus(roomId) {
    const scheduler = systemState.scheduler;
    if (scheduler.serviceQueue.find(r => r.roomId === roomId)) {
        return "running";
    }
    if (scheduler.waitQueue.find(r => r.roomId === roomId)) {
        return "waiting";
    }
    return "idle";
}

function validateAndFixRoomTemp(room) {
    // 确保所有温度值都是数字
    room.initialTemp = parseFloat(room.initialTemp) || DEFAULT_INITIAL_TEMP;
    room.currentTemp = parseFloat(room.currentTemp) || room.initialTemp;
    room.targetTemp = parseFloat(room.targetTemp) || room.initialTemp;
    
    // 记录验证结果
    console.log(`[验证] 房间 ${room.roomId} 温度: 初始=${room.initialTemp}, 当前=${room.currentTemp}, 目标=${room.targetTemp}`);
  }
  
  // 在创建 Room 实例后立即调用
  // 在 simulationLoop 中也定期调用
  function simulationLoop() {
    // 实时更新所有房间状态
    systemState.allRooms.forEach(room => {
      // 验证温度
      validateAndFixRoomTemp(room);
      
      const inService = systemState.scheduler.serviceQueue
      .find(r => r.roomId === room.roomId);

    if (inService) {
      // 在服务队列中 → 一律视为运行中
      room.status = "running";
      room.serve();
    } else {
      room.reWarm();
    }
    });
  
    // 实时调度检查
    systemState.scheduler.dispatch();
  
    // 实时广播状态
    broadcastStatus();
    
    console.log(`[更新] ${new Date().toLocaleTimeString()} 系统状态已更新`);
  }

/**
 * WebSocket 服务器
 */
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
    console.log("[WebSocket] 新连接");

    ws.on("message", async (rawMessage) => {
        const msg = JSON.parse(rawMessage.toString());

        // 注册客户端
        if (Object.values(CLIENT_TYPES).includes(msg.type)) {
            const type = msg.type;
            const roomId = msg.payload?.roomId;
            const recordId = msg.payload?.recordId;

            systemState.clients.set(ws, { type, roomId });
            
            if (type === CLIENT_TYPES.ROOM && roomId) {
                // 如果提供了recordId，直接使用
                if (recordId) {
                    systemState.roomRecordMap.set(roomId, recordId);
                    console.log(`[注册] 房间 ${roomId}，入住记录ID: ${recordId}`);
                } else {
                    // 否则从数据库获取
                    const dbRecordId = await getRoomRecordId(roomId);
                    if (dbRecordId) {
                        console.log(`[注册] 房间 ${roomId}，数据库记录ID: ${dbRecordId}`);
                    } else {
                        console.log(`[注册] 房间 ${roomId}，未找到入住记录`);
                    }
                }
            }
            return;
        }

        // 房间控制
        if (msg.type === "CUSTOMER_CONTROL") {
            const { roomId, targetTemp, fanSpeed, mode, recordId, initialTemp } = msg.payload;
          
            let room = systemState.allRooms.find(r => r.roomId === roomId);
          
            if (!room) {
              // 获取或设置入住记录ID
              let roomRecordId = systemState.roomRecordMap.get(roomId);
              if (!roomRecordId && recordId) {
                roomRecordId = recordId;
                systemState.roomRecordMap.set(roomId, recordId);
              } else if (!roomRecordId) {
                roomRecordId = await getRoomRecordId(roomId);
              }
              
              console.log(`[控制] 房间 ${roomId}，入住记录ID: ${roomRecordId || '未找到'}`);
              
              // 创建房间实例，使用传递的初始温度或默认值
              let actualInitialTemp;
              
              // 如果有传递的 initialTemp，使用它
              if (initialTemp !== undefined && initialTemp !== null) {
                actualInitialTemp = parseFloat(initialTemp);
                console.log(`[控制] 使用传递的初始温度: ${actualInitialTemp}`);
              } else {
                // 否则尝试从数据库获取
                try {
                  const [rows] = await pool.execute(
                    'SELECT initial_temp FROM room WHERE room_id = ?',
                    [roomId]
                  );
                  if (rows.length > 0 && rows[0].initial_temp) {
                    actualInitialTemp = parseFloat(rows[0].initial_temp);
                    console.log(`[控制] 从数据库获取初始温度: ${actualInitialTemp}`);
                  } else {
                    actualInitialTemp = DEFAULT_INITIAL_TEMP;
                    console.log(`[控制] 使用默认初始温度: ${actualInitialTemp}`);
                  }
                } catch (error) {
                  console.error(`[控制] 获取房间初始温度失败:`, error.message);
                  actualInitialTemp = DEFAULT_INITIAL_TEMP;
                }
              }
              
              // 创建房间实例
              room = new Room(roomId, actualInitialTemp, DEFAULT_PRICE_PER_NIGHT, systemState.scheduler);
              systemState.allRooms.push(room);
              
              console.log(`[控制] 创建新房间实例，ID: ${roomId}，初始温度: ${actualInitialTemp}`);
            }
          
            // 记录当前运行开始时间
            if (room.status === "off") {
              room.currentRunStartTime = Date.now();
            }
            
            room.control(targetTemp, fanSpeed, mode);

            return;
          }

        if (msg.type === "CUSTOMER_POWER_OFF") {
            const { roomId } = msg.payload;
            const room = systemState.allRooms.find(r => r.roomId === roomId);

            if (room) {
                
                room.powerOff();
            }
            return;
        }
        
        if (msg.type === "GET_ROOM_RECORD") {
            const { roomId } = msg.payload;
            const recordId = await getRoomRecordId(roomId);
            
            ws.send(JSON.stringify({
                type: "ROOM_RECORD_INFO",
                payload: {
                    roomId,
                    recordId
                }
            }));
            return;
        }
    });

    ws.on("close", () => {
        const info = systemState.clients.get(ws);
        if (info && info.type === CLIENT_TYPES.ROOM) {
            console.log(`[断开] 房间 ${info.roomId} 断开连接`);
        }
        systemState.clients.delete(ws);
    });
});

const loopId = TimeHelper.startSimulationLoop(simulationLoop);

// 优雅关闭数据库连接池
process.on('SIGINT', () => {
    console.log('退出中...');
    TimeHelper.stopSimulationLoop(loopId);
    wss.close(() => {
        pool.end();
        process.exit(0);
    });
});

// 定期检查数据库连接
setInterval(() => {
    pool.query('SELECT 1').catch(err => {
        console.error('[数据库] 连接检查失败:', err.message);
    });
}, 60000); // 每分钟检查一次

console.log(`[启动] WebSocket服务器运行在端口 ${PORT}`);
console.log(`[数据库] 已连接到 ${process.env.DB_HOST || '10.29.147.232'}:${process.env.DB_NAME || 'hotel_ac'}`);