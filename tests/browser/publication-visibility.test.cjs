const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function publicArticles(content) {
  const sandbox = {
    window: { addEventListener() {} }, localStorage: { getItem: () => JSON.stringify(content) },
    location: { pathname: '/' }, URL, URLSearchParams, structuredClone,
  };
  vm.runInNewContext(readFileSync('public/assets/koteka-workspace-sync.js', 'utf8'), sandbox);
  return sandbox.window.KotekaWorkspace.readPublic({ blogPosts: [{ title: 'Public default' }] }).blogPosts;
}

test('new Operator draft collections preserve existing public defaults', () => {
  const articles = publicArticles({ blogPosts: [{ title: 'Private draft', status: 'Draft' }], _koteka_implicit_collections: ['blogPosts'] });
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Public default');
});

test('Admin draft, archive and explicit empty collections still hide public records', () => {
  for (const blogPosts of [[], [{ title: 'Managed', status: 'Draft' }], [{ title: 'Managed', status: 'Arsip' }]]) {
    assert.equal(publicArticles({ blogPosts }).length, 0);
  }
});
