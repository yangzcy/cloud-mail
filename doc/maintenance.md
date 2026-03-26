# 维护说明

本文档只记录后续迁移和维护最容易踩坑的主线，不替代代码本身。

## 目录结构

- `mail-vue`
  前端应用，负责登录、邮件列表、写信、后台管理和系统设置。
- `mail-worker`
  Cloudflare Worker 后端，负责鉴权、权限、邮件收发、D1/KV/R2 读写和系统配置。

## 后端关键链路

### 鉴权与权限

- 入口中间件在 [`mail-worker/src/security/security.js`](/root/cloud-mail/mail-worker/src/security/security.js)。
- 接口访问分三层：
  1. `exclude` 白名单路由，不需要登录态。
  2. 普通登录态接口，需要 JWT + KV 会话白名单同时通过。
  3. `requirePerms` 路由，除了登录态，还需要按钮级权限。
- 管理员邮箱 `c.env.admin` 具有兜底超级权限，不受普通按钮权限限制。
- `userContext` 只负责从上下文读取当前用户，不重复做鉴权。

### 登录态存储

- JWT 只保存最小身份信息。
- 真正的会话白名单保存在 KV：`AUTH_INFO + userId`。
- 同一用户最多保留最近 10 个 token。
- 登出时只移除当前 token，不影响该用户其他设备会话。

### 系统设置

- 设置真值在 D1 的 `setting` 表。
- 读取链路优先级：
  1. request context
  2. KV 缓存
  3. D1
- 写入设置后要调用 `settingService.refresh()`，把最新配置同步回 KV。
- 对前端返回的敏感字段默认做脱敏处理，例如 `siteKey`、`secretKey`、`resendTokens`、`s3AccessKey`。

### D1 批量限制

- Cloudflare D1/SQLite 对变量数量敏感，批量 `IN (...)` 和 `db.batch(...)` 都可能触发 `too many SQL variables`。
- 分块工具在 [`mail-worker/src/utils/batch-utils.js`](/root/cloud-mail/mail-worker/src/utils/batch-utils.js)。
- 当前约定：
  - 普通分块大小 `SQLITE_CHUNK_SIZE = 50`
  - `db.batch(...)` 分块大小 `SQLITE_BATCH_STATEMENT_CHUNK_SIZE = 40`
- 后续新增批量删除、批量更新、批量统计时，默认先考虑分块，不要直接一次性拼大数组。

### 批量删除顺序

当用户、账号、邮件发生硬删除时，优先按“关联资源 -> 主记录”顺序清理：

1. 附件
2. 星标
3. OAuth / KV 会话 / 其他关联记录
4. 邮件或账号或用户主记录

原因：

- 避免留下悬挂数据库记录
- 避免 R2 对象未回收
- 避免 UI 还持有已不存在的主对象

## 前端关键链路

### 初始化

- 前端启动入口在 [`mail-vue/src/main.js`](/root/cloud-mail/mail-vue/src/main.js)。
- 真正初始化逻辑在 [`mail-vue/src/init/init.js`](/root/cloud-mail/mail-vue/src/init/init.js)。
- `init()` 会先拉取站点配置，再在已登录场景下拉取当前用户信息，并动态注入权限路由。
- 应用在 `init()` 结束后才挂载，避免出现路由、语言和权限状态未就绪的闪烁。

### 动态路由与按钮权限

- 动态路由映射在 [`mail-vue/src/perm/perm.js`](/root/cloud-mail/mail-vue/src/perm/perm.js)。
- `permsToRouter()` 负责把按钮权限翻译成后台可访问路由。
- `v-perm` 指令负责移除无权限按钮和菜单。
- 如果后端新增按钮权限，前端通常要同时补：
  - 后端 `security.js` 的路由映射
  - 前端 `perm.js` 的动态路由或按钮控制

### 全局状态

常用 store 作用如下：

- `user`
  当前登录用户信息和轻量刷新信号。
- `account`
  当前账号、账号名同步。
- `email`
  列表刷新、删除、星标、阅读区内容等跨组件联动状态。
- `ui`
  侧栏、账号列、预览和全局 UI 信号。
- `writer`
  写信收件人历史。
- `draft`
  草稿刷新信号和草稿内容同步。

### 邮件列表与阅读区联动

