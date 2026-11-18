(function () {
  function esc(value) {
    return String(value || "").replace(/[&<>"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  }

  function replaceAfter(root, html) {
    var head = root.querySelector("h2") || root.querySelector("h1");
    if (!head) {
      root.innerHTML = html;
      return;
    }
    while (head.nextSibling) root.removeChild(head.nextSibling);
    var holder = document.createElement("div");
    holder.innerHTML = html;
    while (holder.firstChild) root.appendChild(holder.firstChild);
  }

  function caseCard(row, index) {
    return (
      '<div class="case rv' +
      (index ? " d" + index : "") +
      '"><span class="k">' +
      esc(row.kicker) +
      "</span><b>" +
      esc(row.title) +
      "</b><p>" +
      esc(row.summary) +
      '</p><span class="st">' +
      esc(row.status) +
      "</span></div>"
    );
  }

  function fillCases(boot) {
    var cases = boot.cases || {};
    var customer = document.querySelector("#cases .cases");
    var plant = document.querySelector("#plant .cases");
    if (customer && cases.customer) {
      customer.innerHTML = cases.customer.map(caseCard).join("");
    }
    if (plant && cases.plant) {
      plant.innerHTML = cases.plant.map(caseCard).join("");
    }
  }

  function aboutItem(row) {
    return (
      "<li" +
      (row.wide ? ' class="w2"' : "") +
      '><span class="k">' +
      esc(row.kicker) +
      "</span><div><b>" +
      esc(row.title) +
      "</b>" +
      (row.body ? '<span class="s">' + esc(row.body) + "</span>" : "") +
      "</div></li>"
    );
  }

  function fillAbout(boot) {
    var about = boot.about || {};
    var support = document.querySelector("#ab-support ul");
    var honors = document.querySelector("#ab-honors ul");
    if (support && about.institution) support.innerHTML = about.institution.map(aboutItem).join("");
    if (honors && about.honor) honors.innerHTML = about.honor.map(aboutItem).join("");
    var investors = document.getElementById("ab-investors");
    if (investors && about.investor && about.investor.length) {
      var only = about.investor.length === 1 && !about.investor[0].title;
      replaceAfter(
        investors,
        only
          ? "<p>" + esc(about.investor[0].body) + "</p>"
          : '<ul class="ab-rows ab-grid3">' + about.investor.map(aboutItem).join("") + "</ul>",
      );
    }
    var careers = document.getElementById("careers");
    if (careers && about.job && about.job.length) {
      var intro = about.job.find(function (row) {
        return !row.title;
      }) || about.job[0];
      var jobs = about.job.filter(function (row) {
        return row.title;
      });
      var mail = (boot.site && boot.site.email) || "fathompeak@163.com";
      replaceAfter(
        careers,
        '<p class="q">' +
          esc(intro.kicker || "我们正在招人") +
          "</p><p>" +
          esc(intro.body) +
          "</p>" +
          (jobs.length ? '<ul class="ab-rows">' + jobs.map(aboutItem).join("") + "</ul>" : "") +
          '<p class="ab-cta"><a class="btn black" href="mailto:' +
          esc(mail) +
          '?subject=%E5%BA%94%E8%81%98">加入我们 ↗</a><span>HR 联系：<a class="ul" href="mailto:' +
          esc(mail) +
          '">' +
          esc(mail) +
          "</a></span></p>",
      );
    }
  }

  var plus =
    '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  function fillFaqs(boot) {
    var faqs = boot.faqs || {};
    document.querySelectorAll("[data-placement]").forEach(function (box) {
      var placement = box.getAttribute("data-placement");
      var items = faqs[placement];
      if (!items) return;
      box.querySelectorAll(".q").forEach(function (node) {
        node.remove();
      });
      items.forEach(function (item) {
        var row = document.createElement("div");
        row.className = "q";
        row.innerHTML =
          '<button class="qh" type="button" aria-expanded="false">' +
          plus +
          esc(item.question) +
          '</button><div class="qa"><div>' +
          (item.answer || "") +
          "</div></div>";
        box.appendChild(row);
      });
    });
  }

  function fillLegal(boot) {
    var legal = boot.legal || {};
    ["privacy", "terms"].forEach(function (slug) {
      var root = document.getElementById("legal-" + slug);
      var doc = legal[slug];
      if (!root || !doc || !doc.bodyHtml) return;
      var heading = root.querySelector("h1");
      if (heading) heading.textContent = doc.title || heading.textContent;
      while (heading && heading.nextSibling) root.removeChild(heading.nextSibling);
      var holder = document.createElement("div");
      holder.innerHTML = doc.bodyHtml;
      while (holder.firstChild) root.appendChild(holder.firstChild);
    });
  }

  function fillSite(boot) {
    var site = boot.site || {};
    var publicEmail = site.email || "fathompeak@163.com";
    window.__FP_SITE_EMAIL__ = publicEmail;
    document.querySelectorAll('a[href*="fathompeak@163.com"]').forEach(function (link) {
      link.href = link.getAttribute("href").replace(/fathompeak@163\.com/g, publicEmail);
    });
    document.querySelectorAll('[data-toast*="fathompeak@163.com"]').forEach(function (node) {
      node.setAttribute("data-toast", node.getAttribute("data-toast").replace(/fathompeak@163\.com/g, publicEmail));
    });
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var textNode;
    while ((textNode = walker.nextNode())) {
      if (textNode.parentElement && !textNode.parentElement.closest("script,style") && textNode.nodeValue.indexOf("fathompeak@163.com") >= 0) {
        textNode.nodeValue = textNode.nodeValue.replace(/fathompeak@163\.com/g, publicEmail);
      }
    }
    var mail = document.getElementById("footMail");
    if (mail && site.email) {
      mail.textContent = site.email;
      mail.href = "mailto:" + site.email;
    }
    var addr = document.getElementById("footAddr");
    if (addr && site.address) addr.textContent = site.address;
    var icp = document.getElementById("footIcp");
    if (icp && site.icpNo) {
      icp.textContent = site.icpNo;
      if (site.icpUrl) icp.href = site.icpUrl;
    }
    var company = document.getElementById("footCompany");
    if (company && site.companyName) company.textContent = site.companyName;
    if (site.relayConsoleUrl) {
      document.querySelectorAll("[data-relay-login]").forEach(function (link) {
        link.href = site.relayConsoleUrl;
      });
    }
    var catalogUpdatedOn = site.catalogUpdatedOn || "2026-10-13";
    document.querySelectorAll("[data-catalog-updated-on]").forEach(function (node) {
      node.textContent = catalogUpdatedOn;
    });
  }

  window.fpHydrate = function (boot) {
    if (!boot) return;
    fillCases(boot);
    fillAbout(boot);
    fillFaqs(boot);
    fillLegal(boot);
    fillSite(boot);
  };
})();
