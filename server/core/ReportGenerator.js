import AccommodationRecordDAO from '../models/AccommodationRecordDAO.js';
import LogDAO from '../models/LogDAO.js';
import pool from '../config/db.config.js';

class ReportGenerator {
  /**
   * 生成每日营收报表
   * @param {Date} date - 日期
   * @returns {Promise<Object>} 报表数据
   */
  async generateDailyRevenueReport(date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    // 获取当日所有已退房记录
    const [records] = await pool.execute(
      `SELECT ar.*, g.name as guest_name, r.room_no, r.room_type
       FROM accommodation_record ar
       JOIN guest g ON ar.guest_id = g.guest_id
       JOIN room r ON ar.room_id = r.room_id
       WHERE DATE(ar.check_out_time) = DATE(?)
       AND ar.status = '已退房'`,
      [date]
    );
    
    const totalRoomFee = records.reduce((sum, r) => sum + parseFloat(r.room_fee_total || 0), 0);
    const totalACFee = records.reduce((sum, r) => sum + parseFloat(r.ac_fee_total || 0), 0);
    const totalRevenue = totalRoomFee + totalACFee;
    
    return {
      date: date.toISOString().split('T')[0],
      totalRecords: records.length,
      totalRoomFee: totalRoomFee,
      totalACFee: totalACFee,
      totalRevenue: totalRevenue,
      records: records
    };
  }
  
  /**
   * 生成每月营收报表
   * @param {Number} year - 年份
   * @param {Number} month - 月份 (1-12)
   * @returns {Promise<Object>} 报表数据
   */
  async generateMonthlyRevenueReport(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    const [records] = await pool.execute(
      `SELECT ar.*, g.name as guest_name, r.room_no, r.room_type,
       DATE(ar.check_out_time) as checkout_date
       FROM accommodation_record ar
       JOIN guest g ON ar.guest_id = g.guest_id
       JOIN room r ON ar.room_id = r.room_id
       WHERE ar.check_out_time >= ? AND ar.check_out_time <= ?
       AND ar.status = '已退房'
       ORDER BY ar.check_out_time DESC`,
      [startDate, endDate]
    );
    
    // 按日期分组统计
    const dailyStats = {};
    records.forEach(record => {
      // 处理日期格式（可能是 Date 对象或字符串）
      let dateStr;
      if (record.checkout_date instanceof Date) {
        dateStr = record.checkout_date.toISOString().split('T')[0];
      } else if (record.checkout_date) {
        dateStr = new Date(record.checkout_date).toISOString().split('T')[0];
      } else {
        return; // 跳过没有退房日期的记录
      }
      
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = {
          date: dateStr,
          count: 0,
          roomFee: 0,
          acFee: 0,
          revenue: 0
        };
      }
      dailyStats[dateStr].count++;
      dailyStats[dateStr].roomFee += parseFloat(record.room_fee_total || 0);
      dailyStats[dateStr].acFee += parseFloat(record.ac_fee_total || 0);
      dailyStats[dateStr].revenue += parseFloat(record.room_fee_total || 0) + parseFloat(record.ac_fee_total || 0);
    });
    
    const totalRoomFee = records.reduce((sum, r) => sum + parseFloat(r.room_fee_total || 0), 0);
    const totalACFee = records.reduce((sum, r) => sum + parseFloat(r.ac_fee_total || 0), 0);
    const totalRevenue = totalRoomFee + totalACFee;
    
    return {
      year: year,
      month: month,
      totalRecords: records.length,
      totalRoomFee: totalRoomFee,
      totalACFee: totalACFee,
      totalRevenue: totalRevenue,
      dailyStats: Object.values(dailyStats),
      records: records
    };
  }
  
  /**
   * 生成空调使用率报表
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Object>} 报表数据
   */
  async generateACUsageReport(startDate, endDate) {
    // 获取时间范围内的空调使用统计
    const usageStats = await LogDAO.getUsageStats(startDate, endDate);
    
    // 获取所有住宿记录
    const [records] = await pool.execute(
      `SELECT ar.*, r.room_no, r.room_type,
       (SELECT COUNT(*) FROM air_conditioner_log WHERE record_id = ar.record_id) as ac_log_count,
       (SELECT COALESCE(SUM(fee), 0) FROM air_conditioner_log WHERE record_id = ar.record_id) as ac_fee
       FROM accommodation_record ar
       JOIN room r ON ar.room_id = r.room_id
       WHERE ar.check_in_time >= ? AND ar.check_in_time <= ?
       ORDER BY ar.check_in_time DESC`,
      [startDate, endDate]
    );
    
    // 计算使用率
    const totalRecords = records.length;
    const recordsWithAC = records.filter(r => r.ac_log_count > 0).length;
    const usageRate = totalRecords > 0 ? (recordsWithAC / totalRecords * 100).toFixed(2) : 0;
    
    // 按房间类型统计
    const roomTypeStats = {};
    records.forEach(record => {
      const type = record.room_type || 'unknown';
      if (!roomTypeStats[type]) {
        roomTypeStats[type] = {
          roomType: type,
          totalRecords: 0,
          recordsWithAC: 0,
          totalACFee: 0
        };
      }
      roomTypeStats[type].totalRecords++;
      if (record.ac_log_count > 0) {
        roomTypeStats[type].recordsWithAC++;
      }
      roomTypeStats[type].totalACFee += parseFloat(record.ac_fee || 0);
    });
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalRecords: totalRecords,
      recordsWithAC: recordsWithAC,
      usageRate: parseFloat(usageRate),
      totalACRevenue: usageStats.total_revenue,
      totalEnergyUsed: usageStats.total_energy,
      roomTypeStats: Object.values(roomTypeStats),
      records: records
    };
  }
  
  /**
   * 获取仪表盘统计数据
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Object>} 统计数据
   */
  async getDashboardStats(startDate, endDate) {
    // 获取房间总数和入住数
    const [roomStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_rooms,
        SUM(CASE WHEN status IN ('occupied', '已入住') THEN 1 ELSE 0 END) as occupied_rooms
       FROM room`
    );
    
    const totalRooms = roomStats[0].total_rooms || 0;
    const occupiedRooms = roomStats[0].occupied_rooms || 0;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms * 100).toFixed(2) : 0;
    
    // 获取今日收入
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayReport = await this.generateDailyRevenueReport(today);
    
    // 获取月度收入
    const monthlyReport = await this.generateMonthlyRevenueReport(
      today.getFullYear(),
      today.getMonth() + 1
    );
    
    // 获取客户总数
    const [customerStats] = await pool.execute(
      'SELECT COUNT(DISTINCT guest_id) as total_customers FROM accommodation_record'
    );
    
    return {
      totalRooms: totalRooms,
      occupiedRooms: occupiedRooms,
      occupancyRate: parseFloat(occupancyRate),
      todayRevenue: todayReport.totalRevenue,
      monthlyRevenue: monthlyReport.totalRevenue,
      totalCustomers: customerStats[0].total_customers || 0,
      acUsage: todayReport.totalACFee,
      acRevenue: todayReport.totalACFee
    };
  }
}

export default new ReportGenerator();

