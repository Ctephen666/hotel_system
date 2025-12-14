import pool from '../config/db.config.js';

class RoomDAO {
  /**
   * 查找可用房间
   * @param {String} roomType - 房型 (standard/double)
   * @returns {Promise<Object>} 房间对象
   */
  async findAvailableRoom(roomType) {
    // 将前端传入的房型转换为数据库存储的格式
    // 兼容中文和英文值：standard/标准间 -> standard, double/豪华间/商务间 -> double
    let dbRoomType;
    if (roomType === 'standard' || roomType === '标准间') {
      dbRoomType = 'standard';
    } else if (roomType === 'double' || roomType === '豪华间' || roomType === '商务间') {
      dbRoomType = 'double';
    } else {
      dbRoomType = roomType;
    }
    
    // 兼容中文和英文状态值：available/空闲 -> available
    // 兼容中文和英文房型：标准间/standard -> standard, 豪华间/商务间/double -> double
    const roomTypeConditions = dbRoomType === 'standard' 
      ? ['standard', '标准间']
      : ['double', '豪华间', '商务间'];
    
    const placeholders = roomTypeConditions.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT * FROM room 
       WHERE status IN ('available', '空闲') 
       AND room_type IN (${placeholders})
       ORDER BY room_no ASC
       LIMIT 1`,
      roomTypeConditions
    );
    return rows[0] || null;
  }
  
  /**
   * 更新房间状态
   */
  async updateStatus(roomId, status) {
    await pool.execute(
      'UPDATE room SET status = ? WHERE room_id = ?',
      [status, roomId]
    );
  }
  
  /**
   * 根据ID查找房间
   */
  async findById(roomId) {
    const [rows] = await pool.execute(
      'SELECT * FROM room WHERE room_id = ?',
      [roomId]
    );
    return rows[0] || null;
  }
  
  /**
   * 根据房号查找房间
   */
  async findByRoomNo(roomNo) {
    const [rows] = await pool.execute(
      'SELECT * FROM room WHERE room_no = ?',
      [roomNo]
    );
    return rows[0] || null;
  }
  
  /**
   * 获取所有房间信息及实时占用状态
   */
  async getAllRooms() {
    const [rows] = await pool.execute(
      `SELECT 
          r.room_id, r.room_no, r.floor, r.room_type, r.status, r.base_price, r.created_time,
          r.initial_temp,  
          MAX(CASE 
              WHEN ar.status = '在住' THEN 1
              ELSE 0 
          END) AS is_occupied
       FROM room r
       LEFT JOIN accommodation_record ar 
          ON r.room_id = ar.room_id 
       GROUP BY 
          r.room_id, r.room_no, r.floor, r.room_type, r.status, r.base_price, r.created_time, r.initial_temp  -- 【新增字段】
       ORDER BY r.room_no ASC`
    );
    return rows;
  }

}

export default new RoomDAO();

