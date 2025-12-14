import express from 'express';
import CheckInManager from '../core/CheckInManager.js';
import ReceptionistService from '../core/ReceptionistService.js';
import AccommodationRecordDAO from '../models/AccommodationRecordDAO.js';
import BillingService from '../core/BillingService.js';
import LogDAO from '../models/LogDAO.js';
import RoomCardService from '../core/RoomCardService.js';
import RoomDAO from '../models/RoomDAO.js';

const router = express.Router();

/**
 * POST /api/check-in
 * 办理入住
 */
router.post('/check-in', async (req, res) => {
  try {
    const {
      name,
      idNumber,
      phone,
      gender,
      roomType,
      checkInDate,
      checkOutDate,
      depositAmount
    } = req.body;
    
    // 参数验证
    if (!name || !idNumber || !phone || !roomType || !checkInDate || !checkOutDate) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 转换日期格式
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({
        success: false,
        message: '日期格式不正确'
      });
    }
    
    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: '离店日期必须晚于入住日期'
      });
    }
    
    const result = await CheckInManager.processCheckIn({
      name,
      idNumber,
      phone,
      gender,
      roomType,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      depositAmount: depositAmount || 300
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('入住失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '入住办理失败'
    });
  }
});

/**
 * POST /api/check-out
 * 办理结账
 */
router.post('/check-out', async (req, res) => {
  try {
    const { recordId, paymentMethod } = req.body;
    
    if (!recordId) {
      return res.status(400).json({
        success: false,
        message: '缺少记录ID'
      });
    }
    
    const result = await ReceptionistService.checkOut(recordId, paymentMethod || 'cash');
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('结账失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '结账办理失败'
    });
  }
});

/**
 * GET /api/check-out/list
 * 获取结账列表
 */
router.get('/check-out/list', async (req, res) => {
  try {
    const { roomNumber, status, startDate, endDate } = req.query;
    
    const filters = {};
    if (roomNumber) filters.roomNumber = roomNumber;
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const records = await AccommodationRecordDAO.getCheckOutList(filters);
    
    // 格式化数据供前端使用
    const formattedRecords = records.map(record => {
      // 安全地解析数值，避免 NaN
      const roomFee = parseFloat(record.room_fee_total) || 0;
      const acFee = parseFloat(record.ac_fee_total) || 0;
      const deposit = parseFloat(record.deposit_amount) || 0;
      const totalFee = roomFee + acFee;
      const finalAmount = Math.max(0, totalFee - deposit);
      
      return {
        id: record.record_id,
        recordId: record.record_id,
        roomNumber: record.room_no,
        customerName: record.guest_name,
        idNumber: record.id_number,
        phone: record.phone,
        checkInDate: record.check_in_time.toISOString().split('T')[0],
        checkOutDate: record.check_out_time ? record.check_out_time.toISOString().split('T')[0] : null,
        roomType: (record.room_type === 'standard' || record.room_type === '标准间') ? '标准间' : 
                  (record.room_type === 'double' || record.room_type === '豪华间' || record.room_type === '商务间') ? '大床房' : '未知',
        accommodationFee: roomFee,
        acUsageFee: acFee,
        deposit: deposit,
        totalFee: totalFee,
        finalAmount: finalAmount,
        status: record.status === '在住' ? 'pending' : 'completed',
        paymentMethod: '', // 可以从其他表获取
        checkOutTime: record.check_out_time ? record.check_out_time.toISOString().replace('T', ' ').substring(0, 16) : ''
      };
    });
    
    res.json({
      success: true,
      data: formattedRecords
    });
  } catch (error) {
    console.error('获取结账列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取结账列表失败'
    });
  }
});

/**
 * GET /api/check-out/room/:roomNo
 * 根据房间号获取当前在住的记录（用于顾客自助结账）
 * 注意：这个路由必须在 /check-out/:recordId 之前定义，否则会被误匹配
 */
