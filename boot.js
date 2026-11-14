(function () {
  function load(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error(src));
      };
      document.body.appendChild(script);
    });
  }

  var lang = "zh";
  try {
    lang = localStorage.getItem("fp-lang") || "zh";
  } catch (error) {
    lang = "zh";
  }
  if (lang !== "en") lang = "zh";
  var api = window.FP_API_BASE || "/api/features/open/fathompeak";
  var fallbackFile = lang === "en" ? "fallback-en.json" : "fallback.json";

  fetch(api + "/bootstrap?lang=" + encodeURIComponent(lang))
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(function (body) {
      return body && body.data ? body.data : body;
    })
    .catch(function () {
      return fetch(fallbackFile).then(function (response) {
        return response.ok ? response.json() : {};
      });
    })
    .then(function (boot) {
      window.__FP_BOOT = boot || {};
      window.__FP_BOOT.lang = window.__FP_BOOT.lang || lang;
      window.__FP_BOOT.leadUrl = api + "/leads";
      if (window.fpHydrate) window.fpHydrate(window.__FP_BOOT);
      return load("hydrate.js")
        .then(function () {
          if (window.fpHydrate) window.fpHydrate(window.__FP_BOOT);
          return load("app.js");
        })
        .then(function () {
          return load("home2.js");
        });
    })
    .catch(function (error) {
      console.error(error);
    });
})();
