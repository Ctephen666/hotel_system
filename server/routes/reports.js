import express from 'express';
import ReportGenerator from '../core/ReportGenerator.js';
import RoomDAO from '../models/RoomDAO.js';

const router = express.Router();

/**
 * GET /api/reports/daily
 * 获取每日营收报表
 */
router.get('/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date ? new Date(date) : new Date();
    
    const report = await ReportGenerator.generateDailyRevenueReport(reportDate);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('生成每日报表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成报表失败'
    });
  }
});

/**
 * GET /api/reports/monthly
 * 获取每月营收报表
 */
router.get('/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    const reportYear = parseInt(year) || new Date().getFullYear();
    const reportMonth = parseInt(month) || new Date().getMonth() + 1;
    
    const report = await ReportGenerator.generateMonthlyRevenueReport(reportYear, reportMonth);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('生成每月报表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成报表失败'
    });
  }
});

/**
 * GET /api/reports/ac-usage
 * 获取空调使用率报表
 */
router.get('/ac-usage', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    
    const report = await ReportGenerator.generateACUsageReport(start, end);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('生成空调使用率报表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成报表失败'
    });
  }
});

/**
 * GET /api/reports/dashboard
 * 获取仪表盘统计数据
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    
    const stats = await ReportGenerator.getDashboardStats(start, end);
    
    // 获取房间状态列表
    const rooms = await RoomDAO.getAllRooms();
    const roomStatus = rooms.map(room => ({
      roomNumber: room.room_no,
      status: room.is_occupied > 0 ? 'occupied' : 
              (room.status === 'maintenance' || room.status === '待清理') ? 'maintenance' : 
              (room.status === 'available' || room.status === '空闲') ? 'available' : 
              (room.status === 'occupied' || room.status === '已入住') ? 'occupied' : 'vacant',
      customer: '-',
      checkIn: '-',
      checkOut: '-',
      roomType: (room.room_type === 'standard' || room.room_type === '标准间') ? '标准间' : 
                (room.room_type === 'double' || room.room_type === '豪华间' || room.room_type === '商务间') ? '大床房' : '未知'
    }));
    
    res.json({
      success: true,
      data: {
        ...stats,
        roomStatus: roomStatus
      }
    });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取数据失败'
    });
  }
});

export default router;

