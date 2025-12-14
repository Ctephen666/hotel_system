import pool from '../config/db.config.js';

class AccommodationRecordDAO {
  /**
   * 创建住宿记录
   * @param {Object} recordData - 记录数据
   * @returns {Promise<Object>} 创建的记录
   */
  async create(recordData) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO accommodation_record 
         (guest_id, room_id, check_in_time, check_out_time, deposit_amount, room_fee_total, ac_fee_total, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordData.guestId,
          recordData.roomId,
          recordData.checkInTime,
          recordData.checkOutTime || null,
          recordData.depositAmount || 0,
          recordData.roomFeeTotal || 0,
          recordData.acFeeTotal || 0,
          recordData.status || '在住'
        ]
      );
      
      const [record] = await connection.execute(
        'SELECT * FROM accommodation_record WHERE record_id = ?',
        [result.insertId]
      );
      
      return record[0];
    } finally {
      connection.release();
    }
  }
  
  /**
   * 更新住宿记录
   */
  async update(recordId, updateData) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const values = [];
      
      Object.keys(updateData).forEach(key => {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      });
      
      values.push(recordId);
      
      await connection.execute(
        `UPDATE accommodation_record SET ${fields.join(', ')}, updated_time = NOW() WHERE record_id = ?`,
        values
      );
      
      const [record] = await connection.execute(
        'SELECT * FROM accommodation_record WHERE record_id = ?',
        [recordId]
      );
      
      return record[0];
    } finally {
      connection.release();
    }
  }
  
  /**
   * 根据ID查找记录
   */
  async findById(recordId) {
    const [rows] = await pool.execute(
      `SELECT ar.*, g.name as guest_name, g.id_number, g.phone, r.room_no, r.room_type, r.base_price
       FROM accommodation_record ar
       JOIN guest g ON ar.guest_id = g.guest_id
       JOIN room r ON ar.room_id = r.room_id
       WHERE ar.record_id = ?`,
      [recordId]
    );
    return rows[0] || null;
  }
  
  /**
   * 根据房间号查找当前在住的记录 (新增方法)
   * * 联表查询 accommodation_record (ar), guest (g) 和 room (r)，
   * 条件是 r.room_no 等于输入，且 ar.status 为 '在住'
   * * @param {string} roomNo - 房间号 (room_no)
   */
  async findActiveRecordByRoomNo(roomNo) {
    const [rows] = await pool.execute(
      `SELECT ar.*, g.name as guest_name, g.id_number, g.phone, r.room_no, r.room_type, r.base_price, r.room_id
       FROM accommodation_record ar
       JOIN guest g ON ar.guest_id = g.guest_id
       JOIN room r ON ar.room_id = r.room_id
       WHERE r.room_no = ? AND ar.status = '在住'`,
      [roomNo]
    );
    
    return rows[0] || null;
  }

  /**
   * 根据房间ID查找当前在住的记录
   */
  async findActiveByRoomId(roomId) {
    console.log(`[AccommodationRecordDAO] 查询房间 ID ${roomId} 的在住记录`);
    
    // 先查询该房间的所有记录，用于调试
    const [allRecords] = await pool.execute(
      `SELECT ar.record_id, ar.status, ar.check_in_time, ar.check_out_time, r.room_no
       FROM accommodation_record ar
       JOIN room r ON ar.room_id = r.room_id
       WHERE ar.room_id = ?
       ORDER BY ar.record_id DESC
       LIMIT 10`,
      [roomId]
    );
    console.log(`[AccommodationRecordDAO] 房间 ID ${roomId} 的所有记录 (最近10条):`, allRecords.map(r => ({
      recordId: r.record_id,
      status: r.status,
      checkIn: r.check_in_time,
      checkOut: r.check_out_time,
      roomNo: r.room_no
    })));
    
    // 查询在住记录（状态为'在住'）
    const [rows] = await pool.execute(
      `SELECT ar.*, g.name as guest_name, g.id_number, g.phone, r.room_no, r.room_type, r.base_price
       FROM accommodation_record ar
       JOIN guest g ON ar.guest_id = g.guest_id
       JOIN room r ON ar.room_id = r.room_id
       WHERE ar.room_id = ? AND ar.status = '在住'`,
      [roomId]
    );
    
    console.log(`[AccommodationRecordDAO] 找到 ${rows.length} 条在住记录`);
    
    // 如果没有找到在住记录，检查是否有未退房的记录（check_out_time 为 NULL）
    if (rows.length === 0) {
      const [uncheckedRecords] = await pool.execute(
        `SELECT ar.record_id, ar.status, ar.check_in_time, ar.check_out_time
         FROM accommodation_record ar
         WHERE ar.room_id = ? AND ar.check_out_time IS NULL
         ORDER BY ar.record_id DESC
         LIMIT 1`,
        [roomId]
      );
      if (uncheckedRecords.length > 0) {
        console.log(`[AccommodationRecordDAO] 警告: 找到未退房记录但状态不是'在住':`, uncheckedRecords[0]);
      }
    }
    
    return rows[0] || null;
  }
  
  /**
   * 获取结账列表
   */
  async getCheckOutList(filters = {}) {
    let query = `
      SELECT ar.*, g.name as guest_name, g.id_number, g.phone, r.room_no, r.room_type, r.base_price
      FROM accommodation_record ar
      JOIN guest g ON ar.guest_id = g.guest_id
      JOIN room r ON ar.room_id = r.room_id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.roomNumber) {
      query += ' AND r.room_no LIKE ?';
      params.push(`%${filters.roomNumber}%`);
    }
    
    if (filters.status && filters.status !== 'all') {
      query += ' AND ar.status = ?';
      params.push(filters.status === 'pending' ? '在住' : '已退房');
    }
    
    if (filters.startDate && filters.endDate) {
      query += ' AND DATE(ar.check_out_time) BETWEEN ? AND ?';
      params.push(filters.startDate, filters.endDate);
    }
    
    query += ' ORDER BY ar.check_out_time DESC, ar.record_id DESC';
    
    const [rows] = await pool.execute(query, params);
    return rows;
  }
}

export default new AccommodationRecordDAO();

