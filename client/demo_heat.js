import WebSocket from 'ws';

// ===================== 基本配置 =====================

const HTTP_BASE = process.env.HTTP_BASE || 'http://localhost:3000';
const WS_URL    = process.env.WS_URL    || 'ws://10.29.238.57:8080';

const TIME_ACCELERATION_FACTOR = 6;

// 制热场景使用的 5 个房间
const ROOM_NOS = ['201', '202', '203', '204', '205'];


const TEST_SCENARIOS = {
  // 房间1
  '201': [
    // 1 min：开机
    { delay: 10000, action: 'CONTROL', params: { targetTemp: 23, fanSpeed: 'medium', mode: 'heat' } },
    // 2 min：设为 24℃
    { delay: 10000, action: 'CONTROL', params: { targetTemp: 24, fanSpeed: 'medium', mode: 'heat' } },
    // 6 min：风速调高
    { delay: 40000, action: 'CONTROL', params: { targetTemp: 24, fanSpeed: 'high', mode: 'heat' } },
    // 10 min：调到 22℃（保持高风）
    { delay: 40000, action: 'CONTROL', params: { targetTemp: 22, fanSpeed: 'high', mode: 'heat' } },
    // 15 min：关机
    { delay: 50000, action: 'POWER_OFF' },
    // 19 min：再次开机
    { delay: 40000, action: 'CONTROL', params: { targetTemp: 22, fanSpeed: 'high', mode: 'heat' } },
    // 25 min：关机
    { delay: 60000, action: 'POWER_OFF' },
  ],

  // 房间2
  '202': [
    // 2 min：开机
    { delay: 20000, action: 'CONTROL', params: { targetTemp: 23, fanSpeed: 'medium', mode: 'heat' } },
    // 4 min：调到 25℃
    { delay: 20000, action: 'CONTROL', params: { targetTemp: 25, fanSpeed: 'medium', mode: 'heat' } },
    // 13 min：风速调高
    { delay: 90000, action: 'CONTROL', params: { targetTemp: 25, fanSpeed: 'high', mode: 'heat' } },
    // 21 min：26℃，中风
    { delay: 80000, action: 'CONTROL', params: { targetTemp: 26, fanSpeed: 'medium', mode: 'heat' } },
    // 26 min：关机
    { delay: 50000, action: 'POWER_OFF' },
  ],

  // 房间3
  '203': [
    // 3 min：开机
    { delay: 30000, action: 'CONTROL', params: { targetTemp: 23, fanSpeed: 'medium', mode: 'heat' } },
    // 5 min：调到 28℃
    { delay: 20000, action: 'CONTROL', params: { targetTemp: 28, fanSpeed: 'medium', mode: 'heat' } },
    // 15 min: 风速调低
    { delay: 100000, action: 'CONTROL', params: { targetTemp: 28, fanSpeed: 'low', mode: 'heat' } },
    // 18 min：风速调高
    { delay: 30000, action: 'CONTROL', params: { targetTemp: 28, fanSpeed: 'high', mode: 'heat' } },
    // 25 min：关机
    { delay: 70000, action: 'POWER_OFF' },
  ],

  // 房间4
  '204': [
    // 4 min：开机
    { delay: 40000, action: 'CONTROL', params: { targetTemp: 23, fanSpeed: 'medium', mode: 'heat' } },
    // 10 min：21℃，高风
    { delay: 60000, action: 'CONTROL', params: { targetTemp: 21, fanSpeed: 'high', mode: 'heat' } },
    // 19 min：25℃，中风
    { delay: 90000, action: 'CONTROL', params: { targetTemp: 25, fanSpeed: 'medium', mode: 'heat' } },
    // 26 min：
    { delay: 70000, action: 'POWER_OFF' },
  ],

  // 房间5
  '205': [
    // 4 min：开机
    { delay: 40000, action: 'CONTROL', params: { targetTemp: 23, fanSpeed: 'medium', mode: 'heat' } },
    // 5 min：风速高
    { delay: 10000, action: 'CONTROL', params: { targetTemp: 23, fanSpeed: 'high', mode: 'heat' } },
    // 8 min：24℃
    { delay: 30000, action: 'CONTROL', params: { targetTemp: 24, fanSpeed: 'high', mode: 'heat' } },
    // 12 min：中风
    { delay: 40000, action: 'CONTROL', params: { targetTemp: 24, fanSpeed: 'medium', mode: 'heat' } },
    // 17 min：关机
    { delay: 50000, action: 'POWER_OFF' },
    // 21 min：再次开机
    { delay: 40000, action: 'CONTROL', params: { targetTemp: 24, fanSpeed: 'medium', mode: 'heat' } },
    // 25 min：关机
    { delay: 40000, action: 'POWER_OFF' },
  ],
};

