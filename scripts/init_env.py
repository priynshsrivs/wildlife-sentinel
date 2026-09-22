"""Generate local credentials without displaying them or overwriting existing configuration."""
import secrets
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    target=ROOT/'.env'
    if target.exists():raise SystemExit('.env already exists; update it manually without overwriting credentials')
    content=(ROOT/'.env.example').read_text(encoding='utf-8')
    for name in ('ADMIN_API_TOKEN','OPERATOR_API_TOKEN','VIEWER_API_TOKEN','SERVICE_API_TOKEN','CAMERA_STREAM_TOKEN'):
        content=content.replace(name+'=\n',name+'='+secrets.token_urlsafe(32)+'\n')
    with target.open('x',encoding='utf-8') as file:file.write(content)
    print('Created .env. Read your role token locally to sign in; never share or commit this file.')
if __name__=='__main__':main()
