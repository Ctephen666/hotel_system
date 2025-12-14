import AccommodationRecordDAO from '../models/AccommodationRecordDAO.js';
import RoomDAO from '../models/RoomDAO.js';
import BillingService from './BillingService.js';

class ReceptionistService {
  
  /**
   * 处理结账业务逻辑
   * @param {Number} recordId - 住宿记录ID
   * @param {String} paymentMethod - 支付方式 (cash/alipay/wechat)
   * @returns {Promise<Object>} 结账结果
   */
  async checkOut(recordId, paymentMethod = 'cash') {
    // 1. 获取住宿记录
    const record = await AccommodationRecordDAO.findById(recordId);
    if (!record) {
      throw new Error('住宿记录不存在');
    }
    
    if (record.status === '已退房') {
      throw new Error('该房间已经退房');
    }
    
    // 2. 获取空调费用
    const acFee = await BillingService.getACFee(recordId);
    
    // 3. 重新计算住宿费（以防有变化）
    const checkOutTime = new Date();
    const roomFee = BillingService.calculateRoomFee(
      record.base_price,
      record.check_in_time,
      checkOutTime
    );
    
    // 4. 计算最终应付金额
    const totalFee = roomFee + acFee;
    const finalAmount = BillingService.calculateFinalAmount(
      roomFee,
      acFee,
      record.deposit_amount
    );
    
    const depositRefund = BillingService.calculateDepositRefund(
      roomFee,
      acFee,
      record.deposit_amount
    );
    
    // 5. 更新住宿记录
    const updatedRecord = await AccommodationRecordDAO.update(recordId, {
      check_out_time: checkOutTime,
      room_fee_total: roomFee,
      ac_fee_total: acFee,
      status: '已退房'
    });
    
    // 6. 更新房间状态为"maintenance"
    await RoomDAO.updateStatus(record.room_id, 'maintenance');
    
    // 7. 返回结账结果
    return {
      success: true,
      recordId: recordId,
      roomNumber: record.room_no,
      guestName: record.guest_name,
      checkInTime: record.check_in_time,
      checkOutTime: checkOutTime,
      roomFee: roomFee,
      acFee: acFee,
      totalFee: totalFee,
      deposit: record.deposit_amount,
      finalAmount: finalAmount,
      depositRefund: depositRefund,
      paymentMethod: paymentMethod
    };
  }
  
  /**
   * 根据房间号查找当前在住的记录
   */
  async findActiveRecordByRoomNo(roomNo) {
    // 去除空格并统一处理
    const cleanRoomNo = roomNo.trim();
    console.log(`[ReceptionistService] 查找房间号: "${cleanRoomNo}"`);
    
    const room = await RoomDAO.findByRoomNo(cleanRoomNo);
    if (!room) {
      console.log(`[ReceptionistService] 房间号 "${cleanRoomNo}" 不存在`);
      return null;
    }
    
    console.log(`[ReceptionistService] 找到房间 ID: ${room.room_id}, 房间号: ${room.room_no}`);
    const record = await AccommodationRecordDAO.findActiveByRoomId(room.room_id);
    
    if (!record) {
      console.log(`[ReceptionistService] 房间 ID ${room.room_id} 没有在住记录`);
    } else {
      console.log(`[ReceptionistService] 找到在住记录 ID: ${record.record_id}, 状态: ${record.status}`);
    }
    
    return record;
  }
}

export default new ReceptionistService();

