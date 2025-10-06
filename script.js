const icons = document.querySelectorAll('.icon');
const popups = document.querySelectorAll('.popup');

icons.forEach(icon => {
  icon.addEventListener('click', () => {
    const targetId = icon.getAttribute('data-target');
    const targetPopup = document.getElementById(targetId);

    // close all other popups
    popups.forEach(p => {
      if (p !== targetPopup) p.style.display = 'none';
    });

    // toggle current popup
    targetPopup.style.display = 
      targetPopup.style.display === 'flex' ? 'none' : 'flex';
  });
});

document.addEventListener('click', e => {
  if (!e.target.classList.contains('icon') && !e.target.closest('.popup')) {
    popups.forEach(p => p.style.display = 'none');
  }
});
