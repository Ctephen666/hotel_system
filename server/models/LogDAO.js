import pool from '../config/db.config.js';

class LogDAO {

  /**
   * 根据记录ID获取所有空调日志
   */
  async findByRecordId(recordId) {
    const [rows] = await pool.execute(
      'SELECT * FROM air_conditioner_log WHERE record_id = ? ORDER BY start_time ASC',
      [recordId]
    );
    return rows;
  }
  
  /**
   * 计算记录的总空调费用
   */
  async calculateTotalFee(recordId) {
    const [rows] = await pool.execute(
      'SELECT COALESCE(SUM(fee), 0) as total_fee FROM air_conditioner_log WHERE record_id = ?',
      [recordId]
    );
    return parseFloat(rows[0].total_fee) || 0;
  }
  
  /**
   * 获取指定时间范围内的空调使用统计
   */
  async getUsageStats(startDate, endDate) {
    const [rows] = await pool.execute(
      `SELECT 
        COUNT(DISTINCT record_id) as total_records,
        COUNT(*) as total_logs,
        COALESCE(SUM(fee), 0) as total_revenue,
        COALESCE(SUM(energy_used), 0) as total_energy
       FROM air_conditioner_log
       WHERE start_time >= ? AND start_time <= ?`,
      [startDate, endDate]
    );
    return rows[0];
  }
}

export default new LogDAO();

