/* Kademe 2 — framework-free study and persistence model. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StudyCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 1;
  const blankState = () => ({ version: VERSION, history: [], active: null, bookmarks: [] });
  const shuffle = (items, rng = Math.random) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  function makeQuestions(bank, mode, courseId, ids = [], rng = Math.random) {
    let picked;
    if (mode === "mixed") {
      picked = bank.courses.flatMap(c => {
        const pool = bank.questions.filter(q => q.courseId === c.id);
        if (pool.length < 6) throw new Error("Karışık deneme için her dersten en az 6 doğrulanmış soru gerekli.");
        return shuffle(pool, rng).slice(0, 6);
      });
      if (picked.length !== 30) throw new Error("Karışık deneme beş dersten oluşmalı.");
    } else if (mode === "course") {
      const pool = bank.questions.filter(q => q.courseId === courseId);
      if (pool.length < 30) throw new Error("Bu dersin 30 soruluk denemesi için yeterli doğrulanmış soru yok.");
      picked = shuffle(pool, rng).slice(0, 30);
    } else if (mode === "review" || mode === "bookmarks") {
      const allow = new Set(ids);
      picked = shuffle(bank.questions.filter(q => allow.has(q.id)), rng).slice(0, 30);
      if (!picked.length) throw new Error("Tekrar için henüz soru yok.");
    } else {
      throw new Error("Deneme türü tanınmadı.");
    }
    return shuffle(picked.map(q => q.id), rng);
  }
  function createSession(bank, mode, courseId, ids = [], rng = Math.random, now = Date.now()) {
    const questionIds = makeQuestions(bank, mode, courseId, ids, rng);
    return {
      id: `s-${now}-${Math.random().toString(36).slice(2, 10)}`,
      bankVersion: bank.version,
      mode, courseId: mode === "course" ? courseId : null,
      questionIds, answers: {}, index: 0,
      startedAt: now, endedAt: null, elapsedSeconds: 0, completed: false
    };
  }
  function answer(session, questionId, choice, bank, now = Date.now()) {
    const q = bank.questions.find(q => q.id === questionId);
    if (!q || !session.questionIds.includes(questionId)) throw new Error("Soru bu denemeye ait değil.");
    if (session.answers[questionId]) return false;
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) throw new Error("Geçersiz seçenek.");
    if (session.endedAt) throw new Error("Tamamlanan deneme değiştirilemez.");
    session.answers[questionId] = { choice, at: now };
    return true;
  }
  function result(session, bank) {
    const map = new Map(bank.questions.map(q => [q.id, q]));
    let correct = 0, answered = 0;
    for (const id of session.questionIds) {
      const a = session.answers[id];
      if (a) { answered++; if (a.choice === map.get(id)?.answer) correct++; }
    }
    return {
      total: session.questionIds.length, answered, correct,
      wrong: answered - correct, blank: session.questionIds.length - answered,
      accuracy: answered ? Math.round(100 * correct / answered) : null,
      score: Math.round(100 * correct / session.questionIds.length)
    };
  }
  function finish(state, bank, now = Date.now()) {
    if (!state.active) return null;
    const session = state.active;
    session.endedAt = now;
    session.completed = result(session, bank).blank === 0;
    const old = state.history.findIndex(s => s.id === session.id);
    if (old >= 0) state.history[old] = session;
    else state.history.push(session);
    state.active = null;
    return session;
  }
  function events(state, bank) {
    const map = new Map(bank.questions.map(q => [q.id, q]));
    const sessions = state.active ? [...state.history, state.active] : state.history;
    return sessions.flatMap(s => s.questionIds.flatMap(id => {
      const a = s.answers[id], q = map.get(id);
      return a && q ? [{ id, courseId: q.courseId, at: a.at, correct: a.choice === q.answer, sessionId: s.id }] : [];
    })).sort((a, b) => a.at - b.at);
  }
  function wrongIds(state, bank) {
    const latest = new Map();
    for (const e of events(state, bank)) latest.set(e.id, e);
    return [...latest.values()].filter(e => !e.correct).map(e => e.id);
  }
  function localDay(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function stats(state, bank, now = Date.now()) {
    const list = events(state, bank);
    const correct = list.filter(e => e.correct).length;
    const days = new Set(list.map(e => localDay(e.at)));
    let streak = 0;
    const cursor = new Date(now); cursor.setHours(12, 0, 0, 0);
    if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(localDay(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return {
      answered: list.length, correct,
      accuracy: list.length ? Math.round(100 * correct / list.length) : null,
      completed: state.history.filter(s => s.completed).length,
      unique: new Set(list.map(e => e.id)).size,
      today: list.filter(e => localDay(e.at) === localDay(now)).length,
      streak, days,
      courses: bank.courses.map(c => {
        const es = list.filter(e => e.courseId === c.id), ok = es.filter(e => e.correct).length;
        return { id: c.id, answered: es.length, correct: ok, accuracy: es.length ? Math.round(ok / es.length * 100) : null };
      })
    };
  }
  function validateState(raw, bank) {
    const fail = () => { throw new Error("Yedek dosyası bu uygulamanın geçerli çalışma kaydı değil."); };
    if (!raw || raw.version !== VERSION || !Array.isArray(raw.history) || raw.history.length > 10000 || !Array.isArray(raw.bookmarks)) fail();
    const map = new Map(bank.questions.map(q => [q.id, q]));
    const knownCourses = new Set(bank.courses.map(c => c.id));
    const time = n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= Date.now() + 86400000;
    function session(s, active) {
      if (!s || typeof s.id !== "string" || !/^s-[a-zA-Z0-9-]{3,90}$/.test(s.id) ||
          s.bankVersion !== bank.version || !["mixed", "course", "review", "bookmarks"].includes(s.mode) ||
          !Array.isArray(s.questionIds) || s.questionIds.length < 1 || s.questionIds.length > 30 ||
          new Set(s.questionIds).size !== s.questionIds.length || s.questionIds.some(id => !map.has(id)) ||
          !s.answers || typeof s.answers !== "object" || Array.isArray(s.answers) ||
          !Number.isInteger(s.index) || s.index < 0 || s.index >= s.questionIds.length ||
          !time(s.startedAt) || !Number.isInteger(s.elapsedSeconds) || s.elapsedSeconds < 0 || s.elapsedSeconds > 1e8) fail();
      if (s.mode === "course" && (!knownCourses.has(s.courseId) || s.questionIds.some(id => map.get(id).courseId !== s.courseId))) fail();
      if (["mixed", "course"].includes(s.mode) && s.questionIds.length !== 30) fail();
      if (s.mode === "mixed" && bank.courses.some(c => s.questionIds.filter(id => map.get(id).courseId === c.id).length !== 6)) fail();
      if (active ? s.endedAt !== null : (!time(s.endedAt) || s.endedAt < s.startedAt)) fail();
      const answers = {};
      for (const [id, a] of Object.entries(s.answers)) {
        const q = map.get(id);
        if (!s.questionIds.includes(id) || !a || !Number.isInteger(a.choice) || a.choice < 0 || a.choice >= q.options.length ||
            !time(a.at) || a.at < s.startedAt || (!active && a.at > s.endedAt)) fail();
        answers[id] = { choice: a.choice, at: a.at };
      }
      return {
        id: s.id, bankVersion: bank.version, mode: s.mode,
        courseId: s.mode === "course" ? s.courseId : null,
        questionIds: [...s.questionIds], answers, index: s.index,
        startedAt: s.startedAt, endedAt: active ? null : s.endedAt,
        elapsedSeconds: s.elapsedSeconds,
        completed: !active && Object.keys(answers).length === s.questionIds.length
      };
    }
    const history = raw.history.map(s => session(s, false));
    if (new Set(history.map(s => s.id)).size !== history.length) fail();
    const active = raw.active ? session(raw.active, true) : null;
    if (active && history.some(s => s.id === active.id)) fail();
    return { version: VERSION, history, active, bookmarks: [...new Set(raw.bookmarks.filter(id => map.has(id)))] };
  }
  function mergeStates(current, imported, bank) {
    const a = validateState(current, bank), b = validateState(imported, bank);
    const histories = new Map(a.history.map(s => [s.id, s]));
    for (const s of b.history) {
      const prev = histories.get(s.id);
      if (!prev || Object.keys(s.answers).length > Object.keys(prev.answers).length) histories.set(s.id, s);
    }
    const candidate = a.active || b.active;
    const active = candidate && !histories.has(candidate.id) ? candidate : null;
    // Never silently discard a different in-progress test when importing.
    if (a.active && b.active && a.active.id !== b.active.id && !histories.has(b.active.id))
      throw new Error("İki cihazda farklı devam eden denemeler var. İçe aktarmadan önce bu cihazdaki denemeyi bitirin.");
    if (active && a.active?.id === b.active?.id) {
      for (const [id, ans] of Object.entries(b.active.answers)) {
        if (!active.answers[id] || ans.at < active.answers[id].at) active.answers[id] = ans;
      }
      active.elapsedSeconds = Math.max(a.active.elapsedSeconds, b.active.elapsedSeconds);
    }
    return validateState({
      version: VERSION, history: [...histories.values()].sort((x, y) => x.startedAt - y.startedAt),
      active, bookmarks: [...new Set([...a.bookmarks, ...b.bookmarks])]
    }, bank);
  }
  return { VERSION, blankState, shuffle, makeQuestions, createSession, answer, result, finish, events, wrongIds, stats, localDay, validateState, mergeStates };
});
