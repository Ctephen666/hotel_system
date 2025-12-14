import TimeHelper from './TimeHelper.js'; 

class Scheduler {
    constructor({ MAX_SERVICE_CAPACITY = 3, TIME_SLICE_SEC = 120 } = {}) {
        this.serviceQueue = []; // 正在服务的房间
        this.waitQueue = [];    // 等待队列

        this.MAX_SERVICE_CAPACITY = MAX_SERVICE_CAPACITY;   // 服务对象上限
        this.TIME_SLICE_SEC = TIME_SLICE_SEC;               // 规则中的 s 秒（“模拟秒”）

        this.timer = null;

        // 用于规则 2.2：记录最近一次服务队列发生变化的时间（真实时间戳）
        this.lastServiceStateChangeAt = Date.now();
    }

    // 风速转优先级数值：高(3) > 中(2) > 低(1)
    getPriority(fanSpeed) {
        const priorityMap = { high: 3, medium: 2, low: 1 };
        return priorityMap[fanSpeed] || 1;
    }

    // 标记“服务队列发生变化”的时间点（用于 2.2.2 判断 s 秒内是否有变化）
    markServiceStateChanged() {
        this.lastServiceStateChangeAt = Date.now();
    }

    /**
     * 启动调度心跳
     * 对应规则 2.2.1: "倒计时" 逻辑
     */
    startScheduler() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            this.checkWaitTimeOut(); // 检查等待超时 (规则 2.2 + 2.3)
            this.dispatch();         // 常规填充 (规则 1)
        }, 1000);
    }

    /**
     * 请求服务入口
     */
    requestService(room) {
        console.log(`[调度] 房间 ${room.roomId} 请求服务 (风速:${room.fanSpeed})`);

        room.status = 'waiting';

        // 每次“进入等待队列”都重置等待起点时间，表示开启新一轮 s 秒倒计时
        const now = Date.now();
        room.requestStartTime = now;   // 统计用途：本轮等待起点
        room.waitStartTime = now;      // 真正用于调度的等待起点
        //room.waitDeadline = now + this.TIME_SLICE;

        // 如果已经在服务队列或等待队列，先移除，重新排队
        this.removeRoom(room.roomId);

        // 加入等待队列
        this.waitQueue.push(room);

        // 立即执行一次高优先级抢占检查 (规则 2.1.x)
        this.checkHighPriorityPreemption();

        // 尝试常规调度（如果还有空位则直接上机）
        this.dispatch();

        // 确保计时器开启
        this.startScheduler();
    }

    /**
     * 仅从系统中完全移除某个房间（用于重新排队 / 关机等）
     */
    removeRoom(roomId) {
        const beforeLen = this.serviceQueue.length;
        this.serviceQueue = this.serviceQueue.filter(r => r.roomId !== roomId);
        if (this.serviceQueue.length !== beforeLen) {
            this.markServiceStateChanged(); // 服务队列确实有变化
        }
        this.waitQueue = this.waitQueue.filter(r => r.roomId !== roomId);
    }

    /**
     * 仅从“服务队列”中释放房间（例如自然达到目标温度）
     * 对应规则：有服务对象释放时，应尝试让等待队列中对象获得服务
     */
    removeRoomFromService(room) {
        const beforeLen = this.serviceQueue.length;
        this.serviceQueue = this.serviceQueue.filter(r => r.roomId !== room.roomId);
        if (this.serviceQueue.length !== beforeLen) {
            this.markServiceStateChanged();
        }
        // 这里认为是“彻底离开系统”，不再进入等待队列
        this.dispatch(); // 腾出位置后尝试调度
    }

    /**
     * 【核心逻辑 1】高优先级抢占（2.1.1 / 2.1.2 / 2.1.3）
     */
    checkHighPriorityPreemption() {
        if (this.waitQueue.length === 0) return;

        // 等待队列排序：优先级高 -> 低，同优先级 -> 等待时间久
        this.sortWaitQueue();

        const topWaiter = this.waitQueue[0]; // 优先处理“风速最高 + 等得最久”的请求
        const waiterPriority = this.getPriority(topWaiter.fanSpeed);

        // 服务未满则不需要抢占（规则 1 处理）
        if (this.serviceQueue.length < this.MAX_SERVICE_CAPACITY) return;

        // --- 开始规则 2.1 判断 ---
        // 找出所有优先级 “低于” 请求对象 的服务对象
        const lowerPriorityServices = this.serviceQueue.filter(s =>
            this.getPriority(s.fanSpeed) < waiterPriority
        );

        if (lowerPriorityServices.length === 0) {
            // 规则 2.2 / 2.3: 优先级相等或更低的情况，交给时间片逻辑处理
            return;
        }

        console.log(`[调度] 触发高优先级抢占规则 (2.1)`);

        let targetToKick = null;

        // 找出服务队列中最低优先级值
        const minPriorityInService = Math.min(
            ...lowerPriorityServices.map(s => this.getPriority(s.fanSpeed))
        );

        // 所有“最低优先级”的服务对象集合
        const lowestPriorityGroup = lowerPriorityServices.filter(s =>
            this.getPriority(s.fanSpeed) === minPriorityInService
        );

        if (lowestPriorityGroup.length === 1) {
            // 规则 2.1.1: 只有 1 个比请求对象风速低的服务对象
            targetToKick = lowestPriorityGroup[0];
        } else {
            // 规则 2.1.2 & 2.1.3:
            // - 多个风速低于请求对象
            // - 风速可能相等也可能不相等
            // 这里统一选“服务时长最长”的那个
            targetToKick = lowestPriorityGroup.reduce((prev, curr) =>
                prev.serviceStartTime < curr.serviceStartTime ? prev : curr
            );
        }

        if (targetToKick) {
            console.log(`[抢占] 高优先级房间 ${topWaiter.roomId} 踢掉 ${targetToKick.roomId}`);
            this.executePreemption(topWaiter, targetToKick);
        }
    }

