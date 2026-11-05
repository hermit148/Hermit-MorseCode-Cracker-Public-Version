#include "../KeyboardCore.h"
#include "../BuildConfig.h"
#include "../NotificationCore.h"
#include <initializer_list>
using namespace hmcnav;
constexpr Event arrow(Button b){return {b,Edge::Press,false};}
constexpr Event tap(){return {Button::Select,Edge::Release,false};}
constexpr bool editing(){Keyboard k;k.go(Screen::Compose);if(!k.setText("hello 73?"))return false;if(k.length!=9||k.text[0]!='H')return false;if(k.setText("#")||k.length!=9)return false;
 char full[122]={};for(unsigned i=0;i<120;++i)full[i]='Z';if(!k.setText(full))return false;k.choose(0);if(k.length!=120||k.notice!=Notice::Full)return false;full[120]='A';if(k.setText(full)||k.length!=120)return false;
 k.choose(29);if(k.length!=119||k.text[119])return false;k.choose(26);if(k.text[119]!=' ')return false;if(k.choose(31)!=Action::Send)return false;
 k.choose(32);return k.length==120&&k.screen==Screen::SendMenu&&k.depth==1;}
constexpr bool navigation(){Keyboard k;if(k.screen!=Screen::Menu)return false;k.input(arrow(Button::Right),1);if(k.menu!=1)return false;k.input(arrow(Button::Down),2);if(k.menu!=3)return false;k.input(arrow(Button::Left),3);if(k.menu!=2)return false;
 k.input(tap(),4);if(k.screen!=Screen::Tools)return false;k.menu=2;k.input(tap(),5);if(k.screen!=Screen::System)return false;k.menu=2;k.input(tap(),6);if(k.screen!=Screen::About)return false;
 k.input(tap(),7);if(k.screen!=Screen::System||k.menu!=2)return false;k.menu=3;k.input(tap(),8);if(k.screen!=Screen::Tools||k.menu!=2)return false;k.input(arrow(Button::Left),9);if(k.screen!=Screen::Menu||k.menu!=2)return false;
 k.go(Screen::Receive);k.input({Button::Select,Edge::Hold,true},10);if(k.screen!=Screen::Receive||k.input(tap(),11)!=Action::None)return false;if(k.input(arrow(Button::Right),12)!=Action::Finish)return false;if(k.input({Button::Right,Edge::Repeat,false},13)!=Action::None)return false;k.input(arrow(Button::Left),14);return k.screen==Screen::ReceiveMenu;}
constexpr bool backEverywhere(){for(unsigned i=0;i<unsigned(Screen::Count);++i){auto s=static_cast<Screen>(i);if(!isList(s))continue;Keyboard k;k.go(s);unsigned depth=k.depth;k.menu=menuCount(s)-1;k.input(tap(),0);if(k.depth+1!=depth)return false;while(k.depth)k.back();if(k.screen!=Screen::Menu)return false;}return true;}
constexpr bool confirmation(){Keyboard k;k.setText("SOS");k.go(Screen::SendMenu);k.menu=2;k.input(tap(),0);if(k.screen!=Screen::Confirm||k.menu!=1)return false;k.input(tap(),1);if(k.length!=3||k.screen!=Screen::SendMenu)return false;k.menu=2;k.input(tap(),2);k.menu=0;k.input(tap(),3);if(k.length||k.notice!=Notice::Cleared||k.screen!=Screen::SendMenu)return false;
 k.go(Screen::ReceiveMenu);k.menu=2;k.input(tap(),4);k.menu=0;return k.input(tap(),5)==Action::ClearRx&&k.screen==Screen::ReceiveMenu;}
constexpr bool editingSettings(){Keyboard k;k.go(Screen::SignalSetup);if(k.input(tap(),0)!=Action::EditSpeed)return false;k.open(Screen::Adjust);k.editValue=30;k.editMin=5;k.editMax=30;k.editStep=1;k.input(arrow(Button::Up),1);if(k.editValue!=30)return false;for(unsigned i=0;i<30;++i)k.input(arrow(Button::Down),2+i);if(k.editValue!=5)return false;
 if(k.input(tap(),40)!=Action::SaveSetting)return false;k.input(arrow(Button::Left),41);return k.screen==Screen::SignalSetup;}
constexpr bool presetsAndPages(){Keyboard k;k.go(Screen::Presets);k.input(arrow(Button::Up),0);if(k.menu!=6)return false;k.input(arrow(Button::Up),1);if(k.menu!=5||k.presetPage!=1||k.input(tap(),2)!=Action::LoadPreset)return false;
 if(k.input(arrow(Button::Right),3)!=Action::PlayPreset||k.input({Button::Right,Edge::Repeat,false},4)!=Action::None)return false;k.open(Screen::Compose);k.choose(32);if(k.screen!=Screen::Presets||k.menu!=5)return false;
 k.go(Screen::Post);k.input(arrow(Button::Up),5);if(k.postPage!=4)return false;k.input(arrow(Button::Down),6);if(k.postPage)return false;k.input(tap(),7);return k.screen==Screen::Tests;}
