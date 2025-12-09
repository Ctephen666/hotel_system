// WebSocket通信封装类
// 实现房间温度控制、自动重发请求、状态更新等功能
class ClientAPI {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectInterval = 5000; // 5秒重连间隔
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.messageQueue = [];
        this.isReconnecting = false;
        this.roomId = null;
        this.lastMessageTime = Date.now();
        this.throttleInterval = 1000; // 节流间隔（毫秒）
        this.eventListeners = {};
    }

    // 连接到WebSocket服务器
    connect(url, roomId) {
        this.roomId = roomId;
        this.ws = new WebSocket(url);
        this.setupEventListeners();
    }

    // 设置WebSocket事件监听器
    setupEventListeners() {
        this.ws.onopen = () => {
            console.log('WebSocket连接已建立');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            this.registerRoom();
            this.processMessageQueue();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('消息解析错误:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket连接已关闭');
            this.isConnected = false;
            this.attemptReconnect();
        };
    }

    // 处理接收到的消息
    handleMessage(data) {
        console.log('收到服务器消息:', data);
        
        // 根据消息类型分发事件
        switch (data.type) {
            case 'AC_POWER_ON':
                this.emit('acPowerOn', data.payload);
                break;
            case 'AC_POWER_OFF':
                this.emit('acPowerOff', data.payload);
                break;
            case 'TEMP_UPDATE':
                this.emit('tempUpdate', data.payload);
                break;
            case 'BILL_UPDATE':
                this.emit('billUpdate', data.payload);
                break;
            case 'ERROR':
                this.emit('error', data.payload);
                break;
            default:
                this.emit('unknownMessage', data);
                break;
        }
    }

    // 注册房间
    registerRoom() {
        if (this.isConnected && this.roomId) {
            this.send({ type: 'REGISTER_ROOM', roomId: this.roomId });
        }
    }

    // 发送消息到服务器
    send(message) {
        if (this.isConnected) {
            const now = Date.now();
            if (now - this.lastMessageTime > this.throttleInterval) {
                this.ws.send(JSON.stringify(message));
                this.lastMessageTime = now;
            } else {
                console.log('消息发送被节流');
                // 如果需要，可以将节流的消息加入队列
            }
        } else {
            this.queueMessage(message);
            if (!this.isReconnecting) {
                this.attemptReconnect();
            }
        }
    }

    // 将消息加入队列
    queueMessage(message) {
        this.messageQueue.push(message);
        if (this.messageQueue.length > 100) {
            this.messageQueue.shift(); // 限制队列长度
        }
    }

    // 处理消息队列
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    // 请求开启空调
    requestAir(mode, targetTemp, fanSpeed) {
        this.send({
            type: 'REQUEST_AIR',
            payload: { mode, targetTemp, fanSpeed }
        });
    }

    // 请求停止空调
    requestStop(reason = 'user_stop') {
        this.send({
            type: 'STOP_REQUEST',
            payload: { reason }
        });
    }

    // 上报房间状态
    reportRoomState(state) {
        this.send({
            type: 'ROOM_STATUS_UPDATE',
            payload: state
        });
    }

    // 尝试重新连接
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
            this.isReconnecting = true;
            this.reconnectAttempts++;
            console.log(`尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                try {
                    this.connect('ws://localhost:8080', this.roomId);
                } catch (error) {
                    console.error('重连失败:', error);
                    this.isReconnecting = false;
                    this.attemptReconnect();
                }
            }, this.reconnectInterval);
        } else {
            console.error('已达到最大重连次数，停止尝试');
            this.isReconnecting = false;
        }
    }

    // 断开连接
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.isConnected = false;
        }
    }

    // 事件订阅
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    // 事件取消订阅
    off(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }

    // 事件触发
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('事件回调执行错误:', error);
                }
            });
        }
    }
}

export default ClientAPI;