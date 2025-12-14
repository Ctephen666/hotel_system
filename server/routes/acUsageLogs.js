import express from 'express';

import pool from '../config/db.config.js'

const router = express.Router();

/**
 * @route POST /api/ac-usage-logs
 * @desc 接收前端发送的空调使用日志，并插入到 air_conditioner_log 表中。
 */

router.post('/ac-usage-logs', async (req, res) => {
    try {
        const {
            record_id,
            room_no,          
            start_time,
            end_time,
            fan_speed,
            mode,
            target_temp,
            current_temp,
            target_temp_diff,
            energy_used,
            fee,
            operation_type
        } = req.body;


        if (!record_id || !room_no || !start_time || !end_time) {
            console.warn('[AC Log] 缺少关键参数:', req.body);
            // 如果缺少关键参数，返回 400 Bad Request
            return res.status(400).json({ success: false, message: '缺少关键参数 (record_id, room_no, start_time, end_time)' });
        }

        const [roomResult] = await pool.query('SELECT room_id FROM room WHERE room_no = ?', [room_no]);
        if (roomResult.length === 0) {
            console.error(`[AC Log] 房间号 ${room_no} 在 room 表中不存在.`);
            // 找不到房间，返回 404 Not Found 或 409 Conflict
            return res.status(409).json({ success: false, message: `外键约束失败：房间号 ${room_no} 不存在` });
        }
        
        const roomPrimaryKeyId = roomResult[0].room_id; 

        const numericRecordId = parseInt(record_id, 10);
        const numericTargetTemp = parseFloat(target_temp);
        const numericCurrentTemp = parseFloat(current_temp);
        const numericTargetTempDiff = parseFloat(target_temp_diff);
        const numericEnergyUsed = parseFloat(energy_used);
        const numericFee = parseFloat(fee);


        const sql = `
            INSERT INTO air_conditioner_log 
            (record_id, room_id, start_time, end_time, fan_speed, mode, target_temp, 
             current_temp, target_temp_diff, energy_used, fee, operation_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            numericRecordId,    
            roomPrimaryKeyId,      
            start_time, 
            end_time,   
            fan_speed,
            mode,
            numericTargetTemp,
            numericCurrentTemp,
            numericTargetTempDiff,
            numericEnergyUsed,
            numericFee,
            operation_type
        ];

        // 打印 SQL 和 Values 以供调试（在生产环境可以移除）
        console.log('Attempting to insert AC Log. Values:', values);

        // 执行数据库插入操作
        const [result] = await pool.query(sql, values); 
        
        res.json({ 
            success: true, 
            message: '日志记录成功', 
            logId: result.insertId 
        });

    } catch (error) {
        console.error('插入空调日志失败:', error);
        // 返回 400 状态码更合适，因为它是由客户端提供的数据不匹配数据库约束引起的。
        // 但如果错误是服务器内部（如连接断开），则返回 500。
        // 为了方便前端处理，我们这里直接返回 409 Conflict/400 Bad Request
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(409).json({ success: false, message: '外键约束失败：房间或入住记录不存在' });
        }
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

export default router;