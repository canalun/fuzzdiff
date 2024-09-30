(function () {
  const original = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (name.includes("a")) {
      console.log("setAttribute", name, value);
    }
    return original.apply(this, arguments);
  };
})();
