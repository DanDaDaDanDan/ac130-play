/*
 * packs/shim.js — fetch() over the asset packs, for a build that must run from file://.
 *
 * Copied verbatim into <out>/packs/shim.js by tools/build/singlefile.mjs and loaded FIRST,
 * before the packs and the bundles. This is a CLASSIC script on purpose: file:// pages cannot
 * load ES modules (Chromium blocks them cross-origin), so nothing here may use import/export.
 *
 * WHY IT EXISTS. file:// blocks fetch() of real files, so `public/models/*.glb` and
 * `public/vo/*` ship as base64 data: URIs in `packs/models.js` / `packs/vo.js`, registered on
 * `self.__PACKS__` under their public-relative paths ("models/technical.glb", "vo/b1-ac-roe.ogg").
 * Fetching a data: URI DOES work on file://, so a request whose URL — normalized against the
 * document base, leading "./" and "/" stripped — matches a pack key is served by fetching the
 * registered data: URI instead. Everything else passes through to the original fetch untouched.
 *
 * Both call shapes are handled: a plain URL string and a `Request` object (three.js's
 * FileLoader, under GLTFLoader, uses one). For a pack hit the Request's init is dropped — the
 * game's loaders only ever read the body.
 */
(function () {
  'use strict';
  var packs = (self.__PACKS__ = self.__PACKS__ || {});
  if (typeof self.fetch !== 'function') return;
  var orig = self.fetch.bind(self);

  /* The public-relative key for a request URL, or null when it cannot name a pack entry. */
  function keyFor(rawUrl) {
    var u, base;
    try {
      u = new URL(rawUrl, document.baseURI);
      base = new URL(document.baseURI);
    } catch (e) {
      return null;
    }
    if (u.protocol !== 'file:' && u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    var p;
    // file: pages have origin "null" and match each other; http(s) pages match by real origin.
    if (u.protocol === base.protocol && u.origin === base.origin) {
      var b = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
      p = u.pathname.indexOf(b) === 0 ? u.pathname.slice(b.length) : u.pathname;
    } else {
      p = u.pathname;
    }
    try {
      p = decodeURIComponent(p);
    } catch (e) {
      /* leave it percent-encoded — the keys below are plain ASCII anyway */
    }
    p = p.replace(/^(\.?\/)+/, '');
    return p || null;
  }

  self.fetch = function (input, init) {
    var url = input != null && typeof input === 'object' && typeof input.url === 'string'
      ? input.url
      : input;
    var key = typeof url === 'string' ? keyFor(url) : null;
    if (key && Object.prototype.hasOwnProperty.call(packs, key)) {
      return orig(packs[key]);
    }
    return orig(input, init);
  };
})();
