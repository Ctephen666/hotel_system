// RoomController.js

import RoomDAO from './RoomDAO.js';

class RoomController {
    constructor() {
        this.allRooms = []; 
    }
    
    /**
     * 用于从 server.js 注入 live Room 列表
     */
    initialize(allRooms) {
        this.allRooms = allRooms;
        console.log(`[RoomController] 已初始化，管理 ${this.allRooms.length} 个房间实例。`);
    }

    /**
     * 根据房间号查找内存中的 Room 实例
     * @param {string} roomNo - 房间号 (e.g. '101')
     * @returns {Promise<Room|null>} 内存中的 Room 实例或 null
     */
    async findRoomByRoomNo(roomNo) {
        // 1. 先从数据库获取房间ID (roomId)
        const roomDataDB = await RoomDAO.findByRoomNo(roomNo);
        if (!roomDataDB) {
            return null; // 房间不存在于数据库
        }

        const roomId = roomDataDB.room_id;

        // 2. 根据房间ID查找内存中的 Room 实例
        // 假设 this.allRooms 数组中的 Room 实例都有 roomId 属性
        const liveRoom = this.allRooms.find(room => room.roomId === roomId);

        return liveRoom || null;
    }

    /**
     * 顾客查询房间的实时状态（包含初始温度）
     */
    async getRoomStatus(req, res) {
        const { room_no } = req.query;

        if (!room_no) {
            return res.status(400).json({ success: false, message: '缺少房间号 room_no' });
        }

        try {
            // 1. 从数据库/DAO获取房间静态信息（包含 initial_temp）
            const roomDataDB = await RoomDAO.findByRoomNo(room_no);

            if (!roomDataDB) {
                return res.status(404).json({ success: false, message: `房间 ${room_no} 不存在` });
            }

            const initialTemp = parseFloat(roomDataDB.initial_temp || 26.00);

            // 2. 从内存/调度器获取房间实时信息
            const liveRoom = await this.findRoomByRoomNo(room_no);

            // 3. 组合静态和实时数据
            let currentTemp = initialTemp;
            let status = 'off'; 
            let targetTemp = 24;
            let mode = 'cool';
            let fanSpeed = 'medium';

            if (liveRoom) {
                // 如果房间实例在内存中，使用其实时状态
                currentTemp = liveRoom.currentTemp;
                status = liveRoom.status;
                targetTemp = liveRoom.targetTemp;
                mode = liveRoom.mode;
                fanSpeed = liveRoom.fanSpeed;
            }

            // 4. 返回结果
            return res.json({
                success: true,
                data: {
                    roomNo: room_no,
                    currentTemp: parseFloat(currentTemp.toFixed(2)),
                    initialTemp: initialTemp, // 返回初始温度
                    status: status,
                    targetTemp: targetTemp,
                    mode: mode,
                    fanSpeed: fanSpeed,
                }
            });

        } catch (error) {
            console.error('查询房间实时状态失败:', error);
            return res.status(500).json({ success: false, message: '服务器内部错误' });
        }
    }


    /**
     * 将房间号转换为房间ID，并返回 initialTemp
     */
    async convertRoomNoToId(req, res) {
        try {
            const { room_no } = req.query;
            if (!room_no) {
                return res.json({ success: false, message: 'room_no 缺失' });
            }

            const room = await RoomDAO.findByRoomNo(room_no);
            if (!room) {
                return res.json({ success: false, message: '房间不存在' });
            }

            return res.json({
                success: true,
                data: {
                    roomId: room.room_id,
                    roomNo: room.room_no,
                    initialTemp: parseFloat(room.initial_temp || 26.00), 
                }
            });

        } catch (err) {
            res.json({ success: false, message: err.message });
        }
    }
}

export default new RoomController();