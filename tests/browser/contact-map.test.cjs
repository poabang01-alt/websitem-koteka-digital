const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const reference = 'https://www.google.com/maps/place/Kenyam,+Kec.+Kenyam,+Kabupaten+Nduga,+Papua+Pegunungan/@-4.606634,138.3781112,3960m/data=!3m1!1e3!4m6!3m5!1s0x683c181bf8185751:0x4da75a927488f879!8m2!3d-4.6049794!4d138.3863687!16s%2Fg%2F120nqg16?authuser=0&entry=ttu&g_ep=EgoyMDI2MTAyMC4wIKXMDSoASAFQAw%3D%3D';
const storage = new Map();
const sandbox = {
  window: { addEventListener() {} },
  localStorage: { getItem: key => storage.get(key) ?? null },
  location: { pathname: '/admin/' },
  URL, URLSearchParams, structuredClone
};
vm.runInNewContext(readFileSync('public/assets/koteka-workspace-sync.js', 'utf8'), sandbox);
const workspace = sandbox.window.KotekaWorkspace;

test('contact map defaults to the supplied Kenyam destination in labelled satellite view', () => {
  const map = workspace.contactMap({});
  const embed = new URL(map.embed);

  assert.equal(map.link, reference);
  assert.equal(embed.searchParams.get('q'), '-4.6049794,138.3863687');
  assert.equal(embed.searchParams.get('ll'), '-4.606634,138.3781112');
  assert.equal(embed.searchParams.get('t'), 'h');
  assert.equal(embed.searchParams.get('z'), '14');
  assert.equal(embed.searchParams.get('output'), 'embed');
});

test('dashboard map links move the public pin to the destination rather than the camera coordinates', () => {
  const mapLink = 'https://www.google.com/maps/place/Office/@-4.61,138.37,15z/data=!3d-4.60!4d138.38';
  const map = workspace.contactMap({ mapLink, address: 'Unrelated address' });

  assert.equal(map.link, mapLink);
  assert.equal(new URL(map.embed).searchParams.get('q'), '-4.6,138.38');
});

test('coordinate query links are supported and address copy does not move the selected map', () => {
  const mapLink = 'https://maps.google.com/maps?q=-4.62,138.39';

  assert.equal(new URL(workspace.contactMap({ mapLink }).embed).searchParams.get('q'), '-4.62,138.39');
  assert.equal(workspace.contactMap({ address: 'Edited address' }).embed, workspace.contactMap({}).embed);
});

test('invalid or non-Google locations fall back safely and are flagged for the dashboard', () => {
  for (const mapLink of ['javascript:alert(1)', 'https://evil.test/maps/@-4.6,138.3,14z', 'https://www.google.com/maps?q=91,181', 'https://maps.app.goo.gl/unresolved']) {
    const map = workspace.contactMap({ mapLink });

    assert.equal(map.valid, false, mapLink);
    assert.equal(map.link, reference);
    assert.equal(new URL(map.embed).searchParams.get('q'), '-4.6049794,138.3863687');
  }
});
