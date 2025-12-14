import express from 'express';
import pool from '../config/db.config.js';
import ReceptionistService from '../core/ReceptionistService.js';
import RoomController from '../models/RoomController.js';

const router = express.Router();
// 假设您已经设置了数据库连接池


// 顾客登录 API
router.post('/login', async (req, res) => {
    const { room_no, phone } = req.body;

    if (!room_no || !phone) {
        return res.status(400).json({ success: false, message: '房间号和手机号不能为空' });
    }

    try {
        const query = `
            SELECT
                g.name AS userName,
                r.room_no AS roomNo,
                ar.record_id
            FROM
                room r
            JOIN
                accommodation_record ar ON r.room_id = ar.room_id
            JOIN
                guest g ON ar.guest_id = g.guest_id
            WHERE
                r.room_no = ?
                AND g.phone = ?
                AND ar.status = '在住'
        `;

        const [results] = await pool.execute(query, [room_no, phone]);

        if (results.length > 0) {
            const userData = results[0];
            // 登录成功，返回用户信息和重要的 recordId
            return res.json({
                success: true,
                message: `登录成功！欢迎 ${userData.userName}`,
                data: userData
            });
        } else {
            // 查不到符合条件的在住记录
            return res.json({
                success: false,
                message: '登录失败：房间号或手机号错误，或您未办理入住。'
            });
        }

    } catch (error) {
        console.error('顾客登录错误:', error);
        return res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

router.get('/room-records/current', async (req, res) => {
    try {
      const roomNo = req.query.room_no; 
      
      if (!roomNo) {
        return res.status(400).json({
          success: false,
          message: '缺少 room_no 参数'
        });
      }
      
      // 使用 ReceptionistService 查找当前在住的记录
      // 注意：ReceptionistService 必须是已导入的 (已在文件顶部导入)
      const record = await ReceptionistService.findActiveRecordByRoomNo(roomNo);
      
      if (!record) {
        // 房间不存在或无在住记录
        return res.status(404).json({
          success: false,
          message: `房间号 ${roomNo} 当前无在住记录`
        });
      }
      
      // 返回 recordId
      res.json({
        success: true,
        data: {
          recordId: record.record_id,
          roomNo: record.room_no
        }
      });
    } catch (error) {
      console.error('获取房间当前记录ID失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取房间当前记录ID失败'
      });
    }
  });

  router.get('/convert-no', RoomController.convertRoomNoToId);

  router.get('/room-status', RoomController.getRoomStatus);

export default router;