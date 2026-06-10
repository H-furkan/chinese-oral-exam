/* ============ helpers ============ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* localStorage progress */
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem("chnexam_" + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem("chnexam_" + key, JSON.stringify(val)); },
};

/* ============ word segmentation + click-to-explain ============ */
const GLOSS_MAX = Math.max(...Object.keys(DATA.glossary).map(w => w.length));

function matchAt(zh, i) {
  for (let L = Math.min(GLOSS_MAX, zh.length - i); L >= 1; L--) {
    if (DATA.glossary[zh.slice(i, i + L)]) return zh.slice(i, i + L);
  }
  return null;
}

/* Turn a Chinese sentence into clickable word units (pinyin above hanzi).
   Clicking a word — its characters OR its pinyin — opens the word bar. */
function seg(zh) {
  let out = "", i = 0;
  while (i < zh.length) {
    const m = matchAt(zh, i);
    if (m) {
      const [py] = DATA.glossary[m];
      out += `<span class="w" data-w="${m}"><span class="w-py">${py}</span><span class="w-zh">${m}</span></span>`;
      i += m.length;
    } else {
      // group consecutive unmatched chars (numbers, punctuation, latin)
      let j = i + 1;
      while (j < zh.length && !matchAt(zh, j)) j++;
      out += `<span class="w plain"><span class="w-py">&nbsp;</span><span class="w-zh">${zh.slice(i, j)}</span></span>`;
      i = j;
    }
  }
  return `<span class="seg">${out}</span>`;
}

document.addEventListener("click", (e) => {
  const w = e.target.closest(".w");
  if (!w || w.classList.contains("plain") || w.closest(".veiled")) return;
  if (w.closest(".quiz-opts")) return; // clicking an option answers the quiz, don't open the word bar
  const entry = DATA.glossary[w.dataset.w];
  if (!entry) return;
  $$(".w.sel").forEach(x => x.classList.remove("sel"));
  w.classList.add("sel");
  $("#wb-zh").textContent = w.dataset.w;
  $("#wb-py").textContent = entry[0];
  $("#wb-en").textContent = "— " + entry[1];
  $("#wordbar").classList.remove("hidden");
});
$("#wb-close").addEventListener("click", () => {
  $("#wordbar").classList.add("hidden");
  $$(".w.sel").forEach(x => x.classList.remove("sel"));
});

