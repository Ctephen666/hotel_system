// 房间客户端类
// 实现房间温度控制、状态监控和自动重发请求等功能
import Room from './Room.js';
import ClientAPI from './ClientAPI.js';

class RoomClient {
    constructor(roomId) {
        this.roomId = roomId;
        this.room = new Room(roomId);
        this.clientAPI = new ClientAPI();
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.statusUpdateInterval = 2000; // 2秒更新一次状态
    }

    // 初始化房间客户端
    async initialize() {
        await this.connectToServer();
        this.startMonitoring();
        this.startStatusUpdates();
    }

    // 连接到服务器
    connectToServer() {
        return new Promise((resolve, reject) => {
            this.clientAPI.connect('ws://localhost:8080', this.roomId);
            
            this.clientAPI.on('acPowerOn', () => {
                console.log(`房间 ${this.roomId} 空调已开启`);
                this.room.startService();
                resolve();
            });

            this.clientAPI.on('acPowerOff', (data) => {
                console.log(`房间 ${this.roomId} 空调已关闭:`, data.reason);
                this.room.stopService();
            });

            this.clientAPI.on('error', (error) => {
                console.error(`房间 ${this.roomId} 客户端错误:`, error);
                reject(error);
            });
        });
    }

    // 开始监控房间状态
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log(`开始监控房间 ${this.roomId} 状态`);
        
        // 使用setInterval定期更新房间状态
        this.monitoringInterval = setInterval(() => {
            this.updateRoomState();
        }, 1000); // 1秒更新一次温度
    }

    // 停止监控房间状态
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        clearInterval(this.monitoringInterval);
        console.log(`停止监控房间 ${this.roomId} 状态`);
    }

    // 更新房间状态
    updateRoomState() {
        // 模拟温度变化
        this.room.updateTemperature();
        
        // 检查是否需要自然回温
        if (this.room.shouldCoolDown()) {
            this.room.autoCoolDown();
        }
        
        // 处理服务暂停逻辑
        if (this.room.shouldPause()) {
            this.room.pauseService();
        }
        
        // 处理服务恢复逻辑
        if (this.room.shouldResume()) {
            this.room.resumeService();
        }
    }

    // 开始定期上报状态
    startStatusUpdates() {
        setInterval(() => {
            this.reportStatus();
        }, this.statusUpdateInterval);
    }

    // 上报房间状态到服务器
    reportStatus() {
        const status = this.room.getStatus();
        this.clientAPI.reportRoomState({
            roomId: this.roomId,
            ...status
        });
    }

    // 请求开启空调
    requestAir(mode, targetTemp, fanSpeed) {
        this.clientAPI.requestAir(mode, targetTemp, fanSpeed);
        this.room.setACMode(mode);
        this.room.setTargetTemp(targetTemp);
        this.room.setFanSpeed(fanSpeed);
        this.room.startService();
    }

    // 请求停止空调
    requestStop(reason = 'user_stop') {
        this.clientAPI.requestStop(reason);
        this.room.stopService();
    }

    // 重置房间状态
    reset() {
        this.room.resetState();
        this.reportStatus();
    }

    // 断开连接并清理资源
    disconnect() {
        this.stopMonitoring();
        this.clientAPI.disconnect();
        console.log(`房间 ${this.roomId} 客户端已断开连接`);
    }
}

export default RoomClient;