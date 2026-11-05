#include "../OledUI.h"
#include "../DeviceIdentity.h"
using namespace hmcdisplay;
constexpr unsigned lit(const Frame &f){unsigned n=0;for(int y=0;y<64;++y)for(int x=0;x<128;++x)if(f.get(x,y))++n;return n;}
constexpr Model fixture(Page p){Model m;m.page=p;m.ms=700;m.uptime=7460;m.heap=127000;m.minHeap=105000;m.totalHeap=220000;m.letter='S';m.autoSpeed=true;m.speedLocked=true;m.rxWpm=18;m.clients=2;m.navReady=true;m.keyboard.setText("CQ CQ HERMIT 73");
 const char *ap=HMC_AP_NAME,*ip="192.168.4.1",*pw=HMC_AP_PASSWORD,*msg="SOS / HERMIT ONLINE",*pending="...";
 for(unsigned i=0;ap[i];++i)m.ap[i]=ap[i];for(unsigned i=0;ip[i];++i)m.ip[i]=ip[i];for(unsigned i=0;pw[i];++i)m.wifiPass[i]=pw[i];for(unsigned i=0;msg[i];++i)m.message[i]=msg[i];for(unsigned i=0;pending[i];++i)m.pending[i]=pending[i];
 const char *names[]={"SOS / HELP","LONG PRESET LABEL 24 CHAR","CQ CQ","HELLO WORLD","","73"};for(unsigned i=0;i<6;++i)for(unsigned j=0;j<24&&names[i][j];++j)m.presetLabels[i][j]=names[i][j];
 m.post.items[hmcpost::Oled]=hmcpost::Status::Found;m.post.items[hmcpost::Controller]=hmcpost::Status::Pass;m.post.items[hmcpost::Up]=hmcpost::Status::Seen;m.post.items[hmcpost::Mic]=hmcpost::Status::Off;for(unsigned i=hmcpost::Flash;i<hmcpost::Count;++i)m.post.items[i]=hmcpost::Status::Pass;return m;}
constexpr bool bounds(){Frame f;f.pixel(-1,0);f.pixel(128,0);f.pixel(0,64);if(lit(f))return false;f.box(-3,-3,5,5);if(lit(f)!=4)return false;f.box(0,0,128,64);return lit(f)==8192;}
constexpr bool pages(){for(unsigned i=0;i<18;++i){auto m=fixture(static_cast<Page>(i));if(m.page==Page::List)m.keyboard.go(hmcnav::Screen::SendMenu);unsigned n=lit(render(m));if(n<200||n>6000)return false;}return true;}
constexpr bool selections(){Model m=fixture(Page::Keyboard);for(unsigned j=0;j<33;++j){m.keyboard.cursor=j;auto f=render(m);for(unsigned i=0;i<33;++i){int x=i<27?1+i%9*14:1+(i-27)*21,y=i<27?31+i/9*8:56;if(f.get(x,y)!=(i==j))return false;}}
 m.page=Page::Menu;for(unsigned j=0;j<4;++j){m.keyboard.menu=j;auto f=render(m);for(unsigned i=0;i<4;++i)if(f.get(3+(i%2)*64,13+(i/2)*21)!=(i==j))return false;}
 for(unsigned i=0;i<unsigned(hmcnav::Screen::Count);++i){auto s=static_cast<hmcnav::Screen>(i);if(!hmcnav::isList(s))continue;m.page=Page::List;m.keyboard.go(s);m.keyboard.menu=hmcnav::menuCount(s)-1;auto f=render(m);if(!f.get(1,42)||!f.get(126,50))return false;}return true;}