/* ============ tabs ============ */
function showTab(name) {
  $$("nav#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $$(".tab").forEach(t => t.classList.toggle("active", t.id === "tab-" + name));
  window.scrollTo({ top: 0 });
}
$$("nav#tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
$$(".part-card").forEach(c => c.addEventListener("click", () => showTab(c.dataset.goto)));

/* ============ countdown ============ */
(function countdown() {
  const days = Math.ceil((new Date(DATA.examDate) - new Date()) / 86400000);
  $("#countdown").textContent =
    days > 1 ? `${days} days until the exam (June 16) 加油 jiāyóu!` :
    days === 1 ? "Exam is TOMORROW! 加油 jiāyóu!" :
    days === 0 ? "Exam is TODAY! 你可以的 nǐ kěyǐ de!" : "Exam date has passed — hope it went well!";
})();

/* ============ PART 1: flashcards ============ */
const vocabState = {
  deck: [],
  idx: 0,
  known: store.get("known", {}),
};

function vocabKey(v) { return v.en; }

function buildVocabCats() {
  const cats = ["All categories", ...new Set(DATA.vocab.map(v => v.cat))];
  $("#vocab-cat").innerHTML = cats.map(c => `<option>${c}</option>`).join("");
}

function rebuildDeck() {
  const cat = $("#vocab-cat").value;
  let pool = DATA.vocab.filter(v => cat === "All categories" || v.cat === cat);
  // unknown cards first, known cards still appear but at the end
  const unknown = pool.filter(v => !vocabState.known[vocabKey(v)]);
  const known = pool.filter(v => vocabState.known[vocabKey(v)]);
  vocabState.deck = [...shuffle(unknown), ...shuffle(known)];
  vocabState.idx = 0;
  renderCard();
}

function renderCard() {
  const v = vocabState.deck[vocabState.idx];
  const card = $("#flashcard");
  card.classList.remove("flipped");
  if (!v) {
    card.querySelector(".fc-front").innerHTML = "🎉 No cards here!";
    card.querySelector(".fc-back").innerHTML = "";
    updateVocabStats();
    return;
  }
  card.querySelector(".fc-front").innerHTML =
    `<div>${v.en}</div><div class="fc-cat">${v.cat}${vocabState.known[vocabKey(v)] ? " · ✅ known" : ""}</div><div class="fc-tap">tap to flip</div>`;
  card.querySelector(".fc-back").innerHTML =
    `<div class="zh">${v.zh}</div><div class="py">${v.py}</div>`;
  updateVocabStats();
}

function updateVocabStats() {
  const cat = $("#vocab-cat").value;
  const pool = DATA.vocab.filter(v => cat === "All categories" || v.cat === cat);
  const knownCount = pool.filter(v => vocabState.known[vocabKey(v)]).length;
  $("#vocab-stats").textContent = `Known: ${knownCount} / ${pool.length} · Card ${Math.min(vocabState.idx + 1, vocabState.deck.length)} of ${vocabState.deck.length}`;
}

function nextCard(markKnown) {
  const v = vocabState.deck[vocabState.idx];
  if (v) {
    if (markKnown) vocabState.known[vocabKey(v)] = true;
    else delete vocabState.known[vocabKey(v)];
    store.set("known", vocabState.known);
  }
  vocabState.idx = (vocabState.idx + 1) % Math.max(vocabState.deck.length, 1);
  renderCard();
  renderProgressSummary();
}

$("#flashcard").addEventListener("click", () => $("#flashcard").classList.toggle("flipped"));
$("#fc-right").addEventListener("click", () => nextCard(true));
$("#fc-wrong").addEventListener("click", () => nextCard(false));
$("#vocab-cat").addEventListener("change", rebuildDeck);
$("#vocab-shuffle").addEventListener("click", rebuildDeck);
$("#vocab-reset").addEventListener("click", () => {
  if (confirm("Reset all flashcard progress?")) {
    vocabState.known = {};
    store.set("known", {});
    rebuildDeck();
    renderProgressSummary();
  }
});

/* ============ PART 2: Q&A practice ============ */
const listenState = { order: [], idx: 0 };

function buildListenTopics() {
  const topics = ["All topics", ...new Set(DATA.dialogues.map(d => d.topic))];
  $("#listen-topic").innerHTML = topics.map(t => `<option>${t}</option>`).join("");
}

function rebuildListen() {
  const t = $("#listen-topic").value;
  const pool = DATA.dialogues
    .map((d, i) => ({ ...d, i }))
    .filter(d => t === "All topics" || d.topic === t);
  listenState.order = shuffle(pool);
  listenState.idx = 0;
  renderListen();
}

function currentListen() { return listenState.order[listenState.idx]; }

function renderListen() {
  const d = currentListen();
  $("#listen-counter").textContent = d ? `Question ${listenState.idx + 1} of ${listenState.order.length} · topic: ${d.topic}` : "";
  $("#listen-reveal").classList.add("hidden");
  $("#listen-q-zh").classList.add("hide-py");
  $("#listen-q-help").classList.remove("hidden");
  if (!d) return;
  $("#listen-q-zh").innerHTML = seg(d.q.zh);
  $("#listen-a-zh").innerHTML = seg(d.a.zh);
}

function listenHelp() {
  $("#listen-q-zh").classList.remove("hide-py");
  $("#listen-q-help").classList.add("hidden");
}
$("#listen-q-help").addEventListener("click", listenHelp);
$("#listen-show").addEventListener("click", () => {
  $("#listen-reveal").classList.remove("hidden");
  listenHelp(); // once the answer is out, question help is free
});
$("#listen-next").addEventListener("click", () => {
  listenState.idx = (listenState.idx + 1) % Math.max(listenState.order.length, 1);
  renderListen();
});
$("#listen-topic").addEventListener("change", rebuildListen);

/* ============ PART 3: make questions ============ */
const p3State = { order: [], idx: 0 };

function rebuildP3() {
  p3State.order = shuffle(DATA.part3.map((x, i) => ({ ...x, i })));
  p3State.idx = 0;
  renderP3();
}

function renderP3() {
  const item = p3State.order[p3State.idx];
  if (!item) return;
  $("#p3-counter").textContent = `Statement ${p3State.idx + 1} of ${p3State.order.length}`;
  $("#p3-s-zh").innerHTML = seg(item.s.zh);
  $("#p3-hint").textContent = "💡 " + item.hint;
  $("#p3-hint").classList.add("hidden");
  $("#p3-reveal").classList.add("hidden");
  $("#p3-questions").innerHTML = item.q.map(q =>
    `<div class="zh big-zh">${seg(q.zh)}</div><hr style="border:none;margin:0.5rem">`
  ).join("");
}

$("#p3-hint-btn").addEventListener("click", () => $("#p3-hint").classList.toggle("hidden"));
$("#p3-show").addEventListener("click", () => $("#p3-reveal").classList.remove("hidden"));
$("#p3-next").addEventListener("click", () => {
  p3State.idx = (p3State.idx + 1) % p3State.order.length;
  renderP3();
});

function buildQwTable() {
  $("#qw-table tbody").innerHTML = DATA.questionWords.map(q =>
    `<tr><td>${q.qw}</td><td>${q.py}</td><td>${q.use}</td><td class="zh-ex">${seg(q.ex)}</td></tr>`
  ).join("");
}

/* ============ PART 4: monologues ============ */
const monoState = { idx: 0 };

function buildMonoTabs() {
  $("#mono-tabs").innerHTML = DATA.monologues.map((m, i) =>
    `<button class="btn ghost mono-tab" data-i="${i}">${m.titleZh} ${m.titlePy} · ${m.title}</button>`
  ).join("");
  $$(".mono-tab").forEach(b => b.addEventListener("click", () => {
    monoState.idx = +b.dataset.i;
    renderMono();
  }));
}

function renderMono() {
  const m = DATA.monologues[monoState.idx];
  $$(".mono-tab").forEach(b => b.classList.toggle("active-mono", +b.dataset.i === monoState.idx));
  $("#mono-tip").innerHTML = `<strong>${m.titleZh}</strong> (${m.titlePy})<br>💡 ${m.tip}`;
  const showPy = $("#mono-py").checked;
  const showEn = $("#mono-en").checked;
  const recite = $("#mono-recite").checked;
  $("#mono-lines").innerHTML = m.lines.map((l, i) => `
    <div class="mono-line">
      <span class="line-num">${i + 1}.</span>
      <div class="line-text">
        <div class="zh ${showPy ? "" : "hide-py"} ${recite ? "veiled" : ""}" data-i="${i}">${seg(l.zh)}</div>
        ${showEn ? `<div class="en">${l.en}</div>` : ""}
      </div>
    </div>`).join("");
  $$("#mono-lines .zh").forEach(z =>
    z.addEventListener("click", () => z.classList.remove("veiled")));
}

["mono-py", "mono-en", "mono-recite"].forEach(id =>
  $("#" + id).addEventListener("change", renderMono));

/* ============ dialogues browser ============ */
function buildDlgTopics() {
  const topics = ["All topics", ...new Set(DATA.dialogues.map(d => d.topic))];
  $("#dlg-topic").innerHTML = topics.map(t => `<option>${t}</option>`).join("");
}

function renderDialogues() {
  const t = $("#dlg-topic").value;
  const showPy = $("#dlg-py").checked;
  const showEn = $("#dlg-en").checked;
  const hide = $("#dlg-hide").checked;
  const pyCls = showPy ? "" : "hide-py";
  const list = DATA.dialogues
    .map((d, i) => ({ ...d, n: i + 1 }))
    .filter(d => t === "All topics" || d.topic === t);
  $("#dlg-list").innerHTML = list.map(d => `
    <div class="dlg">
      <span class="topic-tag">#${d.n} · ${d.topic}</span>
      <div class="dlg-row a">
        <span class="who">A:</span>
        <div class="line-text">
          <div class="zh ${pyCls}">${seg(d.q.zh)}</div>
          ${showEn ? `<div class="en">${d.q.en}</div>` : ""}
        </div>
      </div>
      <div class="dlg-row b ${hide ? "veiled" : ""}">
        <span class="who">B:</span>
        <div class="line-text">
          <div class="zh ${pyCls}">${seg(d.a.zh)}</div>
          ${showEn ? `<div class="en">${d.a.en}</div>` : ""}
        </div>
      </div>
    </div>`).join("");
  $$("#dlg-list .dlg-row.b.veiled .line-text").forEach(el =>
    el.addEventListener("click", () => el.parentElement.classList.remove("veiled")));
}

["dlg-py", "dlg-en", "dlg-hide"].forEach(id =>
  $("#" + id).addEventListener("change", renderDialogues));
$("#dlg-topic").addEventListener("change", renderDialogues);

/* ============ quiz ============ */
const QUIZ_LEN = 10;
let quiz = null;

function makeQuiz() {
  const qs = [];
  // type 1: EN -> ZH (from vocab)
  shuffle(DATA.vocab).slice(0, 4).forEach(v => {
    const wrong = shuffle(DATA.vocab.filter(x => x.zh !== v.zh)).slice(0, 3);
    qs.push({
      prompt: `How do you say “${v.en}” in Chinese?`,
      zh: null,
      options: shuffle([v, ...wrong]).map(o => ({ label: seg(o.zh), ok: o.zh === v.zh })),
      explain: `${seg(v.zh)} = ${v.en}`,
    });
  });
  // type 2: pick the right answer to a question (from dialogues)
  shuffle(DATA.dialogues).slice(0, 3).forEach(d => {
    const seen = new Set([d.a.zh]);
    const wrong = shuffle(DATA.dialogues)
      .filter(x => !seen.has(x.a.zh) && seen.add(x.a.zh))
      .slice(0, 3);
    qs.push({
      prompt: "Choose the best reply:",
      zh: d.q.zh,
      options: shuffle([d, ...wrong]).map(o => ({ label: seg(o.a.zh), ok: o.a.zh === d.a.zh })),
      explain: `${seg(d.q.zh)} (${d.q.en}) → ${seg(d.a.zh)} (${d.a.en})`,
    });
  });
  // type 3: pick the right question for an answer (Part 3 style)
  shuffle(DATA.part3).slice(0, 3).forEach(p => {
    const wrong = shuffle(DATA.part3.filter(x => x.q[0].zh !== p.q[0].zh)).slice(0, 3);
    qs.push({
      prompt: "Which question produces this answer? (Part 3!)",
      zh: p.s.zh,
      options: shuffle([p, ...wrong]).map(o => ({ label: seg(o.q[0].zh), ok: o.q[0].zh === p.q[0].zh })),
      explain: `${seg(p.s.zh)} ← ${seg(p.q[0].zh)} (${p.q[0].en})`,
    });
  });
  return shuffle(qs).slice(0, QUIZ_LEN);
}

function startQuiz() {
  quiz = { qs: makeQuiz(), idx: 0, score: 0 };
  renderQuizQ();
}

function renderQuizQ() {
  const q = quiz.qs[quiz.idx];
  if (!q) return renderQuizDone();
  $("#quiz-area").innerHTML = `
    <div class="quiz-progress">Question ${quiz.idx + 1} / ${quiz.qs.length} · Score: ${quiz.score}</div>
    <div class="quiz-q">
      <p>${q.prompt}</p>
      ${q.zh ? `<div class="zh">${seg(q.zh)}</div>` : ""}
    </div>
    <div class="quiz-opts">
      ${q.options.map((o, i) => `<button data-i="${i}">${o.label}</button>`).join("")}
    </div>
    <p id="quiz-explain" class="hidden tip-box"></p>
    <div class="fc-actions" style="margin-top:0.8rem">
      <button id="quiz-next" class="btn success hidden">Next ➡️</button>
    </div>`;
  $$(".quiz-opts button").forEach(b => b.addEventListener("click", () => {
    if (!$("#quiz-next").classList.contains("hidden")) return; // already answered
    const o = q.options[+b.dataset.i];
    if (o.ok) { b.classList.add("correct"); quiz.score++; }
    else {
      b.classList.add("wrong");
      $$(".quiz-opts button").forEach((bb, i) => { if (q.options[i].ok) bb.classList.add("correct"); });
    }
    $("#quiz-explain").innerHTML = "📖 " + q.explain;
    $("#quiz-explain").classList.remove("hidden");
    $("#quiz-next").classList.remove("hidden");
  }));
  $("#quiz-next").addEventListener("click", () => { quiz.idx++; renderQuizQ(); });
}

function renderQuizDone() {
  const s = quiz.score, n = quiz.qs.length;
  const best = Math.max(store.get("bestScore", 0), s);
  store.set("bestScore", best);
  const msg =
    s === n ? "🏆 满分 mǎnfēn! Perfect score! You're ready!" :
    s >= n * 0.7 ? "👍 很好 hěn hǎo! Great job — review the ones you missed." :
    "💪 加油 jiāyóu! Keep practicing the dialogues and try again.";
  $("#quiz-area").innerHTML = `
    <div class="quiz-score">
      <p>Your score: <strong>${s} / ${n}</strong> · Best: ${best} / ${n}</p>
      <p>${msg}</p>
      <button id="quiz-start" class="btn big">🔄 Try again</button>
    </div>`;
  $("#quiz-start").addEventListener("click", startQuiz);
  renderProgressSummary();
}

$("#quiz-start").addEventListener("click", startQuiz);

/* ============ home progress summary ============ */
function renderProgressSummary() {
  const known = Object.keys(store.get("known", {})).length;
  const best = store.get("bestScore", 0);
  $("#progress-summary").innerHTML =
    `📊 Your progress: <strong>${known}/${DATA.vocab.length}</strong> vocabulary cards known · best quiz score <strong>${best}/${QUIZ_LEN}</strong>`;
}

/* ============ init ============ */
buildVocabCats();
rebuildDeck();
buildListenTopics();
rebuildListen();
rebuildP3();
buildQwTable();
buildMonoTabs();
renderMono();
buildDlgTopics();
renderDialogues();
renderProgressSummary();
