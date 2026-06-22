/* ============================================================
   広告宣伝ガイドライン 検索データベース  アプリ本体
   - data/*.js が window.RECORDS に積んだデータを検索・表示する
   - データを増やしたいときは data/ にファイルを足して
     index.html に <script> を1行追加するだけ（app.js の変更は不要）
   ============================================================ */
(function () {
  "use strict";

  var RECORDS = (window.RECORDS || []).slice();

  // ---- DOM ----
  var $q = document.getElementById("q");
  var $clear = document.getElementById("clear");
  var $results = document.getElementById("results");
  var $count = document.getElementById("count");
  var $empty = document.getElementById("empty");
  var $typeChips = document.getElementById("typeChips");
  var $sourceChips = document.getElementById("sourceChips");
  var $categorySelect = document.getElementById("categorySelect");

  // ---- 状態 ----
  var state = { q: "", type: "all", source: "all", category: "all" };

  // ---- 出典チップを動的生成 ----
  var sources = uniq(RECORDS.map(function (r) { return r.source; }));
  $sourceChips.appendChild(makeChip("すべて", "all", true));
  sources.forEach(function (s) { $sourceChips.appendChild(makeChip(s, s, false)); });

  // ---- カテゴリ選択肢を動的生成 ----
  refreshCategoryOptions();

  // ---- イベント ----
  $q.addEventListener("input", function () { state.q = $q.value.trim(); render(); });
  $clear.addEventListener("click", function () { $q.value = ""; state.q = ""; $q.focus(); render(); });

  $typeChips.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip"); if (!btn) return;
    state.type = btn.dataset.type;
    setActive($typeChips, btn);
    refreshCategoryOptions();
    render();
  });

  $sourceChips.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip"); if (!btn) return;
    state.source = btn.dataset.source;
    setActive($sourceChips, btn);
    refreshCategoryOptions();
    render();
  });

  $categorySelect.addEventListener("change", function () {
    state.category = $categorySelect.value;
    render();
  });

  // ---- 初回描画 ----
  render();

  /* ---------------- 描画 ---------------- */
  function render() {
    var terms = state.q ? state.q.split(/[\s　]+/).filter(Boolean) : [];
    var list = RECORDS.filter(function (r) {
      if (state.type !== "all" && r.type !== state.type) return false;
      if (state.source !== "all" && r.source !== state.source) return false;
      if (state.category !== "all" && r.category !== state.category) return false;
      if (terms.length) {
        var hay = haystack(r);
        for (var i = 0; i < terms.length; i++) {
          if (hay.indexOf(terms[i].toLowerCase()) === -1) return false; // AND 検索
        }
      }
      return true;
    });

    $count.innerHTML = "<b>" + list.length + "</b> 件" +
      (state.q ? "（「" + escapeHtml(state.q) + "」で検索）" : "");

    $results.innerHTML = "";
    if (!list.length) { $empty.hidden = false; return; }
    $empty.hidden = true;

    var frag = document.createDocumentFragment();
    list.forEach(function (r) { frag.appendChild(card(r, terms)); });
    $results.appendChild(frag);
  }

  function card(r, terms) {
    var isQa = r.type === "qa";
    var el = document.createElement("article");
    el.className = "card type-" + r.type;

    var head =
      '<div class="card-head">' +
        '<span class="badge ' + (isQa ? "qa" : "case") + '">' + (isQa ? "Q&amp;A" : "是正勧告事例") + '</span>' +
        '<span class="badge src">' + escapeHtml(r.source) + '</span>' +
        (r.no ? '<span class="badge no">' + escapeHtml(r.no) + '</span>' : '') +
        (r.period ? '<span class="badge period">' + escapeHtml(r.period) + '</span>' : '') +
      '</div>';

    var title = '<h2 class="card-title">' + hl(r.title, terms) + '</h2>';

    var refsHtml = (r.refs && r.refs.length)
      ? '<div class="refs"><span class="refs-label">参照</span>' +
          r.refs.map(function (x) { return '<span class="ref-tag">' + escapeHtml(x) + '</span>'; }).join("") +
        '</div>'
      : '';

    var catTag = '<div class="refs"><span class="refs-label">分類</span>' +
                 '<span class="ref-tag">' + escapeHtml(r.category) + '</span></div>';

    var body =
      '<div class="card-body">' +
        (isQa ? '<span class="answer-label">回答</span>' : '') +
        '<p class="desc">' + hl(r.body || "", terms) + '</p>' +
        catTag + refsHtml +
      '</div>' +
      '<span class="card-toggle">詳しく見る</span>';

    el.innerHTML = head + title + body;

    var toggle = function () { el.classList.toggle("open"); };
    el.querySelector(".card-title").addEventListener("click", toggle);
    el.querySelector(".card-toggle").addEventListener("click", toggle);

    // 検索中は自動で開く
    if (terms.length) el.classList.add("open");
    return el;
  }

  /* ---------------- ユーティリティ ---------------- */
  function haystack(r) {
    return [r.title, r.body, r.category, r.no, r.source, r.period,
            (r.refs || []).join(" "), (r.keywords || []).join(" ")]
      .join(" ").toLowerCase();
  }

  function refreshCategoryOptions() {
    var pool = RECORDS.filter(function (r) {
      if (state.type !== "all" && r.type !== state.type) return false;
      if (state.source !== "all" && r.source !== state.source) return false;
      return true;
    });
    var cats = uniq(pool.map(function (r) { return r.category; }));
    var cur = state.category;
    $categorySelect.innerHTML = '<option value="all">すべての分類</option>';
    cats.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c;
      $categorySelect.appendChild(o);
    });
    // 現在の選択が無くなったら all に戻す
    if (cur !== "all" && cats.indexOf(cur) === -1) state.category = "all";
    $categorySelect.value = state.category;
  }

  function makeChip(label, value, active) {
    var b = document.createElement("button");
    b.className = "chip" + (active ? " is-active" : "");
    b.textContent = label;
    b.dataset.source = value;
    return b;
  }

  function setActive(container, btn) {
    container.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
    btn.classList.add("is-active");
  }

  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ハイライト（HTMLエスケープしてから検索語を <mark>）
  function hl(text, terms) {
    var safe = escapeHtml(text || "");
    if (!terms || !terms.length) return safe;
    var escaped = terms
      .filter(Boolean)
      .map(function (t) { return escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); })
      .sort(function (a, b) { return b.length - a.length; });
    if (!escaped.length) return safe;
    var re = new RegExp("(" + escaped.join("|") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }
})();
