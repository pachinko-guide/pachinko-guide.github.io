/* ============================================================
   広告セルフチェック本体
   画像 → 前処理 → OCR(Tesseract.js) → 危険ワード辞書(CHECK_RULES)と照合
   ・OCR結果は編集可（読み取りミスを直して再判定できる）
   ・テキスト直接入力でも判定できる（精度UP）
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
  var $textInput = document.getElementById("textInput");
  var $textRun = document.getElementById("textRun");

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

  // ---- テキスト直接入力で判定 ----
  if ($textRun) {
    $textRun.addEventListener("click", function () {
      var t = ($textInput.value || "").trim();
      if (!t) { $textInput.focus(); return; }
      analyze(t);
    });
  }

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

  // ---- 画像前処理（拡大・グレースケール・コントラスト強調）でOCR精度UP ----
  function preprocess(url) {
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          try {
            // 小さい画像は拡大、大きすぎる画像は縮小（OCRに効く範囲へ）
            var scale = img.width < 1300 ? Math.min(2.4, 1300 / img.width)
                       : (img.width > 2400 ? 2400 / img.width : 1);
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var c = document.createElement("canvas");
            c.width = w; c.height = h;
            var ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            var d = ctx.getImageData(0, 0, w, h), p = d.data;
            for (var i = 0; i < p.length; i += 4) {
              var g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
              g = (g - 128) * 1.45 + 128;          // コントラスト強調
              g = g < 0 ? 0 : g > 255 ? 255 : g;
              p[i] = p[i + 1] = p[i + 2] = g;       // グレースケール化
            }
            ctx.putImageData(d, 0, 0);
            resolve(c);
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = url;
      } catch (e) { resolve(null); }
    });
  }

  // ---- OCR 実行 ----
  $run.addEventListener("click", function () {
    if (!currentURL) return;
    if (typeof Tesseract === "undefined") {
      $status.innerHTML = "OCRライブラリを読み込めませんでした（ネット接続をご確認ください）。下の「文字を直接入力」もご利用いただけます。";
      return;
    }
    $run.disabled = true;
    $status.textContent = "画像を最適化しています…";
    preprocess(currentURL).then(function (canvas) {
      var target = canvas || currentURL;  // 前処理失敗時は元画像
      $status.textContent = "文字を読み取っています…（初回は言語データのDLで少し時間がかかります）";
      return Tesseract.recognize(target, "jpn", {
        logger: function (m) {
          if (m.status === "recognizing text" && m.progress != null) {
            $status.textContent = "文字を読み取っています… " + Math.round(m.progress * 100) + "%";
          } else if (m.status) {
            $status.textContent = jpStatus(m.status) + "…";
          }
        }
      });
    }).then(function (res) {
      $run.disabled = false;
      $status.textContent = "";
      analyze((res && res.data && res.data.text) || "");
    }).catch(function (err) {
      $run.disabled = false;
      $status.innerHTML = "読み取りに失敗しました：" + escapeHtml(String(err && err.message || err)) +
                          "<br>下の「文字を直接入力」で判定できます。";
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
    rawText = rawText || "";
    var norm = normalize(rawText);          // 空白除去・NFKC・小文字（部分一致用）
    var loose = nfkcLower(rawText);         // 構造保持（正規表現用：日付など）
    var rules = window.CHECK_RULES || [];
    var hits = [];

    rules.forEach(function (rule) {
      var matched = [];
      // キーワード（部分一致）
      (rule.words || []).forEach(function (w) {
        var nw = normalize(w);
        if (nw && norm.indexOf(nw) !== -1 && matched.indexOf(w) === -1) matched.push(w);
      });
      // 正規表現パターン（日付・「○の付く日」・設定6 など）
      (rule.patterns || []).forEach(function (ps) {
        try {
          var m = loose.match(new RegExp(ps, "i"));
          if (m && matched.indexOf(m[0]) === -1) matched.push(m[0]);
        } catch (e) {}
      });
      if (matched.length) hits.push({ rule: rule, words: matched });
    });

    var high = hits.filter(function (h) { return h.rule.risk === "high"; });
    var mid = hits.filter(function (h) { return h.rule.risk === "mid"; });

    var html = "";

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

    // 編集可能な判定対象テキスト（OCRミスを直して再判定できる）
    html += '<div class="ocredit-wrap">' +
        '<label class="kw-label" for="ocrEdit">判定に使った文字（間違っていれば直して「再判定」できます）</label>' +
        '<textarea id="ocrEdit" class="ocr-edit">' + escapeHtml(rawText.trim()) + '</textarea>' +
        '<button type="button" id="recheck" class="btn btn-primary">✏️ この内容で再判定</button>' +
      '</div>';

    html += '<div class="disclaimer small">⚠️ この結果は断定ではありません。文字以外の示唆や文脈は判定できていません。最終判断は原典・所轄・遊協にご確認ください。</div>';

    $result.innerHTML = html;
    $result.hidden = false;

    var rc = document.getElementById("recheck");
    if (rc) rc.addEventListener("click", function () {
      var v = document.getElementById("ocrEdit").value;
      analyze(v);
    });

    $result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 空白除去・NFKC・小文字（部分一致用）
  function normalize(s) {
    try { s = s.normalize("NFKC"); } catch (e) {}
    return s.replace(/\s+/g, "").toLowerCase();
  }
  // 構造保持の正規化（正規表現用）
  function nfkcLower(s) {
    try { s = s.normalize("NFKC"); } catch (e) {}
    return s.toLowerCase();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
