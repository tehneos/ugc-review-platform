/*! Widget za prikaz recenzija. Ugradnja:
 *  <script src="https://.../widget.js" data-widget="JAVNI_KLJUC" async></script>
 *  Neobavezno: data-target="#selektor" (gdje se prikazuje; inače odmah nakon skripte).
 */
(function () {
  "use strict";

  var CSS =
    ":host{all:initial;display:block;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1c1917;line-height:1.45}" +
    "*{box-sizing:border-box}" +
    ".head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin:0 0 12px}" +
    ".avg{font-size:22px;font-weight:700}.count{font-size:14px;color:#57534e}" +
    ".stars{color:#d97706;letter-spacing:1px;font-size:16px;white-space:nowrap}.stars .off{color:#d6d3d1}" +
    ".list{display:grid;gap:12px;margin:0;padding:0;list-style:none}" +
    ".grid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}" +
    ".carousel{grid-auto-flow:column;grid-auto-columns:minmax(240px,80%);overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}" +
    "@media(min-width:640px){.carousel{grid-auto-columns:300px}}" +
    ".card{scroll-snap-align:start;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:16px;font-size:14px}" +
    ".title{font-weight:600;margin:6px 0 0}.body{margin:6px 0 0;white-space:pre-line;overflow-wrap:anywhere}" +
    ".body.clamp{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}" +
    ".more{background:none;border:0;padding:8px 0;margin:0;font:inherit;font-weight:600;color:#0f766e;cursor:pointer}" +
    ".photos{display:flex;gap:6px;margin:10px 0 0}.photos img{width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #e7e5e4;display:block}" +
    ".meta{margin:10px 0 0;font-size:12px;color:#57534e}" +
    ".badge{display:inline-block;margin:8px 0 0;padding:3px 8px;border-radius:999px;background:#f5f5f4;font-size:11px;color:#44403c}" +
    ".empty{font-size:14px;color:#57534e}";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // uvijek textContent: sadržaj recenzije se nikad ne umeće kao HTML
    return n;
  }

  function stars(rating) {
    var s = el("span", "stars");
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", "Ocjena " + rating + " od 5");
    s.appendChild(document.createTextNode("★★★★★".slice(0, rating)));
    s.appendChild(el("span", "off", "★★★★★".slice(rating)));
    return s;
  }

  function render(root, data) {
    var style = el("style");
    style.textContent = CSS;
    root.appendChild(style);

    var count = (data.summary && data.summary.count) || 0;
    if (!count || !data.reviews.length) {
      root.appendChild(el("p", "empty", "Još nema recenzija."));
      return;
    }

    var head = el("div", "head");
    head.appendChild(el("span", "avg", String(data.summary.average).replace(".", ",")));
    head.appendChild(stars(Math.round(data.summary.average)));
    head.appendChild(el("span", "count", "Broj recenzija: " + count));
    root.appendChild(head);

    var list = el("ul", "list " + (data.type === "grid" ? "grid" : "carousel"));
    data.reviews.forEach(function (r) {
      var card = el("li", "card");
      card.appendChild(stars(r.rating));
      if (r.title) card.appendChild(el("p", "title", r.title));
      var body = el("p", "body", r.body);
      card.appendChild(body);
      if (r.body.length > 280) {
        body.classList.add("clamp");
        var more = el("button", "more", "Prikaži više");
        more.type = "button";
        more.addEventListener("click", function () {
          body.classList.remove("clamp");
          more.remove();
        });
        card.appendChild(more);
      }
      if (r.photos.length) {
        var photos = el("div", "photos");
        r.photos.forEach(function (src) {
          var a = el("a");
          a.href = src;
          a.target = "_blank";
          a.rel = "noopener";
          var img = el("img");
          img.src = src;
          img.loading = "lazy";
          img.alt = "Fotografija kupca: " + r.product;
          a.appendChild(img);
          photos.appendChild(a);
        });
        card.appendChild(photos);
      }
      var date = new Date(r.date).toLocaleDateString("hr-HR");
      card.appendChild(el("p", "meta", r.name + " · " + r.product + " · " + date));
      if (r.incentivized) card.appendChild(el("span", "badge", "Proizvod dobiven uz popust ili besplatno, u zamjenu za iskrenu recenziju"));
      list.appendChild(card);
    });
    root.appendChild(list);
  }

  function mount(script) {
    if (script.__reviewsMounted) return;
    script.__reviewsMounted = true;
    var key = script.getAttribute("data-widget");
    if (!key) return;

    var host = document.createElement("div");
    var target = script.getAttribute("data-target");
    var parent = target ? document.querySelector(target) : null;
    if (parent) parent.appendChild(host);
    else script.parentNode.insertBefore(host, script.nextSibling);

    var root = host.attachShadow({ mode: "open" });
    var api = new URL("/api/widget/" + encodeURIComponent(key), script.src).href;
    fetch(api)
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (data && data.reviews) render(root, data);
        else host.remove(); // isključen widget ili nedopuštena domena: ne prikazuje se ništa
      })
      .catch(function () {
        host.remove();
      });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("script[data-widget]"), mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
