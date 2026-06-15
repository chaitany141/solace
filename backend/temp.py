import urllib.request
import json
import ssl

req = urllib.request.Request(
    'https://career-campus-ruddy.vercel.app/api/chat',
    data=json.dumps({'message': 'hello', 'session_id': 'test'}).encode(),
    headers={'Content-Type': 'application/json'}
)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    res = urllib.request.urlopen(req, context=ctx)
    print("STATUS:", res.status)
    print("REPLY:", res.read().decode())
except Exception as e:
    print("ERROR:", e)
    if hasattr(e, 'read'):
        print("DETAILS:", e.read().decode())
