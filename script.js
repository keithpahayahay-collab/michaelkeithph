// socials and platform popups
const socialsBtn = document.getElementById('socials-btn');
const socialsRow = document.getElementById('socials-row');
const platformBtns = document.querySelectorAll('.platform-btn');
const platformPopups = document.querySelectorAll('.platform-popup');

// hide all platform popups
function hidePlatformPopups() {
  platformPopups.forEach(p => {
    p.style.display = 'none';
    p.setAttribute('aria-hidden', 'true');
  });
}

// toggle socials row
socialsBtn.addEventListener('click', () => {
  const isOpen = socialsRow.style.display === 'flex';
  hidePlatformPopups();
  socialsRow.style.display = isOpen ? 'none' : 'flex';
  socialsRow.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
});

// toggle each platform popup
platformBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-platform') + '-popup';
    const popup = document.getElementById(id);
    if (!popup) return;
    const wasOpen = popup.style.display === 'flex';
    hidePlatformPopups();
    popup.style.display = wasOpen ? 'none' : 'flex';
    popup.setAttribute('aria-hidden', wasOpen ? 'true' : 'false');
  });
});

// close all popups if clicking outside
document.addEventListener('click', e => {
  const target = e.target;
  if (
    target === socialsBtn ||
    socialsRow.contains(target) ||
    Array.from(platformPopups).some(p => p.contains(target))
  ) return;

  socialsRow.style.display = 'none';
  socialsRow.setAttribute('aria-hidden', 'true');
  hidePlatformPopups();
});
