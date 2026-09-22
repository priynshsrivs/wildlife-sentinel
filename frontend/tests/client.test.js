import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, API_BASE, setToken, openAlertSocket } from '../src/api/client.js';
import { mergeAlert } from '../src/utils/alerts.js';

test('credentials go only to configured API', async () => {
  globalThis.window = {location:{href:'http://127.0.0.1:5173'}};
  const calls=[];
  globalThis.fetch=async (url,options)=>{calls.push({url,options});return {ok:true};};
  setToken('test-secret');
  await apiFetch(`${API_BASE}/alerts`);
  await apiFetch('https://other.example/api/alerts');
  await apiFetch('data:image/jpeg;base64,AA');
  assert.equal(calls[0].options.headers.get('Authorization'),'Bearer test-secret');
  assert.equal(calls[1].options.headers.has('Authorization'),false);
  assert.equal(calls[2].options.headers.has('Authorization'),false);
});
test('failed responses are not turned into successes',async()=>{
  globalThis.fetch=async()=>({ok:false,status:403});
  assert.equal((await apiFetch(`${API_BASE}/settings`)).ok,false);
  await assert.rejects(openAlertSocket(),/authentication failed/);
});
test('websocket uses one-use ticket, never role credential in URL',async()=>{
  globalThis.fetch=async()=>({ok:true,json:async()=>({ticket:'one-use-ticket'})});
  globalThis.WebSocket=class {constructor(url){this.url=String(url);}};
  const socket=await openAlertSocket();
  assert.match(socket.url,/ticket=one-use-ticket/);
  assert.ok(!socket.url.includes('test-secret'));
});
test('alert update deduplicates and bounds memory',()=>{
  const old={id:'a',timestamp:'2026-01-01T00:00:00Z',resolved:false};
  const next={...old,resolved:true};
  assert.deepEqual(mergeAlert([old],next),[next]);
  const newer={id:'b',timestamp:'2026-01-02T00:00:00Z'};
  assert.deepEqual(mergeAlert([old],newer,1),[newer]);
});
