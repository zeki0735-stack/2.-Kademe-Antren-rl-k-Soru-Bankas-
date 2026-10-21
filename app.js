/* All progress stays in this browser. No analytics, accounts or external requests. */
(() => {
  "use strict";
  const C = window.StudyCore, B = window.BANK;
  if (!C || !B) {
    document.getElementById("app").innerHTML = '<div class="loading"><h1>Dosyalar yüklenemedi</h1><p>Uygulama klasörünün tamamını açın veya sayfayı yenileyin.</p></div>';
    return;
  }
  const KEY = "kademe2-progress-v1", root = document.getElementById("app"), dialog = document.getElementById("dialog");
  const qs = new Map(B.questions.map(q => [q.id, q])), courses = new Map(B.courses.map(c => [c.id, c]));
  let state = C.blankState(), storageWarning = "", corrupted = "", reviewTab = "wrong", reviewCourse = "all", historyFilter = "all";
  let pendingStart = null, pendingPdf = null, toastTimer = null, boundBooks = new Set(), objectUrls = [];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3Z"/><path d="M12 6v15"/>',
    repeat: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 7a7 7 0 0 1 11-2L20 8M4 16l3.5 3a7 7 0 0 0 11-2"/>',
    history: '<path d="M3 4v5h5"/><path d="M3.5 9a9 9 0 1 1 1 9M12 7v5l3 2"/>',
    folder: '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    cross: '<path d="m6 6 12 12M6 18 18 6"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    left: '<path d="M20 12H5m6-6-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3m-10 4h3"/>',
    chart: '<path d="M4 3v17h17M8 14l4-4 4 2 5-7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    award: '<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
    shield: '<path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6Z"/><path d="m8 11 3 3 5-6"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M5 11h4l2-4 2 8 2-4h4"/>',
    run: '<circle cx="15" cy="4" r="2"/><path d="m5 9 5-3 4 4 5 1M9 9l-2 6-4 3m6-4 5 2 1 6m-3-13-3 5"/>',
    flag: '<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
    brain: '<path d="M12 4c-4-4-9 2-6 5-5 2-3 9 1 8 0 5 5 5 5 1m0-14c4-4 9 2 6 5 5 2 3 9-1 8 0 5-5 5-5 1V4M7 9l2 2m8-2-2 2M7 17l2-2m8 2-2-2"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4h.01"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>'
  };
  const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.book}</svg>`;
  const date = ms => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(ms));
  const dateShort = ms => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(ms));
  const time = ms => new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  const duration = sec => `${Math.floor(sec / 60).toString().padStart(2, "0")}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
  const courseStyle = c => `--accent:${c.color};--tint:${c.tint}`;
  const titleFor = s => s.mode === "mixed" ? "Karışık deneme" : s.mode === "course" ? courses.get(s.courseId).title : s.mode === "review" ? "Yanlışları tekrar" : "İşaretlediklerim";
  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 5500);
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { try { state = C.validateState(JSON.parse(raw), B); } catch (_) { corrupted = raw; storageWarning = "Önceki kayıt okunamadı. Eski veriyi koruduk. Kurtarma kopyasını indirip yeni kayıt başlatabilirsiniz."; } }
  } catch (_) { storageWarning = "Bu tarayıcı kalıcı kayda izin vermiyor. İlerlemenizi kaybetmemek için yedek indirin."; }
  function save() {
    if (corrupted) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (_) { storageWarning = "Tarayıcıda kayıt alanı dolu veya kapalı. Çalışmanızı yedek olarak indirin."; toast(storageWarning); }
  }
  const getRoute = () => location.hash.replace(/^#\/?/, "") || "home";
  function go(route) {
    if (getRoute() === route) { render(); window.scrollTo(0, 0); }
    else location.hash = route;
  }
  function showDialog(title, body) {
    dialog.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close" aria-label="Pencereyi kapat">${icon("cross")}</button></div>${body}`;
    if (!dialog.open) dialog.showModal();
  }
  function banner() {
    if (!storageWarning) return "";
    return `<div class="warning-banner" role="alert">${esc(storageWarning)}${corrupted ? '<div class="actions"><button class="btn" data-action="corrupt-export">Kurtarma kopyasını indir</button><button class="btn" data-action="reset-corrupt">Yeni kayıt başlat</button></div>' : '<button class="text-btn" data-action="export">Yedeği indir</button>'}</div>`;
  }
  function shell(body, current) {
    const nav = [
      ["home", "home", "Çalışma alanım", "Alanım"], ["practice", "book", "Deneme çöz", "Deneme"],
      ["review", "repeat", "Tekrar kutusu", "Tekrar"], ["history", "history", "Çalışma geçmişi", "Geçmiş"],
      ["sources", "folder", "Kaynaklarım", "Kaynak"]
    ];
    const wrongCount = C.wrongIds(state, B).length;
    return `<div class="app-shell">
      <aside class="sidebar"><a class="brand" href="#home"><span class="brand-mark">k<span>2</span></span><span class="brand-name">kademe<span class="small"> 02</span><small>Çalışma atölyesi</small></span></a>
        <div class="nav-caption">KENDİ RİTMİNDE İLERLE</div><nav class="nav" aria-label="Ana menü">${nav.map(([route, ic, label, short]) => `<a href="#${route}" class="${current === route ? "active" : ""}" ${current === route ? 'aria-current="page"' : ""}>${icon(ic)}<span class="long-label">${label}</span><span class="short-label">${short}</span>${route === "review" && wrongCount ? `<span class="nav-count">${wrongCount}</span>` : ""}</a>`).join("")}</nav>
        <div class="sidebar-foot"><div class="side-note">İyi bir antrenörün<br>ilk antrenmanı öğrenmektir.</div><div class="profile"><span class="profile-icon">${icon("person")}</span><span>Kişisel çalışma alanı<small><i class="dot"></i>Bu tarayıcıda saklanır</small></span></div></div>
      </aside>
      <div class="content"><header class="topbar"><div class="breadcrumb">Antrenörlük temel eğitimi ${icon("chevron")} <span>2. kademe</span></div><a class="mobile-brand" href="#home" style="text-decoration:none"><span class="brand-mark">k<span>2</span></span>kademe 02</a><div class="today">${icon("calendar")}<span>${date(Date.now())}</span><button class="icon-btn" data-action="help" aria-label="Kullanım rehberi">${icon("help")}</button></div></header>
      <main id="main" tabindex="-1">${banner()}${body}</main></div></div>`;
  }
  function intro(kicker, title, text, tag = "") {
    return `<div class="intro"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${text}</p></div>${tag ? `<span class="pill">${icon("shield")}${tag}</span>` : ""}</div>`;
  }
  function resume() {
    if (!state.active) return "";
    const r = C.result(state.active, B);
    return `<div class="resume"><div><strong>Başladığın deneme seni bekliyor.</strong><p>${esc(titleFor(state.active))} · ${r.answered} / ${r.total} soru yanıtlandı.</p></div><button class="btn primary" data-action="continue">Kaldığım yerden ${icon("arrow")}</button></div>`;
  }
  function statCard(label, value, note, ic) {
    return `<div class="stat"><div class="stat-top">${label}${icon(ic)}</div><strong class="stat-number">${value}</strong><div class="stat-sub">${note}</div></div>`;
  }
  function chart() {
    const list = state.history.filter(s => s.completed).slice(-8);
    if (!list.length) return `<div class="chart-empty">${icon("chart")}<h3>İlk denemenle şekillenecek.</h3><p>Tamamladığın denemelerin başarı yüzdeleri burada görünecek.</p></div>`;
    const points = list.map((s, i) => ({ x: list.length === 1 ? 255 : 45 + i * 415 / (list.length - 1), y: 184 - C.result(s, B).score * 1.44, score: C.result(s, B).score, s }));
    return `<svg class="line-chart" viewBox="0 0 500 245" role="img" aria-label="Son ${list.length} tamamlanan denemenin başarı grafiği"><title>Deneme başarı yüzdeleri</title>
    ${[0, 25, 50, 75, 100].map(p => `<line x1="40" x2="475" y1="${184 - p * 1.44}" y2="${184 - p * 1.44}" stroke="#e5e9de" stroke-dasharray="3 5"/><text x="25" y="${188 - p * 1.44}" text-anchor="end" fill="#84907d" font-size="10">${p}</text>`).join("")}
    ${points.length > 1 ? `<path d="M${points.map(p => `${p.x},${p.y}`).join(" L")}" fill="none" stroke="#468267" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${points.map(p => `<g><circle cx="${p.x}" cy="${p.y}" r="5" fill="#468267" stroke="#fffefa" stroke-width="2"/><text x="${p.x}" y="${p.y - 13}" text-anchor="middle" fill="#416950" font-size="11" font-weight="600">%${p.score}</text><text x="${p.x}" y="214" text-anchor="middle" fill="#798773" font-size="10">${esc(dateShort(p.s.endedAt))}</text><title>${esc(titleFor(p.s))} · ${esc(date(p.s.endedAt))} · %${p.score}</title></g>`).join("")}</svg>
    <div class="chart-legend"><span><i class="legend-dot"></i>Tamamlanan denemeler (tekrarlar dahil)</span></div>`;
  }
  function activity(st) {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - 13 + i);
      return `<span class="activity-day ${st.days.has(C.localDay(d)) ? "used" : ""} ${i === 13 ? "current" : ""}" role="img" aria-label="${date(d)}: ${st.days.has(C.localDay(d)) ? "çalışıldı" : "kayıt yok"}" title="${date(d)}"></span>`;
    }).join("");
    return `<div class="activity"><div class="activity-top"><span>Son 14 gün</span><span>Bugün ${st.today} yanıt</span></div><div class="activity-days">${days}</div></div>`;
  }
  function home() {
    const st = C.stats(state, B);
    return intro("2. KADEME · TEMEL EĞİTİM", "Bir adım daha ileri.", "Beş ders, tek çalışma alanı. Bugünkü hedefinle başlayalım.", `${B.questions.length} kaynaklı soru`) + resume() +
      `<section class="hero"><div class="hero-copy"><div class="eyebrow">BUGÜNÜN ÇALIŞMASI</div><h2>Bilgini sahaya taşı.</h2><p>Her dersten 6 soruyla dengeli bir deneme çöz.<br>Her yanıtta açıklama, her adımda ilerleme.</p><button class="btn" data-action="start" data-mode="mixed">30 soruluk denemeye başla ${icon("arrow")}</button></div><div class="hero-art" aria-hidden="true"></div><div class="hero-number" aria-hidden="true">02</div></section>
      <div class="stats-grid">${statCard("Çözülen soru", st.answered, `${st.unique} farklı soru üzerinde çalıştın`, "book")}${statCard("Doğru yanıt oranı", st.accuracy === null ? "—" : `%${st.accuracy}`, st.answered ? `${st.correct} doğru / ${st.answered} yanıt` : "İlk yanıtınla hesaplanır", "target")}${statCard("Tamamlanan deneme", st.completed, "Tekrar çalışmaları dahil", "award")}${statCard("Çalışma serisi", `${st.streak}<span class="small"> gün</span>`, "Her gün bir küçük adım", "activity")}</div>
      <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Derslere yakından bak</h2><p>Yanıtların üzerinden ders bazında başarı.</p></div><a class="text-btn" href="#practice">Tümü ${icon("arrow")}</a></div><div class="course-list">${B.courses.map(c => {
        const cs = st.courses.find(x => x.id === c.id);
        return `<div class="course-row" style="${courseStyle(c)}"><span class="course-icon">${icon(c.icon)}</span><div class="course-info"><h3>${esc(c.title)}</h3><p>${cs.answered ? `${cs.answered} yanıt · ${cs.correct} doğru` : "Henüz çalışılmadı"}</p><div class="mini-track" role="meter" aria-label="${esc(c.title)} doğru oranı" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cs.accuracy || 0}" aria-valuetext="${cs.accuracy === null ? "Henüz veri yok" : `%${cs.accuracy}`}"><span style="width:${cs.accuracy || 0}%"></span></div></div><span class="course-percent">${cs.accuracy === null ? "—" : `%${cs.accuracy}`}</span><button class="icon-btn" data-action="start" data-mode="course" data-course="${c.id}" aria-label="${esc(c.title)} denemesine başla">${icon("arrow")}</button></div>`;
      }).join("")}</div></section><section class="panel"><div class="panel-head"><div><h2>Emeğinin izleri</h2><p>Son 8 tamamlanan deneme.</p></div>${icon("chart")}</div>${chart()}${activity(st)}</section></div>
      <div class="bottom-note">${icon("shield")}Sorular ve açıklamalar, kaynak kitapların basılı sayfalarına bağlıdır.</div>`;
  }
  function practice() {
    return intro("HER GÜN BİRAZ DAHA", "Nasıl çalışmak istersin?", "Karışık deneme ya da tek ders. Her denemede 30 farklı soru.") + resume() +
    `<div class="choice-grid"><section class="test-card mixed"><div><div class="eyebrow">BEŞ DERS · DENGELİ DAĞILIM</div><h2 style="margin-top:10px">Karışık deneme</h2><p>Her dersten 6 soru. Sorular her başlangıçta yeniden seçilir ve sıralanır.</p></div><button class="btn" data-action="start" data-mode="mixed">Denemeye başla ${icon("arrow")}</button></section>${B.courses.map(c => {
      const count = B.questions.filter(q => q.courseId === c.id).length;
      return `<section class="test-card" style="${courseStyle(c)}"><div class="test-card-top"><span class="course-icon">${icon(c.icon)}</span><span class="pill">${count} doğrulanmış soru</span></div><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><div class="test-details"><span>${icon("book")}30 soru</span><span>${icon("clock")}Süre sınırı yok</span></div><button class="btn" data-action="start" data-mode="course" data-course="${c.id}">Bu dersten çalış ${icon("arrow")}</button></section>`;
    }).join("")}</div><div class="source-note">Bu bir çalışma denemesidir. Gerçek sınavın soru sayısını, süresini veya geçme koşullarını taklit etmez. İlk bankada ${B.questions.length} soru bulunur; tüm sorular bitince yeni denemelerde daha önce gördüğün sorular gelebilir.</div>`;
  }
  function quiz() {
    const s = state.active;
    if (!s) return `<div class="empty">${icon("book")}<h2>Bir denemeyle başlayalım.</h2><p>Çözmeye hazır sorular çalışma alanında seni bekliyor.</p><a class="btn primary" href="#practice">Deneme seç ${icon("arrow")}</a></div>`;
    const q = qs.get(s.questionIds[s.index]), c = courses.get(q.courseId), a = s.answers[q.id], r = C.result(s, B), isRight = a && a.choice === q.answer;
    return `<div class="quiz-top"><div><div class="eyebrow">ÇALIŞMA MODU</div><div class="quiz-label" style="margin-top:7px">${esc(titleFor(s))} · ${r.answered} / ${r.total} yanıt</div></div><div class="actions"><span class="quiz-timer">${icon("clock")}<span id="elapsed">${duration(s.elapsedSeconds)}</span></span><button class="btn ghost" data-action="pause">${icon("pause")}Ara ver</button></div></div><div class="quiz-progress" aria-label="${r.answered} / ${r.total} tamamlandı"><span style="width:${100 * r.answered / r.total}%"></span></div>
    <div class="quiz-layout"><section class="question-card" style="${courseStyle(c)}"><div class="question-meta"><div><div class="question-course">${icon(c.icon)}${esc(c.title)}</div><div class="question-number" style="margin-top:7px">Soru ${s.index + 1} / ${r.total} · Bölüm ${q.chapter} · ${q.kind === "derived" ? "Kaynak metinden çalışma" : "Kitap testi"}</div></div><button class="icon-btn ${state.bookmarks.includes(q.id) ? "on" : ""}" data-action="bookmark" data-id="${q.id}" aria-pressed="${state.bookmarks.includes(q.id)}" aria-label="${state.bookmarks.includes(q.id) ? "İşareti kaldır" : "Soruyu daha sonra çalışmak için işaretle"}">${icon("star")}</button></div>
    <h1 class="question-stem">${esc(q.stem)}</h1><div class="options" role="group" aria-label="Yanıt seçenekleri">${q.options.map((opt, i) => `<button class="option ${a ? i === q.answer ? "correct" : i === a.choice ? "wrong" : "" : ""}" data-action="answer" data-choice="${i}" ${a ? "disabled" : ""}><span class="letter">${String.fromCharCode(65 + i)}</span><span class="option-text">${esc(opt)}</span>${a && (i === q.answer || i === a.choice) ? `<span class="status-icon" aria-label="${i === q.answer ? "Doğru seçenek" : "Seçtiğin yanlış seçenek"}">${icon(i === q.answer ? "check" : "cross")}</span>` : ""}</button>`).join("")}</div>
    ${a ? `<div class="feedback ${isRight ? "" : "error"}" id="feedback" tabindex="-1" role="status"><h3>${icon(isRight ? "check" : "book")}${isRight ? "Doğru. Bir adım daha!" : "Bu soruyu birlikte netleştirelim."}</h3>${!isRight ? `<div class="correct-answer">Doğru yanıt: ${String.fromCharCode(65 + q.answer)} · ${esc(q.options[q.answer])}</div>` : ""}<p>${esc(q.explanation)}</p><button class="source-link" data-action="source" data-id="${q.id}">${icon("book")}Basılı kitap s. ${q.source.pages.join(", ")} · Kaynağı gör ${icon("arrow")}</button></div>` : '<p class="quiz-tip">Bir seçeneğe dokunduğunda yanıtın kaydedilir ve açıklama açılır.</p>'}
    <div class="quiz-controls"><button class="btn ghost" data-action="previous" ${s.index === 0 ? "disabled" : ""}>${icon("left")}Önceki</button>${r.blank === 0 ? '<button class="btn primary" data-action="finish">Sonuçları gör</button>' : `<button class="btn primary" data-action="next">${a ? "Sonraki soru" : "Şimdilik geç"} ${icon("arrow")}</button>`}</div></section>
    <aside class="quiz-aside"><div class="panel"><h3>Soru haritası</h3><div class="question-map">${s.questionIds.map((id, i) => { const an = s.answers[id]; return `<button data-action="jump" data-index="${i}" class="${i === s.index ? "current" : ""} ${an ? an.choice === qs.get(id).answer ? "right" : "wrong" : ""}" aria-label="Soru ${i + 1}: ${an ? an.choice === qs.get(id).answer ? "doğru" : "yanlış" : "yanıtlanmadı"}"${i === s.index ? ' aria-current="step"' : ""}>${i + 1}</button>`; }).join("")}</div><div class="map-legend"><span><i style="background:#96b995"></i>${r.correct} doğru</span><span><i style="background:#d5a2af"></i>${r.wrong} yanlış</span><span><i style="background:#d9dfd0"></i>${r.blank} bekleyen</span></div><button class="text-btn" style="margin-top:17px" data-action="finish">Denemeyi bitir ${icon("arrow")}</button></div><p class="quiz-tip">Yanıtlar otomatik kaydedilir.<br>Dilediğin soruya dönebilirsin.</p></aside></div>`;
  }
  function reviewIds() {
    const ids = reviewTab === "wrong" ? C.wrongIds(state, B) : state.bookmarks;
    return ids.filter(id => qs.has(id) && (reviewCourse === "all" || qs.get(id).courseId === reviewCourse));
  }
  function review() {
    const ids = reviewIds(), totalWrong = C.wrongIds(state, B).length;
    return intro("ÖĞRENMENİN İKİNCİ TURU", "Tekrar kutun.", "Yanlışlarını pekiştir, işaretlediğin sorulara yeniden bak.") +
    `<div class="filterbar"><div class="tabs" role="group" aria-label="Tekrar türü"><button class="${reviewTab === "wrong" ? "selected" : ""}" data-action="review-tab" data-tab="wrong">Yanlışlarım (${totalWrong})</button><button class="${reviewTab === "bookmarks" ? "selected" : ""}" data-action="review-tab" data-tab="bookmarks">İşaretlediklerim (${state.bookmarks.length})</button></div><select id="review-course" aria-label="Tekrar listesini derse göre süz"><option value="all">Bütün dersler</option>${B.courses.map(c => `<option value="${c.id}" ${reviewCourse === c.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></div>
    ${ids.length ? `<div class="resume"><div><strong>${ids.length} soru yeniden çalışılmayı bekliyor.</strong><p>Bu turda ${Math.min(ids.length, 30)} farklı soru. Doğru yanıtlanan soru yanlışlar listesinden çıkar.</p></div><button class="btn primary" data-action="start-review">${icon("repeat")}Tekrar testini başlat</button></div><div class="review-list">${ids.map(id => reviewItem(qs.get(id), false)).join("")}</div>` : `<div class="empty">${icon(reviewTab === "wrong" ? "check" : "star")}<h2>${reviewTab === "wrong" ? "Burada bekleyen yanlışın yok." : "Henüz işaretlediğin soru yok."}</h2><p>${reviewTab === "wrong" ? "Yanlış yanıtladığın sorular buraya gelir. Daha sonraki çalışmada doğru yanıtladığında listeden çıkar." : "Deneme sırasında yıldız simgesine dokunarak bir soruyu bu listeye ekleyebilirsin."}</p><a class="btn primary" href="#practice">Yeni bir deneme seç ${icon("arrow")}</a></div>`}`;
  }
  function reviewItem(q, showAnswer, selected) {
    const c = courses.get(q.courseId);
    return `<article class="review-item" style="${courseStyle(c)}"><span class="course-icon">${icon(c.icon)}</span><div class="review-body"><p>${esc(c.title)} · Bölüm ${q.chapter}</p><h3>${esc(q.stem)}</h3>${showAnswer ? `<p style="color:${selected === q.answer ? "var(--teal)" : "var(--red)"}">${selected === undefined ? "Boş bırakıldı." : `Yanıtın: ${String.fromCharCode(65 + selected)} · ${esc(q.options[selected])}`}</p><p style="color:var(--teal);margin-top:6px">Doğru: ${String.fromCharCode(65 + q.answer)} · ${esc(q.options[q.answer])}</p><p style="font-size:13px;margin-top:11px">${esc(q.explanation)}</p>` : ""}<div class="actions"><button class="text-btn" data-action="source" data-id="${q.id}">${icon("book")}Kaynak · s. ${q.source.pages.join(", ")}</button>${!showAnswer ? `<button class="text-btn" data-action="single-review" data-id="${q.id}">Bu soruyu çalış ${icon("arrow")}</button>` : ""}</div></div><button class="icon-btn ${state.bookmarks.includes(q.id) ? "on" : ""}" data-action="bookmark" data-id="${q.id}" aria-label="${state.bookmarks.includes(q.id) ? "Sorunun işaretini kaldır" : "Soruyu işaretle"}" aria-pressed="${state.bookmarks.includes(q.id)}">${icon("star")}</button></article>`;
  }
  function backupPanel() {
    return `<section class="backup-panel"><div><h2>Çalışmanı yanında taşı.</h2><p>Kayıtların bu tarayıcıda kalır. Yedeği indirip diğer cihazda içe aktararak geçmişini birleştirebilirsin. Cihazlar otomatik eşitlenmez.</p></div><div class="actions"><button class="btn" data-action="export">${icon("download")}Yedek indir</button><button class="btn" data-action="import">${icon("upload")}İçe aktar</button></div></section>`;
  }
  function history() {
    const list = [...state.history].reverse().filter(s => historyFilter === "all" || (historyFilter === "complete" ? s.completed : !s.completed));
    return intro("EMEĞİN KAYBOLMASIN", "Çalışma geçmişin.", "Her deneme, her tekrar, kaldığın yer. Hepsi burada.") +
    resume() + `<div class="filterbar"><div class="tabs" role="group" aria-label="Geçmiş filtresi">${[["all", "Tümü"], ["complete", "Tamamlanan"], ["partial", "Erken bitirilen"]].map(([id, label]) => `<button class="${historyFilter === id ? "selected" : ""}" data-action="history-filter" data-filter="${id}">${label}</button>`).join("")}</div><span class="small muted">${list.length} kayıt</span></div>` +
    (list.length ? `<div class="history-list">${list.map(s => { const r = C.result(s, B); return `<article class="history-card"><div class="history-score">%${r.score}</div><div class="history-info"><h3>${esc(titleFor(s))}</h3><p>${date(s.endedAt)} · ${time(s.endedAt)} · ${duration(s.elapsedSeconds)}</p>${!s.completed ? '<p style="margin-top:6px">Erken bitirildi · boşlar toplam puana dahil</p>' : ""}</div><div class="history-breakdown"><b>${r.correct} doğru</b> · <em>${r.wrong} yanlış</em><br>${r.blank ? `${r.blank} boş · ` : ""}${r.total} soru</div><button class="btn" data-action="result" data-id="${s.id}">İncele ${icon("arrow")}</button></article>`; }).join("")}</div>` : `<div class="empty">${icon("history")}<h2>Geçmişin ilk denemeyle başlayacak.</h2><p>Bir denemeyi bitirdiğinde sonucu ve soru açıklamalarını burada yeniden açabilirsin.</p><a class="btn primary" href="#practice">Deneme seç ${icon("arrow")}</a></div>`) + backupPanel();
  }
  function resultPage(id) {
    const s = state.history.find(s => s.id === id);
    if (!s) return `<div class="empty"><h2>Bu kayıt bulunamadı.</h2><a class="btn" href="#history">Çalışma geçmişine dön</a></div>`;
    const r = C.result(s, B), wrong = s.questionIds.filter(id => s.answers[id] && s.answers[id].choice !== qs.get(id).answer);
    return `<section class="result-hero"><div class="eyebrow">${esc(titleFor(s))}</div><div class="score-ring" style="--score:${r.score}"><div><strong>${r.score}</strong><span>100 üzerinden</span></div></div><h1>${s.completed ? r.score === 100 ? "Bu tur eksiksiz tamamlandı." : "Bir çalışma daha geride kaldı." : "Bu deneme kaydedildi."}</h1><p>${s.completed ? "Açıklamaları inceleyebilir, yanlışlarına yeniden dönebilirsin." : "Erken bitirdiğin denemede boş bıraktığın sorular aşağıda yer alıyor."}</p><div class="result-stats"><span><b>${r.correct}</b>DOĞRU</span><span><b>${r.wrong}</b>YANLIŞ</span><span><b>${r.blank}</b>BOŞ</span><span><b>${duration(s.elapsedSeconds)}</b>SÜRE</span></div></section>
    <div class="result-actions">${wrong.length ? `<button class="btn primary" data-action="retry-session" data-id="${s.id}">${icon("repeat")}${wrong.length} yanlışı tekrar çöz</button>` : ""}<a class="btn" href="#practice">Yeni deneme ${icon("arrow")}</a><a class="btn ghost" href="#history">Geçmişe dön</a></div><p class="section-text" style="margin-bottom:20px">Puan: doğru / toplam soru × 100. Yanlışlar doğruyu götürmez. Bu çalışma puanı resmî sınav başarı ölçütü değildir.</p>
    <div class="panel-head"><h2>Soru incelemesi</h2><span class="small muted">${date(s.endedAt)}</span></div><div class="review-list">${s.questionIds.map(id => reviewItem(qs.get(id), true, s.answers[id]?.choice)).join("")}</div>`;
  }
  function sources() {
    return intro("HER BİLGİNİN BİR DAYANAĞI VAR", "Kaynak kitapların.", "Soruyu, cevabı ve açıklamayı aynı kitaptan takip et.", "Basılı sayfa esaslı") +
    `<div class="sources-intro"><b>Anadolu Üniversitesi · Eylül 2020 baskıları</b>Bu havuz, beş resmî ders kitabından 150 bölüm sonu sorusu ile konu metinlerine dayalı 450 ek çalışma sorusu içerir. Kitap testleri kaynak seçenekleri ve cevap anahtarıyla kontrol edilmiştir. Ek sorular, kaynak metindeki farklı kavram ve bilgileri sınar; kitabın özgün test sorusu olarak sunulmaz. Her sorunun doğru cevabı, açıklaması ve basılı sayfası kaynakla eşleştirilmiştir. Sorular sınavda çıkmış soru olarak sunulmaz. Kitap sürümü ile güncel müfredatın aynı olduğu ayrıca doğrulanmış değildir.</div>
    <div class="source-grid">${B.courses.map(c => { const list = B.questions.filter(q => q.courseId === c.id), chapters = [...new Set(list.map(q => q.chapter))]; return `<article class="source-card" style="${courseStyle(c)}"><span class="course-icon">${icon(c.icon)}</span><h3>${esc(c.title)}</h3><p>${esc(c.publisher)} · ${esc(c.edition)}<br>E-ISBN: ${esc(c.isbn)}</p><div class="coverage">${list.length} kaynaklı soru · ${chapters.length} bölüm</div><p class="small">${list.filter(q => q.kind !== "derived").length} kitap testi · ${list.filter(q => q.kind === "derived").length} ek çalışma sorusu</p><p class="small">${chapters.map(ch => `B${ch}: ${list.filter(q => q.chapter === ch).length} soru`).join(" · ")}</p><button class="btn" data-action="bind-pdf" data-course="${c.id}">${icon(boundBooks.has(c.id) ? "check" : "folder")}${boundBooks.has(c.id) ? "PDF bağlı · değiştir" : "Kitap PDF’sini bağla"}</button><p class="small">${boundBooks.has(c.id) ? "PDF bu tarayıcıda kayıtlı. Kaynak düğmelerinden ilgili basılı sayfaya ulaşabilirsin." : `Dosya: ${esc(c.fileName)}`}</p></article>`; }).join("")}</div>
    <p class="section-text">PDF bağlamak isteğe bağlıdır; sorular ve açıklamalar hazırdır. Bağladığın PDF sunucuya gönderilmez, bu tarayıcıda tutulur. Dosyanın doğrulanan kitapla aynı olduğu kontrol edilir. Her kaynak bağlantısında yalnızca kitaba basılmış sayfa numarası gösterilir.</p>
    <details class="exclusions"><summary>Bankaya alınmayan sorular (${B.excluded.length})</summary><ul>${B.excluded.map(e => `<li><strong>${esc(courses.get(e.courseId)?.title || e.courseId)}, Bölüm ${e.chapter}, Soru ${e.number}:</strong> ${esc(e.reason)}</li>`).join("")}</ul></details>
    <div class="source-note">Bu bağımsız bir kişisel çalışma aracıdır; Anadolu Üniversitesi veya GSB’nin resmî uygulaması değildir. Kitapların ve soru metinlerinin hakları kaynak yayıncıya aittir. Herkese açık yayımlamadan önce içerik haklarını değerlendirin.</div>${backupPanel()}`;
  }
  function render() {
    const route = getRoute(), current = route === "quiz" ? "practice" : route.startsWith("result/") ? "history" : ["home", "practice", "review", "history", "sources"].includes(route) ? route : "home";
    const body = route === "quiz" ? quiz() : route.startsWith("result/") ? resultPage(route.slice(7)) : ({ home, practice, review, history, sources }[current])();
    root.innerHTML = shell(body, current);
    document.title = `${({ home: "Çalışma alanım", practice: "Deneme çöz", review: "Tekrar kutusu", history: "Çalışma geçmişi", sources: "Kaynaklarım" }[current])} · Kademe 2`;
  }
  function requestStart(mode, courseId = null, ids = []) {
    if (state.active) {
      pendingStart = { mode, courseId, ids };
      showDialog("Devam eden bir denemen var.", `<p>${esc(titleFor(state.active))} içindeki yanıtların kaydedildi. Yeni denemeye geçersen mevcut çalışma erken bitirilmiş olarak geçmişine eklenir.</p><div class="actions"><button class="btn primary" data-action="continue">Kaldığım yerden devam</button><button class="btn" data-action="replace-session">Kaydet ve yeni denemeye geç</button></div>`);
      return;
    }
    try { state.active = C.createSession(B, mode, courseId, ids); save(); go("quiz"); }
    catch (e) { toast(e.message); }
  }
  function finishRequest() {
    if (!state.active) return;
    const r = C.result(state.active, B);
    if (r.blank) {
      showDialog("Denemeyi burada bitirelim mi?", `<p>${r.blank} soru henüz yanıtlanmadı. Sonuç ${r.total} soru üzerinden hesaplanacak ve çalışma geçmişine erken bitirilmiş olarak kaydedilecek.</p><div class="actions"><button class="btn primary" data-action="close">Çözmeye devam</button><button class="btn" data-action="finish-confirm">Bitir ve sonucu göster</button></div>`);
    } else finishNow();
  }
  function finishNow() {
    const s = C.finish(state, B); save(); dialog.close(); if (s) go(`result/${s.id}`);
  }
  function sourceDialog(id) {
    const q = qs.get(id), c = courses.get(q.courseId);
    showDialog("Kitaptaki dayanağı", `<p><strong>${esc(c.title)}</strong><br>${esc(c.edition)} · Bölüm ${q.chapter}: ${esc(q.chapterTitle)}</p><div class="source-pages">Açıklama: <strong>basılı s. ${q.source.pages.join(", ")}</strong><br>${q.kind === "derived" ? "Tür: <strong>Kaynak metinden hazırlanan çalışma sorusu</strong><br>Doğru yanıt, aşağıdaki konu metninden doğrulandı." : `Sorunun aslı: <strong>basılı s. ${q.source.questionPage}</strong> · Soru ${q.number}<br>Cevap anahtarı: <strong>basılı s. ${q.source.answerPage}</strong>`}</div><p>${esc(q.explanation)}</p><blockquote>${esc(q.source.evidence)}</blockquote><p class="small">Kaynak bölümü: ${esc(q.source.section)}. Kaynak metnindeki satır sonları ve PDF’den gelen boşluklar okunabilirlik için sadeleştirilmiştir.</p><div class="actions">${q.source.pages.map(p => `<button class="btn primary" data-action="open-pdf" data-course="${c.id}" data-page="${p}">${icon("book")}Kitapta aç · s. ${p}</button>`).join("")}</div><p class="small" style="margin-top:14px">${boundBooks.has(c.id) ? "Bağladığın kitap bu cihazda açılır." : "Kitapta açmak için önce bu cihazdaki kaynak PDF’yi seçebilirsin."}</p>`);
  }
  function download(name, content, type = "application/json") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("kademe2-books", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("books");
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async function bookGet(id) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction("books", "readonly"), req = tx.objectStore("books").get(id);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      tx.oncomplete = () => database.close();
    });
  }
  async function bookPut(id, value) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction("books", "readwrite"); tx.objectStore("books").put(value, id);
      tx.oncomplete = () => { database.close(); resolve(); }; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  function choosePdf(courseId, page = null) {
    pendingPdf = { courseId, page };
    const el = document.getElementById("pdf-file"); el.value = ""; el.click();
  }
  async function openPdf(courseId, page) {
    // Open a browsing context synchronously so mobile browsers do not block it.
    let child = null;
    if (boundBooks.has(courseId)) child = window.open("about:blank", "_blank");
    try {
      const saved = await bookGet(courseId);
      if (!saved) { if (child) child.close(); choosePdf(courseId, page); return; }
      const c = courses.get(courseId), pdfPage = c.pageMap[String(page)];
      if (!pdfPage) { if (child) child.close(); toast("Bu basılı sayfanın PDF eşleştirmesi bulunamadı."); return; }
      const url = URL.createObjectURL(saved.blob); objectUrls.push(url);
      if (child) { child.opener = null; child.location.href = `${url}#page=${pdfPage}`; }
      else showDialog("Kitabı aç", `<p>Tarayıcı yeni pencereyi engelledi. Aşağıdaki bağlantıdan kitabı açabilirsin. Kitaptaki basılı sayfa: ${page}.</p><a class="btn primary" href="${url}#page=${pdfPage}" target="_blank" rel="noopener">PDF’yi aç</a>`);
    } catch (_) {
      if (child) child.close();
      toast("Bu tarayıcı PDF saklamaya izin vermiyor. Açıklama ve basılı sayfa bilgisi yine kullanılabilir.");
    }
  }
  document.getElementById("pdf-file").addEventListener("change", async event => {
    const file = event.target.files[0], pending = pendingPdf;
    if (!file || !pending) return;
    if (file.size > 90 * 1024 * 1024) { toast("Kaynak kitap için 90 MB sınırı aşıldı."); return; }
    toast("Kitap doğrulanıyor…");
    try {
      const bytes = await file.arrayBuffer();
      if (!crypto.subtle) throw new Error("PDF doğrulama için uygulamayı HTTPS adresinden açın.");
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
      if (hash !== courses.get(pending.courseId).sha256) throw new Error("Bu PDF, doğrulanan kitap dosyasıyla eşleşmiyor. Kaynaklar ekranındaki asıl dosyayı seçin.");
      await bookPut(pending.courseId, { blob: file, name: file.name, sha256: hash });
      boundBooks.add(pending.courseId); toast("Kitap doğrulandı ve bu tarayıcıya bağlandı.");
      if (pending.page) {
        dialog.close();
        showDialog("Kitap hazır.", `<p>Doğrulanan PDF bu tarayıcıya kaydedildi. İlgili basılı sayfayı şimdi açabilirsin.</p><button class="btn primary" data-action="open-pdf" data-course="${pending.courseId}" data-page="${pending.page}">Kitapta aç · s. ${pending.page}</button>`);
      } else render();
    } catch (e) { toast(e.message || "PDF bağlanamadı. Tarayıcı depolama alanını kontrol edin."); }
  });
  document.getElementById("import-file").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast("Yedek dosyası 10 MB’tan küçük olmalı."); return; }
    try {
      const data = JSON.parse(await file.text());
      const imported = C.validateState(data.state || data, B);
      state = C.mergeStates(state, imported, B); save(); render(); toast("Yedek birleştirildi. Aynı kayıtlar ikinci kez eklenmedi.");
    } catch (e) { toast(e.message || "Dosya okunamadı. Geçerli bir Kademe 2 yedeği seçin."); }
  });
  document.addEventListener("change", event => {
    if (event.target.id === "review-course") { reviewCourse = event.target.value; render(); }
  });
  document.addEventListener("click", event => {
    const el = event.target.closest("[data-action]"); if (!el || el.disabled) return;
    const { action, id, mode, course, choice, index, tab, filter, page } = el.dataset;
    switch (action) {
      case "skip-content": event.preventDefault(); document.getElementById("main")?.focus(); break;
      case "start": requestStart(mode, course); break;
      case "continue": dialog.close(); go("quiz"); break;
      case "pause": save(); go("home"); toast("Yanıtların kaydedildi. Dilediğinde devam edebilirsin."); break;
      case "close": dialog.close(); break;
      case "replace-session":
        if (pendingStart) { C.finish(state, B); const p = pendingStart; pendingStart = null; dialog.close(); requestStart(p.mode, p.courseId, p.ids); } break;
      case "answer": {
        const s = state.active; if (!s) break;
        if (C.answer(s, s.questionIds[s.index], Number(choice), B)) {
          save(); render();
          document.getElementById("feedback")?.focus({ preventScroll: true });
          document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } break;
      }
      case "next": {
        const s = state.active; if (!s) break;
        const r = C.result(s, B);
        if (!r.blank) { finishRequest(); break; }
        s.index = s.index < s.questionIds.length - 1 ? s.index + 1 : s.questionIds.findIndex(id => !s.answers[id]);
        save(); render(); window.scrollTo(0, 0); break;
      }
      case "previous": if (state.active) { state.active.index = Math.max(0, state.active.index - 1); save(); render(); window.scrollTo(0, 0); } break;
      case "jump": if (state.active) { state.active.index = Number(index); save(); render(); window.scrollTo(0, 0); } break;
      case "bookmark": {
        const pos = state.bookmarks.indexOf(id);
        if (pos >= 0) state.bookmarks.splice(pos, 1); else if (qs.has(id)) state.bookmarks.push(id);
        save(); render(); toast(pos >= 0 ? "Sorunun işareti kaldırıldı." : "Soru tekrar kutuna işaretlendi."); break;
      }
      case "finish": finishRequest(); break;
      case "finish-confirm": finishNow(); break;
      case "review-tab": reviewTab = tab; render(); break;
      case "history-filter": historyFilter = filter; render(); break;
      case "start-review": requestStart(reviewTab === "wrong" ? "review" : "bookmarks", null, reviewIds()); break;
      case "single-review": requestStart("review", null, [id]); break;
      case "result": go(`result/${id}`); break;
      case "retry-session": {
        const s = state.history.find(s => s.id === id);
        if (s) requestStart("review", null, s.questionIds.filter(qid => s.answers[qid] && s.answers[qid].choice !== qs.get(qid).answer)); break;
      }
      case "source": sourceDialog(id); break;
      case "export": download(`kademe2-yedek-${C.localDay(Date.now())}.json`, JSON.stringify({ app: "Kademe 2", exportedAt: new Date().toISOString(), bankVersion: B.version, state }, null, 2)); toast("Çalışma yedeği indirildi."); break;
      case "corrupt-export": download("kademe2-kurtarma.json", corrupted); break;
      case "reset-corrupt": showDialog("Yeni kayıt başlat", '<p>Okunamayan eski kayıt bu tarayıcıdan kaldırılacak. Önce kurtarma kopyasını indirdiğinden emin ol.</p><div class="actions"><button class="btn" data-action="close">Vazgeç</button><button class="btn danger" data-action="reset-confirm">Eski kaydı kaldır ve devam et</button></div>'); break;
      case "reset-confirm": corrupted = ""; storageWarning = ""; save(); dialog.close(); render(); break;
      case "import": { const f = document.getElementById("import-file"); f.value = ""; f.click(); break; }
      case "bind-pdf": choosePdf(course); break;
      case "open-pdf": openPdf(course, Number(page)); break;
      case "help": showDialog("Kendi ritminde çalış.", `<ol class="help-list"><li><strong>Deneme seç:</strong> Karışık denemede her dersten 6 soru; ders denemesinde aynı dersten 30 soru gelir.</li><li><strong>Bir seçeneğe dokun:</strong> Yanıt hemen kaydedilir. Doğru seçenek, açıklama ve basılı kitap sayfası açılır.</li><li><strong>Ara ver:</strong> Kaldığın yer otomatik saklanır. Yanıtlanan seçenekler sonradan değiştirilemez.</li><li><strong>Tekrar et:</strong> Yanlışlar tekrar kutusuna gelir. Bir soruya sonraki çalışmada doğru yanıt verirsen bu listeden çıkar.</li><li><strong>Yedek al:</strong> Geçmiş ekranından yedeğini indir, diğer cihazda içe aktar. Kayıtlar kendiliğinden cihazlar arasında eşitlenmez.</li><li><strong>Telefona ekle:</strong> Samsung Internet veya Chrome menüsündeki “Ana ekrana ekle / Uygulamayı yükle” seçeneğini kullan. İlk çevrimiçi yüklemeden sonra bu adreste çevrimdışı çalışabilir.</li></ol><p class="small">Kaynaklar: Anadolu Üniversitesi, Eylül 2020 kitapları. Bu bağımsız araç resmî sınav uygulaması değildir.</p>`); break;
    }
  });
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); document.getElementById("main")?.focus({ preventScroll: true }); });
  window.addEventListener("storage", event => {
    if (event.key !== KEY || !event.newValue) return;
    try { state = C.validateState(JSON.parse(event.newValue), B); render(); toast("Diğer sekmedeki çalışma kaydı güncellendi."); } catch (_) {}
  });
  // Count only time spent on a visible quiz, not time away from the app.
  setInterval(() => {
    if (getRoute() !== "quiz" || document.hidden || !state.active || dialog.open) return;
    state.active.elapsedSeconds++;
    const el = document.getElementById("elapsed"); if (el) el.textContent = duration(state.active.elapsedSeconds);
    if (state.active.elapsedSeconds % 5 === 0) save();
  }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  window.addEventListener("pagehide", save);
  render();
  Promise.all(B.courses.map(async c => {
    try { if (await bookGet(c.id)) boundBooks.add(c.id); } catch (_) {}
  })).then(() => { if (getRoute() === "sources") render(); });
  if ("serviceWorker" in navigator && /^(http:|https:)$/.test(location.protocol)) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
