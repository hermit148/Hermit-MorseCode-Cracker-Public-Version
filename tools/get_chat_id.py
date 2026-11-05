"""Read recent updates for your own Telegram bot; never prints its token."""
import getpass
import json
import re
import urllib.error
import urllib.request

token = getpass.getpass('Bot token (hidden): ').strip()
if not re.fullmatch(r'[0-9]{5,20}:[A-Za-z0-9_-]{20,100}', token):
    raise SystemExit('Invalid bot token format.')
try:
    req = urllib.request.Request('https://api.telegram.org/bot' + token + '/getUpdates', data=b'{"limit":20,"timeout":0}', headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=15) as response:
        body = json.load(response)
    if not body.get('ok'):
        raise SystemExit('Telegram rejected the request. Check the token and any existing webhook.')
    seen = set()
    for update in body.get('result', []):
        message = update.get('message') or update.get('channel_post') or update.get('edited_message') or {}
        chat = message.get('chat', {})
        if 'id' in chat and chat['id'] not in seen:
            seen.add(chat['id'])
            print('Chat ID:', chat['id'], '| Type:', chat.get('type', 'unknown'), '| Name:', chat.get('title') or chat.get('first_name') or '')
    if not seen:
        print('No chat found. Send /start to your bot, then run again. Another bot service may already be consuming updates.')
except urllib.error.HTTPError as e:
    raise SystemExit('Telegram HTTP error ' + str(e.code) + '. Check token, webhook conflicts, and rate limits.') from None
except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
    raise SystemExit('Connection or response error. No token was printed.') from None
