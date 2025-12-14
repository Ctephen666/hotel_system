import GuestDAO from '../models/GuestDAO.js';
import RoomDAO from '../models/RoomDAO.js';
import AccommodationRecordDAO from '../models/AccommodationRecordDAO.js';
import BillingService from './BillingService.js';

class CheckInManager {
  /**
   * 处理入住业务逻辑
   * @param {Object} checkInData - 入住数据
   * @param {String} checkInData.name - 客人姓名
   * @param {String} checkInData.idNumber - 身份证号
   * @param {String} checkInData.phone - 联系电话
   * @param {String} checkInData.gender - 性别 (M/F)
   * @param {String} checkInData.roomType - 房型 (standard/double)
   * @param {Date} checkInData.checkInDate - 入住日期
   * @param {Date} checkInData.checkOutDate - 离店日期
   * @param {Number} checkInData.depositAmount - 押金金额（可选，默认300）
   * @returns {Promise<Object>} 入住结果
   */
  async processCheckIn(checkInData) {
    const {
      name,
      idNumber,
      phone,
      gender,
      roomType,
      checkInDate,
      checkOutDate,
      depositAmount = 300
    } = checkInData;
    
    // 1. 查找或创建客人记录
    const guest = await GuestDAO.findOrCreate({
      name,
      idNumber,
      phone,
      gender
    });
    
    // 2. 分配房间
    const room = await RoomDAO.findAvailableRoom(roomType);
    if (!room) {
      throw new Error(`没有可用的${roomType === 'standard' ? '标准间' : '大床房'}`);
    }
    
    // 3. 计算住宿费用
    const roomFee = BillingService.calculateRoomFee(
      room.base_price,
      checkInDate,
      checkOutDate
    );
    
    // 4. 创建住宿记录
    const record = await AccommodationRecordDAO.create({
      guestId: guest.guest_id,
      roomId: room.room_id,
      checkInTime: checkInDate,
      checkOutTime: checkOutDate,
      depositAmount: depositAmount,
      roomFeeTotal: roomFee,
      acFeeTotal: 0, // 初始为0，退房时计算
      status: '在住'
    });
    
    // 5. 更新房间状态为"occupied"
    await RoomDAO.updateStatus(room.room_id, 'occupied');
    
    // 6. 返回入住结果
    return {
      success: true,
      recordId: record.record_id,
      roomNumber: room.room_no,
      roomType: room.room_type,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      roomFee: roomFee,
      deposit: depositAmount,
      totalAmount: roomFee + depositAmount,
      guest: {
        name: guest.name,
        idNumber: guest.id_number,
        phone: guest.phone
      }
    };
  }
}

export default new CheckInManager();

