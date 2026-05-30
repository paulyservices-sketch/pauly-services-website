(function () {
  fetch('./prices.json')
    .then(function (r) { return r.json(); })
    .then(function (pb) {
      document.querySelectorAll('[data-pb-name]').forEach(function (el) {
        var name = el.getAttribute('data-pb-name');
        var val = pb[name];
        if (val === undefined) return;
        var price = Math.round(val);
        var child = el.querySelector('.pb-price');
        if (child) {
          child.textContent = price;
        } else {
          el.textContent = '$' + price;
        }
      });
    })
    .catch(function () {}); // hardcoded fallback stays visible on failure
})();
