// Checked physical circuit; no unsupported microphone simulator is implied.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=root+'/docs/assets';fs.mkdirSync(out,{recursive:true});
const config=fs.readFileSync(root+'/BuildConfig.h','utf8');
for(const text of ['PIN_MIC_BCLK = 2, PIN_MIC_WS = 21, PIN_MIC_DATA = 20','NAV_BUTTON_PINS[5] = {3,4,7,10,1}','PIN_SDA = 5','PIN_SCL = 0','PIN_BUZZER = 6'])assert(config.includes(text),'Pin map changed: '+text);
const components={esp:'ESP32-C3 SuperMini, native USB',oled:'SSD1306 128x64 I2C',mic:'INMP441 breakout, left channel',piezo:'GPIO-rated 3.3 V passive piezo',rPiezo:'220 ohms',rBoot:'10 kohms REQUIRED GPIO2 pullup',rData:'100 kohms SD pulldown (if not fitted)',cMic:'100 nF mic bypass (if not fitted)',up:'Normally open switch',down:'Normally open switch',left:'Normally open switch',right:'Normally open switch',select:'Normally open switch'};
const nets={
 '3V3':['esp:3V3','oled:VCC','mic:VDD','mic:CHIPEN-if-exposed','rBoot:1','cMic:1'],
 'GND':['esp:GND','oled:GND','mic:GND','mic:L/R','cMic:2','rData:2','piezo:-','up:2','down:2','left:2','right:2','select:2'],
 'SDA_GPIO5':['esp:5','oled:SDA'],'SCL_GPIO0':['esp:0','oled:SCL'],
 'BCLK_GPIO2':['esp:2','mic:SCK','rBoot:2'],'WS_GPIO21':['esp:21','mic:WS'],'DATA_GPIO20':['esp:20','mic:SD','rData:1'],
 'BUZZER_GPIO6':['esp:6','rPiezo:1'],'PIEZO_PLUS':['rPiezo:2','piezo:+'],
 'UP_GPIO3':['esp:3','up:1'],'DOWN_GPIO4':['esp:4','down:1'],'LEFT_GPIO7':['esp:7','left:1'],'RIGHT_GPIO10':['esp:10','right:1'],'SELECT_GPIO1':['esp:1','select:1']
};
const seen=new Set();for(const endpoints of Object.values(nets))for(const e of endpoints){assert(!seen.has(e),'Short between nets: '+e);seen.add(e);assert(e.split(':')[0] in components);}
for(const pin of [0,1,2,3,4,5,6,7,10,20,21])assert(seen.has('esp:'+pin));
for(const pin of [8,9,18,19])assert(!seen.has('esp:'+pin));
assert(nets.BCLK_GPIO2.includes('mic:SCK')&&nets.BCLK_GPIO2.includes('rBoot:2'));assert(nets['3V3'].includes('rBoot:1'));assert(!nets.BCLK_GPIO2.includes('mic:SD'));
fs.writeFileSync(out+'/wiring-mic-direct.json',JSON.stringify({format:'hmc-hardware-wiring-v1',variant:'mic-direct-buttons',firmware:'Hermits-Morse-Cracker-C3-Mic-Direct-Buttons.bin',flashOffset:'0x0',voltage:3.3,defines:{ENABLE_I2S_MIC:1,BUTTONS_USE_MCP23017:0,MIC_DIRECT_BOOT_CLOCK:1},components,nets,notes:['GPIO2 is a strapping pin: fit the external 10k pullup to 3V3. Only the microphone SCK INPUT attaches here.','Repeated 3V3, GND and signal labels are the same electrical nets.','Flash the matching image with the microphone disconnected; previous firmware may use a different pin map.','Native USB only. No UART adapter or other driver on GPIO20/21.','The physical microphone and cold-boot behavior require bench verification.']},null,2)+'\n');
let body='';const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const t=(x,y,s,size=17,color='#273b47',extra='')=>body+=`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(s)}</text>`;
const box=(x,y,w,h,fill='#fff',stroke='#c4d5dc',r=10)=>body+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const line=(p,c='#526773',w=4)=>body+=`<polyline points="${p.map(v=>v.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const dot=(x,y,c='#526773')=>body+=`<circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="#fff" stroke-width="1.5"/>`;
box(0,0,1600,1750,'#f4f8fa','#f4f8fa',0);box(28,28,1544,1694,'#fff','#ccdce2',16);
t(64,80,"HERMIT'S MORSE CRACKER / MIC + DIRECT BUTTONS",28,'#164e36','font-weight="700"');
t(64,116,'ESP32-C3 + OLED + INMP441 + five direct buttons + passive piezo.',19);
t(64,151,'Firmware: Hermits-Morse-Cracker-C3-Mic-Direct-Buttons.bin | offset 0x0',18,'#166b49');
t(64,188,'Required: 10k pullup GPIO2 to 3V3. Power off before wiring; follow GPIO labels.',18,'#995b16');
box(660,255,280,970,'#12472f','#12472f');t(800,289,'ESP32-C3',27,'#e4fff0','text-anchor="middle" font-weight="700"');
box(80,255,240,235,'#113a48','#113a48');t(200,290,'SSD1306 OLED',22,'#e4fff0','text-anchor="middle"');
function link(y,left,esp,color='#526773'){t(304,y+6,left,16,'#e4fff0','text-anchor="end"');line([[320,y],[660,y]],color);dot(320,y,color);dot(660,y,color);t(674,y+6,esp,16,'#e4fff0');}
for(const [y,name,gpio,c]of [[330,'VCC','3V3','#ca3e46'],[375,'GND','GND','#526773'],[420,'SDA','GPIO5','#008c8c'],[465,'SCL','GPIO0','#2865c1']])link(y,name,gpio,c);
box(80,540,240,170,'#4a3a1a','#4a3a1a');t(200,574,'PASSIVE PIEZO',21,'#fff3d6','text-anchor="middle"');
link(620,'+','GPIO6','#bc7b18');box(443,607,84,26,'#fff','#bc7b18',2);t(485,600,'220 ohm',15,'#8e641d','text-anchor="middle"');link(680,'-','GND');
box(80,775,240,340,'#19354d','#19354d');t(200,811,'INMP441',24,'#e4f8ff','text-anchor="middle"');
for(const [y,name,gpio,c]of [[850,'VDD','3V3','#ca3e46'],[895,'GND','GND','#526773'],[940,'SCK / BCLK','GPIO2 *','#926229'],[985,'WS','GPIO21','#2865c1'],[1030,'SD / DOUT','GPIO20','#b03d82'],[1075,'L/R','GND','#526773']])link(y,name,gpio,c);
t(800,1146,'Native USB18/19',19,'#e4fff0','text-anchor="middle"');t(800,1178,'GPIO8/9 unused',18,'#c4e8d0','text-anchor="middle"');
const buttons=[['UP',3,'#187b4a'],['DOWN',4,'#2865c1'],['LEFT',7,'#7953b6'],['RIGHT',10,'#bd651b'],['SELECT',1,'#b03d82']];
buttons.forEach(([name,pin,c],i)=>{const y=345+i*100;t(925,y+6,'GPIO'+pin,16,'#e4fff0','text-anchor="end"');line([[940,y],[1210,y]],c);dot(940,y,c);dot(1210,y,c);line([[1210,y],[1280,y-20]],c);dot(1300,y,c);line([[1300,y],[1495,y]]);dot(1495,y);t(1150,y-34,name,19,c,'font-weight="700"');});
line([[1495,330],[1495,800],[940,800]]);dot(1495,800);dot(940,800);t(925,806,'GND',16,'#e4fff0','text-anchor="end"');t(1410,830,'COMMON GND',16);
t(1000,865,'All five switches stay on GPIO.',18,'#166b49','font-weight="700"');t(1000,900,'Other switch contact goes to GND.',17);t(1000,935,'INPUT_PULLUP; no button resistors.',17);
t(1000,1000,'* GPIO2 is a boot strapping pin.',17,'#995b16');t(1000,1035,'Only mic SCK (an input) uses it.',17);t(1000,1070,'Fit the pullup shown below.',17,'#995b16');
t(80,1180,'CHIPEN: tie to 3V3 if exposed.',16);t(80,1211,'Most breakouts already do this.',16);
box(64,1280,1470,340,'#f7fafb','#c7d7de');t(88,1320,'SUPPORT COMPONENTS / LABELS JOIN THE SIGNALS ABOVE',22,'#214b3a','font-weight="700"');
function resistor(x,y,value){line([[x,y],[x,y+24]]);box(x-13,y+24,26,62,'#fff','#8c6740',1);line([[x,y+86],[x,y+120]]);t(x+25,y+62,value,17,'#8c6740');}
t(130,1366,'3V3',18,'#ca3e46');line([[175,1375],[175,1388]],'#ca3e46');resistor(175,1388,'10k REQUIRED');line([[175,1508],[175,1537]],'#926229');t(130,1568,'GPIO2 / SCK',17,'#926229');
t(570,1366,'GPIO20 / SD',18,'#b03d82');line([[615,1375],[615,1388]],'#b03d82');resistor(615,1388,'100k pulldown');line([[615,1508],[615,1537]]);t(590,1568,'GND',17);
t(1105,1366,'3V3',18,'#ca3e46');line([[1150,1375],[1150,1440]],'#ca3e46');line([[1125,1440],[1175,1440]]);line([[1125,1455],[1175,1455]]);line([[1150,1455],[1150,1537]]);t(1188,1454,'100 nF',17);t(1125,1568,'GND',17);t(1090,1598,'Near mic VDD',15);
t(90,1598,'Check breakout-fitted SD pulldown and bypass capacitor before adding duplicates.',15);
t(65,1660,'Logical net map, not physical header positions. All power is 3.3 V; all grounds join.',17);
t(65,1694,'Flash with microphone disconnected, unplug power, then wire this circuit. Hardware audio/boot tests pending.',15,'#995b16');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1750" viewBox="0 0 1600 1750" role="img"><title>INMP441 microphone with five direct buttons and no expander</title><desc>GPIO2 SCK with required 10k pullup, WS21, SD20, OLED5/0, buzzer6 and five buttons3/4/7/10/1. Native USB18/19 stays free.</desc><g font-family="Consolas,DejaVu Sans Mono,monospace">${body}</g></svg>`;
fs.writeFileSync(out+'/wiring-mic-direct.svg',svg);
(async()=>{const {chromium}=require(process.argv[2]||'playwright');const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});try{const page=await browser.newPage({viewport:{width:1600,height:1750}});await page.setContent(svg);await page.screenshot({path:out+'/wiring-mic-direct.png'});}finally{await browser.close();}console.log('PASS: mic/direct hardware nets, required GPIO2 pullup, mic input/output directions, five independent buttons and USB separation.');})().catch(e=>{console.error(e);process.exitCode=1;});