// // ======= 时间片轮转（规则 2.2）=======
// // 思路：
// // 1. 仅在服务已满且等待队列非空时检查；
// // 2. 找出所有 “等待时间 >= TIME_SLICE” 的房间（ready 列表）；
// // 3. 在 ready 中选：优先级最高 + 等得最久 的那个 candidate；
// // 4. 在 serviceQueue 中找与其同优先级的服务房间 samePriorityServices；
// // 5. 在 samePriorityServices 中选“服务时长最长”的 victim，把 candidate 换上去。
// checkWaitTimeOut() {
//     if (this.waitQueue.length === 0) return;
//     if (this.serviceQueue.length < this.MAX_SERVICE_CAPACITY) return; // 服务未满，不需时间片

//     const now = Date.now();

//     // 先按优先级 + 等待时长排序
//     this.sortWaitQueue();

//     // 1) 找出所有等待时间 >= TIME_SLICE 的房间
//     const ready = this.waitQueue.filter(r => {
//         if (!r.waitStartTime) return false;
//         const waitDuration = now - r.waitStartTime;
//         return waitDuration >= this.TIME_SLICE;
//     });

//     if (ready.length === 0) {
//         // 还没有任何人等满一个时间片
//         return;
//     }

//     // 2) 在 ready 里选择“优先级最高 + 等得最久”的房间作为 candidate
//     ready.sort((a, b) => {
//         const pA = this.getPriority(a.fanSpeed);
//         const pB = this.getPriority(b.fanSpeed);
//         if (pA !== pB) {
//             return pB - pA;
//         }
//         return (a.waitStartTime || 0) - (b.waitStartTime || 0);
//     });

//     const candidate = ready[0];
//     const candidatePriority = this.getPriority(candidate.fanSpeed);

//     // 3) 在服务队列中找出和 candidate 同优先级的服务对象
//     const samePriorityServices = this.serviceQueue.filter(
//         s => this.getPriority(s.fanSpeed) === candidatePriority
//     );

//     if (samePriorityServices.length === 0) {
//         // 规则 2.3：如果当前服务队列都比它优先级高，只能继续等待
//         return;
//     }

//     // 4) 在同优先级的服务对象中，选择“服务时长最长”的那个释放
//     const victim = samePriorityServices.reduce((prev, curr) => {
//         const tPrev = prev.serviceStartTime || 0;
//         const tCurr = curr.serviceStartTime || 0;
//         return tPrev <= tCurr ? prev : curr; // startTime 越早，服务越久
//     });

//     console.log(
//         `[时间片轮转] 等待满 ${this.TIME_SLICE / 1000} 秒的房间 ${candidate.roomId} ` +
//         `将替换同风速中服务时长最长的房间 ${victim.roomId}`
//     );

//     // 5) 执行抢占：candidate 上机，victim 进入等待队列
//     this.executePreemption(candidate, victim);

