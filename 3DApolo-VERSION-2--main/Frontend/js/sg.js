(function () {
  if (!localStorage.getItem('token')) {
    window.location.replace('/login');
  }
})();