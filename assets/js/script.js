const prelogin = document.querySelector('#prelogin');
const preloginForm = document.querySelector('#preloginForm');
const preloginUser = document.querySelector('#preloginUser');
const preloginPassword = document.querySelector('#preloginPassword');
const preloginMessage = document.querySelector('#preloginMessage');
const PRELOGIN_USERNAME = 'KinkyKing';
const PRELOGIN_PASSWORD = 'Lima@2020!!';

preloginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const validCredentials = preloginUser.value === PRELOGIN_USERNAME
    && preloginPassword.value === PRELOGIN_PASSWORD;

  if (!validCredentials) {
    preloginMessage.textContent = 'USUARIO O CONTRASEÑA INCORRECTOS';
    preloginPassword.select();
    return;
  }

  prelogin.hidden = true;
  appWindow.classList.remove('prelogin-active');
  form.hidden = false;
  preloginForm.reset();
  preloginMessage.textContent = '';
  documentNumber.focus();
});

const form = document.querySelector('#loginForm');
const documentNumber = document.querySelector('#documentNumber');
const message = document.querySelector('#message');
const examStatus = document.querySelector('#examStatus');
const appWindow = document.querySelector('.app-window');
const pageTitle = document.querySelector('#pageTitle');
const examSummary = document.querySelector('#examSummary');
const summaryDni = document.querySelector('#summaryDni');
const summaryName = document.querySelector('#summaryName');
const summaryCategory = document.querySelector('#summaryCategory');
const documentType = document.querySelector('#documentType');

// Show the same accessible error for typing, pasting, and form submission.
form.noValidate = true;

const documentRules = {
  DNI: { length: 8, label: 'DNI' },
  'CARNET DE EXTRANJERIA': { length: 9, label: 'Carnet' }
};
const documentLengths = Object.values(documentRules).map((rule) => rule.length);
const maxDocumentLength = Math.max(...documentLengths);

// Each registered length belongs to one document type.
function documentTypeForLength(length) {
  return Object.keys(documentRules).find((type) => documentRules[type].length === length);
}

function syncDocumentRule() {
  const rule = documentRules[documentType.value];

  // El límite se controla en JavaScript para que al pasar de DNI (8)
  // a Carnet de Extranjería (9) el campo no conserve el límite anterior.
  documentNumber.removeAttribute('maxlength');

  if (rule) {
    documentNumber.pattern = `[0-9]{${rule.length}}`;
    documentNumber.minLength = rule.length;
  } else {
    documentNumber.pattern = '[0-9]+';
    documentNumber.removeAttribute('minlength');
  }
}

function validateDocumentNumber() {
  const value = documentNumber.value;
  const rule = documentRules[documentType.value];
  let error = '';

  if (!value) {
    error = 'Ingrese su número de documento';
  } else if (rule && value.length !== rule.length) {
    error = `${rule.label}: ${rule.length} dígitos`;
  } else if (!rule && documentTypeForLength(value.length)) {
    error = `Seleccione ${documentRules[documentTypeForLength(value.length)].label}`;
  }

  message.textContent = value ? error : '';
  documentNumber.setCustomValidity(error);
  documentNumber.setAttribute('aria-invalid', String(Boolean(error)));
  return !error;
}

syncDocumentRule();

documentNumber.addEventListener('input', () => {
  examStatus.hidden = true;

  const rule = documentRules[documentType.value];
  const digitsOnly = documentNumber.value.replace(/\D/g, '');
  documentNumber.value = rule ? digitsOnly.slice(0, maxDocumentLength) : digitsOnly;

  validateDocumentNumber();
});
documentNumber.addEventListener('blur', validateDocumentNumber);
documentType.addEventListener('change', () => {
  syncDocumentRule();
  examStatus.hidden = true;
  validateDocumentNumber();
});

