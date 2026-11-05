// Compile optional firmware branches with the installed production toolchain.
// These are translation-unit checks, not microphone/Wokwi hardware tests.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),cache=process.argv[2];
if(!cache)throw Error('Pass the Arduino compilation cache directory');
const entry=JSON.parse(fs.readFileSync(path.join(cache,'compile_commands.json'),'utf8')).find(x=>x.file.endsWith('Firmware.cpp'));
const out=root+'/build/variant-checks';fs.mkdirSync(out,{recursive:true});
const coreInclude=entry.arguments.find(x=>x.startsWith('-I')&&/cores[\\/]esp32$/.test(x));
const hardware=coreInclude.slice(2).replace(/[\\/]cores[\\/]esp32$/,'');
function compile(name,flags,expectedFailure=false){
  const args=entry.arguments.slice(1),oi=args.indexOf('-o');args[oi-1]=root+'/Firmware.cpp';args[oi+1]=out+'/'+name+'.o';
  args.push('-I'+hardware+'/libraries/ESP_I2S/src',...flags);
  const result=cp.spawnSync(entry.arguments[0],args,{encoding:'utf8',maxBuffer:4e6,windowsHide:true});
  if(result.error)throw result.error;
  if(expectedFailure){if(!result.status||!result.stderr.includes(expectedFailure))throw Error('Missing guard: '+result.stderr);}
  else if(result.status)throw Error(result.stdout+result.stderr);
  console.log('PASS: '+name+(expectedFailure?' rejected as intended':' translation unit compiled'));
}
compile('optional-mic-native-usb',['-DENABLE_I2S_MIC=1','-DBUTTONS_USE_MCP23017=1']);
compile('optional-mic-direct-native-usb',['-DENABLE_I2S_MIC=1','-DBUTTONS_USE_MCP23017=0','-DMIC_DIRECT_BOOT_CLOCK=1']);
compile('mic-direct-uart-conflict',['-DENABLE_I2S_MIC=1','-DMIC_DIRECT_BOOT_CLOCK=1','-UARDUINO_USB_CDC_ON_BOOT','-DARDUINO_USB_CDC_ON_BOOT=0'],'Microphone uses UART pins');
compile('mic-direct-expander-conflict',['-DENABLE_I2S_MIC=1','-DMIC_DIRECT_BOOT_CLOCK=1','-DBUTTONS_USE_MCP23017=1'],'MIC_DIRECT_BOOT_CLOCK requires');
compile('mic-direct-disabled-conflict',['-DMIC_DIRECT_BOOT_CLOCK=1'],'MIC_DIRECT_BOOT_CLOCK requires');
compile('wokwi-uart-simulation',['-DWOKWI_BUILD=1','-UARDUINO_USB_CDC_ON_BOOT','-DARDUINO_USB_CDC_ON_BOOT=0']);
compile('mic-uart-conflict',['-DENABLE_I2S_MIC=1','-DBUTTONS_USE_MCP23017=1','-UARDUINO_USB_CDC_ON_BOOT','-DARDUINO_USB_CDC_ON_BOOT=0'],'Microphone uses UART pins');
compile('mic-direct-button-conflict',['-DENABLE_I2S_MIC=1'],'I2S microphone needs BUTTONS_USE_MCP23017=1');
const pinSource=fs.readFileSync(root+'/BuildConfig.h','utf8').replace('PIN_MIC_BCLK = 20','PIN_MIC_BCLK = 18');
fs.writeFileSync(out+'/bad-pins.cpp','#define ENABLE_I2S_MIC 1\n#define BUTTONS_USE_MCP23017 1\n'+pinSource);
const rejected=cp.spawnSync(entry.arguments[0],['-std=c++17','-x','c++','-c',out+'/bad-pins.cpp','-o',out+'/bad-pins.o'],{encoding:'utf8',windowsHide:true});
if(!rejected.status||!rejected.stderr.includes('Pin collision or reserved'))throw Error('Reserved USB pin was not rejected');
console.log('PASS: assigning microphone BCLK to USB GPIO18 fails the pin guard');
