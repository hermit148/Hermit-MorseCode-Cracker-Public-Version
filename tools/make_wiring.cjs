// Generate the importable Wokwi circuit and a readable GPIO schematic together.
// node tools/make_wiring.cjs [path to playwright]
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/assets');fs.mkdirSync(out,{recursive:true});
const pins=fs.readFileSync(root+'/BuildConfig.h','utf8');
const match=name=>Number(pins.match(new RegExp(name+' = (\\d+)'))?.[1]);
assert.equal(match('PIN_BUZZER'),6);assert.equal(match('PIN_SDA'),5);assert.equal(match('PIN_SCL'),0);
assert(pins.includes('NAV_BUTTON_PINS[5] = {3,4,7,10,1}'));
const buttons=[['UP',3,'green','ArrowUp'],['DOWN',4,'blue','ArrowDown'],['LEFT',7,'purple','ArrowLeft'],['RIGHT',10,'orange','ArrowRight'],['SELECT',1,'magenta','Enter']];
const parts=[
 {type:'board-esp32-c3-devkitm-1',id:'esp',top:260,left:400,attrs:{}},
 {type:'board-ssd1306',id:'oled1',top:60,left:90,attrs:{i2cAddress:'0x3c'}},
 {type:'wokwi-resistor',id:'rBuzz',top:560,left:450,rotate:90,attrs:{value:'220'}},
 {type:'wokwi-buzzer',id:'bz1',top:690,left:450,attrs:{volume:'0.3'}},
 {type:'wokwi-text',id:'title',top:-80,left:80,attrs:{text:"HERMIT'S MORSE CRACKER / HMC 3.3\nESP32-C3 + SSD1306 + FIVE BUTTONS + PASSIVE PIEZO"}},
 {type:'wokwi-text',id:'oledNote',top:10,left:80,attrs:{text:'OLED 128x64 / 3.3V\nSDA GPIO5 / SCL GPIO0'}},
 {type:'wokwi-text',id:'groundNote',top:320,left:900,attrs:{text:'COMMON GND\nButton contact 2\njoins ESP GND'}},
 {type:'wokwi-text',id:'piezoNote',top:810,left:370,attrs:{text:'GPIO6 -> 220 ohm -> piezo + (pin 2)\nPiezo - (pin 1) -> ESP GND\nDirect drive: GPIO-rated passive piezo only.'}},
 {type:'wokwi-text',id:'boardNote',top:460,left:280,attrs:{text:'Wokwi: DevKitM-1 symbol\nHardware: C3 SuperMini\nMatch GPIO labels, not header positions.\nNative USB GPIO18/19 stays unused.'}}
];
buttons.forEach(([label,gpio,color,key],i)=>parts.push({type:'wokwi-pushbutton',id:'nav'+i,top:[80,320,200,440,560][i],left:710,attrs:{label:label+' / GPIO'+gpio,color,key}}));
const connections=[
 ['esp:TX','$serialMonitor:RX','gray',[]],['esp:RX','$serialMonitor:TX','gray',[]],
 ['esp:3V3.1','oled1:VCC','red',['h-72','v-190','*','v-40']],
 ['esp:GND.1','oled1:GND','black',['h-96','v-215','*','v-64']],
 ['esp:0','oled1:SCL','blue',['h-48','v-235','*','v-24']],
 ['esp:5','oled1:SDA','cyan',['h58','v-250','h-320','*','v-12']],
 ['esp:6','rBuzz:1','orange',['h24','v150','*','v-20']],
 ['rBuzz:2','bz1:2','orange',[]],
 ['bz1:1','esp:GND.6','black',['h140','v100','*','h400','v400']]
];
const routes=[['h-24','v-130','h240','*','h-32'],['h100','v-20','*','h-32'],['h76','v-110','*','h-56'],['h-36','v140','h250','*','h-32'],['h-60','v220','h280','*','h-32']];
buttons.forEach(([,gpio,color],i)=>connections.push(['esp:'+gpio,'nav'+i+':1.l',color,routes[i]]));
const groundOrder=[0,2,1,3,4];for(let i=0;i<4;++i)connections.push(['nav'+groundOrder[i]+':2.r','nav'+groundOrder[i+1]+':2.r','black',['h90','*','h90']]);
connections.push(['nav4:2.r','esp:GND.6','black',['h90','v130','*','h400','v400']]);
const diagram={version:1,author:'Hermit aka Ashwin',editor:'wokwi',parts,connections,serialMonitor:{display:'always',newline:'lf'}};
fs.writeFileSync(root+'/diagram.json',JSON.stringify(diagram,null,2)+'\n');
// Explicit pin whitelist from Wokwi's published board/part definitions.
const valid={esp:new Set(['TX','RX','3V3.1','GND.1','GND.6','0','1','3','4','5','6','7','10']),oled1:new Set(['GND','VCC','SCL','SDA']),rBuzz:new Set(['1','2']),bz1:new Set(['1','2']),$serialMonitor:new Set(['TX','RX'])};
for(let i=0;i<5;++i)valid['nav'+i]=new Set(['1.l','1.r','2.l','2.r']);
assert.equal(new Set(parts.map(p=>p.id)).size,parts.length);
for(const c of connections)for(const endpoint of c.slice(0,2)){const [id,pin]=endpoint.split(':');assert(valid[id]?.has(pin),'Invalid Wokwi endpoint: '+endpoint);}
const parent=new Map();function find(a){if(!parent.has(a))parent.set(a,a);if(parent.get(a)!==a)parent.set(a,find(parent.get(a)));return parent.get(a);}function join(a,b){parent.set(find(a),find(b));}
for(const [a,b]of connections)join(a,b);join('esp:GND.1','esp:GND.6');
for(let i=0;i<5;++i){join('nav'+i+':1.l','nav'+i+':1.r');join('nav'+i+':2.l','nav'+i+':2.r');}
assert.equal(find('oled1:VCC'),find('esp:3V3.1'));assert.equal(find('oled1:SDA'),find('esp:5'));assert.equal(find('oled1:SCL'),find('esp:0'));
assert.equal(find('oled1:GND'),find('esp:GND.1'));assert.equal(find('bz1:1'),find('esp:GND.1'));assert.equal(find('rBuzz:1'),find('esp:6'));assert.equal(find('rBuzz:2'),find('bz1:2'));
for(let i=0;i<5;++i){assert.equal(find('nav'+i+':1.l'),find('esp:'+buttons[i][1]));assert.equal(find('nav'+i+':2.r'),find('esp:GND.1'));assert.notEqual(find('nav'+i+':1.l'),find('nav'+i+':2.r'));}
const active=['esp:3V3.1','esp:GND.1','esp:0','esp:1','esp:3','esp:4','esp:5','esp:6','esp:7','esp:10'];assert.equal(new Set(active.map(find)).size,active.length,'Power/GPIO short circuit');
console.log('PASS: Wokwi endpoint names, firmware pin map, five independent switches, common ground, OLED power/I2C, piezo polarity/series resistor and no GPIO shorts.');
const hardwareNets={
 '3V3':['esp:3V3','oled:VCC'],
 'GND':['esp:GND','oled:GND','piezo:-',...buttons.map(([name])=>name.toLowerCase()+':2')],
 'SDA_GPIO5':['esp:5','oled:SDA'],'SCL_GPIO0':['esp:0','oled:SCL'],
 'BUZZER_GPIO6':['esp:6','rPiezo:1'],'PIEZO_PLUS':['rPiezo:2','piezo:+']
};
for(const [name,gpio]of buttons)hardwareNets[name+'_GPIO'+gpio]=['esp:'+gpio,name.toLowerCase()+':1'];
const hardwareEndpoints=Object.values(hardwareNets).flat();assert.equal(new Set(hardwareEndpoints).size,hardwareEndpoints.length,'Hardware endpoint assigned to two nets');
for(const pin of [2,8,9,18,19,20,21])assert(!hardwareEndpoints.includes('esp:'+pin),'Non-mic circuit uses an unintended pin');
fs.writeFileSync(out+'/wiring.json',JSON.stringify({format:'hmc-hardware-wiring-v1',variant:'direct-buttons',firmware:'Hermits-Morse-Cracker-C3-Direct-Buttons.bin',flashOffset:'0x0',voltage:3.3,defines:{ENABLE_I2S_MIC:0,BUTTONS_USE_MCP23017:0,MIC_DIRECT_BOOT_CLOCK:0},components:{esp:'ESP32-C3 SuperMini',oled:'SSD1306 128x64 I2C',piezo:'GPIO-rated 3.3 V passive piezo',rPiezo:'220 ohms',...Object.fromEntries(buttons.map(([name])=>[name.toLowerCase(),'Normally open switch']))},nets:hardwareNets},null,2)+'\n');

