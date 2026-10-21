// Slide navigation, fullscreen, touch, and the controls dialog. Edit slides in index.html, not here.
(() => {
  "use strict";

  const slides = [...document.querySelectorAll("[data-slide]")];
  if (!slides.length) return;

  // Controls markup lives here so index.html holds only slide content.
  document.body.insertAdjacentHTML("afterbegin", `
    <button id="open-controls" class="sr-only controls-launcher" type="button" hidden>Presentation controls</button>
    <p id="instructions" class="sr-only">Use the arrow keys to change slides. Press F for fullscreen or question mark for controls. On a touch screen, swipe left or right.</p>`);
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="controls" aria-labelledby="controls-heading" aria-describedby="controls-intro">
      <h2 id="controls-heading">Presentation controls</h2>
      <p id="controls-intro">Use your keyboard or swipe horizontally on a touch screen.</p>
      <dl>
        <dt><kbd>←</kbd> / <kbd>Page Up</kbd></dt><dd>Previous slide</dd>
        <dt><kbd>→</kbd> / <kbd>Page Down</kbd></dt><dd>Next slide</dd>
        <dt><kbd>Home</kbd> / <kbd>End</kbd></dt><dd>First / last slide</dd>
        <dt><kbd>F</kbd></dt><dd>Toggle fullscreen</dd>
        <dt><kbd>?</kbd></dt><dd>Open these controls</dd>
        <dt><kbd>Esc</kbd></dt><dd>Close controls. The browser also uses Escape to leave fullscreen.</dd>
      </dl>
      <p id="slide-position" class="note"></p>
      <div class="control-buttons">
        <button id="previous" type="button">Previous slide</button>
        <button id="next" type="button">Next slide</button>
        <button id="fullscreen" type="button">Enter fullscreen</button>
      </div>
      <p id="control-status" class="note" role="status" aria-live="polite" aria-atomic="true"></p>
      <button id="close-controls" type="button" autofocus>Close controls</button>
    </dialog>
    <p id="slide-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    <p id="feedback" class="feedback" role="status" aria-live="polite" aria-atomic="true"></p>`);
  const main = document.querySelector("main");
  if (main && !main.hasAttribute("aria-describedby")) main.setAttribute("aria-describedby", "instructions");

  const controls = document.getElementById("controls");
  const launcher = document.getElementById("open-controls");
  const previous = document.getElementById("previous");
  const next = document.getElementById("next");
  const fullscreen = document.getElementById("fullscreen");
  const controlStatus = document.getElementById("control-status");
  const position = document.getElementById("slide-position");
  const announcement = document.getElementById("slide-announcement");
  const feedback = document.getElementById("feedback");
  let current = 0;
  let feedbackTimer;
  let swipe = null;

  function slideName(index) {
    const heading = slides[index].querySelector("h1, h2, h3");
    return heading ? heading.textContent.trim() : "Untitled slide";
  }

  function updateControls() {
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    position.textContent = `Slide ${current + 1} of ${slides.length}: ${slideName(current)}`;
    fullscreen.textContent = document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen";
  }

  function showSlide(index, moveFocus = true) {
    const target = Math.max(0, Math.min(index, slides.length - 1));
    const changed = target !== current;
    current = target;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
      slide.inert = i !== current;
    });
    updateControls();
    if (moveFocus && !controls.open) slides[current].focus({ preventScroll: true });
    if (changed) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      announcement.textContent = position.textContent;
      if (controls.open) controlStatus.textContent = position.textContent;
    }
  }

  function report(message) {
    clearTimeout(feedbackTimer);
    if (controls.open) {
      controlStatus.textContent = message;
      feedback.textContent = "";
    } else {
      feedback.textContent = message;
      feedbackTimer = setTimeout(() => { feedback.textContent = ""; }, 6500);
    }
  }

  function fullscreenAvailable() {
    return typeof document.documentElement.requestFullscreen === "function" && document.fullscreenEnabled !== false;
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (fullscreenAvailable()) {
        await document.documentElement.requestFullscreen();
      } else {
        report("Fullscreen is unavailable here. Use your browser's fullscreen command if it has one.");
      }
    } catch {
      report("The browser could not change fullscreen. Use its fullscreen command or continue in this window.");
    }
  }

  function openControls() {
    if (controls.open) return;
    if (typeof controls.showModal !== "function") {
      report("Controls need a browser with dialog support. Use arrow keys, swipe, or press F for fullscreen.");
      return;
    }
    feedback.textContent = "";
    controlStatus.textContent = fullscreenAvailable()
      ? "Fullscreen needs a key press or button click. Your browser may restrict it."
      : "Fullscreen is unavailable here. Use your browser's fullscreen command if it has one.";
    updateControls();
    controls.showModal();
  }

  slides.forEach((slide, index) => {
    slide.tabIndex = -1;
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    // Authors can use any unique heading IDs. Add one if a new slide omitted it.
    const heading = slide.querySelector("h1, h2, h3");
    if (heading && !slide.hasAttribute("aria-labelledby")) {
      if (!heading.id) heading.id = `presentation-heading-${index + 1}`;
      slide.setAttribute("aria-labelledby", heading.id);
    }
  });
  document.documentElement.classList.add("presenting");
  launcher.hidden = false;
  showSlide(0, false);

  launcher.addEventListener("click", openControls);
  document.getElementById("close-controls").addEventListener("click", () => controls.close());
  controls.addEventListener("close", () => slides[current].focus({ preventScroll: true }));
  previous.addEventListener("click", () => showSlide(current - 1));
  next.addEventListener("click", () => showSlide(current + 1));
  fullscreen.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    updateControls();
    report(document.fullscreenElement ? "Fullscreen started. Press Escape to leave." : "Fullscreen ended.");
  });

  const typingTarget = "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='slider'], [role='spinbutton']";
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    // The ? shortcut commonly needs Shift; leave other shifted shortcuts alone.
    if (event.shiftKey && event.key !== "?") return;
    if (event.target instanceof Element && event.target.closest(typingTarget)) return;
    if (controls.open) return; // Native dialog handles Escape and focus containment.

    switch (event.key) {
      case "ArrowLeft": case "PageUp":
        event.preventDefault(); showSlide(current - 1); break;
      case "ArrowRight": case "PageDown":
        event.preventDefault(); showSlide(current + 1); break;
      case "Home":
        event.preventDefault(); showSlide(0); break;
      case "End":
        event.preventDefault(); showSlide(slides.length - 1); break;
      case "f": case "F":
        event.preventDefault(); if (!event.repeat) toggleFullscreen(); break;
      case "?":
        event.preventDefault(); if (!event.repeat) openControls(); break;
    }
  });

  // Horizontal swipes navigate; vertical scrolling, zooming, and links keep their behavior.
  const interactiveTarget = `${typingTarget}, a, button, summary, video, audio, [role='button']`;
  document.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    swipe = null;
    if (!event.isPrimary || controls.open || event.target.closest(interactiveTarget)) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  document.addEventListener("pointercancel", () => { swipe = null; });
  document.addEventListener("pointerup", event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (controls.open || event.target.closest(interactiveTarget)) return;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showSlide(current + (dx < 0 ? 1 : -1));
    }
  });
})();
