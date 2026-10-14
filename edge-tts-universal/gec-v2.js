// JavaScript port of rany2/edge-tts 7.3.1's Sec-MS-GEC v2 token algorithm.
// The upstream implementation is licensed under LGPL-3.0-only.

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;
const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a,
  0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
];
const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba,
  0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
  0xd258b060, 0x72766564,
];
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const SHA256_ADJUSTMENT = 0xc9dc06a7;
const SHA256_BLOCK_CONSTANTS = SHA256_ROUND_CONSTANTS.slice();
SHA256_BLOCK_CONSTANTS[14] = SHA256_ADJUSTMENT;
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;

const CS64_COEFFICIENTS = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d],
  [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c],
  [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464],
  [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
const CS64_ADJUSTMENT1 = 0x0b1a0000;

const u32 = (value) => value >>> 0;
const add32 = (...values) => values.reduce((sum, value) => u32(sum + u32(value)), 0);
const rotr = (value, count) => u32((value >>> count) | (value << (32 - count)));
const rol16 = (value) => u32((value << 16) | (value >>> 16));
const sigma0 = (value) => u32(rotr(value, 7) ^ rotr(value, 18) ^ (value >>> 3));
const sigma1 = (value) => u32(rotr(value, 17) ^ rotr(value, 19) ^ (value >>> 10));

function sha256Rounds(initialState, words, firstRound = 0) {
  let [a, b, c, d, e, f, g, h] = initialState.map(u32);
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  for (let index = firstRound; index < 64; index++) {
    const bigSigma1 = u32(rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25));
    const choose = u32(g ^ (e & (f ^ g)));
    const t1 = add32(h, bigSigma1, choose, constants[index], words[index]);
    const bigSigma0 = u32(rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22));
    const majority = u32((a & b) | (c & (a | b)));
    const t2 = add32(bigSigma0, majority);
    [a, b, c, d, e, f, g, h] = [add32(t1, t2), a, b, c, add32(d, t1), e, f, g];
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSha256Schedule(words, firstWord = 16) {
  for (let index = firstWord; index < 64; index++) {
    words[index] = add32(
      sigma1(words[index - 2]), words[index - 7],
      sigma0(words[index - 15]), words[index - 16],
    );
  }
}

function readUint32BE(bytes, offset) {
  return u32((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
}

function readUint32LE(bytes, offset) {
  return u32(bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24));
}

function sha256Init(data) {
  const words = Array(14).fill(0);
  words.push(u32((data[0] << 16) | (data[1] << 8) | data[2]));
  words.push(readUint32BE(data, 3));
  for (let index = 16; index < 30; index++) {
    const values = [SHA256_SCHEDULE[index - 16]];
    if (index - 2 >= 14) {
      const value = sigma1(words[index - 2]);
      values.push(index === 16 ? u32(value ^ SHA256_SIGMA1_ADJUSTMENT) : value);
    }
    if (index - 7 >= 14) values.push(words[index - 7]);
    if (index - 15 >= 14) {
      const value = sigma0(words[index - 15]);
      values.push(index === 29 ? u32(value ^ SHA256_SIGMA0_ADJUSTMENT) : value);
    }
    words.push(add32(...values));
  }
  words.push(add32(
    sigma1(words[28]), words[23], sigma0(words[15]), words[14],
    SHA256_ADJUSTMENT, u32(-SHA256_ROUND_CONSTANTS[14]),
  ));
  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  return working.map((value, index) => add32(SHA256_INITIAL[index], value));
}

function sha256Digest(data) {
  if (data.length < 7) throw new Error('Token salt must contain at least seven bytes');
  const length = 57 + data.length;
  const zeroCount = ((55 - length) % 64 + 64) % 64;
  const padded = new Uint8Array(data.length - 7 + 1 + zeroCount + 8);
  padded.set(data.subarray(7));
  padded[data.length - 7] = 0x80;
  let bitLength = BigInt(length * 8);
  for (let index = 0; index < 8; index++) {
    padded[padded.length - 1 - index] = Number(bitLength & 0xffn);
    bitLength >>= 8n;
  }
  let state = sha256Init(data.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = [];
    for (let index = 0; index < 16; index++) words.push(readUint32BE(padded, offset + index * 4));
    expandSha256Schedule(words);
    const working = sha256Rounds(state, words);
    state = working.map((value, index) => add32(state[index], value));
  }
  const digest = new Uint8Array(32);
  state.forEach((value, index) => {
    digest[index * 4] = value >>> 24;
    digest[index * 4 + 1] = value >>> 16;
    digest[index * 4 + 2] = value >>> 8;
    digest[index * 4 + 3] = value;
  });
  return digest;
}

function wordsLe4Even(data) {
  const paddedLength = Math.ceil(data.length / 4) * 4;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  const words = [];
  for (let offset = 0; offset < padded.length; offset += 4) words.push(readUint32LE(padded, offset));
  if (words.length % 2) words.push(0);
  return words;
}

function cs64Digest(data, digest) {
  const keyA = u32(readUint32LE(digest, 0) | 1);
  const keyB = u32(readUint32LE(digest, 4) | 1);
  const factors = [u32(Math.imul(keyA, CS64_FACTOR)), u32(Math.imul(keyB, CS64_FACTOR))];
  const terms = CS64_COEFFICIENTS.map(([coefficient], index) => u32(Math.imul(coefficient, factors[index % 2])));
  const offsets = CS64_COEFFICIENTS.map(([, offset]) => offset);
  const salted = new Uint8Array(data.length + 1);
  salted.set(data, 1);
  wordsLe4Even(salted).forEach((word, index) => {
    let term = u32(Math.imul(word, index % 2 === 0 ? keyA : keyB));
    let offset = u32(Math.imul(rol16(word), index % 2 === 0 ? 0xef0569fb : 0xc31713db));
    if (index === 0) {
      term = add32(term, Math.imul(CS64_ADJUSTMENT0, factors[0]));
      offset = add32(offset, CS64_ADJUSTMENT1);
    }
    terms.push(term);
    offsets.push(offset);
  });
  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index];
    const y = terms[index + 1];
    let t = rol16(add32(offsets[index], x));
    let q = u32(Math.imul(t, 0x76f50f34));
    swapAcc = add32(swapAcc, Math.imul(rol16(q), 0xc3efea97), q);
    t = rol16(add32(offsets[index + 1], y));
    q = u32(Math.imul(t, 0x1881ce3c));
    swapLast = add32(Math.imul(rol16(q), 0x35bd1ec9), q);
    swapAcc = add32(swapAcc, swapLast);

    state = add32(Math.imul(state, keyA), x);
    state = u32(Math.imul(rol16(state), 0xcf98b111));
    state = u32(Math.imul(rol16(state), 0x87085b9f));
    state = u32(Math.imul(rol16(state), 0x12ceb96d));
    state = u32(Math.imul(rol16(state), 0x257e1d83));
    acc = add32(acc, state);
    t = add32(Math.imul(state, keyB), y);
    t = u32(Math.imul(rol16(t), 0xa27416f5));
    t = u32(Math.imul(rol16(t), 0xd38396ff));
    state = u32(Math.imul(rol16(u32(Math.imul(rol16(t), 0x7c932b89))), 0xbfa49f69));
    acc = add32(acc, state);
  }
  return [u32(swapLast ^ state), u32(swapAcc ^ acc)];
}

function hex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function uint32PairToLittleEndianHex(values) {
  const bytes = new Uint8Array(8);
  values.forEach((value, index) => {
    bytes[index * 4] = value;
    bytes[index * 4 + 1] = value >>> 8;
    bytes[index * 4 + 2] = value >>> 16;
    bytes[index * 4 + 3] = value >>> 24;
  });
  return hex(bytes);
}

export function generateSecMsGecV2(trustedClientToken, unixTimestamp = Date.now() / 1000) {
  let ticks = Number(unixTimestamp) + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;
  const data = new TextEncoder().encode(`${ticks.toFixed(0)}${trustedClientToken}`);
  const digest = sha256Digest(data);
  return `${uint32PairToLittleEndianHex(cs64Digest(data, digest))}-${hex(digest)}`;
}
