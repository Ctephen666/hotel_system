import Billing from "./Billing.js";
import TimeHelper from "./TimeHelper.js"; 

class Room {
    constructor(roomId, initialTemp, pricePerNight, scheduler) {
        this.roomId = roomId;
        this.initialTemp = parseFloat(initialTemp);
        this.currentTemp = parseFloat(initialTemp);

        this.targetTemp = 24;
        this.fanSpeed = "medium";
        this.mode = "cool";

        this.status = "off"; // off / waiting / running / stopped
        this.scheduler = scheduler;
        this.billing = new Billing(roomId, pricePerNight);

        // 时间记录（这里记录的还是“真实时间戳”，用于差值）
        this.currentRunStartTime = 0;
        this.runTime = 0;             // 累计“模拟秒数”用于统计
        this.requestStartTime = 0;

        // 避免重复申请
        this.hasRequestedRestart = false;
    }

    /**
     * ============================
     *     用户控制：调温/风速/模式
     * ============================
     */
    control(targetTemp, fanSpeed, mode) {
        console.log(`[房间 ${this.roomId}] 控制请求 → T=${targetTemp}, F=${fanSpeed}, M=${mode}`);

        this.targetTemp = targetTemp;
        this.fanSpeed = fanSpeed;
        this.mode = mode;

        this.hasRequestedRestart = false;

        // 如果正在运行 → 停止后重新申请
        if (this.status === "running") {
            console.log(`[房间 ${this.roomId}] 正在运行，先退出服务队列`);
            this.scheduler.removeRoomFromService(this);
        }

        this.status = "waiting";
        this.requestStartTime = Date.now();
        this.scheduler.requestService(this);
    }

    /**
     * ============================
     *           用户关机
     * ============================
     */
    powerOff() {
        console.log(`[房间 ${this.roomId}] 空调关机`);

        if (this.status === "running") {
            this.scheduler.removeRoomFromService(this);
        }

        this.status = "off";
        this.hasRequestedRestart = false;
        this.currentRunStartTime = 0;
    }

    /**
     * ============================
     *       服务中：温度变化 + 计费
     * ============================
     */
    serve() {
        if (this.status !== "running") return;

        // 首次运行
        if (this.currentRunStartTime === 0) {
            this.currentRunStartTime = Date.now();
            console.log(`[房间 ${this.roomId}] 开始送风`);
        }

        this.hasRequestedRestart = false;

        // 本次 tick 对应的“模拟秒数”，例如加速因子=6 时，每秒 tick = 6 秒
        const dt = TimeHelper.SIMULATED_TIME_STEP_SEC || 1;

        /** 温度变化速率（按“每真实秒”定义） **/
        const baseRatePerSec = 1 / 120; // 每“原始秒” 0.00833°C
        let ratePerSec = baseRatePerSec;
        if (this.fanSpeed === "high") ratePerSec *= 2;
        if (this.fanSpeed === "low") ratePerSec *= 2 / 3;

        // 按“模拟秒”更新温度：ΔT = ratePerSec * dt
        let before = this.currentTemp;

        if (this.mode === "cool") this.currentTemp -= ratePerSec * dt;
        else this.currentTemp += ratePerSec * dt;

        this.currentTemp = parseFloat(this.currentTemp.toFixed(3));

        // 达到目标 → 自动暂停
        if (
            (this.mode === "cool" && this.currentTemp <= this.targetTemp) ||
            (this.mode === "heat" && this.currentTemp >= this.targetTemp)
        ) {
            console.log(`[房间 ${this.roomId}] 达到目标温度，停止送风`);
            this.status = "stopped";
            this.scheduler.removeRoomFromService(this);
            return;
        }

        // 记录运行时间：累加“模拟秒”
        this.runTime += dt;

        /** 按“加速后模拟时间”计费 **/
        // 假设：powerRateMap 仍然是“每真实秒的能耗倍率”，*60 换算成每分钟
        const powerRateMap = {
            high: 1 / 60,
            medium: 1 / 120,
            low: 1 / 180,
        };

        // 本次 tick 的“模拟分钟数”：dt 模拟秒 = dt/60 分钟
        const durationMinutes = dt / 60;

        this.billing.recordSegment(
            durationMinutes,                        // 本段时长（模拟分钟）
            this.fanSpeed,
            powerRateMap[this.fanSpeed] * 60        // 每分钟能耗/费用倍率
        );
    }

    /**
     * ============================
     *     停止/关机状态：回温
     * ============================
     */
    reWarm() {
        const EPS = 0.001;
        const dt = TimeHelper.SIMULATED_TIME_STEP_SEC || 1;

        // 每“原始秒”的回温速率
        const recoverRatePerSec = 0.5 / 60; // 每秒回温 0.00833°C
        const recoverDelta = recoverRatePerSec * dt; // 本 tick 的“模拟回温量”

        let before = this.currentTemp;

        /** ============ 关机状态 ============ **/
        if (this.status === "off") {
            if (Math.abs(this.currentTemp - this.initialTemp) < EPS) return;

            if (this.currentTemp < this.initialTemp) this.currentTemp += recoverDelta;
            else this.currentTemp -= recoverDelta;

            this.currentTemp = parseFloat(this.currentTemp.toFixed(3));

            console.log(`[房间 ${this.roomId}] 关机回温: ${before.toFixed(2)} → ${this.currentTemp.toFixed(2)}`);
            return;
        }

        /** ============ 停止状态 ============ **/
        if (this.status === "stopped") {
            let shouldMove = false;
            let direction = 0;

            if (this.mode === "cool" && this.currentTemp < this.initialTemp) {
                shouldMove = true; direction = 1;
            }
            if (this.mode === "heat" && this.currentTemp > this.initialTemp) {
                shouldMove = true; direction = -1;
            }

            if (shouldMove) {
                this.currentTemp += direction * recoverDelta;
                this.currentTemp = parseFloat(this.currentTemp.toFixed(3));

                console.log(`[房间 ${this.roomId}] 回温: ${before.toFixed(2)} → ${this.currentTemp.toFixed(2)}`);
            }

            /** 超过目标 ±1°C → 自动重新申请 **/
            if (!this.hasRequestedRestart) {
                if (this.mode === "cool" && this.currentTemp >= this.targetTemp + 1) {
                    this.status = "waiting";
                    this.hasRequestedRestart = true;
                    console.log(`[房间 ${this.roomId}] 回温到超标，重新申请服务`);
                    this.scheduler.requestService(this);
                }
                if (this.mode === "heat" && this.currentTemp <= this.targetTemp - 1) {
                    this.status = "waiting";
                    this.hasRequestedRestart = true;
                    console.log(`[房间 ${this.roomId}] 回温到超标，重新申请服务`);
                    this.scheduler.requestService(this);
                }
            }
            return;
        }

        /** ============ 等待状态：只回温 ============ **/
        if (this.status === "waiting") {
            if (this.mode === "cool" && this.currentTemp < this.initialTemp)
                this.currentTemp += recoverDelta;
            if (this.mode === "heat" && this.currentTemp > this.initialTemp)
                this.currentTemp -= recoverDelta;

            this.currentTemp = parseFloat(this.currentTemp.toFixed(3));

            // 重新申请逻辑已去掉，完全由调度器时间片轮转防饿死
            // if (Date.now() - this.requestStartTime > 60000) {
            //     console.log(`[房间 ${this.roomId}] 等待超时，重新申请`);
            //     this.scheduler.requestService(this);
            // }
        }
    }
}

export default Room;
