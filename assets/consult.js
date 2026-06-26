/* ============================================================
   状況相談ツール（ルールベース）
   入力文 → CONSULT_SCENARIOS で該当パターンを判定 → 根拠とともに提示
   ※ AI不使用・ブラウザ内完結・無料。断定はせず原典確認を促す。
   ============================================================ */
(function () {
  "use strict";

  var $in = document.getElementById("consultInput");
  var $btn = document.getElementById("consultRun");
  var $out = document.getElementById("consultResult");
  if (!$in || !$btn || !$out) return;

  $btn.addEventListener("click", function () { run($in.value || ""); });

  function run(text) {
    text = (text || "").trim();
    if (!text) { $in.focus(); return; }

    var norm = normalize(text);
    var loose = nfkcLower(text);
    var machines = countMachines(loose);
    var dates = countDates(loose);

    var c = {
      norm: norm, loose: loose, machines: machines, dates: dates,
      has: function (w) { return norm.indexOf(normalize(w)) !== -1; },
      re: function (p) { try { return new RegExp(p, "i").test(loose); } catch (e) { return false; } }
    };

    var scenarios = window.CONSULT_SCENARIOS || [];
    var hits = scenarios.filter(function (s) {
      try { return s.test(c); } catch (e) { return false; }
    });
    // osusume-day が出たら osusume-add と重複しやすいので両方出てもOK（観点が違うため残す）

    render(hits, text);
  }

  function render(hits, text) {
    var html = "";
    var ng = hits.filter(function (h) { return h.severity === "ng"; });
    var warn = hits.filter(function (h) { return h.severity === "warn"; });

    var level, cls, msg;
    if (ng.length) {
      level = "ガイドライン上 NG に該当する可能性が高いです"; cls = "lv-high";
      msg = "下記の理由から、禁止または要注意とされる内容に当たる可能性があります。実施前に必ず根拠（原典）と所轄・遊協でご確認ください。";
    } else if (warn.length) {
      level = "やり方次第で問題となる可能性があります"; cls = "lv-mid";
      msg = "ただちにNGとは限りませんが、表現や運用次第で違反となり得ます。下記の条件に注意してください。";
    } else {
      level = "該当しそうな明確なルールは見つかりませんでした"; cls = "lv-ok";
      msg = "入力内容から、よくあるNGパターンには一致しませんでした。ただし、これは“問題なし”の保証ではありません。関連しそうな項目を検索DBでもご確認ください。最終判断は原典・所轄・遊協へ。";
    }
    html += '<div class="summary ' + cls + '"><h2>' + escapeHtml(level) + '</h2><p>' + escapeHtml(msg) + '</p></div>';

    if (hits.length) {
      html += '<h3 class="hits-title">判断のポイント（' + hits.length + '件）</h3>';
      html += ng.concat(warn).map(function (h) {
        var badge = h.severity === "ng"
          ? '<span class="rbadge high">NGの可能性</span>'
          : '<span class="rbadge mid">要注意</span>';
        var refs = (h.refs || []).map(function (r) {
          var href = r.type ? ("index.html?type=" + encodeURIComponent(r.type))
                            : ("index.html?q=" + encodeURIComponent(r.q || ""));
          return '<a class="hit-link" href="' + href + '" target="_blank" rel="noopener">📘 ' + escapeHtml(r.label) + ' →</a>';
        }).join("");
        return '<div class="hitcard ' + h.severity + '">' +
            '<div class="hit-head">' + badge + '<span class="hit-label">' + escapeHtml(h.title) + '</span></div>' +
            '<p class="hit-advice">' + escapeHtml(h.reason) + '</p>' +
            '<div class="consult-refs">' + refs + '</div>' +
          '</div>';
      }).join("");
    } else {
      // 該当なし → キーワードで検索DBへ誘導
      var kw = pickKeywords(text);
      if (kw) {
        html += '<a class="hit-link" style="display:inline-block;margin:6px 0 4px" href="index.html?q=' +
                encodeURIComponent(kw) + '" target="_blank" rel="noopener">🔍 「' + escapeHtml(kw) + '」で検索DBを調べる →</a>';
      }
    }

    html += '<div class="disclaimer small">⚠️ これはルールに基づく一次的な目安で、最終判断ではありません。表現の組み合わせや図柄など、文章だけでは判断できない要素もあります。実施前に必ず原典（ガイドライン）と所轄・遊協にご確認ください。</div>';
    if (window.REPORT) html += window.REPORT.html();

    $out.innerHTML = html;
    $out.hidden = false;
    if (window.REPORT) window.REPORT.wire($out, function () {
      return { kind: "状況相談", input: text,
               result: level + (hits.length ? (" / 該当: " + hits.map(function (h) { return h.title; }).join("、")) : "") };
    });
    $out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 文中の機種名の数（重複除く）
  function countMachines(loose) {
    var list = window.CONSULT_MACHINES || [];
    var seen = {};
    list.forEach(function (m) {
      var k = nfkcLower(m);
      if (k && loose.indexOf(k) !== -1) seen[k] = 1;
    });
    return Object.keys(seen).length;
  }
  // 文中の日付表現の数
  function countDates(loose) {
    var n = 0, m;
    var res = [/\d{1,2}\s*月\s*\d{1,2}\s*日/g, /\d{1,2}\s*\/\s*\d{1,2}/g, /[0-9０-９]\s*の?\s*(つく|付く)日/g];
    res.forEach(function (re) { while ((m = re.exec(loose))) { n++; } });
    return n;
  }
  // 検索DBへ渡すキーワードをざっくり抽出
  function pickKeywords(text) {
    var t = nfkcLower(text);
    var cands = ["おすすめ", "記念日", "周年", "創業", "時差開店", "設定", "取材", "来店", "賞品入荷",
      "景品", "出玉", "差枚", "合算", "天井", "新台", "リニューアル", "イベント", "来店取材"];
    for (var i = 0; i < cands.length; i++) {
      if (t.indexOf(nfkcLower(cands[i])) !== -1) return cands[i];
    }
    return "";
  }

  function normalize(s) {
    try { s = s.normalize("NFKC"); } catch (e) {}
    return s.replace(/\s+/g, "").toLowerCase();
  }
  function nfkcLower(s) {
    try { s = s.normalize("NFKC"); } catch (e) {}
    return String(s).toLowerCase();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
})();
