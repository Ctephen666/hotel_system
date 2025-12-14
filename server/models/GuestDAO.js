import pool from '../config/db.config.js';

class GuestDAO {
  /**
   * 根据身份证号查找或创建客人
   * @param {Object} guestData - 客人信息 {name, idNumber, phone, gender}
   * @returns {Promise<Object>} 客人对象
   */
  async findOrCreate(guestData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // 先查找是否存在
      const [existing] = await connection.execute(
        'SELECT * FROM guest WHERE id_number = ?',
        [guestData.idNumber]
      );
      
      if (existing.length > 0) {
        // 更新信息
        await connection.execute(
          'UPDATE guest SET name = ?, phone = ?, gender = ? WHERE id_number = ?',
          [guestData.name, guestData.phone, guestData.gender, guestData.idNumber]
        );
        await connection.commit();
        return existing[0];
      }
      
      // 创建新客人
      const [result] = await connection.execute(
        'INSERT INTO guest (name, id_number, phone, gender) VALUES (?, ?, ?, ?)',
        [guestData.name, guestData.idNumber, guestData.phone, guestData.gender]
      );
      
      await connection.commit();
      
      const [newGuest] = await connection.execute(
        'SELECT * FROM guest WHERE guest_id = ?',
        [result.insertId]
      );
      
      return newGuest[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * 根据ID查找客人
   */
  async findById(guestId) {
    const [rows] = await pool.execute(
      'SELECT * FROM guest WHERE guest_id = ?',
      [guestId]
    );
    return rows[0] || null;
  }
}

export default new GuestDAO();