// Each class has its own sheet; class A is checked first.
const CANDIDATE_SHEETS = [
  {
    url: 'https://docs.google.com/spreadsheets/d/1YX-ZWTGew72RdnnPI2z6KDvw503bkyeXPFBNCFXOA9U/export?format=csv',
    classPrefix: '',
    defaultCategory: '(A) IIb'
  },
  {
    url: 'https://docs.google.com/spreadsheets/d/10YIEYB6o5RVcF4eAJBOa-wNv8I4Krba65pTk4pZgD5I/export?format=csv',
    classPrefix: 'B ',
    defaultCategory: '(B) IIb'
  }
];
const ACTIVE_STATUS = 'EN CURSO';

function parseCsvRows(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  const splitLine = (line) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
  // The category column is optional and is found by its header name.
  const typeIndex = splitLine(lines[0] || '').findIndex((name) => /^(tipo|categor[ií]a)/i.test(name));
  return lines.slice(1).map((line) => {
    const values = splitLine(line);
    return { dni: values[1] || '', status: values[2] || '', type: values[typeIndex] || '' };
  }).filter((candidate) => /^[0-9]+$/.test(candidate.dni) && documentLengths.includes(candidate.dni.length));
}

async function loadSheetCandidates(sheet) {
  try {
    const response = await fetch(sheet.url, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo consultar la hoja');
    return parseCsvRows(await response.text()).map((candidate) => {
      const hasClass = /^\s*(clase\s*)?[ab]/i.test(candidate.type);
      const type = hasClass ? candidate.type : `${sheet.classPrefix}${candidate.type}`;
      return { ...candidate, category: formatCategory(type, sheet.defaultCategory) };
    });
  } catch (error) {
    return [];
  }
}

// One failing sheet must not block people registered in the other one.
function loadCandidates() {
  return Promise.all(CANDIDATE_SHEETS.map(loadSheetCandidates));
}

function isActiveCandidate(candidate) {
  return candidate.status.toUpperCase().replace(/\s+/g, ' ').trim() === ACTIVE_STATUS;
}

function formatCategory(type = '', fallback = '(A) IIb') {
  const normalized = type.toUpperCase().replace(/CLASE|CATEGOR[IÍ]A|[\s,-]/g, '');
  const categories = {
    AI: '(A) I',
    AIIA: '(A) IIa',
    AIIB: '(A) IIb',
    AIIIA: '(A) IIIa',
    AIIIB: '(A) IIIb',
    AIIIC: '(A) IIIc',
    BIIA: '(B) IIa',
    BIIB: '(B) IIb',
    BIIC: '(B) IIc',
    // Values used by the previous sheet.
    IA: '(A) I',
    IIA: '(A) IIb',
    IIIA: '(A) IIIa',
    IIIB: '(A) IIIb',
    IIIC: '(A) IIIc'
  };
  return categories[normalized] || fallback;
}

function showExamSummary(candidate) {
  summaryDni.textContent = candidate.dni;
  summaryName.textContent = candidate.name || 'SAMUEL SOTO HERRERA';
  summaryCategory.textContent = candidate.category || formatCategory(candidate.type);
  examStatus.hidden = true;
  examSummary.hidden = false;
  appWindow.classList.add('exam-running');
  pageTitle.textContent = 'EXAMEN EN CURSO';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton.disabled) return;

  if (!validateDocumentNumber()) {
    examStatus.hidden = true;
    documentNumber.focus();
    return;
  }

  const value = documentNumber.value;
  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  try {
    const sheets = await loadCandidates();
    // A repeated DNI uses its most recent row in each sheet.
    const found = sheets
      .map((candidates) => candidates.filter((candidate) => candidate.dni === value).pop())
      .find((candidate) => candidate && isActiveCandidate(candidate));

    if (!found) {
      examSummary.hidden = true;
      examStatus.hidden = false;
      return;
    }

    showExamSummary({ ...found, name: 'SAMUEL SOTO HERRERA' });
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute('aria-busy');
  }
});
const startExam = document.querySelector('#startExam');
const startExamMessage = document.querySelector('#startExamMessage');
const examScreen = document.querySelector('#examScreen');
const finishScreen = document.querySelector('#finishScreen');
const finishName = document.querySelector('#finishName');
const finishCategory = document.querySelector('#finishCategory');
const newExamButton = document.querySelector('#newExamButton');
const questionTopic = document.querySelector('#questionTopic');
const questionText = document.querySelector('#questionText');
const questionImage = document.querySelector('#questionImage');
const questionOptions = document.querySelector('#questionOptions');
const topicsNav = document.querySelector('#topicsNav');
const questionCounter = document.querySelector('#questionCounter');
const examProgressFill = document.querySelector('#examProgressFill');
const answerProgressFill = document.querySelector('#answerProgressFill');
const answerCount = document.querySelector('#answerCount');
const answerPercent = document.querySelector('#answerPercent');
const finishExam = document.querySelector('#finishExam');
const examCandidateName = document.querySelector('#examCandidateName');
const examTimer = document.querySelector('#examTimer');
const categoryFiles = {
  '(A) I': 'A_I',
  '(A) IIa': 'A_IIA',
  '(A) IIb': 'A_IIB',
  '(A) IIIa': 'A_IIIA',
  '(A) IIIb': 'A_IIIB',
  '(A) IIIc': 'A_IIIC',
  '(B) IIa': 'B_IIA',
  '(B) IIb': 'B_IIB',
  '(B) IIc': 'B_IIC'
};
let questionBank = [];
let questionIndex = 0;
const examAnswers = {};
let timerSeconds = 40 * 60;

