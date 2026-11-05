// Export documentation images from the real web UI and production OLED frames.
// Uses fictional local fixtures only; never reads device/NVS credentials.
// node tools/export_docs.cjs [path to playwright]
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.argv[2]||'playwright');const root=path.resolve(__dirname,'..'),out=root+'/docs/assets';
for(const dir of ['web','oled'])fs.mkdirSync(out+'/'+dir,{recursive:true});
const nativeFile=fs.existsSync(root+'/build/hermits-morse-cracker/oled-preview.bin')?root+'/build/hermits-morse-cracker/oled-preview.bin':out+'/oled-frames.bin';
const html=fs.readFileSync(root+'/web.html','utf8'),frameBytes=fs.readFileSync(nativeFile);fs.writeFileSync(out+'/oled-frames.bin',frameBytes);
const titleScript=fs.readFileSync(root+'/tools/preview_oled.cjs','utf8');const titles=JSON.parse(titleScript.match(/const titles=(\[[^\r\n]+\]);/)[1]);assert.equal(frameBytes.length,titles.length*1024);
const slug=s=>s.toLowerCase().replaceAll('/',' ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const wifi={connected:true,state:'connected',reason:'',ip:'192.168.1.50',ssid:'HOME ROUTER',clockReady:true,passwordSet:true,configured:true};
const config={ssid:'HOME ROUTER',wifiSet:true,wpm:12,hz:700,db:48,chat:'',botSet:false,telegramConfigured:false,discordConfigured:false,forwardTx:false,forwardRx:false,discordTx:false,discordRx:false,autoWpm:false,oledView:0,oledContrast:160,oledDim:true,bootSound:true};
const post={OLED:'FOUND',BUTTONS:'PASS',UP:'SEEN',DOWN:'SEEN',LEFT:'SEEN',RIGHT:'SEEN',SELECT:'SEEN',BUZZER:'CHECK','I2S MIC':'OFF',FLASH:'PASS',SETTINGS:'PASS',RAM:'PASS','WI-FI AP':'PASS'};
const status={online:true,wifi,mode:'key',micAvailable:false,micReady:false,letter:'S',pending:'...',text:'SOS / CQ HERMIT 73',key:false,rms:0,ratio:0,tx:false,telegram:0,discord:0,queue:0,ip:wifi.ip,uptime:7460,dropped:0,logs:[{id:1,ms:5000,kind:'TX',text:'CQ CQ HERMIT 73',morse:'-.-. --.- / -.-. --.- / .... . .-. -- .. - / --... ...--'},{id:2,ms:15000,kind:'RX',text:'SOS',morse:'... --- ...'}],wpm:12,rxWpm:12,speedLocked:false,speedSamples:0,autoWpm:false,firmware:'HMC 3.3.0',heap:116252,minHeap:100520,heapBlock:65524,cpuMHz:160,flashBytes:4194304,appBytes:1608912,resetReason:1,apClients:1,oled:true,buttonController:true,buttonWiring:'direct',post};
const presets={presets:[{label:'CALLING CQ',text:'CQ CQ HERMIT 73'},{label:'SOS / HELP',text:'SOS HELP'},{label:'GREETING',text:'HELLO WORLD'},{label:'SIGN OFF',text:'73'},{label:'',text:''},{label:'',text:''}]};
const keyboard={draft:'CQ CQ HERMIT 73',entry:'CQ CQ HERMIT 73',length:14,maxLength:120,cursor:2,page:'compose',menu:0,preset:0,notice:'READY',controller:true,buttonWiring:'direct',seen:31,pressed:0,tx:false,field:'WRITE',entryLength:14,entryLimit:120,secret:false,items:[],keys:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','SP','Aa','123','DEL','CLR','SEND','BACK']};
const manifest={web:[],oled:[]};
(async()=>{const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});try{
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://hmc-docs.test/**',async route=>{const p=new URL(route.request().url()).pathname;if(!p.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:html});
  assert.equal(route.request().method(),'GET','Documentation previews must never post/send');
  const responses={'/api/config':config,'/api/presets':presets,'/api/status':status,'/api/keyboard':keyboard,'/api/wifi':{wifi,status:'ready',networks:[{ssid:'HOME ROUTER',rssi:-48,secure:true,supported:true},{ssid:'GUEST NETWORK',rssi:-65,secure:false,supported:true}]},'/api/ble':{ready:false,initialized:false,scanning:false,beacon:false,error:0,dropped:0,name:'HMC-BEACON',devices:[]},'/api/timeline':{next:9,segments:[[1,7457000,100,true,true],[2,7457100,100,false,true],[3,7457200,300,true,true],[4,7457500,300,false,true],[5,7458000,100,true,false],[6,7458100,100,false,false],[7,7458200,300,true,false],[8,7458500,700,false,false]]}};
  assert(p in responses,'Unexpected preview API '+p);return route.fulfill({contentType:'application/json',body:JSON.stringify(responses[p])});
 });
 await page.goto('http://hmc-docs.test/');await page.locator('#access').fill('HermitCrack');await page.locator('#login button').click();await page.locator('#app').waitFor({state:'visible'});
 await page.locator('#txtext').fill('CQ CQ HERMIT 73');await page.locator('#morseinput').fill('... --- ...');
 for(const [kind,width,height]of [['desktop',1280,900],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  for(const [id,title]of [['station','Signal desk'],['keyboard','Pocket keyboard'],['settings','Connections and settings'],['training','Morse training'],['tools','Device and Bluetooth']]){
   await page.locator('[data-page="'+id+'"]').click();if(id==='settings')await page.evaluate(()=>pollWifi());
   await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Documentation overflow '+id+'/'+kind);
   const file='web/'+id+'-'+kind+'.png';await page.screenshot({path:out+'/'+file,fullPage:true});manifest.web.push({title:title+' / '+kind,file});
   if(id==='station'&&kind==='desktop')await page.screenshot({path:out+'/hero.png'});
  }
 }
 keyboard.micAvailable=true;status.micAvailable=true;status.micReady=true;post['I2S MIC']='DRIVER';
 await page.locator('[data-page="keyboard"]').click();await page.evaluate(()=>pollKeyboard());
 for(const [kind,width,height]of [['desktop',1280,900],['mobile',390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mic keyboard overflow');assert((await page.locator('#keyboardwiringnotice').textContent()).includes('SD20'));assert((await page.locator('#keyboardwiringnotice').textContent()).includes('10k pullup'));const file='web/keyboard-mic-direct-'+kind+'.png';await page.screenshot({path:out+'/'+file,fullPage:true});manifest.web.push({title:'Pocket keyboard / microphone and direct buttons / '+kind,file});}
 await page.locator('#lock').click();for(const [kind,width,height]of [['desktop',1280,900],['mobile',390,844]]){await page.setViewportSize({width,height});const file='web/login-'+kind+'.png';await page.screenshot({path:out+'/'+file,fullPage:true});manifest.web.push({title:'Access screen / '+kind,file});}
 assert.deepEqual(errors,[],'Web preview JavaScript errors');
 const frames=await browser.newPage({viewport:{width:1120,height:1000},deviceScaleFactor:1});
 for(let i=0;i<titles.length;++i){const file='oled/'+String(i+1).padStart(2,'0')+'-'+slug(titles[i])+'.png';const bytes=[...frameBytes.subarray(i*1024,(i+1)*1024)];
  await frames.setContent('<style>body{margin:0;background:#000}canvas{display:block;width:512px;height:256px;image-rendering:pixelated}</style><canvas width="128" height="64"></canvas>');
  await frames.evaluate(bytes=>{const c=document.querySelector('canvas').getContext('2d');c.fillStyle='#000';c.fillRect(0,0,128,64);c.fillStyle='#f0fff4';for(let y=0;y<64;y++)for(let x=0;x<128;x++)if(bytes[x+Math.floor(y/8)*128]&(1<<(y%8)))c.fillRect(x,y,1,1);},bytes);
  await frames.locator('canvas').screenshot({path:out+'/'+file});manifest.oled.push({title:titles[i],file,frame:i});
 }
 fs.writeFileSync(out+'/gallery.json',JSON.stringify(manifest,null,2)+'\n');
 let md='# Screen gallery\n\n[Back to README](../README.md)\n\nWeb images use the real embedded HTML with fictional local fixtures. OLED images are the actual production C++ renderer at 128x64, enlarged 4x. They are screen examples, not photographs or proof of physical peripheral tests. No private bot token, router password or device backup is included.\n\n## Web UI\n\n';
 for(const s of manifest.web)md+='### '+s.title+'\n\n![HMC '+s.title+'](assets/'+s.file+')\n\n';
 md+='## OLED / all 48 layouts\n\n';for(let i=0;i<manifest.oled.length;i+=2){const pair=manifest.oled.slice(i,i+2);md+='| '+pair.map(s=>s.title).join(' | ')+' |\n| '+pair.map(()=>'---').join(' | ')+' |\n| '+pair.map(s=>'!['+s.title+'](assets/'+s.file+')').join(' | ')+' |\n\n';}
 fs.writeFileSync(root+'/docs/GALLERY.md',md);console.log('PASS: exported '+manifest.web.length+' web screenshots and '+manifest.oled.length+' native OLED layouts; no POST/external notification requests.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
