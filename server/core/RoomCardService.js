import AccommodationRecordDAO from '../models/AccommodationRecordDAO.js';
import GuestDAO from '../models/GuestDAO.js';
import RoomDAO from '../models/RoomDAO.js';

class RoomCardService {
  /**
   * 生成房卡信息
   * @param {Number} recordId - 住宿记录ID
   * @returns {Promise<Object>} 房卡信息
   */
  async generateRoomCard(recordId) {
    // 1. 获取住宿记录
    const record = await AccommodationRecordDAO.findById(recordId);
    if (!record) {
      throw new Error('住宿记录不存在');
    }
    
    if (record.status !== '在住') {
      throw new Error('只有入住中的记录才能获取房卡');
    }
    
    // 2. 获取客人信息
    const guest = await GuestDAO.findById(record.guest_id);
    if (!guest) {
      throw new Error('客人信息不存在');
    }
    
    // 3. 获取房间信息
    const room = await RoomDAO.findById(record.room_id);
    if (!room) {
      throw new Error('房间信息不存在');
    }
    
    // 4. 生成房卡号（唯一标识）
    const cardNumber = this.generateCardNumber(recordId, record.room_id);
    
    // 5. 生成二维码数据（用于扫码开门等）
    const qrCodeData = this.generateQRCodeData(recordId, cardNumber);
    
    // 6. 计算有效期
    const checkInDate = new Date(record.check_in_time);
    const checkOutDate = record.check_out_time ? new Date(record.check_out_time) : null;
    const validUntil = checkOutDate || new Date(checkInDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 默认7天
    
    // 7. 返回房卡信息
    return {
      success: true,
      cardNumber: cardNumber,
      recordId: recordId,
      roomNumber: room.room_no,
      roomType: (room.room_type === 'standard' || room.room_type === '标准间') ? '标准间' : 
                (room.room_type === 'double' || room.room_type === '豪华间' || room.room_type === '商务间') ? '大床房' : '未知',
      guestName: guest.name,
      guestIdNumber: guest.id_number,
      guestPhone: guest.phone,
      checkInDate: record.check_in_time,
      checkOutDate: record.check_out_time,
      validUntil: validUntil,
      qrCodeData: qrCodeData,
      hotelName: '波普特酒店',
      hotelAddress: '北京市朝阳区示例街道123号',
      hotelPhone: '400-123-4567',
      issuedAt: new Date(),
      // 房卡使用说明
      instructions: [
        '请妥善保管房卡，退房时需归还',
        '房卡仅限本人使用，不得转借他人',
        '如房卡丢失，请及时联系前台',
        '退房时间为离店日期12:00前'
      ]
    };
  }
  
  /**
   * 根据房间号获取房卡信息
   * @param {String} roomNo - 房间号
   * @returns {Promise<Object>} 房卡信息
   */
  async getRoomCardByRoomNo(roomNo) {
    // 1. 查找房间
    const room = await RoomDAO.findByRoomNo(roomNo);
    if (!room) {
      throw new Error('房间不存在');
    }
    
    // 2. 查找当前在住的记录
    const record = await AccommodationRecordDAO.findActiveByRoomId(room.room_id);
    if (!record) {
      throw new Error('该房间没有在住的记录');
    }
    
    // 3. 生成房卡信息
    return await this.generateRoomCard(record.record_id);
  }
  
  /**
   * 生成房卡号
   * @param {Number} recordId - 记录ID
   * @param {Number} roomId - 房间ID
   * @returns {String} 房卡号
   */
  generateCardNumber(recordId, roomId) {
    // 格式：HOTEL + 时间戳后6位 + 记录ID后3位 + 房间ID后2位
    const timestamp = Date.now().toString().slice(-6);
    const recordSuffix = String(recordId).padStart(3, '0').slice(-3);
    const roomSuffix = String(roomId).padStart(2, '0').slice(-2);
    return `HOTEL${timestamp}${recordSuffix}${roomSuffix}`;
  }
  
  /**
   * 生成二维码数据
   * @param {Number} recordId - 记录ID
   * @param {String} cardNumber - 房卡号
   * @returns {String} 二维码数据
   */
  generateQRCodeData(recordId, cardNumber) {
    // 生成JSON格式的二维码数据
    return JSON.stringify({
      type: 'room_card',
      recordId: recordId,
      cardNumber: cardNumber,
      timestamp: Date.now()
    });
  }
  
  /**
   * 验证房卡有效性
   * @param {String} cardNumber - 房卡号
   * @returns {Promise<Object>} 验证结果
   */
  async validateRoomCard(cardNumber) {
    try {
      // 从房卡号中提取记录ID（简单实现，实际应该存储房卡号到记录的映射）
      // 这里简化处理，实际应该查询房卡表
      const recordId = parseInt(cardNumber.slice(-5, -2));
      
      const record = await AccommodationRecordDAO.findById(recordId);
      if (!record) {
        return {
          valid: false,
          message: '房卡无效'
        };
      }
      
      if (record.status !== '在住') {
        return {
          valid: false,
          message: '房卡已失效（已退房）'
        };
      }
      
      const checkOutDate = record.check_out_time ? new Date(record.check_out_time) : null;
      const now = new Date();
      
      if (checkOutDate && now > checkOutDate) {
        return {
          valid: false,
          message: '房卡已过期'
        };
      }
      
      return {
        valid: true,
        recordId: record.record_id,
        roomNumber: record.room_no,
        guestName: record.guest_name
      };
    } catch (error) {
      return {
        valid: false,
        message: '房卡验证失败'
      };
    }
  }
}

export default new RoomCardService();

