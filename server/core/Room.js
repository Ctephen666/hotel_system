// Room.js - 房间类
// 实现 [A/B] 房间类，维护温度、回温逻辑、费用
// 作为成员B的核心实现之一

import TemperatureSensor from './TemperatureSensor.js';

class Room {
  constructor(roomId, initialTemp = 26.0, ambientTemp = 26.0) {
    this.roomId = roomId;
    this.initialTemp = initialTemp; // 房间初始状态温度
    this.ambientTemp = ambientTemp; // 环境温度
    
    // 温度传感器
    this.temperatureSensor = new TemperatureSensor(initialTemp, ambientTemp);
    
    // 温控状态
    this.mode = 'cool'; // 模式：'cool' 或 'heat'
    this.targetTemp = 25; // 目标温度（缺省温度：25℃）
    this.fanSpeed = '中'; // 风速：'低'、'中'、'高'
    
    // 服务状态
    this.isOn = false; // 空调是否开启
    this.isPaused = false; // 是否暂停（达到目标后）
    this.status = 'stopped'; // 整体状态：'stopped'、'running'、'paused'、'waiting'
    
    // 计费相关
    this.powerConsumed = 0; // 累计消耗电量（度）
    this.usageFee = 0; // 累计费用（元）
    this.runningTime = 0; // 运行时间（秒）
    
    // 耗电速率配置（度/秒）
    this.powerConsumptionRateConfig = {
      '低': 1 / (3 * 60),  // 低风：1度/3分钟
      '中': 1 / (2 * 60),  // 中风：1度/2分钟
      '高': 1 / (1 * 60)   // 高风：1度/1分钟
    };
    
    // 计费标准
    this.ratePerDegree = 1; // 1元/度
    
    // 温度变化检测（用于自动重发请求）
    this.lastTempForResend = initialTemp;
    this.tempDiffThresholdForResend = 1.0; // 超过1度时重新启动
  }

  /**
   * 更新房间状态
   * @param {Object} status - 状态对象
   */
  updateStatus(status) {
    if (status.mode !== undefined) this.mode = status.mode;
    if (status.targetTemp !== undefined) this.targetTemp = status.targetTemp;
    if (status.fanSpeed !== undefined) this.fanSpeed = status.fanSpeed;
    if (status.isOn !== undefined) this.isOn = status.isOn;
    if (status.isPaused !== undefined) this.isPaused = status.isPaused;
    if (status.status !== undefined) this.status = status.status;
  }

  /**
   * 设置WebSocket连接
   * @param {WebSocket} ws - WebSocket连接实例
   */
  setWebSocket(ws) {
    this.ws = ws;
  }

  /**
   * 运行一次温度更新
   * @returns {Object} - 更新后的状态
   */
  updateTemperature() {
    let currentTemp = this.temperatureSensor.getCurrentTemp();
    let shouldSendStopRequest = false;
    let shouldSendResumeRequest = false;
    
    // 1. 温度变化逻辑
    if (this.isOn && !this.isPaused) {
      // 运行中：根据模式和风速调节温度
      currentTemp = this.temperatureSensor.heatUp(this.mode, this.fanSpeed);
      
      // 达到目标自动暂停
      if ((this.mode === 'cool' && currentTemp <= this.targetTemp) || 
          (this.mode === 'heat' && currentTemp >= this.targetTemp)) {
        currentTemp = this.targetTemp;
        this.isPaused = true;
        this.status = 'paused';
        shouldSendStopRequest = true;
      }
    } else {
      // 关闭或暂停：自然回温
      currentTemp = this.temperatureSensor.autoCoolDown();
      
      // 检查是否需要重新启动（超过目标温度1度）
      if ((this.mode === 'cool' && currentTemp >= this.targetTemp + this.tempDiffThresholdForResend) || 
          (this.mode === 'heat' && currentTemp <= this.targetTemp - this.tempDiffThresholdForResend)) {
        if (this.isOn && this.isPaused) {
          this.isPaused = false;
          this.status = 'running';
          shouldSendResumeRequest = true;
        }
      }
    }
    
    // 2. 计费逻辑
    if (this.isOn && !this.isPaused) {
      const powerRate = this.powerConsumptionRateConfig[this.fanSpeed];
      const powerConsumedThisCycle = powerRate * 1; // 假设每次更新间隔1秒
      this.powerConsumed += powerConsumedThisCycle;
      this.usageFee += powerConsumedThisCycle * this.ratePerDegree;
      this.runningTime += 1;
    }
    
    // 3. 状态更新
    if (this.isOn) {
      if (this.isPaused) {
        this.status = 'paused';
      } else {
        this.status = 'running';
      }
    } else {
      this.status = 'stopped';
    }
    
    // 4. 检查是否需要自动重发请求
    if ((Math.abs(currentTemp - this.lastTempForResend) >= this.tempDiffThresholdForResend) && 
        this.isOn && this.isPaused) {
      this.lastTempForResend = currentTemp;
      shouldSendResumeRequest = true;
    }
    
    return {
      currentTemp,
      mode: this.mode,
      targetTemp: this.targetTemp,
      fanSpeed: this.fanSpeed,
      status: this.status,
      powerConsumed: this.powerConsumed,
      usageFee: this.usageFee,
      runningTime: this.runningTime,
      shouldSendStopRequest,
      shouldSendResumeRequest
    };
  }