function normalizeQuestions(payload) {
  const cleanPart = (questions = []) => questions
    .filter((question) => {
      const alternatives = question.alternativas || {};
      const images = question.alternativas_imagenes || {};
      const count = ['a', 'b', 'c', 'd'].filter((letter) => alternatives[letter] || images[letter]).length;
      return question.descripcion && count >= 2;
    })
    .map((question) => ({
      ...question,
      tema: String(question.tema || '').trim() || 'Otros temas'
    }));

  const generales = cleanPart(payload.generales);
  const especificas = cleanPart(payload.especificas);

  let ordered = [...generales.slice(0, 20), ...especificas.slice(0, 20)];

  if (ordered.length < 40) {
    ordered = [
      ...ordered,
      ...generales.slice(20),
      ...especificas.slice(20)
    ];
  }

  return ordered.slice(0, 40).map((question, index) => ({
    ...question,
    displayNumber: index + 1,
    ref: `q-${index + 1}-${question.numero || 'sin-numero'}`
  }));
}
function loadQuestionBank(file) {
  // Classic scripts can load local data even when index.html is opened directly.
  if (window.questionBanks?.[file]) return Promise.resolve(window.questionBanks[file]);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const finish = (error) => {
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      script.remove();
      if (error) reject(error);
      else resolve(window.questionBanks[file]);
    };
    const timeout = setTimeout(() => finish(new Error('Tiempo de carga agotado')), 10000);
    script.src = `assets/data/${file}.js`;
    script.onload = () => finish(window.questionBanks?.[file] ? null : new Error('Banco no disponible'));
    script.onerror = () => finish(new Error('No se pudo cargar el banco'));
    document.head.appendChild(script);
  });
}

async function openQuestionBank() {
  if (startExam.disabled || !examScreen.hidden) return;
  const category = summaryCategory.textContent.trim();
  const file = categoryFiles[category] || 'A_I';
  const label = startExam.querySelector('span');
  const originalLabel = label.textContent;
  startExam.disabled = true;
  startExam.setAttribute('aria-busy', 'true');
  label.textContent = 'CARGANDO PREGUNTAS…';
  startExamMessage.textContent = '';
  try {
    questionBank = normalizeQuestions(await loadQuestionBank(file));
    if (!questionBank.length) throw new Error('El banco no contiene preguntas');

    Object.keys(examAnswers).forEach((key) => delete examAnswers[key]);
    questionIndex = 0;
    timerSeconds = 40 * 60;
    examCandidateName.textContent = summaryName.textContent;
    renderTopicNavigation();
    renderQuestion();
    updateAnswerSummary();
    examSummary.hidden = true;
    examScreen.hidden = false;
    appWindow.classList.add('exam-active');
    pageTitle.textContent = `Examen de Conocimientos - CATEGORÍA: ${category}`;
    startTimer();
  } catch (error) {
    questionBank = [];
    examSummary.hidden = false;
    examScreen.hidden = true;
    appWindow.classList.remove('exam-active');
    startExamMessage.textContent = 'No se pudieron cargar las preguntas. Vuelva a intentarlo y compruebe que la carpeta assets esté completa.';
    console.error('Error al iniciar el examen:', error);
  } finally {
    startExam.disabled = false;
    startExam.removeAttribute('aria-busy');
    label.textContent = originalLabel;
  }
}

