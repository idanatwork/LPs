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
    var stone = document.createElement("p");
    stone.className = "site-credit stone-credit";
    stone.appendChild(document.createTextNode("מרקם האבן מבוסס על "));
    var photo = document.createElement("a");
    photo.href = "https://commons.wikimedia.org/wiki/File:%D7%90%D7%91%D7%A0%D7%99_%D7%94%D7%9B%D7%95%D7%AA%D7%9C_%D7%94%D7%9E%D7%A2%D7%A8%D7%91%D7%99.jpg";
    photo.target = "_blank";
    photo.rel = "noopener";
    photo.title = "Morany84";
    photo.textContent = "צילום בוויקישיתוף";
    stone.appendChild(photo);
    stone.appendChild(document.createTextNode(" לפי "));
    var license = document.createElement("a");
    license.href = "https://creativecommons.org/licenses/by-sa/4.0/deed.he";
    license.target = "_blank";
    license.rel = "noopener";
    license.title = "CC BY-SA 4.0";
    license.textContent = "רישיון ייחוס ושיתוף";
    stone.appendChild(license);
    var main = document.querySelector("main");
    (main || document.body).appendChild(credit);
    (main || document.body).appendChild(stone);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", place);
  else place();
})();
