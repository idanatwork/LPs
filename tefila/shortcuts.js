/* The prayer-focus feature was removed. This stub stays so old pages and old shortcuts that still
   open ?focus=on or ?focus=off do nothing visible: it only clears the leftover flags and the query. */
(function () {
  try {
    localStorage.removeItem("tefilaFocus");
    localStorage.removeItem("tefilaReturn");
    var q = new URLSearchParams(location.search);
    if (q.has("focus")) {
      q.delete("focus");
      var s = q.toString();
      history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
    }
  } catch (e) {}
})();
