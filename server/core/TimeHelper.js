class TimeHelper {
    // 真实循环间隔：每 1 秒 tick 一次
    static REAL_TIME_INTERVAL_MS = 1000;

    // 时间加速因子：现实 1 秒 = 模拟 6 秒
    static TIME_ACCELERATION_FACTOR = 6;

    // 每个 tick 增加的“模拟秒数”
    static SIMULATED_TIME_STEP_SEC = 6;

    /**
     * 把真实时间差（毫秒）换算成“模拟秒数”
     * 例如 realTimeMs = 10000，返回 = 10/1000 * 6 = 60 秒（=1分钟）
     */
    static getSimulatedSeconds(realTimeMs) {
        const realSeconds = realTimeMs / 1000;
        return realSeconds * this.TIME_ACCELERATION_FACTOR;
    }

    static startSimulationLoop(callback) {
        console.log(
          `[时间管理器] 启动：每 ${this.REAL_TIME_INTERVAL_MS}ms 真实时间，模拟 ${this.SIMULATED_TIME_STEP_SEC}s`
        );
        return setInterval(callback, this.REAL_TIME_INTERVAL_MS);
    }
    
    static stopSimulationLoop(intervalId) {
        clearInterval(intervalId);
        console.log('[时间管理器] 已停止。');
    }
}

export default TimeHelper;
