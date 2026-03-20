const Y = require('yjs');

const doc1 = new Y.Doc();
const map = doc1.getMap('state');
map.set('data', { a: 1, b: 2, c: { d: 3 } });

const update1 = Y.encodeStateAsUpdate(doc1);
console.log('Initial size:', update1.length);

const doc2 = new Y.Doc();
Y.applyUpdate(doc2, update1);

// Replace entire object
doc1.on('update', (update) => {
  console.log('Replace update size:', update.length);
});
map.set('data', { a: 1, b: 2, c: { d: 4 } });

// Mutate deep object
doc2.on('update', (update) => {
  console.log('Mutate update size:', update.length);
});
map2 = doc2.getMap('state');
// wait, Y.Map doesn't support deep proxying by itself, syncedstore does.
