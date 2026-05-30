(function () {
  fetch('./prices.json')
    .then(function (r) { return r.json(); })
    .then(function (pb) {

      // 1. Plain elements with data-pb-name — set text to $NNN or just NNN for .pb-price children
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

      // 2. <option> elements with data-pb-option — update displayed text and value string
      document.querySelectorAll('option[data-pb-option]').forEach(function (opt) {
        var name = opt.getAttribute('data-pb-option');
        var val = pb[name];
        if (val === undefined) return;
        var price = Math.round(val);
        // value format is "Service Name — $NNN" — replace the dollar amount
        opt.value = name + ' — $' + price;
        opt.textContent = name + ' — $' + price;
      });

    })
    .catch(function () {}); // hardcoded fallback stays visible on failure
})();
