/* =========================================================
 * 天使笑長｜創作工作室 PWA - Service Worker（穩定版）
 * - App Shell 快取：index/manifest/icons
 * - 靜態資源快取：CSS/JS/圖片/字型
 * - 導航請求（開頁）離線時回 index.html
 * - 版本更新：skipWaiting + clientsClaim
 * ========================================================= */

const VERSION = "v1.0.0"; // 你每次改 sw.js 或想強制更新，就改這裡
const CACHE_STATIC = `angel-studio-static-${VERSION}`;
const CACHE_RUNTIME = `angel-studio-runtime-${VERSION}`;

// ✅ 你的檔案都放同一層（repo root），所以用 ./ 最穩（也適用 GitHub Pages 子路徑）
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// 安裝：預快取 App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// 啟用：清掉舊版快取
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("angel-studio-") && ![CACHE_STATIC, CACHE_RUNTIME].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// 取用：
// - 導航請求（開頁）→ 優先網路，失敗回 index（適合 PWA）
// - 靜態資源（js/css/png/svg/woff2...）→ cache-first（更快）
// - 其他 → 網路優先，並放入 runtime cache
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只處理同源（你的 GitHub Pages）
  if (url.origin !== self.location.origin) return;

  // 1) 導航（使用者開頁/換頁） → network-first + fallback index
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_RUNTIME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // 離線時回 index（App Shell）
          const cachedIndex = await caches.match("./index.html");
          return cachedIndex || caches.match("./");
        }
      })()
    );
    return;
  }

  // 2) 靜態資源（副檔名判斷）→ cache-first
  const isStaticAsset = /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2|woff|ttf|otf)$/i.test(url.pathname);
  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_RUNTIME);
        cache.put(req, fresh.clone());
        return fresh;
      })()
    );
    return;
  }

  // 3) 其他（例如 formResponse 之類的外部請求通常不是同源，前面已 return）
  //    這裡對同源 API/其他資源：network-first
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_RUNTIME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match(req)) || Response.error();
      }
    })()
  );
});
