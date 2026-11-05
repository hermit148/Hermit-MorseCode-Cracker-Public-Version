const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'web.html'), 'utf8');
if (html.includes(')MORSEUI"')) throw Error('Raw-string delimiter in HTML');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
fs.writeFileSync(path.join(root, 'WebUI.h'), '#pragma once\n#include <Arduino.h>\nstatic const char WEB_UI[] PROGMEM = R"MORSEUI(' + html + ')MORSEUI";\n');
console.log('Embedded UI and checked JavaScript syntax: ' + Buffer.byteLength(html) + ' bytes');
