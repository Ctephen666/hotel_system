import express from 'express';
import CheckOutController from '../models/CheckOutController.js'; 

const router = express.Router();

/**
 * -------------------------------------------
 * 顾客结账 API 路由
 * -------------------------------------------
 */

/**
 * @route GET /api/check-out/room/:roomNo
 * @description 根据房间号获取当前在住记录的实时账单明细。
 * 用于顾客自助查询或前台查询未退房记录。
 * @access Public / Private (取决于您的认证配置)
 */
router.get('/room/:roomNo', CheckOutController.getActiveRecordByRoomNo);

/**
 * @route POST /api/check-out
 * @description 办理退房结账，更新住宿记录状态为“已退房”，并更新房间状态。
 * @access Private (需认证)
 */
router.post('/', CheckOutController.processCheckOut);

/**
 * -------------------------------------------
 * 后台管理 API 路由
 * -------------------------------------------
 */

/**
 * @route GET /api/check-out/list
 * @description 获取历史结账/待结账列表（支持筛选）。
 * @access Private (需认证)
 */
router.get('/list', CheckOutController.getCheckOutList);

/**
 * @route GET /api/check-out/:recordId
 * @description 获取指定住宿记录的结账详情。
 * @access Private (需认证)
 */
router.get('/:recordId', CheckOutController.getCheckOutDetail);


export default router;