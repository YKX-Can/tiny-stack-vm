// A tiny stack VM for make.fun's tiny-stack-vm-01 ISA, with exact reference semantics.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
function run(p: Uint8Array, q: Uint8Array) {
 const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), O = new Uint8Array(65536);
 let sp = 0, csp = 0, olen = 0, ip = 0, pc = 0, steps = 0;
 const done = (c: number) => ({ o: O.subarray(0, olen), c });
 for (;;) {
  if (steps === 1e6) return done(10);
  if (pc < 0 || pc >= p.length) return done(9);
  const op = p[pc];
  if (!((op <= 7) || (op >= 0x10 && op <= 0x1e) || (op >= 0x20 && op <= 0x22) || (op >= 0x30 && op <= 0x34) || op === 0x40 || op === 0x41 || (op >= 0x50 && op <= 0x53))) return done(5);
  const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
  if (imm > 0 && pc + imm >= p.length) return done(9);
  steps++;
  let pp = 0, pu = 0;
  if (op === 1 || op === 2 || op === 0x52) pu = 1;
  else if (op === 3 || op === 0x50 || op === 0x51 || op === 0x53) pp = 1;
  else if (op === 4) { pp = 1; pu = 2; }
  else if (op === 5) { pp = 2; pu = 2; }
  else if (op === 6) { pp = 2; pu = 3; }
  else if (op === 7) { pp = 3; pu = 3; }
  else if (op === 0x17 || op === 0x1b || op === 0x40) { pp = 1; pu = 1; }
  else if (op >= 0x10 && op <= 0x22) { pp = 2; pu = 1; }
  else if (op === 0x31 || op === 0x32) pp = 1;
  else if (op === 0x41) pp = 2;
  if (sp < pp) return done(2);
  if (sp - pp + pu > 256) return done(3);
  const nx = pc + 1 + imm;
  if (op >= 0x10 && op <= 0x22 && op !== 0x17 && op !== 0x1b) {
   const b = D[sp - 1], a = D[sp - 2];
   let r: number;
   if (op === 0x10) r = a + b;
   else if (op === 0x11) r = a - b;
   else if (op === 0x12) r = Math.imul(a, b);
   else if (op === 0x13) { if (b === 0) return done(4); r = (a / b) | 0; }
   else if (op === 0x14) { if (b === 0) return done(4); r = a % b; }
   else if (op === 0x15) { if (b === 0) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)); }
   else if (op === 0x16) { if (b === 0) return done(4); r = (a >>> 0) % (b >>> 0); }
   else if (op === 0x18) r = a & b;
   else if (op === 0x19) r = a | b;
   else if (op === 0x1a) r = a ^ b;
   else if (op === 0x1c) r = a << (b & 31);
   else if (op === 0x1d) r = a >> (b & 31);
   else if (op === 0x1e) r = a >>> (b & 31);
   else if (op === 0x20) r = a === b ? 1 : 0;
   else if (op === 0x21) r = a < b ? 1 : 0;
   else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
   D[sp - 2] = r; sp--; pc = nx; continue;
  }
  pc = nx;
  switch (op) {
   case 0x00: return done(0);
   case 0x01: D[sp++] = (p[pc - 1] << 24) >> 24; break;
   case 0x02: D[sp++] = p[pc - 4] | (p[pc - 3] << 8) | (p[pc - 2] << 16) | (p[pc - 1] << 24); break;
   case 0x03: sp--; break;
   case 0x04: D[sp] = D[sp - 1]; sp++; break;
   case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
   case 0x06: D[sp] = D[sp - 2]; sp++; break;
   case 0x07: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
   case 0x17: D[sp - 1] = -D[sp - 1]; break;
   case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
   case 0x30: case 0x31: case 0x32: {
    const rel = ((p[pc - 2] | (p[pc - 1] << 8)) << 16) >> 16;
    let take = true;
    if (op !== 0x30) { const v = D[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
    if (take) pc += rel;
    break;
   }
   case 0x33: if (csp === 64) return done(7); C[csp++] = pc; pc = p[pc - 2] | (p[pc - 1] << 8); break;
   case 0x34: if (csp === 0) return done(8); pc = C[--csp]; break;
   case 0x40: { const a = D[sp - 1]; if (a < 0 || a > 255) return done(6); D[sp - 1] = M[a]; break; }
   case 0x41: { const a = D[sp - 1], v = D[sp - 2]; if (a < 0 || a > 255) return done(6); sp -= 2; M[a] = v; break; }
   case 0x50: {
    const s = String(D[sp - 1]);
    if (olen + s.length > 65536) return done(11);
    sp--;
    for (let i = 0; i < s.length; i++) O[olen++] = s.charCodeAt(i);
    break;
   }
   case 0x51: if (olen + 1 > 65536) return done(11); O[olen++] = D[--sp] & 255; break;
   case 0x52: D[sp++] = ip < q.length ? q[ip++] : -1; break;
   case 0x53: return done(D[--sp] & 255);
  }
 }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
 const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
 mkdirSync(join(O, id), { recursive: true });
 writeFileSync(join(O, id, 'stdout.bin'), Buffer.from(r.o));
 writeFileSync(join(O, id, 'exit.txt'), `${r.c}\n`);
}
