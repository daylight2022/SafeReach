module.exports = {
  apps: [
    {
      name: 'safereach-backend',
      script: 'dist/index.js',
      instances: 'max', // 使用所有可用的 CPU 核心
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志配置
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // 进程管理
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',

      // 监控配置
      watch: false,
      ignore_watch: ['node_modules', 'logs'],

      // 自动重启配置
      autorestart: true,

      // 健康检查
      health_check_grace_period: 3000,

      // 环境变量
      env_file: '.env',

      // 进程间通信
      kill_timeout: 5000,
      listen_timeout: 3000,

      // 集群配置
      instance_var: 'INSTANCE_ID',

      // 合并日志
      merge_logs: true,

      // 时间戳
      time: true,
    },
    {
      name: 'safereach-cron',
      script: 'scripts/reminder-cron.js',
      instances: 1,
      exec_mode: 'fork',
      // 移除 cron_restart，避免与脚本内部定时任务冲突
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // 日志配置
      log_file: './logs/cron-combined.log',
      out_file: './logs/cron-out.log',
      error_file: './logs/cron-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // 进程管理
      max_memory_restart: '500M',
      restart_delay: 4000,
      max_restarts: 5,
      min_uptime: '10s',

      // 监控配置
      watch: false,
      autorestart: true,

      // 环境变量
      env_file: '.env',

      // 合并日志
      merge_logs: true,
      time: true,
    },
  ],
};
