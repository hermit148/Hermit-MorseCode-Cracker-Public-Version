#include "../WifiCore.h"
#include "../KeyboardCore.h"
using namespace hmcwifi;
constexpr bool stateTransitions(){
 Link l;l.begin(100);l.tick(false,202,20099);if(l.state!=State::Connecting)return false;
 l.tick(false,202,20100);if(l.state!=State::Failed||l.error!=Error::Authentication)return false;
 l.begin(22000);l.tick(true,0,22001);if(l.state!=State::Connected)return false;
 l.tick(false,0,23000);if(l.error!=Error::Lost)return false;
 l.begin(0xfffffff0u);l.tick(false,201,0xfffffff0u+20000u);return l.error==Error::NotFound;
}
constexpr bool cacheBounds(){
 Cache c;c.add("",-30,1,false,true);c.add("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456",-20,1,false,true);if(c.count)return false;
 c.add("A",-80,1,true,true);c.add("A",-90,2,false,true);if(c.count!=1||c.items[0].rssi!=-80||!c.items[0].secure)return false;
 c.add("A",-40,3,true,true);if(c.count!=1||c.items[0].rssi!=-40||c.items[0].channel!=3)return false;
 for(unsigned i=0;i<30;++i){char n[3]={'B',char('A'+i),0};c.add(n,-30-int(i),6,false,true);}c.sort();
 if(c.count!=16)return false;for(unsigned i=1;i<c.count;++i)if(c.items[i].rssi>c.items[i-1].rssi)return false;
 if(c.items[0].rssi!=-30||c.items[15].rssi<-44)return false;c.clear();return !c.count;
}
constexpr bool wifiNavigation(){
 using namespace hmcnav;Keyboard k;k.go(Screen::WifiSetup);k.menu=0;
 if(k.activate()!=Action::WifiScan||k.screen!=Screen::WifiScan)return false;
 k.wifiCount=16;k.menu=16;if(k.input({Button::Select,Edge::Release,false},1)!=Action::WifiScan)return false;
 k.menu=15;if(k.input({Button::Select,Edge::Release,false},2)!=Action::WifiChoose)return false;
 k.beginEntry(Field::WifiPass,"");k.choose(0);k.choose(32);if(k.screen!=Screen::WifiScan||k.entryLength)return false;
 k.menu=17;k.input({Button::Select,Edge::Release,false},3);if(k.screen!=Screen::WifiSetup||k.menu)return false;
 k.go(Screen::WifiStatus);if(k.input({Button::Right,Edge::Press,false},4)!=Action::WifiRetry)return false;
 k.input({Button::Select,Edge::Release,false},5);return k.screen==Screen::WifiSetup&&k.menu==2;
}
static_assert(stateTransitions(),"IP success, failure reasons, disconnect and timeout rollover");
static_assert(cacheBounds(),"Scans deduplicate, retain strongest 16 and bound SSID bytes");
static_assert(wifiNavigation(),"Wi-Fi scan selection, password cancellation, rescan, retry and Back");