const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const colors=['#16824b','#2563eb','#8656c7','#c76913','#bf3980'];let body='';
const text=(x,y,s,size=18,color='#273544',extra='')=>body+=`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(s)}</text>`;
const rect=(x,y,w,h,fill,stroke='#c5d0d9',r=12)=>body+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const line=(pts,color='#566675',w=4)=>body+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot=(x,y,color='#566675')=>body+=`<circle cx="${x}" cy="${y}" r="6" fill="${color}" stroke="#fff" stroke-width="2"/>`;
rect(0,0,1600,1110,'#f6f9fb','#f6f9fb',0);rect(36,30,1528,1050,'#fff','#d7e1e7',18);
text(72,82,"HERMIT'S MORSE CRACKER / NON-MIC",31,'#102d23','font-weight="700"');text(72,117,'HMC 3.3  /  ESP32-C3  /  FIVE DIRECT BUTTONS + I2C OLED + PASSIVE PIEZO',17,'#4f6571');
text(74,184,'Firmware: Hermits-Morse-Cracker-C3-Direct-Buttons.bin  |  flash at 0x0',16,'#16824b');
rect(590,210,300,650,'#143d31','#0c2d22',20);text(740,254,'ESP32-C3',29,'#d4ffe6','text-anchor="middle" font-weight="700"');text(740,281,'SuperMini GPIO map',16,'#a3d3b9','text-anchor="middle"');
rect(670,505,140,100,'#26483c','#688a7d',5);text(740,550,'C3 / RISC-V',18,'#e6f2ec','text-anchor="middle"');text(740,578,'3.3 V logic',15,'#b3cfc0','text-anchor="middle"');
rect(697,804,86,56,'#b6c4c5','#5b7470',4);text(740,839,'USB',17,'#183c31','text-anchor="middle"');
const oled=[['3V3',310,'#d43d41','VCC'],['GND',370,'#566675','GND'],['GPIO5',430,'#008a8a','SDA'],['GPIO0',490,'#2563eb','SCL']];
rect(85,220,305,325,'#e8edf3','#6889a4',12);text(110,257,'SSD1306 128 x 64',22,'#1c4569','font-weight="700"');
rect(109,276,170,94,'#06130d','#466f5a',4);
const imagePath=fs.existsSync(root+'/build/hermits-morse-cracker/oled-home.png')?root+'/build/hermits-morse-cracker/oled-home.png':out+'/oled/01-home-all-four-sections.png';if(fs.existsSync(imagePath))body+=`<image x="111" y="278" width="166" height="90" href="data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}"/>`;
for(const [pin,y,color,terminal]of oled){line([[390,y],[590,y]],color);dot(390,y,color);dot(590,y,color);text(373,y-9,terminal,17,'#273544','text-anchor="end" font-weight="700"');text(606,y+6,pin,18,'#e8fff2');text(456,y-10,pin,15,color);}
text(108,518,'Match printed pin labels.',15,'#536879');
const yRows=[310,410,510,610,710];
buttons.forEach(([label,gpio],i)=>{const y=yRows[i],color=colors[i];text(872,y-12,'GPIO'+gpio,18,'#e8fff2','text-anchor="end"');line([[890,y],[1110,y]],color);dot(890,y,color);dot(1110,y,color);dot(1245,y);line([[1110,y],[1135,y]],color);line([[1135,y],[1215,y-22]],color,4);line([[1228,y],[1245,y]],'#566675');line([[1245,y],[1440,y]],'#566675');dot(1440,y);text(1100,y-38,label,22,color,'font-weight="700"');text(1100,y+38,'GPIO'+gpio+' → switch → GND',14,'#576976');});
line([[1440,290],[1440,940]],'#566675',5);line([[890,790],[1440,790]],'#566675',5);dot(890,790);dot(1440,790);text(873,785,'GND',18,'#e8fff2','text-anchor="end"');text(1462,535,'GND',18,'#425260','transform="rotate(90 1462 535)"');
rect(85,625,305,175,'#f2f5f8','#9eacb6',12);body+='<circle cx="181" cy="708" r="48" fill="#26363e" stroke="#586b75" stroke-width="3"/><circle cx="181" cy="708" r="10" fill="#111e24"/>';
text(248,670,'PASSIVE',18,'#304653');text(248,697,'PIEZO',18,'#304653');text(373,675,'+',23,'#c76913','text-anchor="end"');text(373,761,'−',23,'#566675','text-anchor="end"');
line([[390,670],[421,670]],'#c76913');rect(421,657,112,26,'#fff','#c76913',1);line([[533,670],[590,670]],'#c76913');dot(390,670,'#c76913');dot(590,670,'#c76913');text(477,640,'220 Ω',18,'#a24d0a','text-anchor="middle"');text(606,677,'GPIO6',18,'#e8fff2');
line([[390,755],[420,755],[420,940],[1440,940]],'#566675',5);dot(390,755);dot(1440,940);text(74,161,'Use a GPIO-rated 3.3 V passive piezo. Other sounders require a suitable driver (see the wiring guide).',15,'#6b4d20');
rect(965,790,415,105,'#eef8f1','#a3cfb1',10);text(986,821,'BUTTONS: INPUT_PULLUP',19,'#20533b','font-weight="700"');text(986,849,'Released HIGH · pressed LOW',16,'#375c49');text(986,875,'Use contacts from different switch pairs.',14,'#375c49');
text(74,997,'GPIO labels are logical connections, not physical header positions. All grounds join ESP32 GND.',17,'#3a5260');text(74,1028,'GPIO18/19 reserved for native USB; boot GPIO2/8/9 unused. Disconnect power before wiring.',16,'#5a6d79');text(1525,1057,'MADE BY HERMIT AKA ASHWIN',14,'#16824b','text-anchor="end" font-weight="700"');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1110" viewBox="0 0 1600 1110" role="img" aria-labelledby="title desc"><title id="title">Hermit's Morse Cracker wiring diagram</title><desc id="desc">OLED VCC to 3V3, GND to GND, SDA GPIO5, SCL GPIO0; Up3 Down4 Left7 Right10 Select1 to ground; GPIO6 through 220 ohms to a passive piezo positive, negative to ground.</desc><g font-family="Consolas,DejaVu Sans Mono,monospace">${body}</g></svg>`;
fs.writeFileSync(out+'/wiring.svg',svg);
(async()=>{const {chromium}=require(process.argv[2]||'playwright'),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});try{const page=await browser.newPage({viewport:{width:1600,height:1110},deviceScaleFactor:1});await page.setContent(svg);await page.screenshot({path:out+'/wiring.png'});}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
