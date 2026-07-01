/* ============================================================
   禁止ワード・隠語 早見表
   判定辞書 window.CHECK_RULES（広告セルフチェックと共通）から自動生成。
   → check_rules.js に語を足せば、この早見表も自動で増える。
   ============================================================ */
(function () {
  "use strict";
  var rules = (window.CHECK_RULES || []).slice();
  var $list = document.getElementById("ngList");
  var $q = document.getElementById("ngQ");
  var $clear = document.getElementById("ngClear");
  var $count = document.getElementById("ngCount");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    try { s = s.normalize("NFKC"); } catch (e) {}
    return s.toLowerCase();
  }

  function render() {
    var f = norm(($q.value || "").trim());
    var html = "";
    var totalWords = 0, shownCards = 0;

    rules.forEach(function (r) {
      var words = r.words || [];
      var hitWords = f ? words.filter(function (w) { return norm(w).indexOf(f) !== -1; }) : words;
      var labelHit = f && (norm(r.label).indexOf(f) !== -1 || norm(r.advice || "").indexOf(f) !== -1 || norm(r.type || "").indexOf(f) !== -1);
      if (f && !hitWords.length && !labelHit) return;

      var showWords = (f && hitWords.length) ? hitWords : words;
      totalWords += showWords.length; shownCards++;

      var badge = r.risk === "high"
        ? '<span class="rbadge high">違反リスク高</span>'
        : '<span class="rbadge mid">条件次第・要注意</span>';
      var chips = showWords.map(function (w) {
        var hl = (f && norm(w).indexOf(f) !== -1) ? " ngw-hit" : "";
        return '<span class="ngw' + hl + '">' + esc(w) + '</span>';
      }).join("");

      html += '<div class="hitcard ' + r.risk + '">' +
          '<div class="hit-head">' + badge +
            '<span class="hit-label">' + esc(r.label) + '</span>' +
            '<span class="hit-type">' + esc(r.type) + '</span></div>' +
          '<p class="hit-advice">' + esc(r.advice || "") + '</p>' +
          '<div class="ngwords">' + chips + '</div>' +
          '<a class="hit-link" href="index.html?q=' + encodeURIComponent(r.q || "") + '" target="_blank" rel="noopener">' +
            '🔍 検索DBで関連する条文・Q&A・事例を見る →</a>' +
        '</div>';
    });

    if (!html) {
      $list.innerHTML = '<p class="empty" style="display:block">該当する言葉が見つかりませんでした。別のキーワードでお試しください。</p>';
      $count.textContent = "（「" + esc($q.value.trim()) + "」に一致なし）";
      return;
    }
    $list.innerHTML = html;
    $count.innerHTML = (f ? "「" + esc($q.value.trim()) + "」を含む " : "") +
      "<b>" + totalWords + "</b> 語 / " + shownCards + " カテゴリ" +
      (f ? "" : "（広告セルフチェックの判定辞書と連動）");
  }

  $q.addEventListener("input", render);
  $clear.addEventListener("click", function () { $q.value = ""; render(); $q.focus(); });
  render();
})();
