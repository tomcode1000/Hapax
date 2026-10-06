// Writes stellar-cli JSON args from build/ (vkey, proof, public signals) and
// the demo commitments. Usage: node cli_args.js  -> build/cli/*.json
const fs = require('fs'), path = require('path');
const { hasher } = require('./lib');
const u = require('../ref-zk-vote/circuits/conversion-utils.js');
const strip = (h) => h.replace(/^0x/, '');
(async () => {
  const H = await hasher();
  const out = path.join(__dirname, 'build/cli');
  fs.mkdirSync(out, { recursive: true });
  const vk = u.convertVKeyToSoroban(require('./build/vkey.json'));
  const pr = u.convertProofToSoroban(require('./build/proof.json'));
  const pub = require('./build/public.json');
  const w = (n, v) => fs.writeFileSync(path.join(out, n), typeof v === 'string' ? v : JSON.stringify(v));
  w('vk.json', { alpha: strip(vk.alpha), beta: strip(vk.beta), gamma: strip(vk.gamma), delta: strip(vk.delta), ic: vk.ic.map(strip) });
  w('proof.json', { a: strip(pr.a), b: strip(pr.b), c: strip(pr.c) });
  w('root.txt', pub[0]);
  w('nullifier.txt', pub[1]);
  const pepper = 424242n;
  [11111111n, 22222222n, 33333333n].forEach((id, i) => w(`commitment${i}.txt`, H([H([id, pepper])]).toString()));
  console.log('cli args written');
})();
