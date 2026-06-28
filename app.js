/* app.js — 폼 ↔ 스펙 ↔ .docx 생성 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var val = function (id) { var e = $(id); return e ? e.value.trim() : ""; };
  var setVal = function (id, v) { var e = $(id); if (e) e.value = (v == null ? "" : v); };
  var checked = function (id) { var e = $(id); return e ? e.checked : false; };
  var lines = function (t) { return (t || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); };
  var splitList = function (t) { return (t || "").split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean); };

  var mode = "writing";
  var state = clone(window.PRESETS.writing); // 작업용 전체 스펙(steps·rubric 등 구조 보존)

  // ---------------- 동적 목록 렌더 ----------------
  function rowDel(onClick) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "del"; b.title = "삭제"; b.textContent = "×";
    b.addEventListener("click", onClick);
    return b;
  }

  function renderStandards(arr) {
    var box = $("standardsList"); box.innerHTML = "";
    (arr && arr.length ? arr : [{ code: "", text: "" }]).forEach(function (s) {
      var row = document.createElement("div"); row.className = "row";
      var code = document.createElement("input");
      code.type = "text"; code.className = "code-in"; code.placeholder = "12영Ⅱ-02-01"; code.value = s.code || "";
      var text = document.createElement("input");
      text.type = "text"; text.className = "text-in"; text.placeholder = "성취기준 문장"; text.value = s.text || "";
      [code, text].forEach(function (i) { i.addEventListener("input", live); });
      row.appendChild(code); row.appendChild(text);
      row.appendChild(rowDel(function () { row.remove(); live(); }));
      box.appendChild(row);
    });
  }
  function readStandards() {
    return [].slice.call($("standardsList").querySelectorAll(".row")).map(function (r) {
      return { code: r.querySelector(".code-in").value.trim(), text: r.querySelector(".text-in").value.trim() };
    }).filter(function (s) { return s.code || s.text; });
  }

  function renderCondList(kind, arr) {
    var box = $(kind + "List"); box.innerHTML = "";
    var items = (arr && arr.length) ? arr.slice() : ["", "", "", "", ""];
    while (items.length < 5) items.push("");
    items.forEach(function (v, i) { box.appendChild(condRow(kind, i + 1, v)); });
    updateCount(kind);
  }
  function condRow(kind, n, v) {
    var row = document.createElement("div"); row.className = "row";
    var num = document.createElement("span"); num.className = "num"; num.textContent = n;
    var inp = document.createElement("input");
    inp.type = "text"; inp.className = "text-in";
    inp.placeholder = kind === "expr" ? "예: I suggest that S+V — 제안하기" : "예: 가정법 과거 / to부정사의 부사적 용법";
    inp.value = v || "";
    inp.addEventListener("input", function () { updateCount(kind); live(); });
    row.appendChild(num); row.appendChild(inp);
    row.appendChild(rowDel(function () { row.remove(); renumber(kind); updateCount(kind); live(); }));
    return row;
  }
  function renumber(kind) {
    [].slice.call($(kind + "List").querySelectorAll(".row")).forEach(function (r, i) { r.querySelector(".num").textContent = i + 1; });
  }
  function readCondList(kind) {
    return [].slice.call($(kind + "List").querySelectorAll(".text-in")).map(function (i) { return i.value.trim(); }).filter(Boolean);
  }
  function updateCount(kind) {
    var filled = readCondList(kind).length;
    var el = $(kind + "Count"); el.textContent = filled + "개";
    el.classList.remove("full");
  }

  // ---------------- 섹션 텍스트 직렬화(쓰기 2차시) ----------------
  function serializeSections(arr) {
    return (arr || []).map(function (s) { return (s.label || "") + " | " + (s.lines || 4); }).join("\n");
  }
  function parseSections(t) {
    return lines(t).map(function (ln) {
      var i = ln.lastIndexOf("|");
      if (i < 0) return { label: ln, lines: 4 };
      var label = ln.slice(0, i).trim();
      var n = parseInt(ln.slice(i + 1).trim(), 10);
      return { label: label, lines: isNaN(n) ? 4 : n };
    }).filter(function (s) { return s.label; });
  }

  // ---------------- 폼 채우기 (state → 화면) ----------------
  function fillForm() {
    setVal("title", state.title); setVal("subtitle", state.subtitle);
    setVal("school", state.school); setVal("grade", state.grade);
    setVal("purpose", state.purpose);
    renderStandards(state.standards);
    var c = state.conditions || {};
    setVal("length", c.length);
    setVal("contentElements", (c.content_elements || []).join(", "));
    renderCondList("expr", c.required_expressions);
    renderCondList("gram", c.required_grammar);

    if (mode === "writing") {
      var s1 = state.session1 || {}, s2 = state.session2 || {};
      $("mindmapOn").checked = s1.mindmap !== false;
      setVal("mindmapTopic", s1.mindmap_topic);
      setVal("lengthNote", s2.length_note);
      setVal("writingSections", serializeSections(s2.sections));
    } else {
      var sp1 = state.session1 || {}, sp2 = state.session2 || {};
      setVal("keyCount", (sp1.key_sentences && sp1.key_sentences.count) || 4);
      setVal("timeLimit", sp2.time_limit);
      setVal("selfEval", (sp1.self_eval || []).join("\n"));
      setVal("peerEval", (sp1.peer_eval || []).join("\n"));
    }
    $("rubricOn").checked = !!state.rubric;
    renderRubric();
    $("modelOn").checked = !!state.model_answer;
    $("modelWrap").hidden = !state.model_answer;
    setVal("modelAnswer", state.model_answer || "");
    setVal("modelNotes", (state.model_answer_notes || []).join("\n"));
    applyModeUI();
  }

  // ---------------- 스펙 조립 (화면 → 스펙) ----------------
  function collectSpec() {
    var s = clone(state);          // steps·outline_card·rubric 서술어 등 구조 유지
    s.mode = mode;
    s.title = val("title"); s.subtitle = val("subtitle");
    s.school = val("school"); s.grade = val("grade"); s.purpose = val("purpose");
    s.standards = readStandards();
    s.conditions = s.conditions || {};
    s.conditions.length = val("length");
    s.conditions.content_elements = splitList(val("contentElements"));
    s.conditions.required_expressions = readCondList("expr");
    s.conditions.required_grammar = readCondList("gram");

    if (mode === "writing") {
      s.session1 = s.session1 || {};
      s.session1.mindmap = checked("mindmapOn");
      s.session1.mindmap_topic = val("mindmapTopic");
      s.session2 = s.session2 || {};
      s.session2.length_note = val("lengthNote");
      var secs = parseSections(val("writingSections"));
      if (secs.length) s.session2.sections = secs;
    } else {
      s.session1 = s.session1 || {};
      s.session1.key_sentences = s.session1.key_sentences || {};
      var kc = parseInt(val("keyCount"), 10); s.session1.key_sentences.count = isNaN(kc) ? 4 : kc;
      s.session1.self_eval = lines(val("selfEval"));
      s.session1.peer_eval = lines(val("peerEval"));
      s.session2 = s.session2 || {};
      s.session2.time_limit = val("timeLimit");
    }

    if (!checked("rubricOn")) delete s.rubric;
    if (checked("modelOn")) { s.model_answer = val("modelAnswer"); s.model_answer_notes = lines(val("modelNotes")); }
    else { delete s.model_answer; delete s.model_answer_notes; }
    return s;
  }

  // ---------------- 루브릭 미리보기 ----------------
  function renderRubric() {
    var box = $("rubricPreview");
    var r = state.rubric;
    if (!r || !checked("rubricOn")) { box.innerHTML = ""; box.style.display = checked("rubricOn") ? "" : "none"; return; }
    box.style.display = "";
    var levels = r.levels || ["A", "B", "C", "D", "E"];
    var crits = r.criteria || [];
    var ne = readCondList("expr").length, ng = readCondList("gram").length;
    var fmtW = function (w) {
      return String(w).replace(/\{NE\}/g, ne > 0 ? (" " + ne) : "").replace(/\{NG\}/g, ng > 0 ? (" " + ng) : "");
    };
    var html = '<table class="rub"><thead><tr><th>수준</th>' +
      crits.map(function (cr) { return "<th>" + esc(cr.name) + (cr.weight ? "<small>(" + esc(fmtW(cr.weight)) + ")</small>" : "") + "</th>"; }).join("") + "</tr></thead><tbody>";
    levels.forEach(function (l) {
      html += '<tr><td class="crit">' + esc(l) + "</td>";
      crits.forEach(function (cr) {
        var d = (cr.descriptors && (cr.descriptors[l] != null ? cr.descriptors[l] : cr.descriptors[levels.indexOf(l)])) || "";
        html += '<td class="lv">' + esc(String(d)) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    box.innerHTML = html;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  // ---------------- 생성될 구성 미리보기 ----------------
  function renderOutline(spec) {
    var ol = $("outline"); ol.innerHTML = "";
    var add = function (html) { var li = document.createElement("li"); li.innerHTML = html; ol.appendChild(li); };
    add("<b>평가 안내</b> — 목적·성취기준 " + (spec.standards || []).length + "개·조건(표현 " + (spec.conditions.required_expressions || []).length + "·문법 " + (spec.conditions.required_grammar || []).length + ")");
    if (spec.mode === "writing") {
      var s1 = spec.session1 || {}, s2 = spec.session2 || {};
      var step = 0;
      var parts = [];
      if (s1.mindmap !== false) { step++; parts.push("STEP " + step + " 마인드맵"); }
      (s1.steps || []).forEach(function (st) { step++; parts.push("STEP " + step + " " + st.title + (st.points != null ? " (" + st.points + "점)" : "")); });
      add("<b>쓰기 1차시</b> — " + (parts.join(" · ") || "단계별 구상"));
      add("<b>쓰기 2차시</b> — 작성 지침 + 제안서 머리 + 본문 " + ((s2.sections || []).length || 4) + "섹션");
    } else {
      var sp1 = spec.session1 || {};
      add("<b>말하기 1차시</b> — 개요 카드 · 핵심 문장 " + ((sp1.key_sentences && sp1.key_sentences.count) || 4) + "칸 · 자기평가 · 동료평가");
      add("<b>말하기 2차시</b> — 구술 (" + ((spec.session2 || {}).time_limit || "시간 미정") + ")");
    }
    if (spec.rubric) add("<b>채점 기준(교사용)</b> — 성취수준 " + (spec.rubric.levels || ["A", "B", "C", "D", "E"]).join("·"));
    if (spec.model_answer) add("<b>예시 답안(교사용)</b>");
  }

  // ---------------- live 갱신 ----------------
  var liveTimer = null;
  function live() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      var spec = collectSpec();
      renderOutline(spec);
      renderRubric();
      if (!checked("useJson")) {
        $("specJson").value = JSON.stringify(spec, null, 2);
        $("jsonStatus").textContent = ""; $("jsonStatus").className = "json-status";
      }
    }, 120);
  }

  // ---------------- 모드 UI ----------------
  function applyModeUI() {
    $("writingSession").hidden = mode !== "writing";
    $("speakingSession").hidden = mode === "speaking" ? false : true;
    [].slice.call($("modeSeg").querySelectorAll(".seg-btn")).forEach(function (b) {
      var on = b.dataset.mode === mode;
      b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $("modeHint").textContent = mode === "writing"
      ? "단계별 구상 → 제안서 작성 (자기·동료평가 없음)"
      : "개요 카드 · 핵심 문장 · 자기/동료평가 → 구술";
  }

  function switchMode(next) {
    if (next === mode) return;
    // 두 버전은 한 세트: 표현·문법·학교·학년은 그대로 이어 쓴다
    var carry = {
      exprs: readCondList("expr"), grams: readCondList("gram"),
      school: val("school"), grade: val("grade")
    };
    mode = next;
    state = clone(window.PRESETS[mode]);
    if (carry.exprs.length) state.conditions.required_expressions = carry.exprs;
    if (carry.grams.length) state.conditions.required_grammar = carry.grams;
    if (carry.school) state.school = carry.school;
    if (carry.grade) state.grade = carry.grade;
    $("useJson").checked = false;
    fillForm(); live();
  }

  // ---------------- 다운로드 ----------------
  function sanitize(name) {
    return (name || "").replace(/[\/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  }
  function setStatus(msg, kind) { var e = $("status"); e.textContent = msg || ""; e.className = "status" + (kind ? " " + kind : ""); }

  function getSpecForGenerate() {
    if (checked("useJson")) {
      var raw = $("specJson").value;
      var parsed = JSON.parse(raw); // 실패 시 throw → 호출부에서 처리
      return parsed;
    }
    return collectSpec();
  }

  function generate() {
    var btn = $("generate");
    if (!window.docx || !window.WorksheetBuilder) { setStatus("문서 엔진을 불러오지 못했습니다. 새로고침 해주세요.", "err"); return; }
    var spec;
    try { spec = getSpecForGenerate(); }
    catch (e) { setStatus("JSON 형식 오류: " + e.message, "err"); return; }

    if (!(spec.conditions && (spec.conditions.required_expressions || []).length) && !(spec.conditions && (spec.conditions.required_grammar || []).length)) {
      setStatus("필수 표현이나 문법을 1개 이상 입력해 주세요.", "err"); return;
    }

    btn.disabled = true; setStatus("문서를 만드는 중…");
    try {
      var doc = window.WorksheetBuilder.buildWorksheetDoc(window.docx, spec);
      window.docx.Packer.toBlob(doc).then(function (blob) {
        var modeLabel = spec.mode === "speaking" ? "말하기" : "쓰기";
        var fname = sanitize(spec.title) || ("영어수행평가_" + modeLabel);
        triggerDownload(blob, fname + ".docx");
        setStatus("완성: " + fname + ".docx 내려받음", "ok");
        btn.disabled = false;
      }).catch(function (e) {
        setStatus("생성 실패: " + e.message, "err"); btn.disabled = false;
      });
    } catch (e) {
      setStatus("생성 실패: " + e.message, "err"); btn.disabled = false;
    }
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ---------------- 초기화/예시 ----------------
  function loadExample() { state = clone(window.PRESETS[mode]); $("useJson").checked = false; fillForm(); live(); setStatus("예시값을 불러왔습니다.", ""); }
  function resetForm() {
    var blank = clone(window.PRESETS[mode]);
    blank.title = ""; blank.subtitle = ""; blank.purpose = "";
    blank.standards = [{ code: "", text: "" }, { code: "", text: "" }, { code: "", text: "" }];
    blank.conditions.required_expressions = ["", "", "", "", ""];
    blank.conditions.required_grammar = ["", "", "", "", ""];
    blank.conditions.content_elements = [];
    delete blank.model_answer; delete blank.model_answer_notes;
    state = blank; $("useJson").checked = false; fillForm(); live();
    setStatus("비웠습니다. 차시 구성·루브릭 골격은 유지됩니다.", "");
  }

  // ---------------- 이벤트 ----------------
  function wire() {
    $("modeSeg").addEventListener("click", function (e) {
      var b = e.target.closest(".seg-btn"); if (b) switchMode(b.dataset.mode);
    });
    ["title", "subtitle", "school", "grade", "purpose", "length", "contentElements",
      "mindmapTopic", "lengthNote", "writingSections", "keyCount", "timeLimit",
      "selfEval", "peerEval", "modelAnswer", "modelNotes"].forEach(function (id) {
        var e = $(id); if (e) e.addEventListener("input", live);
      });
    $("mindmapOn").addEventListener("change", live);
    $("rubricOn").addEventListener("change", function () { renderRubric(); live(); });
    $("modelOn").addEventListener("change", function () { $("modelWrap").hidden = !this.checked; live(); });
    $("addStandard").addEventListener("click", function () {
      var box = $("standardsList"); var row = document.createElement("div"); row.className = "row";
      var code = document.createElement("input"); code.type = "text"; code.className = "code-in"; code.placeholder = "12영Ⅱ-02-01";
      var text = document.createElement("input"); text.type = "text"; text.className = "text-in"; text.placeholder = "성취기준 문장";
      [code, text].forEach(function (i) { i.addEventListener("input", live); });
      row.appendChild(code); row.appendChild(text);
      row.appendChild(rowDel(function () { row.remove(); live(); }));
      box.appendChild(row); code.focus();
    });
    document.querySelectorAll("[data-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.dataset.add; var box = $(kind + "List");
        var row = condRow(kind, box.querySelectorAll(".row").length + 1, "");
        box.appendChild(row); row.querySelector("input").focus(); updateCount(kind);
      });
    });
    $("useJson").addEventListener("change", function () {
      if (this.checked) { $("specJson").value = JSON.stringify(collectSpec(), null, 2); $("jsonStatus").textContent = "이제 위 JSON으로 생성합니다. 폼 입력은 무시됩니다."; $("jsonStatus").className = "json-status ok"; }
      else { live(); }
    });
    $("specJson").addEventListener("input", function () {
      if (!checked("useJson")) return;
      try { JSON.parse(this.value); $("jsonStatus").textContent = "JSON 정상"; $("jsonStatus").className = "json-status ok"; }
      catch (e) { $("jsonStatus").textContent = "JSON 오류: " + e.message; $("jsonStatus").className = "json-status err"; }
    });
    $("refreshJson").addEventListener("click", function () {
      $("specJson").value = JSON.stringify(collectSpec(), null, 2);
      $("jsonStatus").textContent = "폼 내용으로 다시 채웠습니다."; $("jsonStatus").className = "json-status ok";
    });
    $("generate").addEventListener("click", generate);
    $("loadExample").addEventListener("click", loadExample);
    $("resetForm").addEventListener("click", resetForm);
  }

  // ---------------- start ----------------
  wire();
  fillForm();
  live();
})();
