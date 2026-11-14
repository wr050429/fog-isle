# 雾系列 H5 · 测试

跑测试前先装依赖、起静态服务器（测试用 jsdom 通过 http 读页面，
因为 `file://` 下 localStorage 会报 SecurityError）：

```bash
cd ~/workspace/fog-h5/tests
npm install          # 只装 jsdom（node_modules 不随交付包走，22 MB）
cd ~/workspace/fog-h5
nohup python3 -m http.server 8811 >/tmp/fog-h5-server.log 2>&1 &
```

然后：

```bash
node ~/workspace/fog-h5/tests/node-test.js    # 逻辑测试（种子、平衡、图鉴、底图、秘卷门禁……）
node ~/workspace/fog-h5/tests/render-test.js  # jsdom 渲染测试（390px 无报错、无横向溢出）
```

两套都要全过再交付。`node_modules/` 不用备份，重装即可。

测试里的路径都按测试文件自己的位置相对取，放到哪都能跑（本机、Box 上都行），
不用改代码；渲染测试只要求本机的 8811 端口起着静态服务器。
