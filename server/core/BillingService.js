import LogDAO from '../models/LogDAO.js';

class BillingService {
  
  /**
   * 计算实际住宿天数 (从 calculateRoomFee 中分离出来)
   * @param {Date} checkInTime - 入住时间
   * @param {Date} checkOutTime - 退房时间 (可传入当前时间)
   * @returns {Number} 实际住宿天数（自然日，至少1天）
   */
  calculateActualDays(checkInTime, checkOutTime) {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    
    const diffTime = checkOut.getTime() - checkIn.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(1, diffDays);
  }

  /**
   * 计算住宿费用 (修改，调用 calculateActualDays)
   */
  calculateRoomFee(basePrice, checkInTime, checkOutTime) {
    const days = this.calculateActualDays(checkInTime, checkOutTime);
    return basePrice * days;
  }
  
  /**
   * 获取空调使用费用 (保持不变)
   */
  async getACFee(recordId) {
    return await LogDAO.calculateTotalFee(recordId); //
  }
  
  /**
   * 获取格式化后的空调使用明细 (新增方法)
   * @param {Number} recordId - 住宿记录ID
   * @returns {Promise<Array>} 格式化后的空调使用明细列表
   */
  async getFormattedACUsageDetails(recordId) {
    const logs = await LogDAO.findByRecordId(recordId); // 调用 LogDAO 查询所有日志
    
    const fanSpeedMap = {
        'low': '低',
        'medium': '中',
        'high': '高'
    };
    
    // 格式化时间辅助函数 (YYYY-MM-DD HH:mm)
    const formatTime = (date) => {
        const pad = (n) => n < 10 ? '0' + n : n;
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hour = pad(date.getHours());
        const minute = pad(date.getMinutes());
        return `${month}-${day} ${hour}:${minute}`;
    };
    
    return logs.map(log => {
        const startTime = new Date(log.start_time);
        const endTime = new Date(log.end_time);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = durationMs / (1000 * 60);
        
        return {
            id: log.log_id,
            time: `${formatTime(startTime)} 至 ${formatTime(endTime)}`, 
            duration: `${durationMinutes.toFixed(0)} 分钟`,
            fanSpeed: fanSpeedMap[log.fan_speed] || log.fan_speed, // 转换风速为中文
            fee: parseFloat(log.fee).toFixed(2),
        };
    });
  }

  /**
   * 计算最终应付金额 
   */
  calculateFinalAmount(roomFee, acFee, deposit) {
    const totalFee = roomFee + acFee;
    const finalAmount = totalFee - deposit;
    return Math.max(0, finalAmount);
  }
  
  /**
   * 计算押金退还金额 
   */
  calculateDepositRefund(roomFee, acFee, deposit) {
    const totalFee = roomFee + acFee;
    const refund = deposit - totalFee;
    return Math.max(0, refund);
  }
}

export default new BillingService();