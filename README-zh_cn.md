<table width="100%">
  <tr>
    <td align="left" width="120">
      <img src="apps/web/public/logo.png" alt="OpenCut Logo" width="100" />
    </td>
    <td align="right">
      <h1>OpenCut <span style="font-size: 0.7em; font-weight: normal;">(原AppCut)</span></h1>
      <h3 style="margin-top: -10px;">一款适用于网页、桌面和移动端的免费开源视频编辑器</h3>
    </td>
  </tr>
</table>

## 为什么选择OpenCut？

- **隐私保护**：视频文件全程保存在您的设备中
- **免费特性**：所有基础功能完全免费（对比CapCut已全面付费）
- **极简体验**：简单好用剪辑软件设计模式（CapCut的成功验证了这点）

## 核心功能

- 时间轴非线性编辑
- 多轨道协同编辑
- 实时预览与渲染
- 零水印/订阅制
- 由[Databuddy](https://www.databuddy.cc?utm_source=opencut&utm_campaign=oss)提供数据分析，100%匿名且无痕。

## 项目架构

- `apps/web/` – 主要Next.js前端应用
- `src/components/` – UI组件与编辑器模块
- `src/hooks/` – 自定义React Hook集合
- `src/lib/` – 工具函数与API逻辑层
- `src/stores/` – 状态管理（Zustand等）
- `src/types/` – TypeScript类型定义

## 快速入门

### 系统要求

请确保已安装以下环境：

- [Node.js](https://nodejs.org/en/)（v18+）
- [Bun](https://bun.sh/docs/installation)（npm替代方案）
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)

> **注意**：Docker为可选配置，若要运行本地数据库和Redis服务则为必需。若仅需运行前端或进行前端开发，可跳过Docker环境搭建。若已完成[环境配置](#环境配置)章节的操作，则可直接启动开发环境。

### 环境配置


1. fork本仓库
2. 将个人fork克隆到本地
3. 进入Web应用目录：`cd apps/web`
4. 复制一份`.env.example`，将其改为`.env.local`，命令如下:


   ```bash
   # Unix/Linux/Mac
   cp .env.example .env.local

   # Windows命令提示符
   copy .env.example .env.local

   # Windows PowerShell
   Copy-Item .env.example .env.local
   ```

5. 安装依赖：`bun install`
6. 启动开发服务器：`bun dev`

## 环境配置（针对开发者）

### 本地开发

1. 启动数据库和Redis服务：

   ```bash
   #项目根目录执行该命令
   docker-compose up -d
   ```

2. 进入Web应用目录：

   ```bash
   cd apps/web
   ```

3. 复制一份`.env.example`，将其改为`.env.local`，命令如下:

   ```bash
   # Unix/Linux/Mac
   cp .env.example .env.local

   # Windows命令提示符
   copy .env.example .env.local

   # Windows PowerShell
   Copy-Item .env.example .env.local
   ```

4. 配置环境变量（`.env.local`）:

   **必需配置的变量：**

   ```bash
   # 数据库（需与docker-compose.yaml匹配）
   DATABASE_URL="postgresql://opencut:opencutthegoat@localhost:5432/opencut"

   # 生成Better Auth安全密钥
   BETTER_AUTH_SECRET="此处填写生成的安全密钥"
   BETTER_AUTH_URL="http://localhost:3000"

   # Redis配置（需与docker-compose匹配）
   UPSTASH_REDIS_REST_URL="http://localhost:8079"
   UPSTASH_REDIS_REST_TOKEN="此处填入token"

   # 开发环境
   NODE_ENV="development"
   ```

   **生成BETTER_AUTH_SECRET：**

   ```bash
   # Unix/Linux/Mac
   openssl rand -base64 32

   # Windows PowerShell (简易方法)
   [System.Web.Security.Membership]::GeneratePassword(32, 0)

   # 跨平台 (Node.js)
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

   # 或者使用在线生成器: https://generate-secret.vercel.app/32
   ```

5. 执行数据库迁移：`bun run db:migrate`（在apps/web目录下）
6. 启动开发服务器：`bun run dev`（在apps/web目录下）

应用将在[http://localhost:3000](http://localhost:3000)启动。

## 贡献指南

我们欢迎社区贡献！虽然我们正积极重构某些模块，但仍有众多有效的贡献方向：

**🎯 优先领域：**
- 时间轴功能开发
- 项目管理系统
- 性能优化
- Bug修复
- 预览区域外的UI改进

**⚠️ 暂缓方向：**
- 预览面板增强（字体、贴纸、特效）
- 导出功能   

上述方向将采用新型二进制渲染方案进行重构


查看[贡献指南](.github/CONTRIBUTING.md)获取完整开发规范和详细指南。

**快速贡献指南:**

- fork仓库并本地克隆
- 按照CONTRIBUTING.md设置开发环境
- 创建新的功能分支并提交Pull Request

## 赞助商

感谢[Vercel](https://vercel.com?utm_source=github-opencut&utm_campaign=oss)对开源项目的支持。

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS计划" src="https://vercel.com/oss/program-badge.svg" />
</a>

[![使用Vercel部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FOpenCut-app%2FOpenCut&project-name=opencut&repository-name=opencut)

## 许可证

[MIT许可证](LICENSE)

---

![星标历史图](https://api.star-history.com/svg?repos=opencut-app/opencut&type=Date)