constexpr bool privacy(){for(unsigned p=0;p<18;++p){auto a=fixture(static_cast<Page>(p)),b=a;b.wifiPass[0]='x';auto fa=render(a),fb=render(b);bool same=true;for(unsigned i=0;i<1024;++i)if(fa.data[i]!=fb.data[i])same=false;if(same==(p==unsigned(Page::Network)||p==unsigned(Page::Pair)))return false;}return true;}
constexpr bool posts(){if(hmcpost::Count!=13)return false;for(unsigned page=0;page<5;++page){auto m=fixture(Page::Post);m.keyboard.postPage=page;if(lit(render(m))<200)return false;}return hmcpost::button(false,false)==hmcpost::Status::Check&&hmcpost::button(true,false)==hmcpost::Status::Seen;}
constexpr bool secretPreview(){auto a=fixture(Page::Keyboard),b=a;a.ms=b.ms=2000;a.keyboard.beginEntry(hmcnav::Field::TgToken,"12345:ABCDEFGHIJKLMNOP");b.keyboard.beginEntry(hmcnav::Field::TgToken,"54321:abcdefghijklmnop");auto x=render(a),y=render(b);for(unsigned i=0;i<1024;++i)if(x.data[i]!=y.data[i])return false;return true;}
static_assert(secretPreview(),"Stored secret values must not appear in the framebuffer");
static_assert(sizeof(Frame)==1024,"Native 128x64 framebuffer size");static_assert(bounds(),"Graphics clipping");static_assert(pages(),"Every page renders");static_assert(selections(),"All keys/home tiles highlight independently and every Back row stays visible");static_assert(privacy(),"Password appears only on Wi-Fi access screens");static_assert(posts(),"All hardware pages render and button checks remain honest");
constexpr bool wifiLayouts(){
 Model m=fixture(Page::Menu);auto off=render(m);m.online=true;m.rssi=-45;m.wifiState=hmcwifi::State::Connected;auto on=render(m);bool different=false;
 for(unsigned x=109;x<128;++x)for(unsigned y=0;y<10;++y)if(on.get(x,y)!=off.get(x,y))different=true;if(!different)return false;
 m.page=Page::WifiScan;m.keyboard.wifiCount=16;m.keyboard.menu=17;m.wifiFirst=15;auto f=render(m);if(!f.get(1,42)||!f.get(126,50))return false;
 m.page=Page::WifiStatus;return lit(render(m))>200;
}
static_assert(wifiLayouts(),"Router connection icon differs at Home; scan Back and status stay inside native bounds");
struct Preview{Frame frames[48];};
constexpr Preview preview(){Preview p{};Model m=fixture(Page::Menu);p.frames[0]=render(m);m.keyboard.menu=1;p.frames[1]=render(m);
 const hmcnav::Screen menus[]={hmcnav::Screen::SendMenu,hmcnav::Screen::ReceiveMenu,hmcnav::Screen::Tools,hmcnav::Screen::Setup,hmcnav::Screen::SignalSetup,hmcnav::Screen::DisplaySetup,hmcnav::Screen::InputSetup,hmcnav::Screen::Ble,hmcnav::Screen::System};
 for(unsigned i=0;i<9;++i){m=fixture(Page::List);m.keyboard.go(menus[i]);const char *v0=menus[i]==hmcnav::Screen::SignalSetup?"12WPM":menus[i]==hmcnav::Screen::DisplaySetup?"160":menus[i]==hmcnav::Screen::InputSetup?"OFF":menus[i]==hmcnav::Screen::Ble?"0SEEN":"";const char *v1=menus[i]==hmcnav::Screen::SignalSetup?"700HZ":menus[i]==hmcnav::Screen::DisplaySetup?"ON":menus[i]==hmcnav::Screen::InputSetup?"KEY":menus[i]==hmcnav::Screen::Ble?"OFF":"";for(unsigned j=0;v0[j];++j)m.rowValues[0][j]=v0[j];for(unsigned j=0;v1[j];++j)m.rowValues[1][j]=v1[j];p.frames[2+i]=render(m);}
 m=fixture(Page::Keyboard);p.frames[11]=render(m);for(unsigned i=0;i<120;++i)m.keyboard.text[i]='A'+i%26;m.keyboard.text[120]=0;m.keyboard.length=120;m.keyboard.cursor=32;p.frames[12]=render(m);m.tx=true;m.keyboard.cursor=31;p.frames[13]=render(m);
 m=fixture(Page::Presets);m.keyboard.menu=6;p.frames[14]=render(m);m.keyboard.menu=5;m.keyboard.presetPage=1;p.frames[15]=render(m);
 m=fixture(Page::Signal);p.frames[16]=render(m);m=fixture(Page::Network);p.frames[17]=render(m);m=fixture(Page::Post);p.frames[18]=render(m);m.keyboard.postPage=4;p.frames[19]=render(m);
 p.frames[20]=render(fixture(Page::Device));p.frames[21]=render(fixture(Page::About));m=fixture(Page::Adjust);m.keyboard.editValue=30;p.frames[22]=render(m);m.keyboard.setting=hmcnav::Setting::Contrast;m.keyboard.editValue=255;p.frames[23]=render(m);
 m=fixture(Page::Confirm);m.keyboard.menu=1;p.frames[24]=render(m);p.frames[25]=render(fixture(Page::Splash));m=fixture(Page::Keyboard);m.keyboard.setText("");p.frames[26]=render(m);m=fixture(Page::Post);m.keyboard.postPage=2;p.frames[27]=render(m);
 const hmcnav::Screen settings[]={hmcnav::Screen::Connections,hmcnav::Screen::TelegramSetup,hmcnav::Screen::DiscordSetup,hmcnav::Screen::Tests};
 for(unsigned i=0;i<4;++i){m=fixture(Page::List);m.keyboard.go(settings[i]);const char *status=i<3?"NOT CONFIGURED":"";for(unsigned j=0;status[j];++j)m.statusLine[j]=status[j];p.frames[28+i]=render(m);}
 m=fixture(Page::Keyboard);m.keyboard.beginEntry(hmcnav::Field::TgToken,"12345:MixedCase_token-EXAMPLE");m.keyboard.upper=false;m.keyboard.keyPage=0;m.keyboard.cursor=7;p.frames[32]=render(m);m.keyboard.keyPage=1;m.keyboard.cursor=28;p.frames[33]=render(m);m.keyboard.keyPage=2;p.frames[34]=render(m);
 m=fixture(Page::BuzzerTest);m.buzzerActive=true;p.frames[35]=render(m);m=fixture(Page::MicTest);p.frames[36]=render(m);m.micEnabled=true;m.micReady=true;m.micLevel=65;m.signal=true;p.frames[37]=render(m);
 m=fixture(Page::Splash);m.ms=150;p.frames[38]=render(m);m.ms=1600;p.frames[39]=render(m);
 m=fixture(Page::Menu);m.online=true;m.rssi=-48;m.wifiState=hmcwifi::State::Connected;p.frames[40]=render(m);m.online=false;m.wifiState=hmcwifi::State::Connecting;p.frames[41]=render(m);
 m=fixture(Page::WifiScan);m.keyboard.go(hmcnav::Screen::WifiScan);m.keyboard.wifiCount=3;m.wifiScanDone=true;const char *net[]={"HOME ROUTER","LONG OFFICE NETWORK NAME","OPEN GUEST"};for(unsigned i=0;i<3;++i){for(unsigned j=0;net[i][j];++j)m.wifiNames[i][j]=net[i][j];m.wifiSecure[i]=i!=2;}p.frames[42]=render(m);
 m.keyboard.menu=4;m.wifiFirst=3;p.frames[43]=render(m);m=fixture(Page::WifiStatus);const char *lan="192.168.1.50";for(unsigned i=0;i<16;++i)m.ip[i]=0;for(unsigned i=0;lan[i];++i)m.ip[i]=lan[i];m.online=true;m.wifiState=hmcwifi::State::Connected;const char *ssid="HOME ROUTER";for(unsigned i=0;ssid[i];++i)m.ssid[i]=ssid[i];p.frames[44]=render(m);m.online=false;m.wifiState=hmcwifi::State::Failed;m.wifiError=hmcwifi::Error::PasswordRequired;p.frames[45]=render(m);
 m=fixture(Page::WifiScan);m.wifiScanning=true;p.frames[46]=render(m);m=fixture(Page::List);m.keyboard.go(hmcnav::Screen::WifiSetup);p.frames[47]=render(m);return p;}
extern const Preview oledPreviews __attribute__((section(".oledpreview"),used))=preview();