router.get('/check-out/room/:roomNo', async (req, res) => {
  try {
    // 去除房间号前后的空格
    const roomNo = req.params.roomNo.trim();
    console.log(`[查询在住记录] 房间号: "${roomNo}"`);
    
    const record = await ReceptionistService.findActiveRecordByRoomNo(roomNo);
    
    if (!record) {
      console.log(`[查询在住记录] 未找到房间号 "${roomNo}" 的在住记录`);
      // 尝试查询该房间是否存在
      const RoomDAO = (await import('../models/RoomDAO.js')).default;
      const room = await RoomDAO.findByRoomNo(roomNo);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: `房间号 "${roomNo}" 不存在`
        });
      }
      // 房间存在但没有在住记录，返回更详细的错误信息
      return res.status(404).json({
        success: false,
        message: `房间号 "${roomNo}" 当前没有在住的记录，可能已退房或尚未入住`
      });
    }
    
    console.log(`[查询在住记录] 找到记录 ID: ${record.record_id}, 状态: ${record.status}`);
    
    // 获取空调使用明细
    const acLogs = await LogDAO.findByRecordId(record.record_id);
    
    // 格式化空调使用明细
    const acUsageDetails = acLogs.map(log => ({
      id: log.log_id,
      time: `${new Date(log.start_time).toLocaleString('zh-CN')} - ${new Date(log.end_time).toLocaleString('zh-CN')}`,
      duration: calculateDuration(log.start_time, log.end_time),
      fanSpeed: log.fan_speed === 'low' ? '低' : log.fan_speed === 'medium' ? '中' : '高',
      fee: parseFloat(log.fee || 0)
    }));
    
    // 计算实际住宿天数
    const checkInDate = new Date(record.check_in_time);
    const checkOutDate = record.check_out_time ? new Date(record.check_out_time) : new Date();
    const actualDays = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // 获取空调费用
    const acFee = await BillingService.getACFee(record.record_id);
    
    // 重新计算费用（以防有变化）
    const roomFee = BillingService.calculateRoomFee(
      record.base_price,
      record.check_in_time,
      checkOutDate
    );
    
    const totalFee = roomFee + acFee;
    const depositRefund = BillingService.calculateDepositRefund(
      roomFee,
      acFee,
      record.deposit_amount
    );
    const finalAmount = BillingService.calculateFinalAmount(
      roomFee,
      acFee,
      record.deposit_amount
    );
    
    res.json({
      success: true,
      data: {
        recordId: record.record_id,
        roomNumber: record.room_no,
        roomType: (record.room_type === 'standard' || record.room_type === '标准间') ? '标准间' : 
                  (record.room_type === 'double' || record.room_type === '豪华间' || record.room_type === '商务间') ? '大床房' : '未知',
        checkInDate: record.check_in_time.toISOString().split('T')[0],
        checkOutDate: checkOutDate.toISOString().split('T')[0],
        actualDays: Math.max(1, actualDays),
        accommodationFee: roomFee,
        acUsageFee: acFee,
        deposit: parseFloat(record.deposit_amount || 0),
        depositRefund: depositRefund,
        totalFee: totalFee,
        finalAmount: finalAmount,
        acUsageDetails: acUsageDetails
      }
    });
  } catch (error) {
    console.error('获取房间记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取房间记录失败'
    });
  }
});

/**
 * GET /api/check-out/:recordId
 * 获取结账详情
 * 注意：这个路由必须在 /check-out/room/:roomNo 之后定义
 */
router.get('/check-out/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const record = await AccommodationRecordDAO.findById(recordId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('获取详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取详情失败'
    });
  }
});

// 辅助函数：计算时长
function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分' : ''}`;
  }
  return `${minutes}分钟`;
}

/**
 * GET /api/room-card/:recordId
 * 根据记录ID获取房卡信息
 */
router.get('/room-card/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const cardInfo = await RoomCardService.generateRoomCard(parseInt(recordId));
    
    res.json({
      success: true,
      data: cardInfo
    });
  } catch (error) {
    console.error('获取房卡失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取房卡失败'
    });
  }
});

/**
 * GET /api/room-card/room/:roomNo
 * 根据房间号获取房卡信息
 */
router.get('/room-card/room/:roomNo', async (req, res) => {
  try {
    const { roomNo } = req.params;
    const cardInfo = await RoomCardService.getRoomCardByRoomNo(roomNo);
    
    res.json({
      success: true,
      data: cardInfo
    });
  } catch (error) {
    console.error('获取房卡失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取房卡失败'
    });
  }
});

/**
 * POST /api/room-card/validate
 * 验证房卡有效性
 */
router.post('/room-card/validate', async (req, res) => {
  try {
    const { cardNumber } = req.body;
    
    if (!cardNumber) {
      return res.status(400).json({
        success: false,
        message: '缺少房卡号'
      });
    }
    
    const result = await RoomCardService.validateRoomCard(cardNumber);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('验证房卡失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '验证房卡失败'
    });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const rooms = await RoomDAO.getAllRooms(); // 调用 DAO 获取房间数据
    
    // 数据映射和状态处理
    const mappedRooms = rooms.map(room => {
      let currentStatus = room.status;

      // 如果有任何 '在住' 记录 (is_occupied > 0)，则强制状态为 '在住' (occupied)
      if (room.is_occupied > 0) {
        currentStatus = 'occupied'; // 使用英文状态方便前端统一判断
      } else if (room.status === '绌洪棽' || room.status === '空闲') {
          currentStatus = 'available'; // 统一空闲状态
      } else if (room.status === '待清理' || room.status === 'maintenance') {
          currentStatus = 'maintenance'; // 统一维护状态
      }
      
      return {
        id: room.room_id,
        roomNo: room.room_no,
        name: `${room.room_type}-${room.room_no}`,
        type: room.room_type,
        floor: room.floor ? `${room.floor}楼` : '未指定',
        status: currentStatus, // 实时状态
        basePrice: parseFloat(room.base_price) 
      };
    });

    res.json({
      success: true,
      data: mappedRooms
    });
  } catch (error) {
    console.error('获取房间列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取房间列表失败'
    });
  }
});


export default router;

