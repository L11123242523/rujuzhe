/* 入局者联机服务器入口（Colyseus 0.16 稳定线）：Express(健康检查/静态页) + Colyseus 权威房间共用一个 HTTP server */
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('colyseus');
const { RujuzheRoom } = require(path.join(__dirname, 'rooms', 'RujuzheRoom.js'));

const ROOT = path.join(__dirname, '..');
const app = express();
app.use(cors());
app.use(express.json());

// 保活探针：cron-job.org 每 10 分钟 ping 一次，防止 Render 免费实例休眠
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
// 同仓托管前端静态页（Render 单服务即可同域开游戏，WebSocket 无跨域问题）
app.use(express.static(ROOT, { index: false, extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'game.html')));

const server = http.createServer(app);
const gameServer = new Server({ server });
gameServer.define('rujuzhe', RujuzheRoom);

const PORT = process.env.PORT || 2567;
gameServer.listen(PORT).then(() => {
  console.log(`[rujuzhe] 权威服务器已启动，端口 ${PORT}（Colyseus /matchmaker）`);
}).catch((e) => { console.error('启动失败', e); process.exit(1); });