function renderTopicNavigation() {
  const groups = new Map();
  questionBank.forEach((question, index) => {
    if (!groups.has(question.tema)) groups.set(question.tema, []);
    groups.get(question.tema).push({ question, index });
  });
  topicsNav.innerHTML = '';
  groups.forEach((items, topic) => {
    const group = document.createElement('section');
    group.className = 'topic-group';
    const header = document.createElement('div');
    header.className = 'topic-group-header';
    const title = document.createElement('span');
    title.textContent = topic;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '⌃';
    const list = document.createElement('div');
    list.className = 'topic-group-list';
    header.addEventListener('click', () => list.classList.toggle('collapsed'));
    header.append(title, toggle);
    group.appendChild(header);

    items.forEach(({ question, index }) => {
      const item = document.createElement('div');
      item.className = 'question-nav-item';
      item.dataset.index = index;
      const label = document.createElement('span');
      label.className = 'question-nav-label';
      label.textContent = `${index + 1}. ${question.descripcion}`;
      const badge = document.createElement('span');
      badge.className = 'question-nav-badge';
      badge.dataset.badge = index;
      item.append(label, badge);
      item.addEventListener('click', () => { questionIndex = index; renderQuestion(); });
      list.appendChild(item);
    });
    group.appendChild(list);
    topicsNav.appendChild(group);
  });
}

function renderQuestion() {
  const question = questionBank[questionIndex];
  if (!question) return;
  questionTopic.textContent = `Tema: ${question.tema}`;
  questionText.textContent = `${questionIndex + 1}. ${question.descripcion}`;
  if (question.imagen) {
    questionImage.src = `assets/img/preguntas/${question.imagen}`;
    questionImage.hidden = false;
  } else {
    questionImage.hidden = true;
    questionImage.removeAttribute('src');
  }

  questionOptions.innerHTML = '';
  ['a', 'b', 'c', 'd'].forEach((letter) => {
    const text = question.alternativas?.[letter];
    const image = question.alternativas_imagenes?.[letter];
    if (!text && !image) return;
    const label = document.createElement('label');
    label.className = 'question-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'question-answer';
    radio.value = letter;
    radio.checked = examAnswers[question.ref] === letter;
    radio.addEventListener('change', () => {
      examAnswers[question.ref] = letter;
      updateAnswerSummary();
      renderTopicNavigationState();
    });
    const content = document.createElement('span');
    content.textContent = `${letter.toUpperCase()}.  ${text || ''}`;
    if (image) {
      const optionImage = document.createElement('img');
      optionImage.src = `assets/img/preguntas/${image}`;
      content.appendChild(optionImage);
    }
    label.append(radio, content);
    questionOptions.appendChild(label);
  });
  questionCounter.textContent = `${questionIndex + 1}/${questionBank.length}`;
  examProgressFill.style.width = `${((questionIndex + 1) / questionBank.length) * 100}%`;
  document.querySelector('#previousQuestion').disabled = questionIndex === 0;
  document.querySelector('#nextQuestion').disabled = questionIndex === questionBank.length - 1;
  finishExam.classList.toggle('is-hidden', questionIndex !== questionBank.length - 1);
  renderTopicNavigationState();
}

function renderTopicNavigationState() {
  document.querySelectorAll('.question-nav-item').forEach((item) => {
    const index = Number(item.dataset.index);
    item.classList.toggle('active', index === questionIndex);
    const question = questionBank[index];
    const badge = item.querySelector('.question-nav-badge');
    const answer = question && examAnswers[question.ref];
    badge.textContent = answer ? answer.toUpperCase() : '';
    badge.classList.toggle('answered', Boolean(answer));
  });
}