//     // 注意：这里不重置 candidate.waitStartTime；
//     // executePreemption() 内部会为 victim 设置新的 waitStartTime，
//     // candidate 则在 startServing() 中重置 serviceStartTime。
// }
    checkWaitTimeOut() {
        if (this.waitQueue.length === 0) return;
        if (this.serviceQueue.length < this.MAX_SERVICE_CAPACITY) return;

        const now = Date.now();
        this.sortWaitQueue(); // 优先级高 + 等得久在前

        for (const waiter of this.waitQueue) {
            const waiterPriority = this.getPriority(waiter.fanSpeed);

            // === 1. 计算真实等待时长（用模拟秒）===
            const realWaitMs = now - (waiter.waitStartTime || now);
            const waitedSimSec = TimeHelper.getSimulatedSeconds(realWaitMs);

            // 未满足时间片 -> 不动 waitStartTime（关键修复）
            if (waitedSimSec < this.TIME_SLICE_SEC) {
                continue;
            }

            // 进入时间片条件 -> 现在才重置 waitStartTime（仅成功轮转之后）
            // 但先不重置，等轮转成功后再重置

            // === 2. 找同优先级服务对象 ===
            const samePriorityServices = this.serviceQueue.filter(
                s => this.getPriority(s.fanSpeed) === waiterPriority
            );

            // 没有同优先级可轮转 -> 按策略 2.3 等待继续
            if (samePriorityServices.length === 0) {
                continue;
            }

            // === 3. 选择服务时长最长的作为替换对象 ===
            const targetToKick = samePriorityServices.reduce((prev, curr) => {
                const now2 = Date.now();
                const prevRun = prev.serviceStartTime ? now2 - prev.serviceStartTime : 0;
                const currRun = curr.serviceStartTime ? now2 - curr.serviceStartTime : 0;
                return currRun > prevRun ? curr : prev;
            });

            console.log(
                `[调度] 房间 ${waiter.roomId} 等待满 ${this.TIME_SLICE_SEC} 模拟秒，替换同风速服务最长者 ${targetToKick.roomId}`
            );

            // === 4. 执行轮转 ===
            this.executePreemption(waiter, targetToKick);

            // === 5. 轮转成功后才更新 waitStartTime（防止饿死）===
            waiter.waitStartTime = Date.now();

            break; // 一次 tick 只处理一个
        }
    }

    /**
     * 执行抢占动作：踢掉 oldRoom，换上 newRoom
     * 对应规则：2.1.2 / 2.2.2
     */
    executePreemption(newRoom, oldRoom) {
        const now = Date.now();

        // 1. 释放旧房间 (变为等待)
        oldRoom.status = 'waiting';
        oldRoom.serviceStartTime = 0;

        // 【关键修改 2】
        // 被抢占的房间重新进入等待队列，开启新一轮 s 秒等待
        oldRoom.requestStartTime = now;
        oldRoom.waitStartTime = now;
        oldRoom.waitDeadline = now + this.TIME_SLICE;

        // 从服务队列移到等待队列
        this.serviceQueue = this.serviceQueue.filter(r => r.roomId !== oldRoom.roomId);
        this.waitQueue.push(oldRoom);

        // 2. 上位新房间
        this.startServing(newRoom);
    }

    /**
     * 开始服务房间
     */
    startServing(room) {
        // 从等待队列移除
        this.waitQueue = this.waitQueue.filter(r => r.roomId !== room.roomId);

        // 加入服务队列
        room.status = 'running';
        room.serviceStartTime = Date.now();

        this.serviceQueue.push(room);
        this.markServiceStateChanged();

        console.log(`[调度] 房间 ${room.roomId} 开始服务`);
    }

    /**
     * 基础调度：填充空位 (规则 1)
     */
    dispatch() {
        while (
            this.serviceQueue.length < this.MAX_SERVICE_CAPACITY &&
            this.waitQueue.length > 0
        ) {
            this.sortWaitQueue();
            const nextRoom = this.waitQueue[0];
            this.startServing(nextRoom);
        }
    }

    /**
     * 等待队列排序：
     *  - 优先级高在前
     *  - 优先级相同，等待时间长(waitStartTime小)在前
     */
    sortWaitQueue() {
        this.waitQueue.sort((a, b) => {
            const pA = this.getPriority(a.fanSpeed);
            const pB = this.getPriority(b.fanSpeed);
            if (pA !== pB) {
                return pB - pA; // 优先级高的在前
            }
            return (a.waitStartTime || 0) - (b.waitStartTime || 0); // 等得久的在前
        });
    }

    // /**
    //  * 获取当前状态 (用于前端显示)
    //  */
    // getStatus() {
    //     const now = Date.now();
    //     return {
    //         serviceQueue: this.serviceQueue.map(r => ({
    //             roomId: r.roomId,
    //             fanSpeed: r.fanSpeed,
    //             runTime: r.serviceStartTime ? Math.floor((now - r.serviceStartTime) / 1000) : 0
    //         })),
    //         waitQueue: this.waitQueue.map(r => ({
    //             roomId: r.roomId,
    //             fanSpeed: r.fanSpeed,
    //             waitTime: r.waitStartTime ? Math.floor((now - r.waitStartTime) / 1000) : 0
    //         }))
    //     };
    // }

    getStatus() {
        const now = Date.now();
        return {
            serviceQueue: this.serviceQueue.map(r => {
                const realMs = r.serviceStartTime ? (now - r.serviceStartTime) : 0;
                const simSec = Math.floor(TimeHelper.getSimulatedSeconds(realMs));
                return {
                    roomId: r.roomId,
                    fanSpeed: r.fanSpeed,
                    runTime: simSec,  // 面板显示的“运行秒数”（加速 6 倍）
                };
            }),
            waitQueue: this.waitQueue.map(r => {
                const realMs = r.waitStartTime ? (now - r.waitStartTime) : 0;
                const simSec = Math.floor(TimeHelper.getSimulatedSeconds(realMs));
                return {
                    roomId: r.roomId,
                    fanSpeed: r.fanSpeed,
                    waitTime: simSec, // 面板显示的“等待秒数”（加速 6 倍）
                };
            })
        };
    }
    
}

export default Scheduler;
