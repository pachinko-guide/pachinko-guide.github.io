/* ============================================================
   判定の「報告」ブロック（共通）
   セルフチェック／状況相談の結果に「🚩 この判定はおかしい？」を付け、
   報告内容（判定した文章＋結果＋気づいた点）をクリップボードにコピーできる。
   ※ サーバー不要・無料。担当者がコピー内容を受け取りルールを改善する運用。
   ============================================================ */
(function () {
  "use strict";
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  window.REPORT = {
    // 結果HTMLの末尾に差し込む文字列
    html: function () {
      return '<div class="report-block">' +
          '<button type="button" class="report-toggle">🚩 この判定はおかしい？ 報告する</button>' +
          '<div class="report-form" hidden>' +
            '<textarea class="report-note" placeholder="例：「メンテナンス」がNGなのに検出されない／この検出は不要、など（任意）"></textarea>' +
            '<div class="report-actions">' +
              '<button type="button" class="report-copy btn btn-primary">📋 報告内容をコピー</button>' +
              '<span class="report-msg"></span>' +
            '</div>' +
            '<p class="report-hint">コピーした内容を、このサイトの担当者にお送りください（担当者が判定ルールを改善します）。個人情報は含めないでください。</p>' +
          '</div>' +
        '</div>';
    },
    // innerHTML 設定後に呼ぶ。getCtx() は {kind, input, result} を返す関数
    wire: function (root, getCtx) {
      if (!root) return;
      var tg = root.querySelector(".report-toggle");
      var fm = root.querySelector(".report-form");
      var copy = root.querySelector(".report-copy");
      if (!tg || !fm || !copy) return;
      tg.addEventListener("click", function () { fm.hidden = !fm.hidden; });
      copy.addEventListener("click", function () {
        var ctx = getCtx() || {};
        var note = (root.querySelector(".report-note").value || "").trim();
        var txt = "【広告セルフチェック 判定の報告】\n" +
          "日時: " + new Date().toLocaleString("ja-JP") + "\n" +
          "種類: " + (ctx.kind || "") + "\n" +
          "判定した内容:\n" + (ctx.input || "(なし)") + "\n" +
          "判定結果: " + (ctx.result || "(なし)") + "\n" +
          "気づいた点: " + (note || "(記入なし)");
        var msg = root.querySelector(".report-msg");
        var done = function () { msg.textContent = "✅ コピーしました。担当者にお送りください。"; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(done).catch(function () { fallback(txt, msg); });
        } else {
          fallback(txt, msg);
        }
      });
    }
  };
  function fallback(txt, msg) {
    try {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      msg.textContent = ok ? "✅ コピーしました。担当者にお送りください。" : "コピーできませんでした。手動で選択してください。";
    } catch (e) {
      msg.textContent = "コピーできませんでした。手動で選択してください。";
    }
  }
})();