function updateAnswerSummary() {
  const total = questionBank.length || 1;
  const answered = Object.keys(examAnswers).length;
  const percent = Math.round((answered / total) * 100);
  answerProgressFill.style.width = `${percent}%`;
  answerCount.textContent = `${answered}/${questionBank.length}`;
  answerPercent.textContent = `${percent}%`;
  finishExam.disabled = answered < questionBank.length;
}

function startTimer() {
  if (window.examTimerInterval) clearInterval(window.examTimerInterval);
  const tick = () => {
    const hours = String(Math.floor(timerSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(timerSeconds % 60).padStart(2, '0');
    examTimer.textContent = `${hours}:${minutes}:${seconds}`;
    if (timerSeconds > 0) timerSeconds -= 1;
  };
  tick();
  window.examTimerInterval = setInterval(tick, 1000);
}

startExam.addEventListener('click', openQuestionBank);
document.querySelector('#previousQuestion').addEventListener('click', () => {
  if (questionIndex > 0) { questionIndex -= 1; renderQuestion(); }
});
document.querySelector('#nextQuestion').addEventListener('click', () => {
  if (questionIndex < questionBank.length - 1) { questionIndex += 1; renderQuestion(); }
});
document.addEventListener('keydown', (event) => {
  if (examScreen.hidden) return;
  if (event.key === 'Enter') {
    // Preserve Enter activation for focused buttons and other controls.
    if (event.target.closest('button, a, select, textarea, input:not([type="radio"]), [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const question = questionBank[questionIndex];
    if (question && examAnswers[question.ref] && questionIndex < questionBank.length - 1) {
      questionIndex += 1;
      renderQuestion();
    }
    return;
  }
  if (event.key === 'ArrowLeft') document.querySelector('#previousQuestion').click();
  if (event.key === 'ArrowRight') document.querySelector('#nextQuestion').click();
  const map = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', a: 'a', b: 'b', c: 'c', d: 'd' };
  const letter = map[event.key.toLowerCase()];
  if (letter) {
    const radio = questionOptions.querySelector(`input[value="${letter}"]`);
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
  }
});

document.querySelector('#zoomRange').addEventListener('input', (event) => {
  document.querySelector('#zoomPercent').textContent = `${event.target.value}%`;
  document.querySelector('#questionCard').style.fontSize = `${event.target.value / 45}em`;
});
document.querySelector('#zoomOut').addEventListener('click', () => {
  const control = document.querySelector('#zoomRange');
  control.value = Math.max(35, Number(control.value) - 5);
  control.dispatchEvent(new Event('input'));
});
document.querySelector('#zoomIn').addEventListener('click', () => {
  const control = document.querySelector('#zoomRange');
  control.value = Math.min(100, Number(control.value) + 5);
  control.dispatchEvent(new Event('input'));
});
function resetToLogin() {
  if (window.examTimerInterval) clearInterval(window.examTimerInterval);
  finishScreen.hidden = true;
  examScreen.hidden = true;
  examSummary.hidden = true;
  examStatus.hidden = true;
  appWindow.classList.remove('finish-active', 'exam-active', 'exam-running');
  pageTitle.textContent = 'EXAMEN DE CONOCIMIENTO - ACCESO PARA POSTULANTES';
  documentNumber.value = '';
  documentNumber.setCustomValidity('');
  documentNumber.removeAttribute('aria-invalid');
  message.textContent = '';
}

function showFinishedExam() {
  if (finishExam.disabled) return;
  finishName.textContent = summaryName.textContent;
  finishCategory.textContent = summaryCategory.textContent;
  examScreen.hidden = true;
  finishScreen.hidden = false;
  appWindow.classList.remove('exam-active');
  appWindow.classList.add('finish-active');
  pageTitle.textContent = 'EXAMEN FINALIZO';
  if (window.examTimerInterval) clearInterval(window.examTimerInterval);
  window.finishReturnTimer = setTimeout(resetToLogin, 2000);
}

finishExam.addEventListener('click', showFinishedExam);
newExamButton.addEventListener('click', () => {
  if (window.finishReturnTimer) clearTimeout(window.finishReturnTimer);
  resetToLogin();
});

