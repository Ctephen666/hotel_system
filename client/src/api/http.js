import axios from 'axios';

// 创建 axios 实例
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://10.29.238.57:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
http.interceptors.request.use(
  config => {
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
http.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    const message = error.response?.data?.message || error.message || '请求失败';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// API 方法
export const checkInAPI = {
  // 办理入住
  processCheckIn: (data) => {
    return http.post('/check-in', data);
  },
  // 获取房卡信息（根据记录ID）
  getRoomCard: (recordId) => {
    return http.get(`/room-card/${recordId}`);
  },
  // 获取房卡信息（根据房间号）
  getRoomCardByRoomNo: (roomNo) => {
    return http.get(`/room-card/room/${roomNo}`);
  },
  // 验证房卡
  validateRoomCard: (cardNumber) => {
    return http.post('/room-card/validate', { cardNumber });
  }
};

export const checkOutAPI = {
  // 办理结账
  processCheckOut: (recordId, paymentMethod = 'cash') => {
    return http.post('/check-out', { recordId, paymentMethod });
  },
  // 获取结账列表
  getCheckOutList: (params = {}) => {
    return http.get('/check-out/list', { params });
  },
  // 获取结账详情
  getCheckOutDetail: (recordId) => {
    return http.get(`/check-out/${recordId}`);
  },
  // 根据房间号获取当前在住的记录（用于顾客自助结账）
  getActiveRecordByRoomNo: (roomNo) => {
    return http.get(`/check-out/room/${roomNo}`);
  }
};

export const reportAPI = {
  // 获取每日营收报表
  getDailyReport: (date) => {
    return http.get('/reports/daily', { params: { date } });
  },
  // 获取每月营收报表
  getMonthlyReport: (year, month) => {
    return http.get('/reports/monthly', { params: { year, month } });
  },
  // 获取空调使用率报表
  getACUsageReport: (startDate, endDate) => {
    return http.get('/reports/ac-usage', { params: { startDate, endDate } });
  },
  // 获取仪表盘数据
  getDashboardStats: (startDate, endDate) => {
    return http.get('/reports/dashboard', { params: { startDate, endDate } });
  }
};

export default http;