- 通用列表组件在 [`mail-vue/src/components/email-scroll/index.vue`](/root/cloud-mail/mail-vue/src/components/email-scroll/index.vue)。
- 阅读区在 [`mail-vue/src/views/content/index.vue`](/root/cloud-mail/mail-vue/src/views/content/index.vue)。
- 列表和阅读区通过 `emailStore` 传递：
  - 删除信号
  - 星标变化
  - 当前阅读邮件
  - 已读状态

### 草稿

- 草稿存储在前端 IndexedDB，不走后端。
- 草稿页在 [`mail-vue/src/views/draft/index.vue`](/root/cloud-mail/mail-vue/src/views/draft/index.vue)。
- 写信窗口关闭时，如果需要保存草稿，会把正文和附件分别写入本地库。

## 迁移时优先确认的配置

- Worker 环境变量中的 `domain`
- `admin`
- `jwt_secret`
- `project_link`
- `linuxdo_*`
- D1 绑定 `db`
- KV 绑定 `kv`
- R2 绑定 `r2`

## 发布与同步流程

### 远程约定

- `origin`
  自己的 fork，用于推送日常开发和版本发布。
- `upstream`
  官方仓库，用于同步上游更新。

推荐检查命令：

```bash
git remote -v
```

### 默认策略

- 默认先 `fetch`，再决定是否 `rebase`。
- 如果只是把本地已确认的提交发布到自己的 fork，优先使用 `git pull --rebase origin main` 保持线性历史。
- 如果需要吸收官方最新改动，优先使用 `git fetch upstream` + `git rebase upstream/main`，避免无意义的合并提交。

### 只发布到自己的 fork

适用于当前不打算同步官方更新，只想把本地 `main` 和标签发布到自己的 `origin`：

```bash
git checkout main
git status
git pull --rebase origin main
git log --oneline --max-count=5
git push origin main
```

如果需要同时发布标签，先显式确认标签指向的提交，再推送：

```bash
git tag -f v1.0 <commit>
git tag -f 1.0 <commit>
git rev-parse v1.0 1.0 main
git push origin refs/tags/v1.0 --force
git push origin refs/tags/1.0 --force
```

说明：

- `v1.0` 和 `1.0` 可以同时保留，兼容不同使用习惯。
- 只有在标签已经存在且需要改到新提交时，才使用 `--force`。
- 推送标签时使用 `refs/tags/...`，减少分支名和标签名冲突时的歧义。

### 同步官方更新后再发布

适用于先吸收 `upstream/main` 的最新改动，再同步到自己的 fork：

```bash
git checkout main
git status
git fetch upstream
git rebase upstream/main
git push origin main
```

如果同步上游后需要发新标签：

```bash
git tag -f v1.1 <commit>
git tag -f 1.1 <commit>
git push origin refs/tags/v1.1 --force
git push origin refs/tags/1.1 --force
```

### 发布前最小检查项

发布前至少确认以下几点：

1. `git status` 为干净状态，或你明确知道未提交改动不会影响发布。
2. `git log --oneline --max-count=5` 中最新提交就是准备发布的版本提交。
3. `git remote -v` 中 `origin` 和 `upstream` 没有配反。
4. 标签最终指向预期提交，必要时用 `git rev-parse 1.0 v1.0 main` 交叉确认。

### 发布后最小验证项

发布后至少确认以下几点：

1. `git ls-remote --heads origin main` 返回的提交与本地 `git rev-parse main` 一致。
2. 如果推了标签，`git ls-remote --tags origin v1.0 1.0` 返回的提交与本地标签一致。
3. 远端仓库页面上的分支和标签已更新，没有推错到 `upstream`。
4. 如果你的实际部署依赖 GitHub Actions、Cloudflare Worker 或静态站点发布，确认对应流水线已经执行并完成。

## 新增功能时的建议

- 新增批量接口时，先判断是否可能出现大数组，必要时直接复用 `chunkArray()`。
- 新增后台页面时，同时考虑：
  - 后端 `requirePerms`
  - 权限 key 到路由的映射
  - 前端 `v-perm`
- 新增系统设置项时，确认是否需要：
  - 脱敏返回
  - 写入后刷新 KV
  - 前端初始化阶段读取

## 不建议直接做的事

- 不要直接把大批量 ID 一次性塞进 `inArray(...)`。
- 不要绕过 `settingService.refresh()` 直接改设置表。
- 不要只靠 JWT 判断登录态有效，KV 白名单同样是会话真值。
- 不要把无权限按钮只做置灰而不隐藏，当前前端权限模型默认是直接移除。
