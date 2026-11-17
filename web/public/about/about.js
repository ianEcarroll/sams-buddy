// "Back to Buddy": go back to where the reader came from (the app's settings or the team page); otherwise the app's home.
const back = document.getElementById('back');
if (back && document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
  back.addEventListener('click', (e) => { e.preventDefault(); history.back(); });
}
