function toggleLinks(id) {
  const section = document.getElementById(id);
  const isVisible = section.style.display === "flex";

  // hide all others first
  document.querySelectorAll(".sub-links").forEach(el => el.style.display = "none");

  // show selected if it was hidden
  if (!isVisible) {
    section.style.display = "flex";
  }
}
