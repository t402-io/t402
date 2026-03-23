(function(){
  var root = document.documentElement;
  var stored = localStorage.getItem("t402-theme");
  if (stored === "light") root.classList.add("light");
})();
