import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { config } from 'dotenv-flow';
import { serve } from '@hono/node-server';

// 导入数据库连接
import { testConnection } from './db/connection.js';

// 导入路由
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import departmentsRouter from './routes/departments.js';
import personsRouter from './routes/persons.js';
import leavesRouter from './routes/leaves.js';
import contactsRouter from './routes/contacts.js';
import remindersRouter from './routes/reminders.js';
import reminderSettingsRouter from './routes/reminderSettings.js';
import statisticsRouter from './routes/statistics.js';
import versionsRouter from './routes/versions.js';

// 导入工具
import { successResponse, errorResponse } from './utils/response.js';
import ReminderScheduler from './services/reminderScheduler.js';

// 加载环境变量
config();

const app = new Hono();

// 中间件配置
app.use('*', logger());
app.use('*', prettyJSON());

// CORS 配置
app.use(
  '*',
  cors({
    origin: origin => {
      const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        return origin || '*';
      }
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// 健康检查
app.get('/health', async c => {
  try {
    const dbConnected = await testConnection();

    return successResponse(c, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      version: '1.0.0',
    });
  } catch (error) {
    return errorResponse(c, '健康检查失败', 500);
  }
});

// API 根路径
app.get('/', c => {
  return successResponse(c, {
    name: 'SafeReach API',
    version: '1.0.0',
    description: '基于 Hono 的现代化 API 服务',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      departments: '/api/departments',
      persons: '/api/persons',
      leaves: '/api/leaves',
      contacts: '/api/contacts',
      reminders: '/api/reminders',
      reminderSettings: '/api/reminder-settings',
      statistics: '/api/statistics',
      versions: '/api/versions',
    },
    docs: '/api/docs',
  });
});

// API 路由
app.route('/api/auth', authRouter);
app.route('/api/users', usersRouter);
app.route('/api/departments', departmentsRouter);
app.route('/api/persons', personsRouter);
app.route('/api/leaves', leavesRouter);
app.route('/api/contacts', contactsRouter);
app.route('/api/reminders', remindersRouter);
app.route('/api/reminder-settings', reminderSettingsRouter);
app.route('/api/statistics', statisticsRouter);
app.route('/api/versions', versionsRouter);

// API 文档
app.get('/api/docs', c => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SafeReach API 文档</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1, h2, h3 { color: #333; }
        .endpoint { margin: 20px 0; padding: 15px; border-left: 4px solid #007cba; background: #f9f9f9; }
        .method { font-weight: bold; color: #007cba; }
        .path { font-family: monospace; background: #eee; padding: 2px 6px; }
        .description { margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>SafeReach API 文档</h1>
      
      <h2>认证</h2>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/auth/login</span></div>
        <div class="description">用户登录</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/auth/verify</span></div>
        <div class="description">验证 Token</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/auth/refresh</span></div>
        <div class="description">刷新 Token</div>
      </div>

      <h2>用户管理</h2>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/users</span></div>
        <div class="description">获取用户列表（管理员）</div>
      </div>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/users/me</span></div>
        <div class="description">获取当前用户信息</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/users</span></div>
        <div class="description">创建用户（管理员）</div>
      </div>
      <div class="endpoint">
        <div><span class="method">PUT</span> <span class="path">/api/users/:id</span></div>
        <div class="description">更新用户信息</div>
      </div>

      <h2>人员管理</h2>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/persons</span></div>
        <div class="description">获取人员列表</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/persons</span></div>
        <div class="description">创建人员</div>
      </div>
      <div class="endpoint">
        <div><span class="method">PUT</span> <span class="path">/api/persons/:id</span></div>
        <div class="description">更新人员信息</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/persons/:id/contact</span></div>
        <div class="description">更新联系信息</div>
      </div>

      <h2>休假管理</h2>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/leaves</span></div>
        <div class="description">获取休假记录列表</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/leaves</span></div>
        <div class="description">创建休假记录</div>
      </div>
      <div class="endpoint">
        <div><span class="method">PUT</span> <span class="path">/api/leaves/:id</span></div>
        <div class="description">更新休假记录</div>
      </div>

      <h2>联系记录</h2>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/contacts</span></div>
        <div class="description">获取联系记录列表</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/contacts</span></div>
        <div class="description">创建联系记录</div>
      </div>
      <div class="endpoint">
        <div><span class="method">PUT</span> <span class="path">/api/contacts/:id</span></div>
        <div class="description">更新联系记录</div>
      </div>

      <h2>提醒管理</h2>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/reminders</span></div>
        <div class="description">获取提醒记录列表</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/reminders</span></div>
        <div class="description">创建提醒记录</div>
      </div>
      <div class="endpoint">
        <div><span class="method">POST</span> <span class="path">/api/reminders/:id/handle</span></div>
        <div class="description">标记提醒为已处理</div>
      </div>

      <h2>统计数据</h2>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/statistics/dashboard</span></div>
        <div class="description">获取仪表板统计数据</div>
      </div>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/statistics/contacts</span></div>
        <div class="description">获取联系统计数据</div>
      </div>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/statistics/leaves</span></div>
        <div class="description">获取休假统计数据</div>
      </div>
      <div class="endpoint">
        <div><span class="method">GET</span> <span class="path">/api/statistics/personal</span></div>
        <div class="description">获取个人统计数据</div>
      </div>

      <h2>认证说明</h2>
      <p>除了登录接口外，所有 API 都需要在请求头中包含 JWT Token：</p>
      <pre>Authorization: Bearer &lt;your-jwt-token&gt;</pre>
    </body>
    </html>
  `);
});

// 404 处理
app.notFound(c => {
  return errorResponse(c, '接口不存在', 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('服务器错误:', err);
  return errorResponse(c, '服务器内部错误', 500);
});

// 启动定时任务
const scheduler = ReminderScheduler.getInstance();
scheduler.start();

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 接收到 SIGINT 信号，正在关闭服务...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 接收到 SIGTERM 信号，正在关闭服务...');
  scheduler.stop();
  process.exit(0);
});

// 启动服务器
const port = parseInt(process.env.PORT || '3000');

console.log(`🚀 SafeReach API 服务启动中...`);
console.log(`📡 端口: ${port}`);
console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
console.log(`📚 API 文档: http://localhost:${port}/api/docs`);
console.log(`⏰ 定时任务调度器已启动`);

// 启动 HTTP 服务器 (使用官方 node-server)
serve(
  {
    fetch: app.fetch,
    port,
  },
  info => {
    console.log(`✅ SafeReach API 服务已启动在端口 ${info.port}`);
  },
);

export default {
  port,
  fetch: app.fetch,
};
