(function () {
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (name.includes("a")) {
      const arr = [];
      for (let i = 0; i < 2; i++) {
        arr.push(i);
      }
    }
    return originalSetAttribute.apply(this, arguments);
  };

  const originalAppendChild = Element.prototype.appendChild;
  Element.prototype.appendChild = function (child) {
    if (child.tagName === "DIV") {
      "aaa".includes("a");
    }
    return originalAppendChild.apply(this, arguments);
  };

  const originalGet = Map.prototype.get;
  Map.prototype.get = function (key) {
    return originalGet.apply(this, arguments);
  };
})();