constexpr bool boundedHistory(){Keyboard k;for(unsigned i=0;i<8;++i)k.open(i%2?Screen::Tools:Screen::SendMenu);if(k.depth!=8)return false;k.open(Screen::About);if(k.depth!=8||k.notice!=Notice::Busy)return false;for(unsigned i=0;i<12;++i)k.back();return k.depth==0&&k.screen==Screen::Menu;}
constexpr bool debounce(){
  KeyState k;
  if(k.tick(Button::Select,true,100).edge!=Edge::None)return false;
  k.tick(Button::Select,false,105);k.tick(Button::Select,true,110);
  if(k.tick(Button::Select,true,124).edge!=Edge::None)return false;
  if(k.tick(Button::Select,true,125).edge!=Edge::Press||!k.isDown())return false;
  if(k.tick(Button::Select,true,924).edge!=Edge::None)return false;
  if(k.tick(Button::Select,true,925).edge!=Edge::Hold)return false;
  if(k.tick(Button::Select,true,1000).edge!=Edge::None)return false;
  k.tick(Button::Select,false,1010);auto e=k.tick(Button::Select,false,1025);
  if(e.edge!=Edge::Release||!e.held||k.isDown())return false;
  KeyState a;a.tick(Button::Down,true,0xfffffff0u);
  if(a.tick(Button::Down,true,0xffffffffu).edge!=Edge::Press)return false;
  if(a.tick(Button::Down,true,398).edge!=Edge::None)return false;
  if(a.tick(Button::Down,true,399).edge!=Edge::Repeat)return false;
  if(a.tick(Button::Down,true,508).edge!=Edge::None)return false;
  return a.tick(Button::Down,true,509).edge==Edge::Repeat;
}

constexpr bool reopenPreset(){Keyboard k;k.preset=5;k.go(Screen::Presets);if(k.menu!=5||k.presetPage!=1)return false;k.back();if(k.screen!=Screen::SendMenu||k.menu!=1)return false;k.go(Screen::Menu);k.menu=3;k.back();return k.menu==3;}
static_assert(reopenPreset(),"Reopening presets keeps its selected slot visible; Back at Home preserves selection");
constexpr bool asciiCoverage(){Keyboard k;k.beginEntry(Field::DiscordUrl,"");bool seen[95]={};for(unsigned page=0;page<3;++page){k.keyPage=page;for(unsigned shift=0;shift<2;++shift){k.upper=shift==0;for(unsigned i=0;i<27;++i){auto c=k.caption(i);char ch=i==26?' ':c.text[0];if(ch<32||ch>126)return false;seen[ch-32]=true;}}}for(bool found:seen)if(!found)return false;return true;}
constexpr bool credentials(){Keyboard k;k.go(Screen::TelegramSetup);k.beginEntry(Field::TgToken,"12345:AbCd");if(!k.secret()||k.entryLength!=10)return false;k.choose(27);k.choose(0);if(k.entry[10]!='a')return false;k.choose(28);k.choose(31);if(k.choose(31)!=Action::SaveText)return false;k.choose(32);if(k.screen!=Screen::TelegramSetup||k.entryLength||k.field!=Field::Message)return false;for(char c:k.entry)if(c)return false;return true;}
constexpr bool grid(){Keyboard k;k.go(Screen::Compose);for(unsigned i=0;i<33;++i){for(Button b:{Button::Up,Button::Down,Button::Left,Button::Right}){k.cursor=i;k.input(arrow(b),1);if(k.cursor>=33)return false;}}k.cursor=0;k.input(arrow(Button::Left),1);return k.cursor==8;}
static_assert(asciiCoverage(),"Credential keyboard covers all printable ASCII including lowercase and symbols");
static_assert(credentials(),"Credential editing saves explicitly and Back wipes only the unsaved secret");
static_assert(grid(),"Character/action row navigation never leaves the visible key grid");
static_assert(editing(),"Draft boundaries and Back must preserve the message");
static_assert(navigation(),"Home navigation, exact previous-menu return and Morse long dash");
static_assert(backEverywhere(),"Every submenu has a working Back row");
static_assert(confirmation(),"Clear requires explicit confirmation; Back preserves input");
static_assert(editingSettings(),"Settings bounds, explicit save and cancel return");
static_assert(presetsAndPages(),"All presets reachable; Back pinned; hardware pagination wraps");
static_assert(boundedHistory(),"Navigation stack stays bounded and cannot underflow");
static_assert(debounce(),"Debounce, hold, repeat and rollover");
static_assert(validPinPlan(),"No pin conflicts");
#if MIC_DIRECT_BOOT_CLOCK
static_assert(ENABLE_I2S_MIC && !BUTTONS_USE_MCP23017,"Direct microphone requires direct switches");
static_assert(PIN_MIC_BCLK==2 && PIN_MIC_WS==21 && PIN_MIC_DATA==20,"Direct mic uses pulled-up GPIO2 clock and GPIO20 input");
static_assert(NAV_BUTTON_PINS[4]==1,"Direct Select remains separate from mic data");
#endif

static_assert(hmcnotify::webhookValid("https://discord.com/api/webhooks/123456789012345678/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),"Valid bounded Discord webhook");
static_assert(!hmcnotify::webhookValid("http://discord.com/api/webhooks/123456789012345678/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),"HTTPS required");
static_assert(!hmcnotify::webhookValid("https://discord.com.evil.test/api/webhooks/123456789012345678/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),"Exact Discord host only");
