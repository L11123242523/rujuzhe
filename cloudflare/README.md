# 入局者联机中继 —— Cloudflare Workers + Durable Objects（免信用卡，主用方案）

前端 `game.html` 采用**确定性双机推演**：双方浏览器跑同一份引擎、用同一颗随机种子，
因此服务器**不做任何规则结算**，只负责：建房发号 / 两人就绪后发同一颗种子 / 原样转发消息。
一个 4 位房号 = 一个 Durable Object 实例，天然持有该房间连接与状态。

## 协议（Cloudflare Worker 与根目录 `online_server.js` 一致；**前端也必须照这套走**）

- `GET /health` → `{ok:true}`
- `GET /newroom` → `{code:"ABCD"}`（带 CORS，供跨源页面 fetch）
- WebSocket 连接 `wss://<域名>/?r=房号`，连上后首条发：
  - 房主 `{t:'hello',role:'host',name}`
  - 客人 `{t:'hello',role:'guest',name}`
- 服务器下发：`joined{id,sid,isHost}` / `room{players:[{sid,name,ready}]}` /
  `start{seed,first:房主sid}` / `relay{m}` / `oppLeft` / `error{msg,code}`
- 客户端发送：`ready` / `relay{m}` / `leave`

> ⚠️ **房号是两步拿的，不是靠连上以后发消息建的。**
> 房主必须先 `GET /newroom` 拿 4 位房号，再连 `/?r=房号`；
> 服务器端**没有** `create` / `join` 这两条消息 —— Durable Object 是按房号命名的，
> 没法"先连上再要一个房号"。前端对应实现在 `game.html` 的 `Online.createRoom / joinRoom / _connect`。

## 本地调试

```bash
# 在仓库根目录（wrangler 已在 devDependencies）
npm install
npx wrangler -C cloudflare/wrangler.toml dev --port 8787
# 另开终端跑协议自测（需要 ws）：
node cloudflare/relay_test.js            # RELAY_PORT=8787
# 对照 Node 版：node online_server.js 后 RELAY_PORT=2567 node cloudflare/relay_test.js
```

## 部署到 Cloudflare（永久免费，无需信用卡）

**关键前提：自定义域名要求该域名的 DNS 托管在 Cloudflare。**
`rujuzhe-b-a-gs.top` 的 NS 原本在 DNSPod，必须先改到 Cloudflare，否则
`wrangler deploy` 会因为 `routes` 里的 `custom_domain` 找不到 zone 而直接报错。
（详见仓库根目录的 `联机上线步骤.md`。）

1. Cloudflare 仪表盘 Add a site 加 `rujuzhe-b-a-gs.top`（Free 档），
   拿到 Cloudflare 给的两个 NS，去域名注册商处改成它们；等状态变成 Active。
2. 注册/登录后在 My Profile → API Tokens 创建令牌，模板选 **Edit Cloudflare Workers**
   （已含 Workers Scripts 与 Durable Objects 权限），并拿到 **Account ID**。
3. 配置环境变量后部署：

```bash
export CLOUDFLARE_API_TOKEN=你的令牌
export CLOUDFLARE_ACCOUNT_ID=你的AccountID
npx wrangler -C cloudflare/wrangler.toml deploy
```

首次部署会自动执行 `wrangler.toml` 里的 Durable Object 迁移（创建 RoomObject 类），
并按 `routes` 自动建好 `relay.rujuzhe-b-a-gs.top` 的 DNS 记录与证书，
得到中继地址 **`wss://relay.rujuzhe-b-a-gs.top`**。验证：
`curl https://relay.rujuzhe-b-a-gs.top/health` 应返回 `{"ok":true,...}`。

4. 打开游戏 → 联机大厅，**服务器栏留空即可**（前端已内置该中继域名并自动拼接）；
   房主点"创建房间"拿到 4 位房号，把房号发给异地好友，好友输入后"加入房间"。

## 免费额度（两人房足够长期使用）

Workers 免费档：每天 10 万次请求；Durable Objects 免费档包含充足的连接/时长额度，
回合制 1v1 一局仅一条长连接、消息量极小，远低于上限。Durable Objects 不会像
Render 免费实例那样 15 分钟休眠，无需 cron 保活。

## 国内访问说明

默认 `*.workers.dev` 域名在国内网络下可达性不稳定（时好时坏）。若朋友连不上，
最稳的兜底是在 Cloudflare 绑定一个自己的域名（该域名 DNS 托管到 Cloudflare 后，
给 Worker 加 Custom Domain，走标准 443，国内可达性显著改善）。
