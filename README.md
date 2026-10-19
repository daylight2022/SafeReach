# SafeReach · 安心通

在外人员管理系统的内部项目仓库。

本仓库**仅存放基础设施运维配置**（GitHub Actions 保活工作流），**不含项目源代码**——代码在维护者本地进行版本管理，不对外共享。

## 工作流

| 工作流 | 用途 |
|---|---|
| Supabase Keep-alive | 每天北京时间 10:00 探测 Supabase 项目与反代域名存活，防止免费层闲置自动暂停；失败自动发告警邮件 |

真实地址与密钥存放于仓库 Secrets（Settings → Secrets and variables → Actions），不落任何文件。
