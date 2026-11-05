// node tests/ui.cjs <path to playwright or playwright-core module>
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(root+'/web.html','utf8');
assert(fs.readFileSync(root+'/WebUI.h','utf8').includes('R"MORSEUI('+html+')MORSEUI";'));
const config={ssid:'',wpm:12,hz:700,db:48,chat:'',forwardTx:false,forwardRx:false,botSet:false,autoWpm:false,oledView:0,oledContrast:160,oledDim:true,discordConfigured:false,telegramConfigured:false,discordTx:false,discordRx:false,bootSound:true};
const keyboard={draft:'',length:0,maxLength:120,cursor:0,page:'compose',menu:0,preset:0,notice:'READY',controller:true,buttonWiring:'direct',seen:0,pressed:0,tx:false};
let presets=Array.from({length:6},()=>({label:'',text:''})),lastTraining,delayStatus=0,denyStatus=false,bleInitRetries=0,ble={ready:false,initialized:false,scanning:false,beacon:false,error:0,dropped:0,name:'HMC-BEACON',devices:[]};
let wifiScanPolls=0,wifiConnects=0;const wifi={connected:false,state:'not-configured',reason:'',ip:'',clockReady:false};
const networks=[{ssid:'HOME ROUTER',rssi:-40,secure:true,supported:true},{ssid:'OPEN GUEST',rssi:-60,secure:false,supported:true},{ssid:'<img src=x onerror=alert(1)>',rssi:-65,secure:true,supported:true},{ssid:'ENTERPRISE',rssi:-70,secure:true,supported:false}];
let status={online:false,mode:'key',micAvailable:false,letter:'S',pending:'...',text:'SOS',key:false,rms:0,ratio:0,tx:false,telegram:0,queue:0,ip:'192.168.4.1',uptime:42,dropped:0,logs:[],wpm:12,rxWpm:12,speedLocked:false,speedSamples:0,autoWpm:false,firmware:'HMC 3.3.0',heap:100000,minHeap:90000,heapBlock:60000,cpuMHz:160,flashBytes:4194304,appBytes:1500000,resetReason:1,apClients:1,oled:true,buttonController:true,buttonWiring:'direct',post:{OLED:"FOUND",BUTTONS:"PASS",UP:"CHECK",SELECT:"CHECK",RAM:"PASS"}};
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://morse.test/**',async route=>{
      const request=route.request(),url=new URL(request.url()),endpoint=url.pathname;
      if(!endpoint.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:html});
      if(request.headers()['x-device-key']!=='HermitCrack')return route.fulfill({status:401,contentType:'application/json',body:'{"error":"Wrong key"}'});
      if(endpoint==='/api/status'&&denyStatus)return route.fulfill({status:401,contentType:'application/json',body:'{"error":"Access denied"}'});
      if(endpoint==='/api/status'&&delayStatus){const wait=delayStatus;delayStatus=0;await new Promise(r=>setTimeout(r,wait));}
      const post=request.method()==='POST',body=post?request.postDataJSON():null;
      let data={ok:true};
      if(endpoint==='/api/config'){if(post){Object.assign(config,body);config.discordConfigured=!!config.discordUrl;status.autoWpm=config.autoWpm;}else data=config;}
      else if(endpoint==='/api/presets'){if(post){presets=body.presets;}else data={presets};}
      else if(endpoint==='/api/status')data=status;
      else if(endpoint==='/api/wifi'){
        if(post){if(body.op==='scan')wifiScanPolls=2;else if(body.op==='connect'){++wifiConnects;config.ssid=body.ssid;config.wifiSet=!body.open;Object.assign(wifi,{connected:false,state:'connecting',ssid:body.ssid});}}
        else data={wifi,status:wifiScanPolls>1?'scanning':'ready',networks};
        if(!post&&wifiScanPolls) --wifiScanPolls;
      }
      else if(endpoint==='/api/keyboard'){
        if(post){
          if(body.op==='draft'){keyboard.draft=body.text.toUpperCase();keyboard.page='compose';}
          if(body.op==='page')keyboard.page=body.page;if(body.op==='item'){if(keyboard.page==='menu')keyboard.page=['send','receive-options','tools','setup'][body.index];else if(keyboard.page==='setup')keyboard.page=['signal-settings','display-settings','input-settings','menu'][body.index];else if(keyboard.page==='signal-settings'&&body.index===3)keyboard.page='setup';else if(keyboard.page==='send'&&body.index===3)keyboard.page='menu';}
          if(body.op==='nav'){if(body.button==='back')keyboard.page=({compose:'send',presets:'send',send:'menu',setup:'menu','signal-settings':'setup',tools:'menu'})[keyboard.page]||'menu';else if(keyboard.page==='compose'){let row=Math.floor(keyboard.cursor/9),col=keyboard.cursor%9;if(body.button==='left')col=(col+8)%9;if(body.button==='right')col=(col+1)%9;if(body.button==='up')row=(row+4)%5;if(body.button==='down')row=(row+1)%5;keyboard.cursor=row*9+col;}}
          if(body.op==='key'){keyboard.page='compose';keyboard.cursor=body.index;if(body.index<27)keyboard.draft+=body.index===26?' ':'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[body.index];if(body.index===29)keyboard.draft=keyboard.draft.slice(0,-1);if(body.index===31){keyboard.tx=!keyboard.tx;keyboard.notice=keyboard.tx?'SENDING':'STOPPED';}if(body.index===32)keyboard.page='send';}
          keyboard.length=keyboard.draft.length;
        }else{keyboard.items=({menu:['SEND','RECEIVE','TOOLS','SETUP'],send:['Write text','Saved msgs','Clear draft','Back'],setup:['Signal','Display','Input','Back'],'signal-settings':['Speed','Tone','Receive','Back']})[keyboard.page]||[];data=keyboard;}
      }
      else if(endpoint==='/api/train')lastTraining=body;
      else if(endpoint==='/api/timeline')data={next:7,segments:[[1,1000,100,true,true],[2,1100,100,false,true],[3,1200,300,true,true],[4,1500,700,false,false],[5,2200,100,true,false],[6,2300,100,false,false]]};
      else if(endpoint==='/api/ble'){
        if(post&&body.op==='scan'&&!ble.initialized){ble.ready=ble.initialized=true;++bleInitRetries;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'BLE starting or unavailable; check status and retry'})});}
        if(post){if(body.op==='scan')Object.assign(ble,{ready:true,initialized:true,scanning:true,devices:[{address:'aa:bb:cc:dd:ee:ff',type:1,name:'<img src=x onerror=alert(1)>',rssi:-45}]});if(body.op==='stop')Object.assign(ble,{scanning:false,beacon:false});if(body.op==='beacon')Object.assign(ble,{ready:true,initialized:true,beacon:true,name:body.name});}
        else data=ble;
      }
      if(endpoint==='/api/status')data={...data,wifi};
      return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    async function login(){await page.goto('http://morse.test/');await page.locator('#access').fill('HermitCrack');await page.locator('#login button').click();await page.locator('#app').waitFor({state:'visible'});}
    await page.goto('http://morse.test/');await page.locator('#access').fill('bad');await page.locator('#login button').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Wrong key');assert(await page.locator('#app').isHidden());
    await login();await page.locator('#txtext').fill('SOS');assert.equal(await page.locator('#preview').textContent(),'... --- ...');
    assert((await page.locator('#pair').textContent()).includes('HermitCrack'));
    assert(await page.locator('#inputmode option[value="mic"]').isDisabled());
    status.logs=[{id:1,ms:1000,kind:'RX',text:'<img src=x onerror=alert(1)>',morse:'...'}];
    await page.evaluate(()=>poll());await page.waitForFunction(()=>document.querySelector('#history').textContent.includes('<img'));
    assert.equal(await page.locator('#history img').count(),0);
    const downloading=page.waitForEvent('download');await page.locator('#export').click();const download=await downloading;
    const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.messages[0].id,1);assert.equal(exported.messages[0].text,status.logs[0].text);
    await page.locator('#presetlist + details summary').click();await page.locator('#presetslot').selectOption({value:'4'});await page.locator('#presetlabel').fill('RESCUE');await page.locator('#presettext').fill('SOS HELP');await page.locator('#savepreset').click();await page.waitForFunction(()=>document.querySelector('#presetlist').textContent.includes('RESCUE'));assert.equal(presets[4].text,'SOS HELP');
    await login();assert(await page.locator('#presetlist').textContent().then(t=>t.includes('RESCUE')));await page.locator('#presetlist .ghost').click();assert.equal(await page.locator('#txtext').inputValue(),'SOS HELP');
    await page.locator('[data-page="keyboard"]').click();await page.waitForFunction(()=>document.querySelector('#keyboardhardware').textContent.includes('GPIO inputs ready'));
    assert.equal(await page.locator('#keyboardkeys button, #keyboardactions button').count(),33);
    await page.locator('#keyboarddraft').fill('hello 73');await page.locator('#keyboardload').click();await page.waitForFunction(()=>document.querySelector('#keyboarddraft').value==='HELLO 73');
    await page.locator('#keyboardactions button[data-index="29"]').click();await page.waitForFunction(()=>document.querySelector('#keyboarddraft').value==='HELLO 7');
    await page.locator('#keyboardkeys button[data-index="0"]').click();await page.waitForFunction(()=>document.querySelector('#keyboarddraft').value==='HELLO 7A');
    await page.locator('[data-nav="left"]').click();await page.waitForFunction(()=>document.querySelector('#keyboardkeys button[data-index="8"]').getAttribute('aria-current')==='true');
    await page.locator('#keyboardactions button[data-index="31"]').click();await page.waitForFunction(()=>document.querySelector('#keyboardstatus').textContent.includes('PLAYING'));
    await page.locator('#keyboardactions button[data-index="31"]').click();await page.waitForFunction(()=>document.querySelector('#keyboardstatus').textContent==='STOPPED');
    await page.locator('#keyboardview').selectOption('presets');await page.waitForFunction(()=>document.querySelector('#keyboardpage').textContent.includes('PRESETS'));
    await page.locator('#keyboardmenu').click();await page.waitForFunction(()=>document.querySelector('#keyboardpage').textContent.includes('SEND'));
    assert.equal(await page.locator('#keyboardnavlist button').last().textContent(),'Back');
    await page.locator('#keyboardactions button[data-index="32"]').click();await page.waitForFunction(()=>document.querySelector('#keyboardpage').textContent.includes('SEND'));assert.equal(keyboard.draft,'HELLO 7A');
    await page.locator('#keyboardview').selectOption('menu');await page.waitForFunction(()=>document.querySelectorAll('#keyboardnavlist button').length===4);await page.locator('#keyboardnavlist button').nth(3).click();await page.waitForFunction(()=>document.querySelector('#keyboardpage').textContent.includes('SETUP'));await page.locator('#keyboardnavlist button').nth(0).click();await page.waitForFunction(()=>document.querySelector('#keyboardpage').textContent.includes('SIGNAL-SETTINGS'));await page.locator('#keyboardnavlist button').last().click();await page.waitForFunction(()=>document.querySelector('#keyboardpage').textContent.includes('SETUP'));
    await page.locator('#keyboarddraft').fill('UNSAVED');keyboard.draft='PHYSICAL';keyboard.length=8;keyboard.controller=true;keyboard.seen=31;keyboard.pressed=16;
    await page.evaluate(()=>pollKeyboard());assert.equal(await page.locator('#keyboarddraft').inputValue(),'UNSAVED');assert.equal(await page.locator('#keyboardbuttons .seen').count(),4);assert.equal(await page.locator('#keyboardbuttons .pressed').count(),1);
    keyboard.buttonWiring='mcp23017';keyboard.controller=false;await page.evaluate(()=>pollKeyboard());assert((await page.locator('#keyboardwiringlabel').textContent()).includes('MCP23017'));assert((await page.locator('#keyboardwiringnotice').textContent()).includes('INMP441'));assert((await page.locator('#keyboardwiringnotice').textContent()).includes('SD1'));assert((await page.locator('#keyboardhardware').textContent()).includes('not detected'));keyboard.buttonWiring='direct';keyboard.controller=true;keyboard.micAvailable=true;await page.evaluate(()=>pollKeyboard());assert((await page.locator('#keyboardwiringnotice').textContent()).includes('SD20'));assert((await page.locator('#keyboardwiringnotice').textContent()).includes('10k pullup'));assert(!(await page.locator('#keyboardwiringnotice').textContent()).includes('disabled'));keyboard.micAvailable=false;await page.evaluate(()=>pollKeyboard());assert((await page.locator('#keyboardwiringnotice').textContent()).includes('Microphone disabled'));await page.locator('#keyboardrefresh').click();await page.waitForFunction(()=>document.querySelector('#keyboarddraft').value==='PHYSICAL');
    await page.locator('[data-page="settings"]').click();assert.equal(await page.locator('#discordstate').textContent(),'Not configured');await page.locator('#discordurl').fill('https://discord.com/api/webhooks/123456789012345678/'+ 'a'.repeat(70));await page.locator('#discordtx').check();await page.locator('#bootsound').uncheck();await page.locator('#settingsform > .actions .primary').click();await page.waitForFunction(()=>document.querySelector('#saveinfo').textContent.includes('Saved'));assert.equal(config.discordTx,true);assert.equal(config.bootSound,false);assert.equal(await page.locator('#discordurl').inputValue(),'');
    await page.locator('#wifiscan').click();await page.waitForFunction(()=>document.querySelector('#wifinetwork').options.length===5);
    assert.equal(await page.locator('#wifinetwork img').count(),0);assert(await page.locator('#wifinetwork option[value="ENTERPRISE"]').isDisabled());
    await page.locator('#wifinetwork').selectOption('HOME ROUTER');await page.locator('#wificonnect').click();await page.waitForFunction(()=>document.querySelector('#wifiresult').textContent.includes('password'));assert.equal(wifiConnects,0);
    await page.locator('#wifipass').fill('QA-network-password');await page.locator('#wificonnect').click();await page.waitForFunction(()=>document.querySelector('#wifiresult').textContent.includes('settings saved'));assert.equal(wifiConnects,1);assert.equal(config.ssid,'HOME ROUTER');assert.equal(await page.locator('#wifipass').inputValue(),'');
    Object.assign(wifi,{connected:true,state:'connected',ip:'192.168.1.50',ssid:'HOME ROUTER',clockReady:true});status.online=true;await page.evaluate(()=>poll());await page.waitForFunction(()=>document.querySelector('#connection').textContent==='Wi-Fi connected');assert.equal(await page.locator('#connection svg').count(),1);
    Object.assign(wifi,{connected:false,state:'failed',reason:'Check Wi-Fi password'});status.online=false;await page.evaluate(()=>poll());await page.waitForFunction(()=>document.querySelector('#wifilink').textContent.includes('Check Wi-Fi password'));assert.equal(await page.locator('#connection').textContent(),'Wi-Fi not connected');
    await page.locator('#wifinetwork').selectOption('OPEN GUEST');assert(await page.locator('#openwifi').isChecked());assert(await page.locator('#wifipass').isDisabled());await page.locator('#wificonnect').click();await page.waitForFunction(()=>document.querySelector('#wifiresult').textContent.includes('settings saved'));assert.equal(wifiConnects,2);
    await page.locator('[data-page="training"]').click();
    for(let i=1;i<=5;i++){
      lastTraining=null;await page.locator('#trainnew').click();await page.waitForFunction(()=>!document.querySelector('#traincheck').disabled);assert(lastTraining);assert.equal(lastTraining.wpm,8);await page.locator('#trainanswer').fill(lastTraining.text);await page.locator('#traincheck').click();assert.equal(await page.locator('#traincorrect').textContent(),String(i));
    }
    assert.equal(await page.locator('#trainwpm').inputValue(),'9');assert.equal(await page.locator('#trainaccuracy').textContent(),'100%');
    const previousTraining=lastTraining;await page.locator('#trainwpm').fill('4');await page.locator('#trainnew').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('5 to 30'));assert.equal(lastTraining,previousTraining);await page.locator('#trainwpm').fill('9');
    await page.locator('#trainnew').click();await page.waitForFunction(()=>!document.querySelector('#trainreveal').disabled);await page.locator('#trainreveal').click();assert.equal(await page.locator('#trainskips').textContent(),'1');assert.equal(await page.locator('#trainstreak').textContent(),'0');
    await page.locator('#trainnew').click();await page.waitForFunction(()=>!document.querySelector('#traincheck').disabled);await page.locator('#trainanswer').fill('WRONG');await page.locator('#traincheck').click();assert.equal(await page.locator('#trainattempts').textContent(),'6');assert.equal(await page.locator('#traincorrect').textContent(),'5');
    await page.locator('[data-page="settings"]').click();await page.locator('#autowpm').check();await page.locator('#oledview').selectOption({value:'5'});await page.locator('#oledcontrast').fill('200');await page.locator('#oleddim').uncheck();await page.locator('#settingsform button[type="submit"], #settingsform > .actions .primary').click();await page.waitForFunction(()=>document.querySelector('#saveinfo').textContent.includes('Saved'));assert.equal(config.autoWpm,true);assert.equal(config.oledView,5);assert.equal(config.oledContrast,200);assert.equal(config.oledDim,false);
    await page.locator('[data-page="tools"]').click();await page.waitForFunction(()=>document.querySelector('#health').textContent.includes('HMC 3.3.0'));await page.waitForFunction(()=>document.querySelectorAll('#timeline rect').length===3);
    await page.locator('#blescan').click();await page.waitForFunction(()=>document.querySelector('#blestatus').textContent.includes('Scanning'));assert.equal(bleInitRetries,1);assert(await page.locator('#blescan').isDisabled());assert.equal(await page.locator('#bledevices img').count(),0);assert((await page.locator('#bledevices').textContent()).includes('<img'));
    await page.locator('#blestop').click();await page.waitForFunction(()=>!document.querySelector('#blebeacon').disabled);await page.locator('#beaconname').fill('HERMIT');await page.locator('#blebeacon').click();await page.waitForFunction(()=>document.querySelector('#blestatus').textContent.includes('Beacon active: HERMIT'));await page.locator('#blestop').click();
    // Rollover must not draw a huge backwards rectangle.
    await page.evaluate(()=>{timelineData=[[1,4294967250,100,true,false],[2,54,50,false,false]];drawTimeline();});assert.equal(await page.locator('#timeline rect').count(),1);
    const emptyTimeline=await page.evaluate(()=>{timelineData=[];drawTimeline();return [document.querySelector('#timingdetails').textContent,document.querySelector('#timelineinfo').textContent];});assert.equal(emptyTimeline[0],'');assert(emptyTimeline[1].includes('Waiting'));
    await page.evaluate(()=>document.querySelector('#toast').hidden=true);fs.mkdirSync(root+'/build/ui-previews',{recursive:true});
    for(const name of ['station','keyboard','training','tools','settings']){await page.locator('[data-page="'+name+'"]').click();assert.equal(await page.locator('[data-page="'+name+'"]').getAttribute('aria-selected'),'true');await page.waitForTimeout(180);await page.screenshot({path:root+'/build/ui-previews/'+name+'-desktop.png',fullPage:true});}
    await page.setViewportSize({width:390,height:844});
    for(const name of ['station','keyboard','training','tools','settings']){await page.locator('[data-page="'+name+'"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile overflow in '+name);await page.waitForTimeout(180);await page.screenshot({path:root+'/build/ui-previews/'+name+'-mobile.png',fullPage:true});}
    for(const width of [320,768]){await page.setViewportSize({width,height:900});for(const name of ['station','keyboard','training','tools','settings']){await page.locator('[data-page="'+name+'"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overflow '+width+' '+name);}}
    await page.waitForFunction(()=>!polling);delayStatus=250;await page.evaluate(()=>{poll();});await page.locator('#lock').click();await page.waitForTimeout(400);assert.equal(await page.locator('#connection').textContent(),'Device locked');assert.equal(await page.evaluate(()=>lastState),null);assert.equal(await page.locator('#history').textContent(),'');assert.equal(await page.locator('#presettext').inputValue(),'');assert.equal(await page.locator('#presetlabel').inputValue(),'');assert(await page.locator('#pair').isVisible());assert(await page.locator('#app').isHidden());
    await login();denyStatus=true;await page.evaluate(()=>poll());await page.waitForFunction(()=>!document.querySelector('#pair').hidden);assert.equal(await page.evaluate(()=>key),'');denyStatus=false;
    assert.deepEqual(errors,[]);
    console.log('PASS: shared 33-key keyboard, draft/cursor navigation, send/stop, unsaved edits, physical-button indicators, pairing/auth/locking, export, Morse preview, presets, trainer, settings, hardware POST, timeline, BLE and all five pages at 320/390/768/1280 px.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
