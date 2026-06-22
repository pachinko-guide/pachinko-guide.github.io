/* ============================================================
   広告セルフチェック本体
   画像 → OCR(Tesseract.js) → 危険ワード辞書(CHECK_RULES)と照合 → 結果表示
   ※ 文字ベースの一次チェック。図柄の示唆は判定不可。断定もしない。
   ============================================================ */
(function () {
  "use strict";

  var $drop = document.getElementById("drop");
  var $file = document.getElementById("file");
  var $pick = document.getElementById("pick");
  var $work = document.getElementById("work");
  var $preview = document.getElementById("preview");
  var $run = document.getElementById("run");
  var $reset = document.getElementById("reset");
  var $status = document.getElementById("status");
  var $result = document.getElementById("result");

  var currentURL = null;

  // ---- 画像の受け取り ----
  $pick.addEventListener("click", function () { $file.click(); });
  $file.addEventListener("change", function () { if ($file.files[0]) loadImage($file.files[0]); });

  $drop.addEventListener("dragover", function (e) { e.preventDefault(); $drop.classList.add("over"); });
  $drop.addEventListener("dragleave", function () { $drop.classList.remove("over"); });
  $drop.addEventListener("drop", function (e) {
    e.preventDefault(); $drop.classList.remove("over");
    var f = e.dataTransfer.files[0];
    if (f && f.type.indexOf("image/") === 0) loadImage(f);
  });
  document.addEventListener("paste", function (e) {
    var items = (e.clipboardData || {}).items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image/") === 0) { loadImage(items[i].getAsFile()); break; }
    }
  });

  function loadImage(file) {
    if (currentURL) URL.revokeObjectURL(currentURL);
    currentURL = URL.createObjectURL(file);
    $preview.src = currentURL;
    $work.hidden = false;
    $result.hidden = true;
    $result.innerHTML = "";
    $status.textContent = "";
    $work.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $reset.addEventListener("click", function () {
    $work.hidden = true; $result.hidden = true; $file.value = "";
    if (currentURL) { URL.revokeObjectURL(currentURL); currentURL = null; }
    $drop.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---- OCR 実行 ----
  $run.addEventListener("click", function () {
    if (!currentURL) return;
    if (typeof Tesseract === "undefined") {
      $status.innerHTML = "OCRライブラリを読み込めませんでした（ネット接続をご確認ください）。";
      return;
    }
    $run.disabled = true;
    $status.textContent = "文字を読み取っています…（初回は言語データのダウンロードで少し時間がかかります）";
    Tesseract.recognize(currentURL, "jpn", {
      logger: function (m) {
        if (m.status === "recognizing text" && m.progress != null) {
          $status.textContent = "文字を読み取っています… " + Math.round(m.progress * 100) + "%";
        } else if (m.status) {
          $status.textContent = jpStatus(m.status) + "…";
        }
      }
    }).then(function (res) {
      $run.disabled = false;
      $status.textContent = "";
      analyze(res.data.text || "");
    }).catch(function (err) {
      $run.disabled = false;
      $status.innerHTML = "読み取りに失敗しました：" + escapeHtml(String(err && err.message || err));
    });
  });

  function jpStatus(s) {
    var map = {
      "loading tesseract core": "エンジン読み込み",
      "initializing tesseract": "初期化",
      "loading language traineddata": "言語データ取得",
      "initializing api": "準備",
      "recognizing text": "読み取り"
    };
    return map[s] || s;
  }

  // ---- 照合・結果表示 ----
  function analyze(rawText) {
    var norm = normalize(rawText);
    var rules = window.CHECK_RULES || [];
    var hits = [];

    rules.forEach(function (rule) {
      var matched = [];
      rule.words.forEach(function (w) {
        var nw = normalize(w);
        if (nw && norm.indexOf(nw) !== -1 && matched.indexOf(w) === -1) matched.push(w);
      });
      if (matched.length) hits.push({ rule: rule, words: matched });
    });

    var high = hits.filter(function (h) { return h.rule.risk === "high"; });
    var mid = hits.filter(function (h) { return h.rule.risk === "mid"; });

    var html = "";

    // サマリー
    var level, cls, msg;
    if (high.length) {
      level = "違反の可能性がある表現が見つかりました"; cls = "lv-high";
      msg = "下記の表現は、ガイドラインで禁止・注意とされる内容に該当する可能性があります。掲示前に必ず原典と所轄・遊協で確認してください。";
    } else if (mid.length) {
      level = "注意が必要な表現が見つかりました"; cls = "lv-mid";
      msg = "ただちに違反とは限りませんが、表現の組み合わせ次第で問題となる可能性があります。";
    } else {
      level = "明らかな危険ワードは検出されませんでした"; cls = "lv-ok";
      msg = "あくまで文字ベースのチェックです。図柄・絵柄・レインボー柄などによる示唆や、文脈・組み合わせは判定できていません。安全を保証するものではありません。";
    }
    html += '<div class="summary ' + cls + '"><h2>' + escapeHtml(level) + '</h2><p>' + escapeHtml(msg) + '</p></div>';

    // ヒット一覧
    if (hits.length) {
      html += '<h3 class="hits-title">該当しそうなポイント（' + hits.length + '件）</h3>';
      html += high.concat(mid).map(function (h) {
        var r = h.rule;
        var badge = r.risk === "high"
          ? '<span class="rbadge high">違反の可能性</span>'
          : '<span class="rbadge mid">要注意</span>';
        var found = h.words.map(function (w) { return '<span class="kw">' + escapeHtml(w) + '</span>'; }).join("");
        return '<div class="hitcard ' + r.risk + '">' +
            '<div class="hit-head">' + badge +
              '<span class="hit-label">' + escapeHtml(r.label) + '</span>' +
              '<span class="hit-type">' + escapeHtml(r.type) + '</span></div>' +
            '<p class="hit-advice">' + escapeHtml(r.advice) + '</p>' +
            '<div class="hit-kw"><span class="kw-label">検出ワード</span>' + found + '</div>' +
            '<a class="hit-link" href="index.html?q=' + encodeURIComponent(r.q) + '" target="_blank" rel="noopener">' +
              '検索DBで関連する事例・Q&Aを見る →</a>' +
          '</div>';
      }).join("");
    }

    // 読み取り結果（確認用）
    var shown = rawText.trim() ? escapeHtml(rawText.trim()) : "（文字を読み取れませんでした。画像が不鮮明・装飾的だと読めない場合があります）";
    html += '<details class="ocrtext"><summary>読み取った文字を見る（OCR結果の確認用）</summary><pre>' + shown + '</pre></details>';

    // 再掲の注意
    html += '<div class="disclaimer small">⚠️ この結果は断定ではありません。文字以外の示唆や文脈は判定できていません。最終判断は原典・所轄・遊協にご確認ください。</div>';

    $result.innerHTML = html;
    $result.hidden = false;
    $result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 全角→半角・カタカナ正規化など（NFKCで丸数字や全角英数も吸収）
  function normalize(s) {
    try { s = s.normalize("NFKC"); } catch (e) {}
    return s.replace(/\s+/g, "").toLowerCase();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
