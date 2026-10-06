// Test input: three enrolled people, the second one claims round 1.
// Usage: node make_input.js [recipientStrkey]
const fs = require('fs');
const path = require('path');
const { recipientField, hasher, buildTree } = require('./lib');

(async () => {
  const H = await hasher();
  const pepper = 424242n;
  const ids = [11111111n, 22222222n, 33333333n];
  const secrets = ids.map((id) => H([id, pepper]));
  const tree = buildTree(H, secrets.map((s) => H([s])));

  const me = 1, roundId = 1n;
  const recipient = process.argv[2] || 'GCBQG6AHWZE3JX5COSRBOYKG6XQKZUNMMTSI5TNRNWJ6TLGIAJ2LPHXP';
  const input = {
    root: tree.root.toString(),
    nullifier: H([secrets[me], roundId]).toString(),
    roundId: roundId.toString(),
    recipient: recipientField(recipient).toString(),
    secret: secrets[me].toString(),
    ...tree.pathFor(me),
  };
  fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'build/input.json'), JSON.stringify(input, null, 2));
  console.log(JSON.stringify({ root: input.root, nullifier: input.nullifier, recipient: input.recipient }));
})();
