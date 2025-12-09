// TemperatureSensor.js - 实现B1房间温度模拟器任务
// 包含heatUp和autoCoolDown方法，根据风速实现升温/降温模拟
// 参数配置CSV（回温法）：初始温度、环境温度、温度变化率（℃/2min, 1℃/min）和自然回温速率（0.5℃/min）

class TemperatureSensor {
  constructor(initialTemp = 26.0, ambientTemp = 26.0) {
    this.currentTemp = initialTemp; // 当前温度
    this.ambientTemp = ambientTemp; // 环境温度
    
    // 温度变化率配置（℃/分钟）
    this.tempChangeRateConfig = {
      // 风速对应的温度变化率
      '低': 1,  // 低风：1℃/分钟
      '中': 2,  // 中风：2℃/分钟
      '高': 3   // 高风：3℃/分钟
    };
    
    // 自然回温速率（℃/分钟）
    this.autoCoolDownRate = 0.5; // 0.5℃/分钟
    
    // 时间单位转换（秒）
    this.updateInterval = 1; // 假设每秒更新一次
  }

  /**
   * 根据模式和风速调节温度
   * @param {string} mode - 模式：'cool' 或 'heat'
   * @param {string} fanSpeed - 风速：'低'、'中'、'高'
   * @returns {number} - 更新后的温度
   */
  heatUp(mode, fanSpeed) {
    // 获取当前风速对应的温度变化率（℃/分钟）
    const changeRatePerMinute = this.tempChangeRateConfig[fanSpeed] || this.tempChangeRateConfig['中'];
    
    // 转换为每秒的变化率
    const changeRatePerSecond = changeRatePerMinute / 60;
    
    // 根据模式调整温度
    if (mode === 'cool') {
      // 制冷：温度降低
      this.currentTemp -= changeRatePerSecond * this.updateInterval;
    } else if (mode === 'heat') {
      // 制热：温度升高
      this.currentTemp += changeRatePerSecond * this.updateInterval;
    }
    
    // 归一化温度（保留一位小数）
    this.currentTemp = this.normalizeTemp(this.currentTemp);
    
    return this.currentTemp;
  }

  /**
   * 自然回温（无空调运行时）
   * @returns {number} - 更新后的温度
   */
  autoCoolDown() {
    // 如果当前温度等于环境温度，不变化
    if (Math.abs(this.currentTemp - this.ambientTemp) < 0.1) {
      return this.currentTemp;
    }
    
    // 转换为每秒的变化率
    const changeRatePerSecond = this.autoCoolDownRate / 60;
    
    // 向环境温度方向变化
    if (this.currentTemp > this.ambientTemp) {
      // 当前温度高于环境温度，自然降温
      this.currentTemp -= changeRatePerSecond * this.updateInterval;
      // 确保不会低于环境温度
      if (this.currentTemp < this.ambientTemp) {
        this.currentTemp = this.ambientTemp;
      }
    } else if (this.currentTemp < this.ambientTemp) {
      // 当前温度低于环境温度，自然升温
      this.currentTemp += changeRatePerSecond * this.updateInterval;
      // 确保不会高于环境温度
      if (this.currentTemp > this.ambientTemp) {
        this.currentTemp = this.ambientTemp;
      }
    }
    
    // 归一化温度（保留一位小数）
    this.currentTemp = this.normalizeTemp(this.currentTemp);
    
    return this.currentTemp;
  }

  /**
   * 设置当前温度
   * @param {number} temp - 要设置的温度
   */
  setCurrentTemp(temp) {
    this.currentTemp = this.normalizeTemp(temp);
  }

  /**
   * 获取当前温度
   * @returns {number} - 当前温度
   */
  getCurrentTemp() {
    return this.currentTemp;
  }

  /**
   * 设置环境温度
   * @param {number} temp - 环境温度
   */
  setAmbientTemp(temp) {
    this.ambientTemp = this.normalizeTemp(temp);
  }

  /**
   * 获取环境温度
   * @returns {number} - 环境温度
   */
  getAmbientTemp() {
    return this.ambientTemp;
  }

  /**
   * 归一化温度值（保留一位小数）
   * @param {number} temp - 温度值
   * @returns {number} - 归一化后的温度
   */
  normalizeTemp(temp) {
    return parseFloat(temp.toFixed(1));
  }

  /**
   * 重置温度传感器
   */
  reset() {
    this.currentTemp = this.initialTemp;
  }
}

export default TemperatureSensor;