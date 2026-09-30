"""Exercise exam startup in Edge, both directly from disk and over HTTP."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
import threading


root = Path(__file__).resolve().parents[1]
edge = Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
checks = r"""
<script>
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = () => new Promise(resolve => setTimeout(resolve, 20));
  try {
    for (const category of Object.keys(categoryFiles)) {
      resetToLogin();
      showExamSummary({ dni: '00123456', type: 'I A' });
      summaryCategory.textContent = category;
      examAnswers.stale = 'a';
      startExam.click();
      assert(startExam.disabled, 'Button should disable while loading');
      startExam.click();
      while (startExam.disabled) await wait();
      assert(!examScreen.hidden && examSummary.hidden, 'Exam failed to open: ' + category);
      assert(questionBank.length === 40, 'Expected 40 questions: ' + category);
      assert(questionText.textContent.length > 5, 'Missing question text');
      assert(questionOptions.querySelectorAll('input').length >= 2, 'Missing answers');
      assert(questionCounter.textContent === '1/40', 'Wrong first question');
      assert(answerCount.textContent === '0/40' && finishExam.disabled, 'Stale answer state');
      assert(examTimer.textContent === '00:40:00', 'Timer did not start');
      document.querySelector('#nextQuestion').click();
      assert(questionCounter.textContent === '2/40', 'Navigation failed');
    }
    resetToLogin();
    showExamSummary({ dni: '00123456', type: 'I A' });
    const originalLoader = loadQuestionBank;
    for (const payload of [null, { generales: [], especificas: [] }]) {
      loadQuestionBank = () => payload ? Promise.resolve(payload) : Promise.reject(new Error('Test failure'));
      await openQuestionBank();
      assert(!examSummary.hidden && examScreen.hidden, 'Error should keep summary visible');
      assert(startExamMessage.textContent && !startExam.disabled, 'Error should allow retry');
    }
    loadQuestionBank = originalLoader;
    await openQuestionBank();
    assert(!examScreen.hidden && !startExamMessage.textContent, 'Retry failed');
    clearInterval(window.examTimerInterval);
    const pressEnter = (target = document.body, repeat = false) => target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, repeat })
    );
    pressEnter();
    assert(questionIndex === 0, 'Enter should wait for an answer');
    const selectedOption = questionOptions.querySelector('input');
    selectedOption.click();
    pressEnter(selectedOption, true);
    assert(questionIndex === 0, 'Holding Enter should not skip questions');
    pressEnter(selectedOption);
    assert(questionIndex === 1, 'Enter after clicking an answer should advance once');
    assert(examAnswers[questionBank[0].ref] === selectedOption.value, 'Enter should preserve the answer');
    questionIndex = questionBank.length - 1;
    renderQuestion();
    questionOptions.querySelector('input').click();
    pressEnter();
    assert(questionIndex === questionBank.length - 1 && finishScreen.hidden, 'Enter should not finish the exam');
    questionIndex = 0;
    renderQuestion();
    const card = document.querySelector('#questionCard');
    const navigation = document.querySelector('.question-navigation');
    const main = document.querySelector('.exam-main');
    questionImage.hidden = true;
    const compactHeight = card.getBoundingClientRect().height;
    const compactNavigationTop = navigation.getBoundingClientRect().top;
    questionImage.src = 'assets/img/avatar-placeholder.png';
    questionImage.hidden = false;
    await questionImage.decode();
    const expandedHeight = card.getBoundingClientRect().height;
    const navigationMovement = navigation.getBoundingClientRect().top - compactNavigationTop;
    assert(expandedHeight > compactHeight, 'Card should grow with an image');
    assert(Math.abs(navigationMovement - (expandedHeight - compactHeight)) < 2, 'Navigation should follow card height');
    questionImage.hidden = true;
    assert(Math.abs(card.getBoundingClientRect().height - compactHeight) < 2, 'Card should shrink without an image');
    questionText.textContent = 'Pregunta extensa para comprobar el ajuste del contenido. '.repeat(150);
    assert(card.getBoundingClientRect().height > compactHeight, 'Card should grow with long text');
    assert(card.scrollHeight <= card.clientHeight + 1, 'Question card should not scroll internally');
    finishExam.classList.remove('is-hidden');
    assert(finishExam.getBoundingClientRect().top >= navigation.getBoundingClientRect().bottom - 1, 'Finish button should follow navigation');
    main.scrollTop = main.scrollHeight;
    assert(main.scrollTop > 0, 'Long questions should allow scrolling the main panel');
    const zoom = document.querySelector('.exam-zoom').getBoundingClientRect();
    assert(zoom.bottom <= main.getBoundingClientRect().bottom + 1, 'Bottom controls should remain reachable');
    document.body.innerHTML = '<pre id="test-result">PASS: all categories, double click, timer, navigation, reset, errors and retry</pre>';
  } catch (error) {
    document.body.innerHTML = '<pre id="test-result">FAIL: ' + error.message + '</pre>';
  }
})();
</script>
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
test_path = None
try:
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', prefix='exam-check-',
                                     dir=root, encoding='utf-8', delete=False) as page:
        test_path = Path(page.name)
        page.write((root / 'index.html').read_text(encoding='utf-8').replace('</body>', checks + '</body>'))
    for url, size in [(test_path.as_uri(), '1366,900'),
                      (f'http://127.0.0.1:{server.server_port}/{test_path.name}', '390,844')]:
        with tempfile.TemporaryDirectory(prefix='exam-edge-') as profile:
            result = subprocess.run(
                [str(edge), '--headless', '--disable-gpu', '--no-first-run',
                 '--no-default-browser-check', f'--user-data-dir={profile}',
                 '--dump-dom', '--virtual-time-budget=5000', f'--window-size={size}', url],
                capture_output=True, encoding='utf-8', errors='replace', timeout=45,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            if '<pre id="test-result">PASS:' not in result.stdout:
                raise RuntimeError(result.stdout[-2500:] + result.stderr[-1500:])
            print(f'PASS ({url.split(":")[0]}, {size}): exam startup, recovery and adaptive layout')
finally:
    server.shutdown()
    server.server_close()
    if test_path:
        test_path.unlink(missing_ok=True)