  /**
   * 开启空调
   */
  turnOn() {
    this.isOn = true;
    this.isPaused = false;
    this.status = 'running';
  }

  /**
   * 关闭空调
   */
  turnOff() {
    this.isOn = false;
    this.isPaused = false;
    this.status = 'stopped';
  }

  /**
   * 暂停空调（达到目标温度后）
   */
  pause() {
    this.isPaused = true;
    this.status = 'paused';
  }

  /**
   * 恢复空调运行
   */
  resume() {
    this.isPaused = false;
    this.status = 'running';
  }

  /**
   * 设置目标温度
   * @param {number} temp - 目标温度
   */
  setTargetTemp(temp) {
    this.targetTemp = temp;
    if (this.isOn && this.isPaused) {
      // 如果当前暂停且设置了新目标，恢复运行
      this.resume();
    }
  }

  /**
   * 设置模式
   * @param {string} mode - 模式：'cool' 或 'heat'
   */
  setMode(mode) {
    this.mode = mode;
    if (this.isOn && this.isPaused) {
      // 如果当前暂停且切换了模式，恢复运行
      this.resume();
    }
  }

  /**
   * 设置风速
   * @param {string} speed - 风速：'低'、'中'、'高'
   */
  setFanSpeed(speed) {
    this.fanSpeed = speed;
  }

  /**
   * 获取当前温度
   * @returns {number} - 当前温度
   */
  getCurrentTemp() {
    return this.temperatureSensor.getCurrentTemp();
  }

  /**
   * 获取当前状态
   * @returns {Object} - 当前状态
   */
  getCurrentState() {
    return {
      roomId: this.roomId,
      currentTemp: this.getCurrentTemp(),
      mode: this.mode,
      targetTemp: this.targetTemp,
      fanSpeed: this.fanSpeed,
      status: this.status,
      powerConsumed: this.powerConsumed,
      usageFee: this.usageFee,
      runningTime: this.runningTime
    };
  }

  /**
   * 重置计费和运行时间
   */
  resetBilling() {
    this.powerConsumed = 0;
    this.usageFee = 0;
    this.runningTime = 0;
  }

  /**
   * 检查温度是否在允许范围内
   * @param {number} temp - 要检查的温度
   * @returns {boolean} - 是否在范围内
   */
  isValidTemperature(temp) {
    return temp >= 16 && temp <= 30;
  }

  /**
   * 检查风速是否有效
   * @param {string} speed - 要检查的风速
   * @returns {boolean} - 是否有效
   */
  isValidFanSpeed(speed) {
    return ['低', '中', '高'].includes(speed);
  }

  /**
   * 检查模式是否有效
   * @param {string} mode - 要检查的模式
   * @returns {boolean} - 是否有效
   */
  isValidMode(mode) {
    return ['cool', 'heat'].includes(mode);
  }
}

export default Room;