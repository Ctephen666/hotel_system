import mysql from 'mysql2/promise';

const dbConfig = {
  host: '10.29.147.232',       // 远程服务器的公网 IP
  port: 3306,                 // 端口
  user: 'hotel_user',               // 远程数据库用户名
  password: 'asdfgh1234',// 远程数据库密码
  database: 'hotel_ac'        // 数据库名
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
pool.getConnection()
  .then(connection => {
    console.log('数据库连接成功');
    connection.release();
  })
  .catch(err => {
    console.error('数据库连接失败:', err.message);
  });

export default pool;

