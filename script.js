// elements
const socialsBtn = document.getElementById('socials-btn');
const socialsRow = document.getElementById('socials-row');
const platformBtns = document.querySelectorAll('.platform-btn');
const platformPopups = document.querySelectorAll('.platform-popup');

// helper: hide all platform popups
function hidePlatformPopups() {
  platformPopups.forEach(p => {
    p.style.display = 'none';
    p.setAttribute('aria-hidden', 'true');
  });
}

// toggle socials row
socialsBtn.addEventListener('click', (e) => {
  const isOpen = socialsRow.style.display === 'flex';
  // close any open platform popups first
  hidePlatformPopups();

  socialsRow.style.display = isOpen ? 'none' : 'flex';
  socialsRow.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
});

// open popup below platform clicked
platformBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const id = btn.getAttribute('data-platform') + '-popup';
    const popup = document.getElementById(id);
    if (!popup) return;

    // toggle only this popup, do not close socials row
    const wasOpen = popup.style.display === 'flex';
    hidePlatformPopups();
    popup.style.display = wasOpen ? 'none' : 'flex';
    popup.setAttribute('aria-hidden', wasOpen ? 'true' : 'false');
  });
});

// click outside closes socials row and popups
document.addEventListener('click', (e) => {
  const target = e.target;
  // if clicked on socials button or inside socials row or inside any popup, ignore
  if (target === socialsBtn || socialsRow.contains(target) || Array.from(platformPopups).some(p => p.contains(target))) {
    return;
  }
  // else hide everything
  socialsRow.style.display = 'none';
  socialsRow.setAttribute('aria-hidden', 'true');
  hidePlatformPopups();
});
