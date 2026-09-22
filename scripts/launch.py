"""Local development supervisor. All child processes stop when this launcher exits."""
import argparse
import importlib.util
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
import httpx
from sentinel_config import ROOT, DATA_DIR, API_TOKENS, SERVICE_TOKEN

def wait_health(url, process):
    deadline=time.monotonic()+120
    while time.monotonic()<deadline:
        if process.poll() is not None:raise RuntimeError('Service exited; inspect data/logs')
        try:
            response=httpx.get(url,timeout=2,trust_env=False)
            response.raise_for_status()
            print(url, response.json())
            return
        except httpx.HTTPError:time.sleep(1)
    raise RuntimeError('Startup timed out; inspect data/logs')
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--camera',action='store_true');args=parser.parse_args()
    if not shutil.which('npm') or not shutil.which('node'):raise SystemExit('Install Node 24 LTS and npm')
    if not (ROOT/'frontend/node_modules').is_dir():raise SystemExit('Run npm ci in frontend first')
    if not any(API_TOKENS.values()) or not SERVICE_TOKEN:raise SystemExit('Run python -m scripts.init_env, then configure .env')
    for module in ('fastapi','slowapi','cv2','ultralytics','tensorflow','flask','waitress'):
        if importlib.util.find_spec(module) is None:raise SystemExit('Missing dependencies: pip install -r backend/requirements.txt')
    logs=DATA_DIR/'logs';logs.mkdir(parents=True,exist_ok=True)
    processes=[];handles=[]
    def start(name, command,cwd=ROOT):
        file=(logs/(name+'.log')).open('w',encoding='utf-8');handles.append(file)
        kwargs={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}
        process=subprocess.Popen(command,cwd=cwd,stdout=file,stderr=subprocess.STDOUT,**kwargs)
        processes.append(process);return process
    try:
        backend=start('backend',[sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8000','--workers','1','--limit-concurrency','32','--ws-max-size','4096','--no-access-log'])
        wait_health('http://127.0.0.1:8000/health',backend)
        audio=start('audio',[sys.executable,'-m','uvicorn','ai_service.audio.audio_api:app','--host','127.0.0.1','--port','5001','--limit-concurrency','16','--no-access-log'])
        wait_health('http://127.0.0.1:5001/health',audio)
        if args.camera:start('camera',[sys.executable,'mjpeg_server.py'])
        # Invoke Vite directly with Node, avoiding shell quoting and orphaned npm child processes.
        start('frontend',[shutil.which('node'),str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173','--strictPort'],ROOT/'frontend')
        time.sleep(1)
        import webbrowser
        try:
            webbrowser.open('http://127.0.0.1:5173')
        except Exception:
            pass
        print('==================================================================')
        print(' Wildlife Sentinel Services are Running!')
        print(' Dashboard URL: http://127.0.0.1:5173')
        print(f" Admin Sign-In Token: {API_TOKENS.get('admin', '')}")
        print(' Logs: data/logs/ | Press Ctrl+C in this window to stop all services')
        print('==================================================================')
        while all(p.poll() is None for p in processes):time.sleep(1)
        raise RuntimeError('A service stopped; inspect data/logs')
    except KeyboardInterrupt:pass
    finally:
        for process in processes:
            if process.poll() is None:process.terminate()
        for process in processes:
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill()
        for file in handles:file.close()
if __name__=='__main__':main()
