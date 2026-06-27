/* ============================================================
   広告宣伝ガイドライン 検索データベース  アプリ本体
   - data/*.js が window.RECORDS に積んだデータを検索・表示する
   - データを増やしたいときは data/ にファイルを足して
     index.html に <script> を1行追加するだけ（app.js の変更は不要）
   ============================================================ */
(function () {
  "use strict";

  var RECORDS = (window.RECORDS || []).slice();

  // 種別ごとの表示メタ（バッジ名・クラス・画像見出し）
  var TYPE_META = {
    qa:        { label: "Q&A",            cls: "qa",        imgLabel: "" },
    case:      { label: "是正勧告事例",     cls: "case",      imgLabel: "該当広告（原典PDFの該当ページ）" },
    guideline: { label: "ガイドライン本文", cls: "guideline", imgLabel: "" },
    appendix:  { label: "別紙（具体例）",   cls: "appendix",  imgLabel: "具体例の図版（別紙の該当ページ）" }
  };

  // ---- 関連項目の算出（キーワード・分類・参照条文の近さ） ----
  var VOCAB = ["時差開店","おすすめ","設定","高設定","記念日","周年","創業","就任","リニューアル",
    "リフレッシュオープン","取材","来店","公約","インフルエンサー","賞品入荷","景品","入荷","出玉",
    "差枚","ランキング","合算","コンプリート","レインボー","キリン","隠語","メンテナンス","天井",
    "時速","駐車場","新台","当たり絵柄","ステマ","三店","誕生日","グランドオープン","遊技結果",
    "営業時間","遊技機性能","総付景品","設定示唆","おすすめ機種"];
  function _norm(s){ try{ s = s.normalize("NFKC"); }catch(e){} return String(s).replace(/\s+/g,"").toLowerCase(); }
  function _normRef(s){ return _norm(s).replace(/[（）()【】「」・]/g,""); }
  RECORDS.forEach(function (r) {
    var bag = _norm([r.title, r.body, r.category, (r.keywords||[]).join(" ")].join(" "));
    r._terms = VOCAB.filter(function (t) { return bag.indexOf(_norm(t)) !== -1; });
    r._refs = (r.refs||[]).map(_normRef);
  });
  function relatedFor(r) {
    var scored = [];
    for (var i = 0; i < RECORDS.length; i++) {
      var o = RECORDS[i]; if (o.id === r.id) continue;
      var shared = 0, k;
      for (k = 0; k < r._terms.length; k++) if (o._terms.indexOf(r._terms[k]) !== -1) shared++;
      var refov = 0;
      for (k = 0; k < r._refs.length; k++) if (o._refs.indexOf(r._refs[k]) !== -1) refov++;
      var score = shared * 2 + refov * 3 + (o.category === r.category ? 2 : 0);
      if (score > 0) scored.push({ o: o, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 5).map(function (x) { return x.o; });
  }
  function recById(id) { for (var i = 0; i < RECORDS.length; i++) if (RECORDS[i].id === id) return RECORDS[i]; return null; }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"); }

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

  // ---- URLパラメータで初期化（他ページからの遷移用）----
  // 例: ?q=時差開店 / ?type=guideline / ?source=ガイドライン本文(第3版)
  (function initFromUrl() {
    try {
      var p = new URLSearchParams(location.search);
      var q = p.get("q");
      if (q) { state.q = q.trim(); $q.value = state.q; }

      var ty = p.get("type");
      if (ty) {
        var tb = $typeChips.querySelector('[data-type="' + ty + '"]');
        if (tb) { state.type = ty; setActive($typeChips, tb); }
      }

      var src = p.get("source");
      if (src) {
        var sb = [].slice.call($sourceChips.querySelectorAll(".chip")).filter(function (b) {
          return b.dataset.source === src;
        })[0];
        if (sb) { state.source = src; setActive($sourceChips, sb); }
      }

      if (ty || src) refreshCategoryOptions();
    } catch (e) {}
  })();

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
    var meta = TYPE_META[r.type] || TYPE_META.case;
    var isQa = r.type === "qa";
    var imgs = (r.images && r.images.length) ? r.images
             : (window.CASE_IMAGES && CASE_IMAGES[r.id]) ? CASE_IMAGES[r.id]
             : [];
    var el = document.createElement("article");
    el.className = "card type-" + r.type;

    var head =
      '<div class="card-head">' +
        '<span class="badge ' + meta.cls + '">' + escapeHtml(meta.label) + '</span>' +
        '<span class="badge src">' + escapeHtml(r.source) + '</span>' +
        (r.no ? '<span class="badge no">' + escapeHtml(r.no) + '</span>' : '') +
        (r.period ? '<span class="badge period">' + escapeHtml(r.period) + '</span>' : '') +
        (imgs.length ? '<span class="badge img">📷 画像あり</span>' : '') +
      '</div>';

    var title = '<h2 class="card-title">' + hl(r.title, terms) + '</h2>';

    var refsHtml = (r.refs && r.refs.length)
      ? '<div class="refs"><span class="refs-label">参照</span>' +
          r.refs.map(function (x) { return '<span class="ref-tag">' + escapeHtml(x) + '</span>'; }).join("") +
        '</div>'
      : '';

    var catTag = '<div class="refs"><span class="refs-label">分類</span>' +
                 '<span class="ref-tag">' + escapeHtml(r.category) + '</span></div>';

    var imgHtml = imgs.length
      ? '<div class="case-imgs"><span class="refs-label">' + escapeHtml(meta.imgLabel || "画像") + '</span><div class="thumbs">' +
          imgs.map(function (src) {
            return '<img class="thumb" loading="lazy" src="' + escapeHtml(src) +
                   '" alt="該当する広告・具体例の画像">';
          }).join("") +
        '</div></div>'
      : '';

    var body =
      '<div class="card-body">' +
        (isQa ? '<span class="answer-label">回答</span>' : '') +
        '<p class="desc">' + hl(r.body || "", terms) + '</p>' +
        imgHtml + catTag + refsHtml +
        '<div class="related-slot"></div>' +
      '</div>' +
      '<span class="card-toggle">詳しく見る</span>';

    el.innerHTML = head + title + body;
    el.dataset.recId = r.id;

    var toggle = function () {
      el.classList.toggle("open");
      if (el.classList.contains("open")) fillRelated(el, r);
    };
    el.querySelector(".card-title").addEventListener("click", toggle);
    el.querySelector(".card-toggle").addEventListener("click", toggle);
    // サムネクリックで拡大（カードの開閉とは独立）
    el.querySelectorAll(".thumb").forEach(function (im) {
      im.addEventListener("click", function (e) { e.stopPropagation(); openLightbox(im.src); });
    });

    // 検索中は自動で開く（関連項目も埋める）
    if (terms.length) { el.classList.add("open"); fillRelated(el, r); }
    return el;
  }

  /* ---------------- 関連項目の表示・ジャンプ ---------------- */
  function fillRelated(el, r) {
    var slot = el.querySelector(".related-slot");
    if (!slot || slot.dataset.done) return;
    slot.dataset.done = "1";
    var rel = relatedFor(r);
    if (!rel.length) return;
    slot.innerHTML = '<div class="related"><span class="refs-label">🔗 関連する項目</span>' +
      rel.map(function (o) {
        var m = TYPE_META[o.type] || TYPE_META.case;
        return '<a class="rel-item" href="#" data-rel="' + escapeHtml(o.id) + '">' +
            '<span class="rel-badge ' + m.cls + '">' + escapeHtml(m.label) + '</span>' +
            '<span class="rel-t">' + (o.no ? escapeHtml(o.no) + " " : "") + escapeHtml(o.title) + '</span></a>';
      }).join("") + '</div>';
    slot.querySelectorAll(".rel-item").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        showRecord(a.getAttribute("data-rel"));
      });
    });
  }

  function showRecord(id) {
    var sel = '.card[data-rec-id="' + cssEsc(id) + '"]';
    var target = $results.querySelector(sel);
    if (!target) {
      // 現在の絞り込みに無い → 全件表示に戻して出す
      state.q = ""; $q.value = ""; state.type = "all"; state.source = "all"; state.category = "all";
      setActive($typeChips, $typeChips.querySelector('[data-type="all"]'));
      setActive($sourceChips, $sourceChips.querySelector('[data-source="all"]'));
      refreshCategoryOptions();
      render();
      target = $results.querySelector(sel);
    }
    if (!target) return;
    target.classList.add("open");
    fillRelated(target, recById(id));
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("flash");
    void target.offsetWidth;
    target.classList.add("flash");
    setTimeout(function () { target.classList.remove("flash"); }, 2000);
  }

  /* ---------------- 画像の拡大表示（ライトボックス） ---------------- */
  var $lb;
  function openLightbox(src) {
    if (!$lb) {
      $lb = document.createElement("div");
      $lb.className = "lightbox";
      $lb.innerHTML = '<button class="lb-close" aria-label="閉じる">×</button><img class="lb-img" alt="">';
      document.body.appendChild($lb);
      $lb.addEventListener("click", function (e) {
        if (e.target === $lb || e.target.classList.contains("lb-close")) closeLightbox();
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLightbox(); });
    }
    $lb.querySelector(".lb-img").src = src;
    $lb.classList.add("show");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    if ($lb) { $lb.classList.remove("show"); document.body.style.overflow = ""; }
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
