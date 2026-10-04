"""Read-only external preflights for the QuantaPhi org suite; no credentials or writes."""
import json, subprocess, sys

probes = [
    ('AI', 'infinity-rogers', '/v1/chat', 'POST', 'content-type'),
    ('News monitor', 'monitor-phi', '/p/news/feed', 'POST', 'content-type'),
    ('Search', 'orange-brook-a2ac', '/search', 'GET', 'accept'),
    ('Unified wallet', 'unified-wallet', '/v1/wallet/state', 'GET', 'authorization,content-type'),
    ('Quant ledger', 'quanta-phi-ledger', '/v1/quants/history', 'GET', 'authorization,content-type'),
    ('Star ledger', 'starquest-ledger', '/v1/state', 'GET', 'authorization,content-type'),
]
results = []
for name, worker, path, method, requested in probes:
    url = 'https://' + worker + '.marvaseater.workers.dev' + path
    try:
        raw = subprocess.check_output(['curl','-sS','--max-time','15','-X','OPTIONS',url,'-D','-','-o','/dev/null','-H','Origin: https://quantaphi.org','-H','Access-Control-Request-Method: '+method,'-H','Access-Control-Request-Headers: '+requested],text=True)
        block = raw.replace('\r','').strip().split('\n\n')[-1].splitlines()
        status = int(block[0].split()[1]); headers = dict(line.lower().split(': ',1) for line in block[1:] if ': ' in line)
        origin = headers.get('access-control-allow-origin',''); allowed = headers.get('access-control-allow-headers','').split(',')
        ok = 200 <= status < 300 and origin in ('*','https://quantaphi.org') and all(x in [v.strip() for v in allowed] for x in requested.split(','))
        results.append({'name':name,'ok':ok,'status':status})
    except Exception as error:
        results.append({'name':name,'ok':False,'error':str(error)})
print(json.dumps({'ok':all(x['ok'] for x in results),'results':results},indent=2))
sys.exit(0 if all(x['ok'] for x in results) else 1)
