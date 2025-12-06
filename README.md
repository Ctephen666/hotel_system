```
Hotel-AC-System/
├── .gitignore                    # Git 忽略文件 (必须包含 node_modules, .env)
├── README.md                     # 项目说明、启动文档
├── package.json                  # (可选) 用于同时启动前后端的脚本
│
├── docs/                         # [文档资料区]
│   ├── 1.pdf                     # 需求规格说明书
│   └── parameter_config.csv      # 系统参数配置表 
│
├── server/                       # [后端项目] - Node.js + Express
│   ├── package.json              # 后端依赖 (express, ws, mysql2, sequelize)
│   ├── server.js                 # [D] 程序入口 (启动 HTTP 和 WebSocket 服务)
│   │
│   ├── config/                   # [配置中心]
│   │   ├── db.config.js          # [D] 数据库连接配置
│   │   └── system.config.js      # [D] 读取CSV参数 (费率:1元/度, 调度:2分钟) 
│   │
│   ├── core/                     # [核心业务逻辑 - 纯OOP]
│   │   ├── Scheduler.js          # [A] 调度器 (优先级+时间片算法)
│   │   ├── Room.js               # [A/B] 房间类 (维护温度、回温逻辑、费用) 
│   │   ├── Billing.js            # [A] 计费服务 (计算详单费用)
│   │   └── TimeHelper.js         # [A] 时间加速器 (10s = 1min) 
│   │
│   ├── models/                   # [数据库模型/DAO]
│   │   ├── db.js                 # [D] 数据库实例
│   │   ├── LogDAO.js             # [D] 空调详单表 (Service logs)
│   │   ├── BillDAO.js            # [D] 账单/发票表 (Invoice)
│   │   └── RoomDAO.js            # [D] 客房状态表
│   │
│   ├── routes/                   # [API 路由]
│   │   ├── checkIn.js            # [C] 入住/退房 API
│   │   └── reports.js            # [C] 报表 API
│   │
│   └── utils/                    # [工具类]
│       └── logger.js             # 日志工具
│
└── client/                       # [前端项目] - React + Vite/CRA
    ├── package.json              # 前端依赖 (react, antd, axios, react-router-dom)
    ├── vite.config.js            # (或 webpack.config.js)
    ├── public/
    └── src/
        ├── main.jsx              # 入口文件
        ├── App.jsx               # 路由配置
        ├── index.css             # 全局样式
        │
        ├── api/                  # [通信层 - 前后端对接关键]
        │   ├── socket.js         # [E] WebSocket 单例封装 (处理实时消息)
        │   └── http.js           # [E] Axios 封装 (处理 REST 请求)
        │
        ├── components/           # [公共组件]
        │   └── Layout.jsx        # 页面导航栏/侧边栏
        │
        └── pages/                # [页面视图]
            ├── Home.jsx          # 首页 (用户上传)
            │
            ├── customer/         # [客户/房间端] - 成员 B
            │   ├── CustomerCheckIn.jsx     # 自助入住 (用户上传)
            │   ├── CustomerACControl.jsx   # 空调面板 (用户上传) - [重点: WebSocket]
            │   └── CustomerCheckOut.jsx    # 自助退房 (用户上传)
            │
            └── admin/            # [酒店管理端] - 成员 C & E
                ├── AdminDispatcher.jsx # 调度监控 (用户上传) - [重点: 队列展示]
                ├── AdminConsole.jsx    # 房间总控 (用户上传)
                ├── AdminCheckOut.jsx   # 前台结账 (用户上传) - [重点: 打印账单]
                └── AdminDashBoard.jsx  # 报表中心 (用户上传)
```