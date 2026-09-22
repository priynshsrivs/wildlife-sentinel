"""Exercise real services in an isolated temporary database, never operational data."""
import argparse
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import httpx
from sentinel_config import ROOT
from scripts.launch import wait_health

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--hold',action='store_true');args=parser.parse_args()
    processes=[];logs=[]
    with tempfile.TemporaryDirectory(prefix='sentinel-smoke-', ignore_cleanup_errors=True) as tmp:
        env={**os.environ,'DATABASE_PATH':str(Path(tmp)/'smoke.db'),'DATA_DIR':tmp,
             'ADMIN_API_TOKEN':'smoke-local-admin-token-for-isolated-test',
             'SERVICE_API_TOKEN':'smoke-local-service-token-for-isolated-test',
             'BACKEND_URL':'http://127.0.0.1:18000','AUDIO_API_URL':'http://127.0.0.1:15001',
             'FRONTEND_ORIGINS':'http://127.0.0.1:5174','DISCORD_WEBHOOK_URL':'','CAMERA_ENDPOINTS_JSON':'{}'}
        def start(name,args,cwd=ROOT):
            log=open(Path(tmp)/(name+'.log'),'w',encoding='utf-8');logs.append(log)
            p=subprocess.Popen(args,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
            processes.append(p);return p
        try:
            backend=start('backend',[sys.executable,'-m','uvicorn','backend.main:app','--port','18000','--no-access-log'])
            audio=start('audio',[sys.executable,'-m','uvicorn','ai_service.audio.audio_api:app','--port','15001','--no-access-log'])
            wait_health(env['BACKEND_URL']+'/health',backend);wait_health(env['AUDIO_API_URL']+'/health',audio)
            headers={'Authorization':'Bearer '+env['ADMIN_API_TOKEN']}
            with httpx.Client(timeout=120,headers=headers,trust_env=False) as client:
                for endpoint in ('/health','/api/alerts','/api/stats','/api/analytics','/api/settings','/api/cameras'):
                    response=client.get(env['BACKEND_URL']+endpoint);response.raise_for_status();print(endpoint,'PASS')
                for path in ('/health','/api/audio/labels'):
                    response=client.get(env['AUDIO_API_URL']+path);response.raise_for_status();print('audio'+path,'PASS')
                with (ROOT/'ai_service/test_samples/poachers/person.jpg').open('rb') as image, (ROOT/'ai_service/audio/test.wav').open('rb') as sound:
                    response=client.post(env['AUDIO_API_URL']+'/api/audio/pipeline',files={'image':('person.jpg',image,'image/jpeg'),'audio':('test.wav',sound,'audio/wav')})
                    response.raise_for_status();result=response.json()
                    assert response.status_code==200,result
                    assert result['persisted'] and result['combined_risk']=='CRITICAL',result
                    print('REAL FUSION PASS', result['combined_risk'],result['audio']['label'], 'persisted=',result['persisted'])
                alert_id=result['alert_id']
                response=client.post(env['BACKEND_URL']+f'/api/alerts/{alert_id}/resolve');response.raise_for_status()
                print('RESOLUTION PASS')
            if args.hold:
                env['VITE_API_BASE']=env['BACKEND_URL']+'/api'
                start('frontend',['node',str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5174','--strictPort'],ROOT/'frontend')
                print('UI READY http://127.0.0.1:5174 (isolated smoke credential)',flush=True)
                while True:time.sleep(1)
        except KeyboardInterrupt:pass
        except Exception:
            for log in logs:log.flush()
            for path in Path(tmp).glob('*.log'):print(path.name,path.read_text(encoding='utf-8')[-5000:])
            raise
        finally:
            for p in processes:
                if p.poll() is None:
                    p.terminate()
            for p in processes:
                try:p.wait(timeout=10)
                except subprocess.TimeoutExpired:p.kill();p.wait()
            for log in logs:
                try:
                    log.flush()
                    log.close()
                except Exception:
                    pass
            time.sleep(0.5)
if __name__=='__main__':main()