// 下面 RoomClient、main 的实现和 demo_cool.js 完全一样，唯一差异是默认 mode = 'heat'

class RoomClient {
  constructor(roomNo) {
    this.roomNo      = roomNo;
    this.roomId      = null;
    this.recordId    = null;
    this.initialTemp = null;
    this.ws          = null;
    this.scenario    = TEST_SCENARIOS[roomNo] || [];
    this.connected   = false;

    // 当前实时状态（从服务器推送更新）
    this.currentTemp = null;
    this.targetTemp  = 23;
    this.fanSpeed    = 'medium';
    this.mode        = 'heat';
    this.status      = null;   // running / stopped / waiting / off
    this.prevStatus  = null;

    // 当前计费片段（segment）
    this.segmentStartTime   = null;
    this.segmentFanSpeed    = null;
    this.segmentTargetTemp  = null;
    this.segmentMode        = null;
  }

  log(...args) {
    console.log(`[Room ${this.roomNo}]`, ...args);
  }

  async init() {
    await this.fetchRoomId();
    await this.fetchCurrentRecord();
    await this.connectWS();
  }

  async fetchRoomId() {
    const url = `${HTTP_BASE}/api/customer/convert-no?room_no=${this.roomNo}`;
    this.log('请求房间转换:', url);
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`convert-no HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(`convert-no 返回异常: ${JSON.stringify(json)}`);

    const { roomId, initialTemp } = json.data;
    this.roomId      = roomId;
    this.initialTemp = initialTemp != null ? Number(initialTemp) : 26;
    this.currentTemp = this.initialTemp;

    this.log('房间转换成功, roomId =', roomId, 'initialTemp =', this.initialTemp);
  }

  async fetchCurrentRecord() {
    const url = `${HTTP_BASE}/api/customer/room-records/current?room_no=${this.roomNo}`;
    this.log('请求当前入住记录:', url);
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`room-records/current HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data || !json.data.recordId) {
      throw new Error(`当前入住记录为空或异常: ${JSON.stringify(json)}`);
    }
    this.recordId = json.data.recordId;
    this.log('获取 recordId =', this.recordId);
  }

  // ======== 计费片段相关工具函数 ========

  startNewSegment(startTime, state = {}) {
    this.segmentStartTime  = startTime;
    this.segmentFanSpeed   = state.fanSpeed   ?? this.fanSpeed   ?? 'medium';
    this.segmentMode       = state.mode       ?? this.mode       ?? 'heat';
    this.segmentTargetTemp = state.targetTemp ?? this.targetTemp ?? 23;

    this.log('开始新的计费片段:', {
      startTime: this.segmentStartTime.toISOString(),
      fanSpeed:  this.segmentFanSpeed,
      mode:      this.segmentMode,
      target:    this.segmentTargetTemp,
    });
  }

  async saveOperationLog(operationType, options = {}) {
    if (!this.recordId) {
      this.log('recordId 为空，跳过写日志');
      return;
    }
    if (!this.segmentStartTime) {
      this.log('当前没有正在计费的片段，跳过写日志', operationType);
      return;
    }

    const endTime   = options.endTime || new Date();
    const startTime = this.segmentStartTime;

    const realMinutes      = (endTime - startTime) / (1000 * 60);
    const durationMinutes  = Math.max(0, realMinutes * TIME_ACCELERATION_FACTOR);

    const feePerMinute     = { low: 1/3, medium: 0.5, high: 1.0 };
    const fanSpeed         = options.fanSpeed   || this.segmentFanSpeed   || 'medium';
    const mode             = options.mode       || this.segmentMode       || this.mode || 'heat';
    const targetTemp       = options.targetTemp ?? this.segmentTargetTemp ?? this.targetTemp ?? 23;
    const currentTemp      = options.currentTemp ?? this.currentTemp ?? targetTemp;

    const fee        = (feePerMinute[fanSpeed] || feePerMinute.medium) * durationMinutes;
    const energyUsed = fee;

    const logData = {
      record_id:        this.recordId,
      room_no:          this.roomNo,
      start_time:       startTime.toISOString().slice(0, 19).replace('T', ' '),
      end_time:         endTime.toISOString().slice(0, 19).replace('T', ' '),
      fan_speed:        fanSpeed,
      mode,
      target_temp:      Number(targetTemp),
      current_temp:     Number(currentTemp),
      target_temp_diff: Number(Math.abs(currentTemp - targetTemp)),
      energy_used:      Number(energyUsed.toFixed(3)),
      fee:              Number(fee.toFixed(3)),
      operation_type:   operationType,
    };

    this.log('写入 AC 日志:', logData);

    try {
      const res = await fetch(`${HTTP_BASE}/api/acUsage/ac-usage-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.log('写日志失败:', res.status, res.statusText, txt);
      } else {
        this.log('写日志成功');
      }
    } catch (e) {
      this.log('写日志异常:', e);
    } finally {
      // 当前片段已经结束
      this.segmentStartTime = null;
    }
  }

  // ======== WebSocket 连接 ========

  async connectWS() {
    return new Promise((resolve, reject) => {
      this.log('连接 WebSocket:', WS_URL);
      const ws = new WebSocket(WS_URL);
      this.ws = ws;

      ws.on('open', () => {
        this.connected = true;
        this.log('WebSocket 已连接');

        const msg = {
          type: 'REGISTER_ROOM',
          payload: {
            roomId: this.roomId,
            recordId: this.recordId,
            initialTemp: this.initialTemp ?? 26,
          },
        };
        ws.send(JSON.stringify(msg));
        this.log('已发送 REGISTER_ROOM:', msg);
        resolve();
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type !== 'ROOM_STATUS_UPDATE') {
            this.log('收到消息:', msg);
            return;
          }

          const p = msg.payload || {};
          const newStatus = p.status || this.status;  // running / waiting / stopped / off
          const now       = new Date();

          this.log(
            'ROOM_STATUS_UPDATE',
            `status=${p.status}, mode=${p.mode}, fan=${p.fanSpeed}, ` +
              `curr=${p.currentTemp}, target=${p.targetTemp}, fee=${p.usageFee}, power=${p.powerConsumed}`
          );

          // 1）同步当前温度 / 目标温度 / 模式 / 风速
          if (p.currentTemp != null) this.currentTemp = Number(p.currentTemp);
          if (p.targetTemp  != null) this.targetTemp  = Number(p.targetTemp);
          if (p.mode)                this.mode       = p.mode;
          if (p.fanSpeed)            this.fanSpeed   = p.fanSpeed;

          // 2）状态机：检查 status 变化
          const prev = this.status;
          this.prevStatus = prev;
          this.status     = newStatus;

          // 3）根据状态流转关闭 / 开启计费片段
          //   - 非 running -> running：开启新片段
          //   - running -> waiting：被抢占 preempted
          //   - running -> stopped：到温度 auto_stop
          //   - running -> off：用户关机 user_off
          if (prev !== 'running' && newStatus === 'running') {
            // 新进入 running，开启一个新的计费片段
            this.startNewSegment(now, {
              fanSpeed:  p.fanSpeed,
              mode:      p.mode,
              targetTemp:p.targetTemp,
            });
          } else if (prev === 'running' && newStatus === 'waiting') {
            this.saveOperationLog('preempted', { endTime: now })
              .catch((err) => this.log('自动写日志失败(preempted):', err));
          } else if (prev === 'running' && newStatus === 'stopped') {
            this.saveOperationLog('auto_stop', { endTime: now })
              .catch((err) => this.log('自动写日志失败(auto_stop):', err));
          } else if (prev === 'running' && newStatus === 'off') {
            this.saveOperationLog('user_off', { endTime: now })
              .catch((err) => this.log('自动写日志失败(user_off):', err));
          }
        } catch (e) {
          this.log('解析消息失败:', e, data.toString());
        }
      });

      ws.on('close', () => {
        this.connected = false;
        this.log('WebSocket 已关闭');
      });

      ws.on('error', (err) => {
        this.connected = false;
        this.log('WebSocket 错误:', err);
        reject(err);
      });
    });
  }

  // ======== 发送控制命令 ========

  sendControl(targetTemp, fanSpeed, mode) {
    if (!this.connected) {
      this.log('未连接，无法发送 CUSTOMER_CONTROL');
      return;
    }
    const payload = {
      roomId: this.roomId,
      targetTemp,
      fanSpeed,
      mode,
      recordId: this.recordId,
    };
    const msg = { type: 'CUSTOMER_CONTROL', payload };
    this.ws.send(JSON.stringify(msg));
    this.log('发送 CUSTOMER_CONTROL:', msg);
  }

  sendPowerOff() {
    if (!this.connected) {
      this.log('未连接，无法发送 CUSTOMER_POWER_OFF');
      return;
    }
    const payload = {
      roomId: this.roomId,
      recordId: this.recordId,
    };
    const msg = { type: 'CUSTOMER_POWER_OFF', payload };
    this.ws.send(JSON.stringify(msg));
    this.log('发送 CUSTOMER_POWER_OFF:', msg);
  }

  // ======== 执行测试场景 ========

  runScenario() {
    if (!this.scenario.length) {
      this.log('没有配置测试用例，跳过');
      return;
    }
    this.log('开始执行测试场景，共', this.scenario.length, '步');

    let accumulatedDelay = 0;
    for (const step of this.scenario) {
      accumulatedDelay += step.delay || 0;
      setTimeout(() => {
        this.executeStep(step).catch((err) =>
          this.log('执行步骤异常:', err)
        );
      }, accumulatedDelay);
    }
  }

  async executeStep(step) {
    const { action, params = {} } = step;
    this.log('执行步骤:', action, params);

    switch (action) {
      case 'CONTROL': {
        const { targetTemp, fanSpeed, mode } = params;
        const now = new Date();

        // 如果当前处于 running，则当前片段到此结束，原因是 user_control
        if (this.status === 'running' && this.segmentStartTime) {
          await this.saveOperationLog('user_control', { endTime: now });
        }

        // 更新“目标设置”
        this.targetTemp = targetTemp;
        this.fanSpeed   = fanSpeed;
        this.mode       = mode;

        // 如果此刻仍是 running（通常是改设定温度 / 风速），立即开启新的计费片段
        if (this.status === 'running') {
          this.startNewSegment(now, { targetTemp, fanSpeed, mode });
        }

        this.sendControl(targetTemp, fanSpeed, mode);
        break;
      }

      case 'POWER_OFF': {
        // 不在这里结算费用，真正结算在 running -> off / waiting / stopped 的状态流转里处理
        this.sendPowerOff();
        break;
      }

      case 'SLEEP': {
        this.log('SLEEP 步骤，只等待，不发送指令');
        break;
      }

      default:
        this.log('未知 action，忽略:', action);
    }
  }
}

// =================== 主流程：同时启动 5 个房间 ===================

async function main() {
  console.log('=== 多房间空调测试（冷风）开始 ===');
  const clients = ROOM_NOS.map((roomNo) => new RoomClient(roomNo));

  // 初始化（HTTP + WebSocket）
  for (const client of clients) {
    try {
      await client.init();
    } catch (e) {
      client.log('初始化失败，跳过该房间:', e.message);
    }
  }

  // 执行各自测试场景
  for (const client of clients) {
    if (client.connected) {
      client.runScenario();
    }
  }

  // 总测试时长（按需调整）
  const TOTAL_TEST_TIME_MS = 30 * 60 * 1000; // 30 分钟
  setTimeout(() => {
    console.log('=== 测试结束，关闭所有连接 ===');
    clients.forEach((c) => c.ws && c.ws.close());
    process.exit(0);
  }, TOTAL_TEST_TIME_MS);
}

main().catch((err) => {
  console.error('主流程异常:', err);
  process.exit(1);
});
