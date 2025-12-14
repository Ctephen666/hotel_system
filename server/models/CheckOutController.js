import AccommodationRecordDAO from './AccommodationRecordDAO.js';
import RoomDAO from './RoomDAO.js';
import BillingService from '../core/BillingService.js';
import LogDAO from './LogDAO.js';

/**
 * 格式化时间为 YYYY-MM-DD HH:mm
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的时间字符串
 */
const formatDateTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => n < 10 ? '0' + n : n;
    
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
};

class CheckOutController {
  
  /**
   * GET /api/check-out/room/:roomNo
   * 根据房间号获取当前在住记录的实时账单（用于顾客自助结账）
   */
  async getActiveRecordByRoomNo(req, res) {
    const { roomNo } = req.params;
    
    try {
      // 1. 根据房间号查找在住记录，并获取房间价格等信息
      const recordInfo = await AccommodationRecordDAO.findActiveRecordByRoomNo(roomNo); 

      if (!recordInfo) {
        return res.status(200).send({ success: false, message: '未找到该房间的在住记录' });
      }
      
      const { 
        record_id, 
        room_no, 
        room_type, 
        base_price, 
        check_in_time, 
        deposit_amount 
      } = recordInfo;
      
      const checkOutTime = new Date(); // 使用当前时间作为临时退房时间
      const checkInDate = new Date(check_in_time);
      
      // 2. 费用计算
      // 计算住宿天数（BillingService.calculateRoomFee内部会计算，这里只是为了返回给前端）
      const diffTime = checkOutTime.getTime() - checkInDate.getTime();
      const dayDurationMs = 1000 * 60 * 60 * 24;
      const actualDays = Math.max(1, Math.ceil(diffTime / dayDurationMs));
      
      // 住宿费用
      const accommodationFee = BillingService.calculateRoomFee(base_price, check_in_time, checkOutTime);
      
      // 空调费用
      const acUsageFee = await BillingService.getACFee(record_id); 
      
      const totalFee = accommodationFee + acUsageFee;
      
      // 最终应付/退款金额
      const finalAmount = BillingService.calculateFinalAmount(accommodationFee, acUsageFee, deposit_amount);
      const depositRefund = BillingService.calculateDepositRefund(accommodationFee, acUsageFee, deposit_amount);
      
      // 3. 获取并格式化空调使用明细
      const logs = await LogDAO.findByRecordId(record_id);
      
      const fanSpeedMap = {
        'low': '低',
        'medium': '中',
        'high': '高'
      };
      
      // 格式化数据以匹配 CustomerCheckOut.jsx 的 columns
      const acUsageDetails = logs.map(log => {
          const startTime = new Date(log.start_time);
          const endTime = new Date(log.end_time);
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationMinutes = durationMs / (1000 * 60);
          
          return {
              id: log.log_id,
              time: `${formatDateTime(startTime)} 至 ${formatDateTime(endTime)}`, 
              duration: `${durationMinutes.toFixed(0)} 分钟`,
              fanSpeed: fanSpeedMap[log.fan_speed] || log.fan_speed, // 转换风速为中文
              fee: parseFloat(log.fee).toFixed(2),
          };
      });
      
      // 4. 组装并返回数据 (注意字段名需与前端 billData 结构匹配)
      const billData = {
        recordId: record_id,
        roomNumber: room_no,
        roomType: room_type,
        checkInDate: formatDateTime(checkInDate),
        checkOutDate: formatDateTime(checkOutTime),
        actualDays: actualDays,
        deposit: parseFloat(deposit_amount),
        
        accommodationFee: parseFloat(accommodationFee.toFixed(2)),
        acUsageFee: parseFloat(acUsageFee.toFixed(2)),
        totalFee: parseFloat(totalFee.toFixed(2)),
        finalAmount: parseFloat(finalAmount.toFixed(2)),
        depositRefund: parseFloat(depositRefund.toFixed(2)),
        acUsageDetails: acUsageDetails 
      };
      
      res.send({ success: true, data: billData });
    } catch (error) {
      console.error('获取结账账单失败:', error);
      res.status(500).send({ success: false, message: '服务器内部错误' });
    }
  }

  /**
   * POST /api/check-out
   * 确认办理退房结账
   */
  async processCheckOut(req, res) {
    const { recordId, paymentMethod } = req.body;
    
    if (!recordId) {
      return res.status(400).send({ success: false, message: '缺少住宿记录ID' });
    }
    
    try {
      // 1. 查找记录和费用信息
      const recordInfo = await AccommodationRecordDAO.findById(recordId); 
      if (!recordInfo || recordInfo.status !== '在住') {
        return res.status(200).send({ success: false, message: '记录不存在或非在住状态' });
      }
      
      const { room_id, base_price, check_in_time, deposit_amount } = recordInfo;
      const checkOutTime = new Date();
      
      // 2. 重新计算最终费用（以确保数据实时准确）
      const accommodationFee = BillingService.calculateRoomFee(base_price, check_in_time, checkOutTime);
      const acUsageFee = await BillingService.getACFee(recordId);
      
      const totalFee = accommodationFee + acUsageFee;
      
      // 3. 更新住宿记录
      const updateData = {
        check_out_time: checkOutTime,
        room_fee_total: parseFloat(accommodationFee.toFixed(2)),
        ac_fee_total: parseFloat(acUsageFee.toFixed(2)),
        total_fee: parseFloat(totalFee.toFixed(2)),
        status: '已退房',
        payment_method: paymentMethod 
      };
      
      await AccommodationRecordDAO.update(recordId, updateData);
      
      // 4. 更新房间状态为 'available' 或 '空闲'
      await RoomDAO.updateStatus(room_id, 'available'); 
      
      res.send({ success: true, message: '结账成功', data: { recordId, totalFee: totalFee.toFixed(2) } });
      
    } catch (error) {
      console.error('处理结账失败:', error);
      res.status(500).send({ success: false, message: '服务器内部错误' });
    }
  }

  /**
   * GET /api/check-out/list
   * 获取结账列表
   */
  async getCheckOutList(req, res) {
    try {
      const filters = req.query;
      const list = await AccommodationRecordDAO.getCheckOutList(filters);
      res.send({ success: true, data: list });
    } catch (error) {
      console.error('获取结账列表失败:', error);
      res.status(500).send({ success: false, message: '服务器内部错误' });
    }
  }

  /**
   * GET /api/check-out/:recordId
   * 获取结账详情
   */
  async getCheckOutDetail(req, res) {
    try {
      const { recordId } = req.params;
      // 1. 获取住宿记录详情
      const detail = await AccommodationRecordDAO.findById(recordId); 
      
      if (!detail) {
        return res.status(404).send({ success: false, message: '未找到结账记录' });
      }
      
      // 2. 获取空调明细
      const acUsageDetails = await LogDAO.findByRecordId(recordId); 
      
      res.send({ 
        success: true, 
        data: { 
          ...detail, 
          acUsageDetails // 返回原始日志数据，前端或另一个服务层可进行格式化
        } 
      });
    } catch (error) {
      console.error('获取结账详情失败:', error);
      res.status(500).send({ success: false, message: '服务器内部错误' });
    }
  }
}

export default new CheckOutController();