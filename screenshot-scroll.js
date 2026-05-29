const { execSync } = require('child_process');
const { spawn } = require('child_process');

const chrome = spawn('google-chrome', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--remote-debugging-port=9223',
  '--window-size=1440,900',
  'http://localhost:5199/'
]);

setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:9223/json').then(r => r.json());
    const target = res.find(t => t.type === 'page');
    if (!target) { chrome.kill(); return; }

    const { default: WebSocket } = await import('ws');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => new Promise(res => {
      const i = id++;
      const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === i) { ws.off('message', handler); res(msg.result); }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

    ws.on('open', async () => {
      await new Promise(r => setTimeout(r, 6000));

      // Screenshot at hero
      let { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x:0, y:0, width:1440, height:900, scale:1 } });
      require('fs').writeFileSync('/tmp/section-hero.png', Buffer.from(data, 'base64'));

      // Scroll to blueprint area (~2200px down)
      await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 2200)' });
      await new Promise(r => setTimeout(r, 1500));
      ({ data } = await send('Page.captureScreenshot', { format: 'png', clip: { x:0, y:0, width:1440, height:900, scale:1 } }));
      require('fs').writeFileSync('/tmp/section-blueprint.png', Buffer.from(data, 'base64'));

      // Scroll to features area (~800px)
      await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 700)' });
      await new Promise(r => setTimeout(r, 1500));
      ({ data } = await send('Page.captureScreenshot', { format: 'png', clip: { x:0, y:0, width:1440, height:900, scale:1 } }));
      require('fs').writeFileSync('/tmp/section-features.png', Buffer.from(data, 'base64'));

      console.log('done');
      ws.close();
      chrome.kill();
    });
  } catch(e) { console.error(e.message); chrome.kill(); }
}, 2000);
