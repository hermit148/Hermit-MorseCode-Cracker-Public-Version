// Rebuild all sketch/library sources using an existing Arduino compilation
// database and its matching, unmodified core archive. Does not upload anything.
// node tools/build_cached.cjs <Arduino build cache directory>
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),cache=process.argv[2];
if(!cache)throw Error('Pass the Arduino cache directory containing compile_commands.json');
const qa=process.argv.includes('--qa');
const fullMic=process.argv.includes('--mic-mcp');
const directMic=process.argv.includes('--mic-direct'),anyMic=fullMic||directMic;
if(fullMic&&directMic)throw Error('Choose one microphone wiring variant');
const defines=fullMic?['-DENABLE_I2S_MIC=1','-DBUTTONS_USE_MCP23017=1']:directMic?['-DENABLE_I2S_MIC=1','-DBUTTONS_USE_MCP23017=0','-DMIC_DIRECT_BOOT_CLOCK=1']:[];
if(qa)require('./prepare_target_core.cjs');
const variant=fullMic?'mic-mcp23017':directMic?'mic-direct-buttons':'direct-buttons';
const output=root+'/build/'+(qa?'qa':'hermits-morse-cracker')+(fullMic?'-mic-mcp':directMic?'-mic-direct':'');fs.mkdirSync(output,{recursive:true});
const db=JSON.parse(fs.readFileSync(path.join(cache,'compile_commands.json'),'utf8'));
const firmware=db.find(x=>x.file.endsWith('Firmware.cpp'));
const compiler=firmware.arguments[0], sdkArg=firmware.arguments.find(x=>x.endsWith('/flags/cpp_flags'));
const sdk=sdkArg.slice(1,-'/flags/cpp_flags'.length);
const hardware=firmware.arguments.find(x=>x.includes('cores')&&x.startsWith('-I')).slice(2).replace(/[\\/]cores[\\/]esp32$/,'');
const esptool=path.resolve(hardware,'../../../tools/esptool_py/5.3.1/esptool.exe');
const core=path.join(cache,'core/core.a');
if(anyMic&&!db.some(e=>e.file.endsWith('ESP_I2S.cpp'))){const extra={...firmware,arguments:[...firmware.arguments],file:hardware+'/libraries/ESP_I2S/src/ESP_I2S.cpp'};const oi=extra.arguments.indexOf('-o');extra.arguments[oi-1]=extra.file;extra.arguments[oi+1]=path.join(cache,'libraries/ESP_I2S/ESP_I2S.cpp.o');db.push(extra);}
if(!fs.existsSync(core))throw Error('Matching core archive is missing');
function run(exe,args,options={}){const r=cp.spawnSync(exe,args,{encoding:'utf8',maxBuffer:8e6,...options});if(r.error)throw r.error;if(r.status!==0)throw Error((r.stdout||'')+(r.stderr||''));if(r.stdout)console.log(r.stdout.trim());}
async function compile(entry){const args=entry.arguments.slice(1),oi=args.indexOf('-o');let source=entry.file;
  if(source.endsWith('Firmware.cpp'))source=root+'/Firmware.cpp';
  if(source.endsWith('MorseStation.ino.cpp')){source=output+'/MorseStation.ino.cpp';fs.writeFileSync(source,'#include <Arduino.h>\n'+fs.readFileSync(root+'/MorseStation.ino','utf8'));}
  const old=args[oi+1],rel=path.relative(cache,old);if(rel.startsWith('..'))throw Error('Object outside build cache');
  const object=path.join(output,'objects',rel);fs.mkdirSync(path.dirname(object),{recursive:true});
  args[oi-1]=source;args[oi+1]=object;
  if(qa)args.push('-DHMC_QA=1');
  args.push(...defines);if(anyMic)args.push('-I'+hardware+'/libraries/ESP_I2S/src');
  await new Promise((resolve,reject)=>{
    const child=cp.spawn(entry.arguments[0],args,{windowsHide:true});let log='';
    child.stdout.on('data',data=>log+=data);child.stderr.on('data',data=>log+=data);
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(log)));
  });return object;
}
async function main(){
const objects=new Array(db.length);
run(compiler,['-std=c++17',...defines,'-c',root+'/tests/test_keyboard.cpp','-o',output+'/test_keyboard.o']);
run(compiler,['-std=c++17',...defines,'-c',root+'/tests/test_wifi.cpp','-o',output+'/test_wifi.o']);
console.log('PASS: Wi-Fi connection states, timeout rollover, bounded strongest-network cache and scan/password/Back navigation');
console.log('PASS: keyboard editing, navigation, debounce, hold, repeat, rollover and collision-free pin plan');
run(compiler,['-std=c++17','-c',root+'/tests/test_signal_tools.cpp','-o',output+'/test_signal_tools.o']);
console.log('PASS: compile-time execution of speed estimation, jitter, ambiguity, reacquisition, timeline bounds and rollover checks');
run(compiler,['-std=c++17',...defines,'-c',root+'/tests/test_oled.cpp','-o',output+'/test_oled.o']);
run(compiler.replace(/g\+\+(\.exe)?$/,'objcopy$1'),['--dump-section','.oledpreview='+output+'/oled-preview.bin',output+'/test_oled.o']);
console.log('PASS: production OLED rendering, four home icons, visible Back rows, keyboard states, five hardware pages, clipping and credential isolation');
let cursor=0,completed=0;
await Promise.all(Array.from({length:3},async()=>{while(cursor<db.length){const index=cursor++;objects[index]=await compile(db[index]);if(++completed%10===0)console.log('Compiled '+completed+' / '+db.length+' sources');}}));
console.log('Recompiled '+objects.length+' sketch/library translation units');
const elf=output+'/MorseStation.ino.elf';
const link=[`-Wl,--Map=${output}/MorseStation.ino.map`,`-L${sdk}/lib`,`-L${sdk}/ld`,`-L${sdk}/qio_qspi`,
  '-Wl,--wrap=esp_panic_handler','-Wl,--wrap=esp_bt_mem_release','-Wl,--wrap=esp_bt_controller_mem_release',
  '@'+sdk+'/flags/ld_flags','@'+sdk+'/flags/ld_scripts','-Wl,--start-group',...objects,core,
  '@'+sdk+'/flags/ld_libs','-Wl,--end-group','-Wl,-EL','-o',elf];
// A response file avoids Windows' command-line length limit and keeps paths literal.
const response=output+'/link.rsp';
fs.writeFileSync(response,link.map(x=>'"'+x.replace(/\\/g,'/').replace(/"/g,'\\"')+'"').join('\n'));
run(compiler,['@'+response]);
run(compiler.replace(/g\+\+(\.exe)?$/,'size$1'),[elf]);
fs.copyFileSync(root+'/partitions.csv',output+'/partitions.csv');
run(hardware+'/tools/gen_esp32part.exe',[output+'/partitions.csv',output+'/MorseStation.ino.partitions.bin']);
fs.copyFileSync(cache+'/MorseStation.ino.bootloader.bin',output+'/MorseStation.ino.bootloader.bin');
fs.copyFileSync(hardware+'/tools/partitions/boot_app0.bin',output+'/boot_app0.bin');
run(esptool,['--chip','esp32c3','elf2image','--flash-mode','dio','--flash-freq','80m','--flash-size','4MB','--elf-sha256-offset','0xb0','-o',output+'/MorseStation.ino.bin',elf]);
const appBytes=fs.statSync(output+'/MorseStation.ino.bin').size;
if(appBytes>0x300000)throw Error('App exceeds 3 MB partition');
run(esptool,['--chip','esp32c3','merge-bin','-o',output+'/MorseStation.ino.merged.bin','--pad-to-size','4MB','0x0',output+'/MorseStation.ino.bootloader.bin','0x8000',output+'/MorseStation.ino.partitions.bin','0xe000',output+'/boot_app0.bin','0x10000',output+'/MorseStation.ino.bin']);
fs.writeFileSync(output+'/flash_args','--flash-mode dio --flash-freq 80m --flash-size 4MB\n0x0 MorseStation.ino.bootloader.bin\n0x8000 MorseStation.ino.partitions.bin\n0xe000 boot_app0.bin\n0x10000 MorseStation.ino.bin\n');
const crypto=require('crypto');const hashes={};for(const file of fs.readdirSync(output).filter(x=>x.endsWith('.bin')))hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(output+'/'+file)).digest('hex');
fs.writeFileSync(output+'/SHA256SUMS.json',JSON.stringify(hashes,null,2)+'\n');
const sourceHashes={};for(const file of fs.readdirSync(root).filter(x=>/\.(cpp|h|ino|html|csv)$/.test(x)))sourceHashes[file]=crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex');
const coreSha256=crypto.createHash('sha256').update(fs.readFileSync(core)).digest('hex');
fs.writeFileSync(output+'/build-record.json',JSON.stringify({timestamp:new Date().toISOString(),variant,defines,core,coreSha256,cache,compiler,sdk,appBytes,partitionBytes:0x300000,rebuiltTranslationUnits:objects.length,sourceHashes},null,2)+'\n');
console.log('PASS: firmware linked, application '+appBytes+' / 3145728 bytes; merged image ready. No device was flashed.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
