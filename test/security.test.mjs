import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal,open,stateStore,challenge,equal} from '../server/security.mjs';
test('cifrado y autenticación',()=>{const key=randomBytes(32),data={refresh_token:'test'};const encrypted=seal(data,key);assert.deepEqual(open(encrypted,key),data);assert.throws(()=>open(encrypted,randomBytes(32)));assert.notEqual(encrypted,seal(data,key))});
test('estado ligado a sesión y de uso único',()=>{const store=stateStore(),s=store.create('browser1');assert.equal(store.take(s.state,'browser2'),null);assert.equal(store.take(s.state,'browser1').verifier,s.verifier);assert.equal(store.take(s.state,'browser1'),null)});
test('PKCE y comparación',()=>{assert.equal(challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');assert.equal(equal('abc','abc'),true);assert.equal(equal('abc','abcd'),false)});
