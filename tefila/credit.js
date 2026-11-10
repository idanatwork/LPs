/* Shared builder credit. Include this script at the end of each page. */
(function () {
  function place() {
    if (document.querySelector(".site-credit")) return;
    var style = document.createElement("style");
    style.textContent = [
      ".site-credit{margin:22px 0 0;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--accent,#1e3a8a) 28%,transparent);font-size:13px;line-height:1.5;font-weight:400;text-align:center;color:var(--muted,#5c5348)}",
      ".site-credit a{color:inherit;text-decoration:none;border-bottom:1px solid color-mix(in srgb,currentColor 45%,transparent)}",
    ].join("");
    document.head.appendChild(style);
    var credit = document.createElement("p");
    credit.className = "site-credit";
    credit.appendChild(document.createTextNode("נבנה ע\"י טק-מייט | "));
    var link = document.createElement("a");
    link.href = "https://brand.page/Tech-Mate";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Tech-Mate";
    credit.appendChild(link);
    var main = document.querySelector("main");
    (main || document.body).appendChild(credit);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", place);
  else place();
})();
