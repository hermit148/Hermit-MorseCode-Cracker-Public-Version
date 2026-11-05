#pragma once
// Compiled only with HMC_QA=1. Production firmware contains no QA command.
// Tests run against the real WebServer via local TCP on the ESP32 itself.
unsigned qaCoreChecks=0,qaCoreFailure=0;
#include "target_core.inc"
namespace targetqa {
static std::atomic<bool> running{false};
static unsigned checks=0,failures=0;
static void check(bool ok,const char *name) {
  ++checks;if(!ok)++failures;
  Serial.printf("[QA %s] %s\n",ok?"PASS":"FAIL",name);
}
struct Reply { int code; String body; };
static Reply request(const char *method,const char *path,const String &body="{}",bool auth=true,const char *type="application/json") {
  WiFiClient client;HTTPClient http;
  http.setConnectTimeout(2000);http.setTimeout(3500);http.setReuse(false);
  if(!http.begin(client,String("http://127.0.0.1")+path))return {-1,""};
  if(auth)http.addHeader("X-Device-Key",deviceKey);
  if(strcmp(method,"GET"))http.addHeader("Content-Type",type);
  int code=strcmp(method,"GET")?http.POST(body):http.GET();
  String result=code>0?http.getString():"";http.end();return {code,std::move(result)};
}
class PageSink : public Stream {
  char window[65] = {};unsigned length=0;
public:
  unsigned bytes=0,decodes=0;uint8_t last=0;bool title=false,trainer=false,ending=false;
  int available() override{return 0;}int read() override{return -1;}int peek() override{return -1;}void flush() override{}
  size_t write(uint8_t c) override {
    if(length==64){memmove(window,window+1,63);length=63;}
    window[length++]=char(c);window[length]=0;++bytes;last=c;
    if(length>=8&&!memcmp(window+length-8,"\"DECODE\"",8))++decodes;
    if(strstr(window,"Hermit's"))title=true;
    if(strstr(window,"trainnew"))trainer=true;
    if(strstr(window,"</html>"))ending=true;
    return 1;
  }
  size_t write(const uint8_t *data,size_t size) override{for(size_t i=0;i<size;++i)write(data[i]);return size;}
};
// The client also runs on the ESP32 in this harness. Drain through a small
// bounded reader instead of HTTPClient's extra 4 KB receive staging allocation;
// a normal phone/browser holds that memory outside the device.
static int consumePage(HTTPClient &http,PageSink &sink){
 auto *client=http.getStreamPtr();if(!client)return -1;int expected=http.getSize(),total=0;uint32_t progress=millis();uint8_t bytes[512];
 while(expected<0||total<expected){int available=client->available();if(available>0){unsigned n=unsigned(available)>sizeof(bytes)?sizeof(bytes):unsigned(available);if(expected>=0&&n>unsigned(expected-total))n=expected-total;int got=client->read(bytes,n);if(got>0){sink.write(bytes,got);total+=got;progress=millis();}}
  else if(!http.connected())break;if(millis()-progress>8000)return -1;vTaskDelay(pdMS_TO_TICKS(1));}
 return expected>=0&&total!=expected?-1:total;
}
static void pageCheck(const char *name) {
  WiFiClient client;HTTPClient http;PageSink sink;
  http.setTimeout(5000);http.setReuse(false);
  const char *headers[]={"X-Frame-Options","Cache-Control"};http.collectHeaders(headers,2);
  http.begin(client,"http://127.0.0.1/");int status=http.GET();
  int written=status==200?consumePage(http,sink):-1;
  check(status==200&&written>39000&&sink.title&&sink.trainer&&sink.ending,name);
  check(http.header("X-Frame-Options")=="DENY"&&http.header("Cache-Control")=="no-store","real UI security/cache headers");
  Serial.printf("[QA PAGE] HTTP %d / write %d / %u bytes / heap %lu / largest %lu\n",status,written,sink.bytes,(unsigned long)ESP.getFreeHeap(),(unsigned long)ESP.getMaxAllocHeap());
  http.end();
}
static void code(const char *method,const char *path,const String &body,int expected,bool auth=true,const char *type="application/json") {
  auto r=request(method,path,body,auth,type);
  char label[100];snprintf(label,sizeof(label),"%s %s -> %d (expected %d)",method,path,r.code,expected);
  check(r.code==expected,label);
}
static bool idle(unsigned ms=4000) {
  uint32_t start=millis();
  while(millis()-start<ms) {
    auto r=request("GET","/api/status");JsonDocument d;
    if(r.code==200&&!deserializeJson(d,r.body)&&!d["tx"].as<bool>()&&!playbackReserved)return true;
    vTaskDelay(pdMS_TO_TICKS(50));
  }
  return false;
}
static void task(void *) {
  // Let the idle task reclaim the large core-test stack before BLE/TCP work.
  vTaskDelay(pdMS_TO_TICKS(150));
  Config original;
  { Guard g(configLock);original=cfg;cfg.forwardTx=cfg.forwardRx=cfg.discordTx=cfg.discordRx=false; }
  const bool hadPresets=prefs.isKey("presets");const String oldPresets=prefs.getString("presets","[]");
  String restorePresets;
  {JsonDocument d;auto a=d["presets"].to<JsonArray>();for(const auto &p:presets){auto o=a.add<JsonObject>();o["label"]=p.label;o["text"]=p.text;}serializeJson(d,restorePresets);}
  pageCheck("real embedded UI served in full");
  for(const char *p:{"/api/status","/api/config","/api/presets","/api/timeline","/api/ble","/api/keyboard","/api/wifi"})code("GET",p,"",401,false);
  for(const char *p:{"/api/train","/api/transmit","/api/decode","/api/mode","/api/stop","/api/finish","/api/clear","/api/config","/api/presets","/api/ble","/api/telegram-test","/api/keyboard","/api/buzzer-test"})code("POST",p,"{}",401,false);
  code("GET","/missing","",404);
  code("GET","/api/transmit","",404);
  code("POST","/api/wifi",R"({"op":"scan"})",401,false);
  for(const char *body:{R"({"op":"bad"})",R"({"op":"connect","ssid":""})",R"({"op":"connect","ssid":"HERMITS MORSECODE CRACKER","open":true})",R"({"op":"connect","ssid":"QA NETWORK","pass":"short"})",R"({"op":"connect","ssid":"QA NETWORK","useSavedPassword":true})",R"({"op":"connect","ssid":42})",R"({"op":"connect","ssid":"QA NETWORK","open":"yes"})"})code("POST","/api/wifi",body,400);
  code("POST","/api/wifi",R"({"op":"scan"})",202);
  code("POST","/api/wifi",R"({"op":"scan"})",409);
  {uint32_t start=millis();bool finished=false,bounded=false,privateFields=false;
   while(millis()-start<14000){auto r=request("GET","/api/wifi");JsonDocument d;if(r.code==200&&!deserializeJson(d,r.body)&&d["status"]=="ready"){finished=true;bounded=d["networks"].size()<=16;privateFields=d["wifi"]["pass"].isNull()&&d["wifi"]["bot"].isNull();break;}vTaskDelay(pdMS_TO_TICKS(150));}
   check(finished,"real asynchronous Wi-Fi scan completes while HTTP remains responsive");check(bounded&&privateFields,"Wi-Fi scan cache is bounded and reports no passwords/tokens");}
  code("POST","/api/wifi",R"({"op":"scan"})",429);
  {auto r=request("GET","/api/status");JsonDocument d;deserializeJson(d,r.body);check(r.code==200&&d["wifi"]["connected"]==d["online"]&&d["wifi"]["clockReady"].is<bool>(),"router connection and clock readiness are reported separately");}
  code("POST","/api/config","{}",415,true,"text/plain");
  code("POST","/api/config","{",400);
  code("POST","/api/config","[]",400);
  code("POST","/api/stop","true",400);
  String oversized;oversized.reserve(2100);for(unsigned i=0;i<2050;++i)oversized+='x';
  code("POST","/api/config",oversized,413);oversized=String();
  for(const char *body:{"{\"wpm\":4}","{\"wpm\":31}","{\"wpm\":-1}","{\"wpm\":5.5}","{\"wpm\":\"12\"}","{\"oledView\":8}","{\"oledContrast\":15}","{\"oledDim\":1}","{\"ssid\":42}","{\"pass\":\"short\"}","{\"bot\":\"bad-token\"}"})code("POST","/api/config",body,400);
  code("POST","/api/config","{\"wpm\":30,\"hz\":700,\"autoWpm\":true,\"oledView\":5,\"oledContrast\":180,\"oledDim\":false,\"forwardTx\":false,\"forwardRx\":false}",202);
  {auto r=request("GET","/api/config");JsonDocument d;deserializeJson(d,r.body);check(r.code==200&&d["wpm"]==30&&d["oledView"]==5&&d["oledContrast"]==180&&!d["oledDim"].as<bool>(),"configuration saved and read back");check(d["pass"].isNull()&&d["bot"].isNull(),"configuration response omits secrets");}
  code("POST","/api/presets","{\"presets\":[]}",400);
  String sample="{\"presets\":[{\"label\":\"QA\",\"text\":\"SOS\"},{\"label\":\"\",\"text\":\"\"},{\"label\":\"\",\"text\":\"\"},{\"label\":\"\",\"text\":\"\"},{\"label\":\"\",\"text\":\"\"},{\"label\":\"EDGE\",\"text\":\"CQ 73\"}]}";
  code("POST","/api/presets",sample,202);sample=String();
  {auto r=request("GET","/api/presets");JsonDocument d;deserializeJson(d,r.body);check(d["presets"].size()==6&&d["presets"][5]["text"]=="CQ 73","six preset slots including last slot");JsonDocument saved;deserializeJson(saved,prefs.getString("presets"));check(saved[5]["label"]=="EDGE","presets persisted in real NVS");}
  for(const char *body:{"{}","{\"op\":\"bad\"}","{\"op\":\"key\",\"index\":40}","{\"op\":\"key\",\"index\":-1}","{\"op\":\"key\",\"index\":1.5}","{\"op\":\"draft\",\"text\":\"#\"}","{\"op\":\"draft\",\"text\":42}","{\"op\":\"page\",\"page\":\"bad\"}","{\"op\":\"nav\",\"button\":\"bad\"}"})code("POST","/api/keyboard",body,400);
  code("POST","/api/keyboard","{\"op\":\"draft\",\"text\":\"hello 73\"}",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(r.code==200&&d["draft"]=="HELLO 73"&&d["maxLength"]==120&&d["page"]=="compose","shared OLED draft is normalized and readable");}
  code("POST","/api/keyboard","{\"op\":\"key\",\"index\":29}",202);
  code("POST","/api/keyboard","{\"op\":\"key\",\"index\":0}",202);
  code("POST","/api/keyboard","{\"op\":\"nav\",\"button\":\"left\"}",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["draft"]=="HELLO 7A"&&d["cursor"]==8,"keyboard delete, append and horizontal wrap");}
  String fullDraft;for(unsigned i=0;i<120;++i)fullDraft+='Z';
  code("POST","/api/keyboard",String("{\"op\":\"draft\",\"text\":\"")+fullDraft+"\"}",202);
  code("POST","/api/keyboard","{\"op\":\"key\",\"index\":0}",202);
  code("POST","/api/keyboard",String("{\"op\":\"draft\",\"text\":\"")+fullDraft+"Z\"}",400);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["length"]==120&&d["draft"].as<String>()==fullDraft,"full draft refuses overflow and invalid edits atomically");}fullDraft=String();
  code("POST","/api/keyboard","{\"op\":\"key\",\"index\":32}",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["length"]==120&&d["page"]=="send","keyboard Back preserves draft and returns to Send");}
  code("POST","/api/keyboard",R"({"op":"item","index":2})",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["page"]=="confirm"&&d["menu"]==1,"clear confirmation defaults to Back");}
  code("POST","/api/keyboard",R"({"op":"item","index":1})",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["length"]==120&&d["page"]=="send","confirmation Back preserves draft");}
  code("POST","/api/keyboard",R"({"op":"item","index":2})",202);
  code("POST","/api/keyboard",R"({"op":"item","index":0})",202);

  code("POST","/api/keyboard","{\"op\":\"key\",\"index\":31}",202);
  check(idle(),"empty keyboard draft does not start playback");
  code("POST","/api/keyboard","{\"op\":\"page\",\"page\":\"presets\"}",202);
  code("POST","/api/keyboard","{\"op\":\"nav\",\"button\":\"select\"}",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["draft"]=="SOS"&&d["page"]=="compose","OLED preset loads into composer");}
  code("POST","/api/keyboard","{\"op\":\"draft\",\"text\":\"TTTTTT\"}",202);
  code("POST","/api/keyboard","{\"op\":\"key\",\"index\":31}",202);
  vTaskDelay(pdMS_TO_TICKS(50));check(playbackReserved,"keyboard starts real engine playback");
  code("POST","/api/keyboard","{\"op\":\"key\",\"index\":31}",202);check(idle(),"same keyboard key stops active playback");
  code("POST","/api/keyboard","{\"op\":\"page\",\"page\":\"receive\"}",202);
  code("POST","/api/keyboard","{\"op\":\"nav\",\"button\":\"select\"}",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["page"]=="receive"&&d["pressed"]==0,"virtual selection does not fabricate a physical Morse key press");}
  code("POST","/api/keyboard","{\"op\":\"nav\",\"button\":\"left\"}",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["page"]=="receive-options","receive Back returns to its exact previous menu");}
  {auto r=request("GET","/api/status");JsonDocument d;deserializeJson(d,r.body);check(d["post"].size()==hmcpost::Count&&!d["post"]["SELECT"].isNull()&&!d["post"][hmcpost::name(hmcpost::Controller)].isNull()&&d["post"]["LED BANK"].isNull()&&d["buttonWiring"]==hmcbuttons::wiring(),"hardware POST covers configured button wiring and all five buttons");}

  code("POST","/api/keyboard",R"({"op":"page","page":"menu"})",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["items"].size()==4&&d["items"][3]=="SETUP","all four home sections are directly visible");}
  code("POST","/api/keyboard",R"({"op":"item","index":4})",400);
  code("POST","/api/keyboard",R"({"op":"page","page":"adjust"})",400);
  code("POST","/api/keyboard",R"({"op":"page","page":"signal-settings"})",202);
  code("POST","/api/keyboard",R"({"op":"item","index":0})",202);
  code("POST","/api/keyboard",R"({"op":"nav","button":"down"})",202);
  code("POST","/api/keyboard",R"({"op":"nav","button":"back"})",202);
  {auto r=request("GET","/api/config");JsonDocument d;deserializeJson(d,r.body);check(d["wpm"]==30,"Back cancels unsaved speed change");}
  code("POST","/api/keyboard",R"({"op":"item","index":0})",202);
  code("POST","/api/keyboard",R"({"op":"nav","button":"down"})",202);
  code("POST","/api/keyboard",R"({"op":"item","index":0})",202);
  {auto r=request("GET","/api/config");JsonDocument d;deserializeJson(d,r.body);check(d["wpm"]==29,"explicit OLED Save commits speed");}
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["page"]=="signal-settings"&&d["items"][3]=="Back","Save returns to the previous settings menu");}
  code("POST","/api/config",R"({"wpm":30})",202);
  code("POST","/api/keyboard",R"({"op":"page","page":"input-settings"})",202);
  code("POST","/api/keyboard",R"({"op":"item","index":0})",202);
  {auto r=request("GET","/api/config");JsonDocument d;deserializeJson(d,r.body);check(!d["autoWpm"].as<bool>(),"OLED auto-speed toggle persists");}
  code("POST","/api/keyboard",R"({"op":"item","index":0})",202);
  code("POST","/api/keyboard",R"({"op":"item","index":3})",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["page"]=="signal-settings","nested Back restores Morse settings");}

  code("POST","/api/buzzer-test","{}",202);check(idle(),"buzzer POST pattern completes without blocking");
  {auto r=request("GET","/api/status");JsonDocument d;deserializeJson(d,r.body);check(d["buzzerTests"].as<unsigned>()>=1&&!d["buzzerTesting"].as<bool>(),"buzzer playback completion recorded without claiming acoustic verification");}
  code("POST","/api/config",R"({"clearDiscord":true})",202);
  for(const char *bad:{R"({"discordUrl":"http://discord.com/api/webhooks/123/token"})",R"({"discordUrl":"https://evil.test/api/webhooks/123/token"})",R"({"discordTx":true})",R"({"bootSound":1})"})code("POST","/api/config",bad,400);
  String dummyUrl="https://discord.com/api/webhooks/123456789012345678/";for(unsigned i=0;i<70;++i)dummyUrl+='A';
  code("POST","/api/config",String("{\"discordUrl\":\"")+dummyUrl+"\",\"discordTx\":false,\"discordRx\":false}",202);
  {auto r=request("GET","/api/config");JsonDocument d;deserializeJson(d,r.body);check(d["discordConfigured"]==true&&d["discordUrl"].isNull(),"Discord configured status without exposing the webhook secret");}dummyUrl=String();
  code("POST","/api/config",R"({"clearDiscord":true})",202);
  code("POST","/api/config",R"({"bot":"123456789:AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789","chat":"123456789","forwardTx":false,"forwardRx":false})",202);
  {auto r=request("GET","/api/config");JsonDocument d;deserializeJson(d,r.body);check(d["telegramConfigured"]==true&&d["bot"].isNull(),"Telegram configured status without exposing its token");}
  code("POST","/api/keyboard",R"({"op":"page","page":"telegram-settings"})",202);
  code("POST","/api/keyboard",R"({"op":"item","index":0})",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["secret"]==true&&d["entry"].isNull()&&d["keys"].size()==33,"credential keyboard has 33 keys and never returns a saved secret");}
  code("POST","/api/keyboard",R"({"op":"key","index":27})",202);
  code("POST","/api/keyboard",R"({"op":"key","index":0})",202);
  code("POST","/api/keyboard",R"({"op":"key","index":31})",202);
  {auto r=request("GET","/api/keyboard");JsonDocument d;deserializeJson(d,r.body);check(d["page"]=="telegram-settings","mixed-case credential entry saves and returns to its provider menu");}
  code("POST","/api/config",R"({"clearTelegram":true})",202);
  code("POST","/api/keyboard",R"({"op":"page","page":"mic-test"})",202);
  {auto r=request("GET","/api/status");JsonDocument d;deserializeJson(d,r.body);check(d["micAvailable"]==bool(ENABLE_I2S_MIC),"mic test reflects compiled hardware support");}
  code("POST","/api/keyboard",R"({"op":"nav","button":"back"})",202);
  code("POST","/api/transmit","{\"text\":\"#\"}",400);
  code("POST","/api/train","{\"text\":\"QA\",\"wpm\":31}",400);
  code("POST","/api/decode","{\"morse\":\"......\"}",400);
  code("POST","/api/decode","{\"morse\":\"... --- ... / .... . .-.. .--.\"}",202);
  code("POST","/api/mode","{\"mode\":\"bad\"}",400);
  if(!ENABLE_I2S_MIC)code("POST","/api/mode","{\"mode\":\"mic\"}",409);
  code("POST","/api/mode","{\"mode\":\"key\"}",202);
  code("POST","/api/clear","{}",202);code("POST","/api/finish","{}",202);
  code("POST","/api/train","{\"text\":\"SOS\",\"wpm\":30}",202);
  vTaskDelay(pdMS_TO_TICKS(100));check(idle(6000),"training completes without hanging");
  {auto r=request("GET","/api/status");JsonDocument d;deserializeJson(d,r.body);bool found=false;for(JsonObject e:d["logs"].as<JsonArray>())if(e["kind"]=="TRAIN"&&e["text"]=="SOS")found=true;check(found,"TRAIN completion recorded");}
  code("POST","/api/train","{\"text\":\"TTTTTT\",\"wpm\":5}",202);
  code("POST","/api/transmit","{\"text\":\"E\"}",409);
  code("POST","/api/stop","{}",202);check(idle(),"stop releases playback reservation");
  code("POST","/api/transmit","{\"text\":\"QA\"}",202);vTaskDelay(pdMS_TO_TICKS(100));check(idle(),"normal playback completes");
  {auto r=request("GET","/api/timeline");JsonDocument d;deserializeJson(d,r.body);check(r.code==200&&d["segments"].size()>0&&d["segments"].size()<=64,"real TX edges recorded in bounded timeline");}
  if(!original.bot.length())code("POST","/api/telegram-test","{}",400);
  else Serial.println("[QA SKIP] external Telegram send; no message sent");
  code("POST","/api/ble","{\"op\":\"bad\"}",400);
  code("POST","/api/ble","{\"op\":\"beacon\",\"name\":\"\"}",400);
  code("POST","/api/ble","{\"op\":\"stop\"}",202);
  int scanCode=0;
  for(unsigned i=0;i<10;++i){scanCode=request("POST","/api/ble","{\"op\":\"scan\"}").code;if(scanCode==202)break;vTaskDelay(pdMS_TO_TICKS(300));}
  check(scanCode==202,"real BLE host initialization and passive scan start");
  if(scanCode==202){
    code("POST","/api/ble","{\"op\":\"beacon\",\"name\":\"HMC-QA\"}",409);
    vTaskDelay(pdMS_TO_TICKS(5500));
    {auto r=request("GET","/api/ble");JsonDocument d;deserializeJson(d,r.body);check(r.code==200&&d["ready"]==true&&d["scanning"]==false&&d["devices"].size()<=20,"BLE scan times out and results stay bounded");Serial.printf("[QA BLE] %u advertisers; heap %lu\n",unsigned(d["devices"].size()),(unsigned long)ESP.getFreeHeap());}
    uint32_t scanAge=millis()-bletools::lastScan;
    if(scanAge>=9500&&scanAge<10500)vTaskDelay(pdMS_TO_TICKS(10500-scanAge));
    int repeatExpected=millis()-bletools::lastScan<10000?429:202;
    code("POST","/api/ble","{\"op\":\"scan\"}",repeatExpected);
    if(repeatExpected==202) {
      code("POST","/api/ble","{\"op\":\"stop\"}",202);
      code("POST","/api/ble","{\"op\":\"scan\"}",429);
    }
    code("POST","/api/ble","{\"op\":\"beacon\",\"name\":\"HMC-QA\"}",202);
    code("POST","/api/ble","{\"op\":\"scan\"}",409);
    code("POST","/api/ble","{\"op\":\"stop\"}",202);
    pageCheck("real UI still serves with BLE host allocated");
    code("POST","/api/ble","{\"op\":\"beacon\",\"name\":\"HMC-QA-TIMEOUT\"}",202);
    uint32_t soakStart=millis(),heapStart=ESP.getFreeHeap();unsigned requests=0,errors=0;
    while(millis()-soakStart<61500) {
      {auto r=request("GET","/api/status");JsonDocument d;if(r.code!=200||deserializeJson(d,r.body)||d["firmware"]!=FIRMWARE_VERSION)++errors;}
      ++requests;vTaskDelay(pdMS_TO_TICKS(500));
    }
    check(!errors&&requests>60,"one-minute real HTTP soak while BLE beacon active");
    {auto r=request("GET","/api/ble");JsonDocument d;deserializeJson(d,r.body);check(r.code==200&&!d["beacon"].as<bool>(),"beacon stops automatically after 60 seconds");}
    check(ESP.getFreeHeap()+6144>=heapStart,"no sustained heap loss above 6 KB during soak");
    Serial.printf("[QA SOAK] %u real HTTP polls / %u errors / heap before %lu after %lu\n",requests,errors,(unsigned long)heapStart,(unsigned long)ESP.getFreeHeap());
    String longCode="{\"morse\":\"";
    for(unsigned i=0;i<120;++i){if(i)longCode+=' ';longCode+="-.-.--";}longCode+="\"}";
    bool stored=true;for(unsigned i=0;i<24;++i)if(request("POST","/api/decode",longCode).code!=202)stored=false;
    check(stored,"24 maximum-length history messages accepted");longCode=String();
    {WiFiClient client;HTTPClient http;PageSink sink;http.setTimeout(5000);http.begin(client,"http://127.0.0.1/api/status");http.addHeader("X-Device-Key",deviceKey);int rc=http.GET();int written=rc==200?consumePage(http,sink):-1;check(rc==200&&written>23000&&sink.last=='}'&&sink.decodes==24,"full history JSON streams completely with BLE initialized");Serial.printf("[QA HISTORY] HTTP %d / %u bytes / %u decoded records / declared %d / last %02x\n",rc,sink.bytes,sink.decodes,http.getSize(),sink.last);http.end();}
  }
  code("POST","/api/presets",restorePresets,202);
  if(!hadPresets)prefs.remove("presets");else check(prefs.getString("presets")==oldPresets,"original preset storage restored");
  check(saveConfig(original),"original configuration persisted after QA");
  {Guard g(configLock);cfg=original;}
  micHz=original.hz;micDb=original.db;
  check(ESP.getFreeHeap()>16000,"heap remains above minimum readiness threshold");
  Serial.printf("[QA END] %u checks / %u failures / %u core assertions / free heap %lu\n",checks,failures,qaCoreChecks,(unsigned long)ESP.getFreeHeap());
  running=false;vTaskDelete(nullptr);
}
static void coreTask(void *) {
  checks=failures=0;qaCoreChecks=qaCoreFailure=0;
  Serial.println("[QA BEGIN] isolated runtime core + real HTTP API + BLE tests");
  qaCoreTests();check(!qaCoreFailure,"runtime Morse core suite");
  Serial.printf("[QA CORE] %u assertions; failure line %u\n",qaCoreChecks,qaCoreFailure);
  if(xTaskCreate(task,"qa_network",8192,nullptr,1,nullptr)!=pdPASS){check(false,"network QA task allocation");running=false;}
  vTaskDelete(nullptr);
}
}
void startTargetQa() {
  if(targetqa::running.exchange(true)){Serial.println("[QA] Already running");return;}
  if(xTaskCreate(targetqa::coreTask,"qa",24576,nullptr,1,nullptr)!=pdPASS){targetqa::running=false;Serial.println("[QA FAIL] Task allocation");}
}
