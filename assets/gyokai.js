/* ============================================================
   業界マップ：検索フィルタ ＋ 相関図ノードのクリック連動
   - 検索：カード/関係性アイテムをキーワードで絞り込み
   - 図のノード(.node[data-id])クリック → 対応カードへスクロール＋強調
   ============================================================ */
(function () {
  "use strict";

  var $q = document.getElementById("q");
  var $clear = document.getElementById("clear");
  var $count = document.getElementById("count");
  var $empty = document.getElementById("empty");

  // 検索対象：解説カード ＋ 関係性アイテム
  var items = [].slice.call(document.querySelectorAll(".card, .relation-item"));
  // セクション見出し（中身が全部隠れたら見出しも隠す）
  var sections = [].slice.call(document.querySelectorAll(".section-title.sec"));

  function textOf(el) {
    return (el.textContent + " " + (el.getAttribute("data-keywords") || "")).toLowerCase();
  }

  function applySearch() {
    var q = $q.value.trim().toLowerCase();
    var terms = q ? q.split(/[\s　]+/).filter(Boolean) : [];
    var shown = 0;

    items.forEach(function (el) {
      var hay = textOf(el);
      var match = terms.every(function (t) { return hay.indexOf(t) !== -1; });
      el.style.display = match ? "" : "none";
      if (match) shown++;
    });

    // 各セクション（cards / relation-grid）配下に表示要素が無ければ見出しごと隠す
    [].slice.call(document.querySelectorAll(".cards, .relation-grid, .santen-wrap, .note")).forEach(function (grp) {
      if (grp.classList.contains("santen-wrap")) return; // 三店図は常に表示
    });
    toggleSections();

    if (terms.length) {
      $count.textContent = shown + " 件ヒット（「" + $q.value.trim() + "」）";
      $empty.style.display = shown ? "none" : "block";
    } else {
      $count.textContent = "";
      $empty.style.display = "none";
    }
  }

  // 見出し＋直後のグリッドを、中身の有無で表示/非表示
  function toggleSections() {
    var searching = !!$q.value.trim();
    sections.forEach(function (sec) {
      var grid = sec.nextElementSibling;
      // 見出し直後がグリッドでない場合（三店図など）は次を探す
      var visible = false;
      var node = grid;
      while (node && !node.classList.contains("section-title")) {
        if ((node.classList.contains("cards") || node.classList.contains("relation-grid")) ) {
          if ([].slice.call(node.children).some(function (c) { return c.style.display !== "none"; })) visible = true;
        }
        node = node.nextElementSibling;
      }
      sec.style.display = (!searching || visible) ? "" : "none";
    });
  }

  $q.addEventListener("input", applySearch);
  $clear.addEventListener("click", function () { $q.value = ""; applySearch(); $q.focus(); });

  // ── 各カードをクリックで Google 検索（新しいタブ） ──
  [].slice.call(document.querySelectorAll(".card")).forEach(function (card) {
    var h3 = card.querySelector("h3");
    if (!h3) return;
    var term = h3.textContent.trim();
    var url = "https://www.google.com/search?q=" + encodeURIComponent(term + " パチンコ");

    // 既存リンク（広告DBへのリンク等）はカードクリックと二重発火させない
    [].slice.call(card.querySelectorAll("a")).forEach(function (a) {
      a.addEventListener("click", function (e) { e.stopPropagation(); });
    });

    // 見える案内リンクを各カード末尾に追加
    var g = document.createElement("a");
    g.className = "glink";
    g.href = url; g.target = "_blank"; g.rel = "noopener";
    g.textContent = "🔍 Googleで調べる →";
    g.addEventListener("click", function (e) { e.stopPropagation(); });
    card.appendChild(g);

    // カード本体クリックでも Google 検索（テキスト選択中は無視）
    card.style.cursor = "pointer";
    card.title = "クリックで「" + term + "」をGoogle検索";
    card.addEventListener("click", function () {
      var sel = window.getSelection && String(window.getSelection());
      if (sel) return; // 文章を選択しているだけのときは開かない
      window.open(url, "_blank", "noopener");
    });
  });

  // ── 相関図ノードのクリック ──
  var svg = document.querySelector(".diagram-wrap svg");
  if (svg) {
    svg.addEventListener("click", function (e) {
      var node = e.target.closest ? e.target.closest(".node") : null;
      // テキストは pointer-events:none なので通常 rect(.node) が target
      var id = node && node.getAttribute("data-id");
      if (!id) return;
      var card = document.getElementById("card-" + id);
      if (!card) return;
      // 検索中なら解除して全表示に戻す
      if ($q.value.trim()) { $q.value = ""; applySearch(); }
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.remove("flash");
      // リフロー強制してアニメ再発火
      void card.offsetWidth;
      card.classList.add("flash");
      setTimeout(function () { card.classList.remove("flash"); }, 2000);
    });
  }
})();
