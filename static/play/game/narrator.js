/* ============================================================================
   narrator.js — the manga panel. dhilipsiva's outlined face + speech bubble.
   Core conceit: SHORT text → the face is big. LONGER text → the camera
   "zooms out": face shrinks, bubble takes the space.

   API (used by engine.js / brain.js):
     Narrator.speak(lines, opts?)   lines: string | string[]
     Narrator.advance()             [space] — finish typing, or next line, or close
     Narrator.thinking(on)          spinner state while the SLM computes
     Narrator.close()
     Narrator.isOpen / Narrator.hasQueue
   ========================================================================== */

window.Narrator = (function () {

  const el = {};
  let queue = [], typing = null, openFlag = false, sourceTag = '';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    el.panel = document.getElementById('manga');
    el.text = el.panel.querySelector('.manga__text');
    el.more = el.panel.querySelector('.manga__more');
    el.src = el.panel.querySelector('.manga__src');
    el.panel.addEventListener('click', () => advance());
  }

  /* face size buckets — the manga zoom */
  function sizeFor(line) {
    const n = line.length;
    if (n <= 90) return 'xl';
    if (n <= 180) return 'lg';
    if (n <= 300) return 'md';
    return 'sm';
  }

  function stopTyping() {
    if (typing) { clearInterval(typing.timer); typing = null; }
    el.panel.classList.remove('manga--talking');
  }

  function showLine(line) {
    el.panel.dataset.size = sizeFor(line);
    el.more.dataset.state = queue.length ? 'more' : 'end';
    el.text.textContent = '';
    el.panel.classList.remove('manga--think');
    stopTyping();
    if (reduced) { el.text.textContent = line; return; }
    let i = 0;
    el.panel.classList.add('manga--talking');
    typing = { line, timer: setInterval(() => {
      i = Math.min(line.length, i + 3);
      el.text.textContent = line.slice(0, i);
      if (i >= line.length) stopTyping();
    }, 16) };
  }

  function speak(lines, opts = {}) {
    if (typeof lines === 'string') lines = [lines];
    queue = lines.slice();
    sourceTag = opts.source || '';
    el.src.textContent = sourceTag;
    openFlag = true;
    el.panel.hidden = false;
    el.panel.classList.add('manga--in');
    showLine(queue.shift());
  }

  function advance() {
    if (!openFlag) return false;
    if (typing) {                       // skip to full line
      const full = typing.line; stopTyping(); el.text.textContent = full;
      return true;
    }
    if (queue.length) { showLine(queue.shift()); return true; }
    close();
    return true;
  }

  function thinking(on) {
    if (on) {
      queue = []; stopTyping();
      openFlag = true; el.panel.hidden = false;
      el.panel.classList.add('manga--in', 'manga--think');
      el.panel.dataset.size = 'xl';
      el.src.textContent = '';
      el.text.innerHTML = '<span class="think-dots"><i>·</i><i>·</i><i>·</i></span>';
      el.more.dataset.state = 'end';
    } else {
      el.panel.classList.remove('manga--think');
    }
  }

  function close() {
    stopTyping(); queue = []; openFlag = false;
    el.panel.classList.remove('manga--in', 'manga--think');
    el.panel.hidden = true;
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    speak, advance, thinking, close,
    get isOpen() { return openFlag; },
    get hasQueue() { return queue.length > 0 || !!typing; }
  };
})();
