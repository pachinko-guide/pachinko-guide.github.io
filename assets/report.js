/* ============================================================
   判定の「報告」ブロック（共通）
   セルフチェック／状況相談の結果に「🚩 この判定はおかしい？」を付け、
   ワンクリックで担当者宛のメールを開く（宛先・本文入力済み→送信するだけ）。
   コピーも残してある（メールが使えない環境向け）。サーバー不要・無料。
   ============================================================ */
(function () {
  "use strict";
  // 宛先（スパム対策で分割して組み立て・変更はここだけ）
  var REPORT_EMAIL = ["msrk7948", "gmail.com"].join("@");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function buildText(root, ctx) {
    var note = (root.querySelector(".report-note").value || "").trim();
    return "【広告セルフチェック 判定の報告】\n" +
      "日時: " + new Date().toLocaleString("ja-JP") + "\n" +
      "種類: " + (ctx.kind || "") + "\n" +
      "判定した内容:\n" + (ctx.input || "(なし)") + "\n" +
      "判定結果: " + (ctx.result || "(なし)") + "\n" +
      "気づいた点: " + (note || "(記入なし)");
  }

  window.REPORT = {
    html: function () {
      return '<div class="report-block">' +
          '<button type="button" class="report-toggle">🚩 この判定はおかしい？ 報告する</button>' +
          '<div class="report-form" hidden>' +
            '<textarea class="report-note" placeholder="例：「メンテナンス」がNGなのに検出されない／この検出は不要、など（任意）"></textarea>' +
            '<div class="report-actions">' +
              '<button type="button" class="report-mail btn btn-primary">✉️ メールで報告する</button>' +
              '<button type="button" class="report-copy btn">📋 コピーで報告</button>' +
              '<span class="report-msg"></span>' +
            '</div>' +
            '<p class="report-hint">「✉️ メールで報告」を押すとメール画面が開きます（宛先・本文は入力済み）。そのまま送信してください。メールが開かない場合は「📋 コピー」をご利用ください。個人情報は含めないでください。</p>' +
          '</div>' +
        '</div>';
    },
    wire: function (root, getCtx) {
      if (!root) return;
      var tg = root.querySelector(".report-toggle");
      var fm = root.querySelector(".report-form");
      var mail = root.querySelector(".report-mail");
      var copy = root.querySelector(".report-copy");
      var msg = root.querySelector(".report-msg");
      if (!tg || !fm) return;
      tg.addEventListener("click", function () { fm.hidden = !fm.hidden; });

      if (mail) mail.addEventListener("click", function () {
        var txt = buildText(root, getCtx() || {});
        var url = "mailto:" + REPORT_EMAIL +
          "?subject=" + encodeURIComponent("【広告セルフチェック】判定の報告") +
          "&body=" + encodeURIComponent(txt);
        msg.textContent = "✉️ メール画面を開きました。そのまま送信してください。";
        window.location.href = url;
      });

      if (copy) copy.addEventListener("click", function () {
        var txt = buildText(root, getCtx() || {});
        var done = function () { msg.textContent = "✅ コピーしました。担当者にお送りください。"; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(done).catch(function () { fallback(txt, msg); });
        } else { fallback(txt, msg); }
      });
    }
  };

  function fallback(txt, msg) {
    var form = msg.closest(".report-form") || document;
    var out = form.querySelector(".report-output");
    if (!out) {
      out = document.createElement("textarea");
      out.className = "report-output"; out.readOnly = true;
      form.appendChild(out);
    }
    out.value = txt; out.hidden = false;
    out.focus(); out.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    msg.textContent = ok
      ? "✅ コピーしました。担当者にお送りください。"
      : "👇 下の枠の内容を選択してコピーし、担当者にお送りください。";
  }
})();
