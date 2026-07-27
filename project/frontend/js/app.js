/* =========================================================
   Smart Placement Cell Portal — app.js
   Auth · Theme · Sidebar · Charts · AI Assistant · Supabase
   ========================================================= */

// Supabase credentials injected by js/env.js (Vite module)
let SUPABASE_URL = null;
let SUPABASE_ANON_KEY = null;

let supabase = null;
let currentUser = null;
let currentProfile = null;
let charts = {};
let allCompanies = [];
let allMatches = [];

/* =========================================================
   PHASE 2 — THEME SYSTEM
   ========================================================= */
const THEME_KEY = "spc-theme";

function applyTheme(theme) {
  document.body.classList.remove("light", "dark", "aurora");
  document.body.classList.add(theme);
  localStorage.setItem(THEME_KEY, theme);
  if (typeof Chart !== "undefined") styleCharts(theme);
}

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
}

function initThemeSwitcher() {
  const btn = document.getElementById("themeBtn");
  const menu = document.getElementById("themeMenu");
  if (!btn || !menu) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", () => (menu.hidden = true));
  menu.addEventListener("click", (e) => e.stopPropagation());
  menu.querySelectorAll("button[data-theme]").forEach((b) =>
    b.addEventListener("click", () => {
      applyTheme(b.dataset.theme);
      menu.hidden = true;
    })
  );
  document.querySelectorAll(".theme-pick").forEach((b) =>
    b.addEventListener("click", () => applyTheme(b.dataset.theme))
  );
}

/* =========================================================
   PHASE 4 — SUPABASE + AUTH
   ========================================================= */
function initSupabase() {
  if (typeof window.supabase === "undefined") return;
  SUPABASE_URL = window.__SUPABASE_URL__;
  SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase env vars missing.");
    return;
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ---------- Login page ---------- */
function initAuthPage() {
  initTheme();
  initSupabase();
  if (!supabase) {
    showError("Cannot connect to authentication service. Please refresh.");
    return;
  }

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = "dashboard.html";
  });

  const form = document.getElementById("authForm");
  const errEl = document.getElementById("loginError");
  const submitBtn = document.getElementById("submitBtn");
  const toggle = document.getElementById("toggleMode");
  const fullNameField = document.getElementById("fullNameField");
  const fullNameInput = document.getElementById("fullName");
  let mode = "signin";
  const titleEl = document.querySelector(".login-card h1");
  const switchText = document.querySelector(".login-switch a");

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    mode = mode === "signin" ? "signup" : "signin";
    titleEl.textContent = mode === "signin" ? "Smart Placement Cell" : "Create Account";
    submitBtn.textContent = mode === "signin" ? "Sign In" : "Sign Up";
    switchText.textContent = mode === "signin" ? "Create an account" : "Sign in instead";
    fullNameField.style.display = mode === "signup" ? "block" : "none";
    fullNameInput.required = mode === "signup";
    errEl.classList.remove("show");
  });

  initPasswordToggle();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.classList.remove("show");
    submitBtn.disabled = true;
    submitBtn.textContent = "Please wait…";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const fullName = fullNameInput.value.trim();

    let data, error;
    if (mode === "signin") {
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    } else {
      ({ data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      }));
      // Supabase returns a user object with no error and an empty `identities`
      // array when someone signs up with an email that's already registered
      // (an anti-enumeration measure) — surface that clearly instead of
      // silently pretending signup worked.
      if (!error && data.user && data.user.identities && data.user.identities.length === 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign Up";
        showError("An account with this email already exists. Please sign in instead.");
        return;
      }
    }

    submitBtn.disabled = false;
    submitBtn.textContent = mode === "signin" ? "Sign In" : "Sign Up";
    if (error) {
      showError(/already registered|already exists/i.test(error.message)
        ? "An account with this email already exists. Please sign in instead."
        : error.message);
      return;
    }
    if (data.session) {
      window.location.href = "dashboard.html";
    } else if (data.user && mode === "signup") {
      showError("Account created — check your email to confirm, then sign in.");
    }
  });

  document.getElementById("googleBtn").addEventListener("click", async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/frontend/dashboard.html" },
    });
    if (error) showError(error.message);
  });
}

/** Eye / eye-off toggle for the password field. */
function initPasswordToggle() {
  const btn = document.getElementById("passwordToggle");
  const input = document.getElementById("password");
  const icon = document.getElementById("eyeIcon");
  if (!btn || !input) return;
  const EYE = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  const EYE_OFF = '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  btn.addEventListener("click", () => {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    icon.innerHTML = showing ? EYE : EYE_OFF;
    btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
}

function showError(msg) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
}

/* ---------- Dashboard auth guard ---------- */
async function requireAuth() {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return false;
  }
  currentUser = data.session.user;
  return true;
}

async function loadProfile() {
  if (!supabase || !currentUser) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error) return null;
  if (!data) {
    const insert = {
      id: currentUser.id,
      email: currentUser.email,
      full_name: currentUser.user_metadata?.full_name || "",
    };
    const { data: created } = await supabase.from("profiles").insert(insert).select().maybeSingle();
    currentProfile = created;
  } else {
    currentProfile = data;
  }
  return currentProfile;
}

async function saveProfile(updates) {
  if (!supabase || !currentUser) return { error: new Error("Not signed in") };
  const { error } = await supabase.from("profiles").update(updates).eq("id", currentUser.id);
  if (error) console.error("saveProfile failed:", error);
  return { error };
}

async function signOut() {
  if (supabase) await supabase.auth.signOut();
  window.location.href = "login.html";
}

/* =========================================================
   SIDEBAR NAVIGATION
   ========================================================= */
const VIEW_META = {
  dashboard: { t: "Dashboard", s: "AI-driven placement insights at a glance" },
  profile: { t: "Profile", s: "Manage your academic and skills profile" },
  upload: { t: "Upload Documents", s: "Upload your resume for AI analysis" },
  matches: { t: "Match & Recommendations", s: "Companies matched to your profile" },
  roadmap: { t: "Skill Gap Roadmap", s: "Close the gaps blocking your top matches" },
  analysis: { t: "Resume Analysis", s: "Deep breakdown of your resume" },
  applications: { t: "Applications", s: "Track companies you've applied to" },
  simulator: { t: "What-If Simulator", s: "Preview how profile changes affect matches" },
  analytics: { t: "Analytics", s: "Cohort-wide placement analytics" },
  settings: { t: "Settings", s: "Manage appearance and account" },
};

function initSidebar() {
  const items = document.querySelectorAll(".side-item[data-view]");
  items.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      if (item.dataset.view === "ai-assistant") return; // handled by initAIAssistant()
      switchView(item.dataset.view);
    });
  });
  const toggle = document.getElementById("menuToggle");
  const sb = document.getElementById("sidebar");
  if (toggle && sb) toggle.addEventListener("click", () => sb.classList.toggle("open"));
}

function switchView(view) {
  document.querySelectorAll(".side-item[data-view]").forEach((i) =>
    i.classList.toggle("active", i.dataset.view === view)
  );
  document.querySelectorAll(".view").forEach((v) =>
    v.classList.toggle("active", v.id === "view-" + view)
  );
  const meta = VIEW_META[view];
  if (meta) {
    document.getElementById("viewTitle").textContent = meta.t;
    document.getElementById("viewSub").textContent = meta.s;
  }
  if (window.innerWidth <= 760) document.getElementById("sidebar").classList.remove("open");
  if (view === "analytics") loadAnalytics();
  if (view === "applications") loadApplications();
}

/* =========================================================
   DATA LOADING — REAL SUPABASE DATA ONLY
   ========================================================= */
async function loadCompanies() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("companies").select("*").order("name");
  if (error) return [];
  return data || [];
}

async function loadMatches() {
  if (!supabase || !currentUser) return [];
  const { data, error } = await supabase
    .from("matches")
    .select("*, companies(*)")
    .eq("student_id", currentUser.id)
    .order("match_score", { ascending: false });
  if (error) return [];
  return data || [];
}

/* ---------- Matching engine (client-side, real computation) ---------- */
function computeMatch(profile, company) {
  const studentSkills = new Set((profile.skills || []).map((s) => s.toLowerCase()));
  const required = new Set((company.required_skills || []).map((s) => s.toLowerCase()));
  const matched = [...studentSkills].filter((s) => required.has(s));
  const missing = [...required].filter((s) => !studentSkills.has(s));
  const skillRatio = required.size ? matched.length / required.size : 0;
  const skillScore = skillRatio * 60;
  const cgpa = profile.cgpa || 0;
  const cgpaScore = cgpa >= (company.min_cgpa || 0) ? 20 : (cgpa / (company.min_cgpa || 1)) * 20;
  const branch = profile.branch || "";
  const branchScore = (company.required_branches || []).includes(branch) ? 20 : 0;
  const total = Math.round(skillScore + cgpaScore + branchScore);
  const eligible = cgpa >= (company.min_cgpa || 0) && (company.required_branches || []).includes(branch) && skillRatio >= 0.4;
  return {
    match_score: total,
    matched_skills: (company.required_skills || []).filter((s) => matched.includes(s.toLowerCase())),
    missing_skills: (company.required_skills || []).filter((s) => missing.includes(s.toLowerCase())),
    eligible,
    reasoning: `${matched.length}/${required.size} skills matched, CGPA ${cgpa} vs min ${company.min_cgpa}, branch ${branch}`,
  };
}

async function generateAndSaveMatches() {
  if (!supabase || !currentProfile || !allCompanies.length) return [];
  // Delete old matches, recompute
  await supabase.from("matches").delete().eq("student_id", currentUser.id);
  const rows = allCompanies.map((c) => {
    const m = computeMatch(currentProfile, c);
    return {
      student_id: currentUser.id,
      company_id: c.id,
      match_score: m.match_score,
      missing_skills: m.missing_skills,
      matched_skills: m.matched_skills,
      eligible: m.eligible,
      reasoning: m.reasoning,
      status: "matched",
    };
  }).filter((r) => r.match_score > 0);
  if (rows.length) await supabase.from("matches").insert(rows);
  return loadMatches();
}

/* =========================================================
   RENDER — DASHBOARD
   ========================================================= */
function matchTier(m) { return m >= 85 ? "high" : m >= 75 ? "med" : "low"; }

function renderDashboard(matches) {
  allMatches = matches || [];
  if (!allMatches.length) {
    renderEmptyDashboard();
    return;
  }
  const avg = Math.round(allMatches.reduce((s, m) => s + m.match_score, 0) / allMatches.length);
  const high = allMatches.filter((m) => m.match_score >= 85).length;
  animateCount("matchScore", avg, 1000);
  animateCount("companiesMatched", allMatches.length, 1100);
  animateCount("highMatches", high, 1100);
  animateCount("shortlisted", 0, 900);
  setRing("matchRing", avg);
  document.getElementById("matchFoot").textContent = `Across ${allMatches.length} matched companies`;
  document.getElementById("highBar").style.setProperty("--w", (high / allMatches.length) * 100 + "%");
  document.getElementById("shortBar").style.setProperty("--w", "0%");
  renderCompanyTable(allMatches);
  renderWhyList(allMatches);
  renderAIRec(allMatches);
  renderProfileCompletion();
  buildCharts(allMatches);
}

function renderEmptyDashboard() {
  document.getElementById("matchScore").textContent = "0";
  document.getElementById("companiesMatched").textContent = "0";
  document.getElementById("highMatches").textContent = "0";
  document.getElementById("shortlisted").textContent = "0";
  setRing("matchRing", 0);
  document.getElementById("matchFoot").textContent = "Complete your profile to see matches";
  document.getElementById("highBar").style.setProperty("--w", "0%");
  document.getElementById("shortBar").style.setProperty("--w", "0%");
  document.getElementById("companyBody").innerHTML =
    '<tr><td colspan="6" class="muted" style="text-align:center;padding:2rem">No matches yet. Add your skills and CGPA in Profile, then upload a resume.</td></tr>';
  document.getElementById("aiRec").textContent = "Add your skills and CGPA in the Profile page to get AI recommendations.";
  renderProfileCompletion();
}

function renderCompanyTable(matches) {
  const body = document.getElementById("companyBody");
  if (!body) return;
  body.innerHTML = matches.map((m) => {
    const c = m.companies || m;
    const score = m.match_score || m.match || 0;
    return `
    <tr>
      <td><div class="company-cell"><div class="company-logo" style="background:${c.logo_color || "#4f46e5"}">${(c.name || "?").slice(0, 2).toUpperCase()}</div><div><div class="company-name">${c.name}</div><div class="company-sub">${c.tier || "Tier 1"}</div></div></div></td>
      <td><span class="match-pill ${matchTier(score)}">${score}%</span></td>
      <td>₹${c.package_lpa} LPA</td>
      <td>${c.role}</td>
      <td style="max-width:220px;font-size:0.82rem;color:var(--text-soft)">${m.reasoning || m.why || "—"}</td>
      <td><button class="row-btn" data-id="${c.id}">View Details</button></td>
    </tr>`;
  }).join("");
  body.querySelectorAll(".row-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const match = matches.find((m) => (m.companies?.id || m.id) === b.dataset.id);
      openCompanyModal(match);
    })
  );
}

function renderWhyList(matches) {
  const ul = document.getElementById("whyList");
  if (!ul || !matches.length) return;
  const top = matches.slice(0, 3);
  ul.innerHTML = top.map((m) => {
    const c = m.companies || m;
    const skills = m.matched_skills || [];
    return `<li>${c.name}: ${skills.length} skill${skills.length !== 1 ? "s" : ""} matched (${(m.matched_skills || []).join(", ") || "none"})</li>`;
  }).join("");
}

function renderAIRec(matches) {
  const el = document.getElementById("aiRec");
  if (!el) return;
  if (!matches.length) { el.textContent = "Add your skills to get AI recommendations."; return; }
  const top = matches[0];
  const c = top.companies || top;
  el.innerHTML = `Prioritise <strong>${c.role}</strong> at <strong>${c.name}</strong> — your top match at ${top.match_score}%. ${
    (top.missing_skills || []).length ? `Close the gap: ${(top.missing_skills || []).join(", ")} to push past 90%.` : "You're fully eligible — apply now."
  }`;
  const apply = document.getElementById("applyRec");
  if (apply) apply.onclick = () => showToast("Applied suggestion to your roadmap", "success");
}

function renderProfileCompletion() {
  let pct = 0;
  const checks = [
    { label: "Resume uploaded", done: false },
    { label: "Skills added", done: false },
    { label: "CGPA added", done: false },
    { label: "Branch selected", done: false },
  ];
  if (currentProfile) {
    if (currentProfile.resume_text) { checks[0].done = true; pct += 25; }
    if (currentProfile.skills && currentProfile.skills.length) { checks[1].done = true; pct += 25; }
    if (currentProfile.cgpa && currentProfile.cgpa > 0) { checks[2].done = true; pct += 25; }
    if (currentProfile.branch) { checks[3].done = true; pct += 25; }
  }
  setRing("profileRing", pct);
  animateCount("profileScore", pct, 1000);
  const ul = document.getElementById("checklist");
  if (ul) ul.innerHTML = checks.map((c) => `<li class="${c.done ? "done" : ""}">${c.label}</li>`).join("");
}

/* =========================================================
   MATCHES VIEW
   ========================================================= */
function renderMatches(matches) {
  const body = document.getElementById("matchBody");
  if (!body) return;
  document.getElementById("matchCount").textContent = `${matches.length} companies`;
  if (!matches.length) {
    body.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:2rem">No matches yet. Complete your profile first.</td></tr>';
    return;
  }
  body.innerHTML = matches.map((m) => {
    const c = m.companies || m;
    return `
    <tr>
      <td><div class="company-cell"><div class="company-logo" style="background:${c.logo_color || "#4f46e5"}">${(c.name || "?").slice(0, 2).toUpperCase()}</div><div><div class="company-name">${c.name}</div><div class="company-sub">${c.tier || "Tier 1"}</div></div></div></td>
      <td><span class="match-pill ${matchTier(m.match_score)}">${m.match_score}%</span></td>
      <td>₹${c.package_lpa} LPA</td>
      <td>${c.role}</td>
      <td style="max-width:200px">${(m.missing_skills || []).length ? (m.missing_skills || []).map((s) => `<span class="skill-tag missing">${s}</span>`).join("") : '<span class="muted">None</span>'}</td>
      <td>${m.eligible ? '<span class="status-dot">Eligible</span>' : '<span class="status-dot review">Review</span>'}</td>
      <td><button class="row-btn" data-id="${c.id}">Apply</button></td>
    </tr>`;
  }).join("");
  body.querySelectorAll(".row-btn").forEach((b) =>
    b.addEventListener("click", () => applyToCompany(b.dataset.id))
  );
}

async function applyToCompany(companyId) {
  if (!supabase || !currentUser) { showToast("Sign in to apply", "error"); return; }
  const { error } = await supabase.from("applications").upsert({
    student_id: currentUser.id,
    company_id: companyId,
    status: "applied",
  });
  if (error) showToast("Could not apply: " + error.message, "error");
  else showToast("Application submitted", "success");
}

/* =========================================================
   ROADMAP VIEW — derived from real missing skills
   ========================================================= */
function renderRoadmap(matches) {
  const el = document.getElementById("roadmapList");
  if (!el) return;
  const missingMap = {};
  matches.forEach((m) => {
    (m.missing_skills || []).forEach((s) => {
      if (!missingMap[s]) missingMap[s] = [];
      missingMap[s].push((m.companies || m).name);
    });
  });
  const entries = Object.entries(missingMap);
  if (!entries.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">✓</div><p>No skill gaps — you meet all requirements for your matched companies.</p></div>';
    return;
  }
  el.innerHTML = entries
    .sort((a, b) => b[1].length - a[1].length)
    .map(([skill, companies], i) => `
      <div class="roadmap-step">
        <div class="roadmap-num">${i + 1}</div>
        <div class="roadmap-body"><h4>${skill}</h4><p>Required by ${companies.join(", ")}</p></div>
      </div>`).join("");
}

/* =========================================================
   UPLOAD VIEW
   ========================================================= */
function initUpload() {
  const zone = document.getElementById("uploadZone");
  const input = document.getElementById("fileInput");
  if (!zone || !input) return;
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault(); zone.classList.remove("drag");
    if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", () => { if (input.files[0]) handleUpload(input.files[0]); });
}

// pdf.js needs its worker script location set once, before first use.
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

/**
 * Extract real text from an uploaded PDF using pdf.js (runs entirely in the
 * browser — no server round-trip needed). Falls back to plain file.text()
 * for non-PDF files, and to an empty string if parsing fails.
 */
async function extractResumeText(file) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return await file.text().catch(() => "");
  }
  if (typeof pdfjsLib === "undefined") return "";
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text;
  } catch (err) {
    console.error("Resume PDF parsing failed:", err);
    return "";
  }
}

async function handleUpload(file) {
  const result = document.getElementById("uploadResult");
  result.innerHTML = `<p class="muted"><span class="spinner"></span> Analyzing resume…</p>`;
  const text = await extractResumeText(file);
  const analysis = analyzeResumeText(text);
  renderUploadResult(analysis, file.name, text);
  // Reset so choosing the same file again (or after switching away and back)
  // still fires the change event — otherwise the browser sees no value
  // change and silently does nothing on a repeat upload.
  const input = document.getElementById("fileInput");
  if (input) input.value = "";
}

/** Best-effort CGPA extraction, mirrors backend/app.py's extract_cgpa(). */
function extractCgpaFromText(text) {
  const match = text.match(/(?:CGPA|CPI|GPA)[:\s]+([0-9]+\.?[0-9]*)/i);
  return match ? parseFloat(match[1]) : null;
}

/** Best-effort branch extraction, mirrors backend/app.py's extract_branch(). */
function extractBranchFromText(text) {
  const branches = ["Computer Science", "Information Technology", "Artificial Intelligence", "CSE", "IT", "ECE", "EEE", "Electrical", "Mechanical", "AI"];
  const lower = text.toLowerCase();
  const alias = { "computer science": "CSE", "information technology": "IT", "artificial intelligence": "AI" };
  for (const b of branches) {
    if (lower.includes(b.toLowerCase())) return alias[b.toLowerCase()] || b;
  }
  return null;
}

function analyzeResumeText(text) {
  const SKILL_DB = ["React", "JavaScript", "TypeScript", "Python", "Java", "SQL", "AWS", "Docker", "Kubernetes", "Machine Learning", "TensorFlow", "CSS", "HTML", "Node", "PostgreSQL", "MongoDB", "Git", "Figma", "REST", "GraphQL", "Spring", "Kafka", "Tableau", "Excel", "Statistics", "NLP", "Linux", "CI/CD", "Terraform", "Microservices", "UI/UX", "Prototyping", "Research", "Design Systems"];
  const found = SKILL_DB.filter((s) => text.toLowerCase().includes(s.toLowerCase()));
  return {
    skills: found,
    cgpa: extractCgpaFromText(text),
    branch: extractBranchFromText(text),
    score: Math.min(95, 40 + found.length * 5),
    missing_skills: [],
    eligibility: found.length >= 3,
  };
}

function renderUploadResult(data, filename, resumeText) {
  const result = document.getElementById("uploadResult");
  const skillTags = (data.skills || []).map((s) => `<span class="skill-tag">${s}</span>`).join("");
  result.innerHTML = `
    <div style="margin-top:1.5rem">
      <h3 style="margin-bottom:0.5rem">Analysis Complete</h3>
      <p class="muted" style="margin-bottom:1rem">${filename}</p>
      <div style="display:flex;gap:2rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">
        <div><div class="score-big" style="font-size:2.5rem;color:var(--primary)">${data.score || 0}</div><p class="muted">Resume Score</p></div>
        <div><span class="app-status ${data.eligibility ? "shortlisted" : "rejected"}">${data.eligibility ? "Eligible" : "Needs Work"}</span></div>
      </div>
      <h4 style="margin:1rem 0 0.5rem">Detected Skills</h4>
      <div>${skillTags || '<span class="muted">None detected</span>'}</div>
    </div>`;
  document.getElementById("resumeScore").textContent = data.score || 0;
  document.getElementById("resumeScoreLabel").textContent = data.eligibility ? "Eligible for most roles" : "Build missing skills";
  document.getElementById("resumeSkills").innerHTML = skillTags;
  renderResumeTips(resumeText || "");

  if (supabase && currentProfile) {
    // This is a plain UPDATE on the student's single profile row, so the
    // previous resume's filename/text/skills are overwritten here — nothing
    // from the old upload lingers in the database after this.
    const update = {
      resume_filename: filename,
      resume_text: (resumeText || "").slice(0, 20000), // keep the row reasonably sized
      skills: data.skills || [],
      profile_completion: Math.min(100, (currentProfile.profile_completion || 0) + 25),
    };
    if (data.cgpa) update.cgpa = data.cgpa;
    if (data.branch) update.branch = data.branch;
    saveProfile(update).then(({ error }) => {
      if (error) { showToast("Resume analyzed, but saving to your profile failed: " + error.message, "error"); return; }
      currentProfile.skills = data.skills || [];
      currentProfile.resume_filename = filename;
      currentProfile.resume_text = update.resume_text;
      if (data.cgpa) currentProfile.cgpa = data.cgpa;
      if (data.branch) currentProfile.branch = data.branch;
      renderProfileCompletion();
      regenerateMatches();
      renderNotifications();
      showToast("Resume analyzed successfully", "success");
    });
  } else {
    showToast("Resume analyzed successfully", "success");
  }
}

/**
 * Rule-based resume feedback — no AI needed, works offline. Flags common,
 * concrete issues recruiters/ATS systems actually check for.
 */
function generateResumeTips(text) {
  const tips = [];
  const t = text || "";
  const lower = t.toLowerCase();
  const wordCount = t.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < 80) {
    tips.push({ good: false, text: "Your resume text looks very short — either the PDF didn't extract cleanly (try re-saving/exporting it), or it genuinely needs more content (projects, experience, skills)." });
  } else if (wordCount > 1200) {
    tips.push({ good: false, text: "That's a lot of text — recruiters skim resumes in seconds. Consider trimming to the most relevant 1-2 pages." });
  } else {
    tips.push({ good: true, text: "Resume length looks reasonable." });
  }

  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(t)) {
    tips.push({ good: true, text: "Contact email found." });
  } else {
    tips.push({ good: false, text: "No email address detected — make sure your contact info is in plain text, not an image." });
  }

  if (/\b\d{10}\b|\+\d{1,3}[\s-]?\d{3,5}[\s-]?\d{3,5}/.test(t)) {
    tips.push({ good: true, text: "Phone number found." });
  } else {
    tips.push({ good: false, text: "No phone number detected — add one near the top of your resume." });
  }

  const hasNumbers = /\d+%|\d+\+|\b\d{2,}\b/.test(t);
  if (hasNumbers) {
    tips.push({ good: true, text: "Found quantified results (numbers/percentages) — recruiters respond well to measurable impact." });
  } else {
    tips.push({ good: false, text: "No quantified achievements found. Try adding numbers — e.g. \"improved load time by 30%\" instead of \"improved load time\"." });
  }

  const actionVerbs = ["built", "led", "designed", "developed", "created", "implemented", "optimized", "managed", "launched", "improved", "automated", "shipped"];
  if (actionVerbs.some((v) => lower.includes(v))) {
    tips.push({ good: true, text: "Uses strong action verbs (built, led, designed, etc.)." });
  } else {
    tips.push({ good: false, text: "Try starting bullet points with action verbs like \"Built\", \"Led\", \"Designed\" instead of passive phrases like \"Responsible for\"." });
  }

  const sections = ["education", "experience", "project", "skill"];
  const missingSections = sections.filter((s) => !lower.includes(s));
  if (missingSections.length) {
    tips.push({ good: false, text: `Couldn't find a clear "${missingSections.join('", "')}" section — standard headers help both recruiters and ATS software scan your resume correctly.` });
  } else {
    tips.push({ good: true, text: "Has clear Education, Experience, Projects, and Skills sections." });
  }

  return tips;
}

function renderResumeTips(text) {
  const el = document.getElementById("resumeTips");
  if (!el) return;
  if (!text || !text.trim()) { el.innerHTML = ""; return; }
  const tips = generateResumeTips(text);
  el.innerHTML = `
    <h4>Resume Improvement Tips</h4>
    ${tips.map((tip) => `
      <div class="tip-row">
        <span class="tip-icon ${tip.good ? "good" : "warn"}">${tip.good ? "✓" : "!"}</span>
        <span class="tip-text">${tip.text}</span>
      </div>`).join("")}`;
}

async function regenerateMatches() {
  if (!supabase || !currentProfile) return;
  allMatches = await generateAndSaveMatches();
  renderDashboard(allMatches);
  renderMatches(allMatches);
  renderRoadmap(allMatches);
}

/* =========================================================
   APPLICATIONS VIEW
   ========================================================= */
async function loadApplications() {
  const body = document.getElementById("appBody");
  if (!body) return;
  if (!supabase || !currentProfile) {
    body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:2rem">Sign in to track applications</td></tr>';
    return;
  }
  const { data } = await supabase.from("applications").select("*, companies(*)").eq("student_id", currentUser.id).order("applied_at", { ascending: false });
  if (!data || !data.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:2rem">No applications yet. Apply from the Matches page.</td></tr>';
    return;
  }
  body.innerHTML = data.map((a) => `
    <tr>
      <td><div class="company-cell"><div class="company-logo" style="background:${a.companies?.logo_color || "#4f46e5"}">${(a.companies?.name || "?").slice(0, 2).toUpperCase()}</div><div class="company-name">${a.companies?.name || "—"}</div></div></td>
      <td>${a.companies?.role || "—"}</td>
      <td>₹${a.companies?.package_lpa || 0} LPA</td>
      <td><span class="app-status ${a.status}">${a.status}</span></td>
      <td>${new Date(a.applied_at).toLocaleDateString()}</td>
    </tr>`).join("");
}

/* =========================================================
   SIMULATOR VIEW
   ========================================================= */
function initSimulator() {
  const run = document.getElementById("simRun");
  if (!run) return;
  const cgpaSlider = document.getElementById("simCgpa");
  const cgpaVal = document.getElementById("simCgpaVal");
  cgpaSlider.addEventListener("input", () => (cgpaVal.textContent = parseFloat(cgpaSlider.value).toFixed(1)));
  run.addEventListener("click", runSimulation);
}

function runSimulation() {
  const cgpa = parseFloat(document.getElementById("simCgpa").value);
  const skills = document.getElementById("simSkills").value.split(",").map((s) => s.trim()).filter(Boolean);
  const branch = document.getElementById("simBranch").value;
  const result = document.getElementById("simResult");
  if (!allCompanies.length) { result.innerHTML = '<p class="muted">No company data loaded.</p>'; return; }
  const fakeProfile = { skills, cgpa, branch };
  const matches = allCompanies.map((c) => {
    const m = computeMatch(fakeProfile, c);
    return { ...c, match_score: m.match_score, missing_skills: m.missing_skills, companies: c };
  }).sort((a, b) => b.match_score - a.match_score);
  result.innerHTML = matches.map((m) => `
    <div class="sim-bar">
      <span class="label">${m.name}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${m.match_score}%"></div></div>
      <span class="val">${m.match_score}%</span>
    </div>`).join("");
  showToast("Simulation complete", "info");
}

/* =========================================================
   ANALYTICS / ADMIN VIEW — REAL DATA ONLY
   ========================================================= */
async function loadAnalytics() {
  const statsEl = document.getElementById("adminStats");
  if (!statsEl) return;

  if (!supabase) {
    statsEl.innerHTML = '<div class="card" style="grid-column:1/-1"><p class="muted">Sign in to view analytics.</p></div>';
    document.getElementById("atRiskList").innerHTML = '<p class="muted">No data available.</p>';
    return;
  }

  if (currentProfile?.role !== "admin") {
    statsEl.innerHTML = '<div class="card" style="grid-column:1/-1"><p class="muted">Analytics is only available to placement cell admins. Ask an admin to promote your account if you need access.</p></div>';
    document.getElementById("atRiskList").innerHTML = "";
    return;
  }

  statsEl.innerHTML = `
    <div class="card stat-card fade-in admin-stat"><span class="stat-label">Total Students</span><div class="big-num" id="aTotal">…</div></div>
    <div class="card stat-card fade-in admin-stat"><span class="stat-label">Avg Profile Completion</span><div class="big-num" id="aAvg">…</div></div>
    <div class="card stat-card fade-in admin-stat"><span class="stat-label">At-Risk Students</span><div class="big-num" id="aRisk">…</div></div>
    <div class="card stat-card fade-in admin-stat"><span class="stat-label">Companies Hiring</span><div class="big-num" id="aComp">…</div></div>`;

  const { data: students, error } = await supabase.from("profiles").select("*").eq("role", "student");
  if (error) {
    statsEl.innerHTML = '<div class="card" style="grid-column:1/-1"><p class="muted">Could not load analytics data.</p></div>';
    return;
  }

  const total = students.length;
  const avg = total ? Math.round(students.reduce((s, p) => s + (p.profile_completion || 0), 0) / total) : 0;
  const atRiskStudents = students.filter((p) => (p.profile_completion || 0) < 50);
  const atRisk = atRiskStudents.length;
  const { count: companyCount } = await supabase.from("companies").select("*", { count: "exact", head: true });

  animateCount("aTotal", total, 1000);
  animateCount("aAvg", avg, 1000);
  animateCount("aRisk", atRisk, 1000);
  animateCount("aComp", companyCount || 0, 1000);

  const atRiskEl = document.getElementById("atRiskList");
  if (atRiskEl) {
    if (!atRiskStudents.length) {
      atRiskEl.innerHTML = '<p class="muted">No at-risk students. All profiles are above 50% completion.</p>';
    } else {
      atRiskEl.innerHTML = atRiskStudents.map((s) => `
        <div class="at-risk-row">
          <div><strong>${s.full_name || s.email}</strong><br><span class="muted">${s.branch || "No branch"} · CGPA ${s.cgpa || "—"}</span></div>
          <span class="match-pill low">${s.profile_completion || 0}%</span>
        </div>`).join("");
    }
  }
  buildAnalyticsCharts(students);
}

function buildAnalyticsCharts(students) {
  if (typeof Chart === "undefined") return;
  const c = themeColors(localStorage.getItem(THEME_KEY) || "light");

  // Distribution by profile completion
  const buckets = [0, 0, 0, 0, 0];
  students.forEach((s) => {
    const p = s.profile_completion || 0;
    if (p < 25) buckets[0]++;
    else if (p < 50) buckets[1]++;
    else if (p < 75) buckets[2]++;
    else if (p < 90) buckets[3]++;
    else buckets[4]++;
  });

  const distEl = document.getElementById("distChart");
  if (distEl) {
    if (charts.dist) charts.dist.destroy();
    charts.dist = new Chart(distEl.getContext("2d"), {
      type: "bar",
      data: { labels: ["0-25%", "25-50%", "50-75%", "75-90%", "90%+"], datasets: [{ label: "Students", data: buckets, backgroundColor: c.fills, borderRadius: 8 }] },
      options: baseOpts(c),
    });
  }

  // Branch performance
  const branchData = {};
  students.forEach((s) => {
    const b = s.branch || "Unknown";
    if (!branchData[b]) branchData[b] = { sum: 0, count: 0 };
    branchData[b].sum += s.profile_completion || 0;
    branchData[b].count++;
  });
  const branches = Object.keys(branchData);
  const branchAvgs = branches.map((b) => Math.round(branchData[b].sum / branchData[b].count));

  const branchEl = document.getElementById("branchChart");
  if (branchEl) {
    if (charts.branch) charts.branch.destroy();
    charts.branch = new Chart(branchEl.getContext("2d"), {
      type: "bar",
      data: { labels: branches.length ? branches : ["No data"], datasets: [{ label: "Avg Completion %", data: branchAvgs.length ? branchAvgs : [0], backgroundColor: c.primary + "cc", borderRadius: 8 }] },
      options: baseOpts(c),
    });
  }
}

/* =========================================================
   PROFILE VIEW
   ========================================================= */
function initProfileForm() {
  const form = document.getElementById("profileForm");
  if (!form) return;
  if (currentProfile) {
    document.getElementById("pName").value = currentProfile.full_name || "";
    document.getElementById("pCgpa").value = currentProfile.cgpa || "";
    document.getElementById("pBranch").value = currentProfile.branch || "";
    document.getElementById("pEmail").value = currentProfile.email || "";
    document.getElementById("pSkills").value = (currentProfile.skills || []).join(", ");
    renderSkillTags();
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const skills = document.getElementById("pSkills").value.split(",").map((s) => s.trim()).filter(Boolean);
    const cgpaInput = document.getElementById("pCgpa").value;
    const cgpa = cgpaInput === "" ? 0 : Math.min(10, Math.max(0, parseFloat(cgpaInput) || 0));
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Saving…";

    const { error } = await saveProfile({
      full_name: document.getElementById("pName").value,
      cgpa,
      branch: document.getElementById("pBranch").value,
      skills,
      profile_completion: Math.min(100, (currentProfile?.profile_completion || 0) + 20),
    });

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (error) {
      showToast("Couldn't save profile: " + error.message, "error");
      return;
    }

    currentProfile.skills = skills;
    currentProfile.cgpa = cgpa;
    currentProfile.branch = document.getElementById("pBranch").value;
    currentProfile.full_name = document.getElementById("pName").value;
    renderSkillTags();
    renderProfileCompletion();
    showToast("Profile saved — recalculating matches", "success");
    regenerateMatches();
  });
  document.getElementById("pSkills").addEventListener("input", renderSkillTags);
}

function renderSkillTags() {
  const el = document.getElementById("skillTags");
  if (!el) return;
  const skills = document.getElementById("pSkills").value.split(",").map((s) => s.trim()).filter(Boolean);
  el.innerHTML = skills.map((s) => `<span class="skill-tag">${s}</span>`).join("");
}

/* =========================================================
   CHARTS
   ========================================================= */
function themeColors(theme) {
  if (theme === "dark") return { text: "#cbd5e1", grid: "rgba(148,163,184,0.15)", primary: "#6366f1", accent: "#22d3ee", fills: ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"] };
  if (theme === "aurora") return { text: "rgba(255,255,255,0.85)", grid: "rgba(255,255,255,0.18)", primary: "#ffffff", accent: "#67e8f9", fills: ["#ffffff", "#67e8f9", "#6ee7b7", "#fcd34d", "#f0abfc", "#a5b4fc"] };
  return { text: "#475569", grid: "rgba(148,163,184,0.2)", primary: "#4f46e5", accent: "#06b6d4", fills: ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"] };
}

function baseOpts(c) {
  return { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: c.text, boxWidth: 12, padding: 14 } } }, scales: { x: { ticks: { color: c.text }, grid: { color: c.grid } }, y: { ticks: { color: c.text }, grid: { color: c.grid } } } };
}

function buildCharts(matches) {
  if (typeof Chart === "undefined") return;
  const c = themeColors(localStorage.getItem(THEME_KEY) || "light");
  Chart.defaults.font.family = "Inter, sans-serif";
  Chart.defaults.color = c.text;

  // Role demand doughnut — from real matches
  const roleCounts = {};
  matches.forEach((m) => {
    const role = (m.companies || m).role || "Other";
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });
  const roleLabels = Object.keys(roleCounts);
  const roleData = Object.values(roleCounts);

  const roleEl = document.getElementById("roleChart");
  if (roleEl) {
    if (charts.role) charts.role.destroy();
    charts.role = new Chart(roleEl.getContext("2d"), {
      type: "doughnut",
      data: { labels: roleLabels.length ? roleLabels : ["No data"], datasets: [{ data: roleData.length ? roleData : [1], backgroundColor: c.fills, borderWidth: 0, hoverOffset: 8 }] },
      options: { ...baseOpts(c), cutout: "68%" },
    });
  }

  // Hiring insights — real matches per company
  const companyLabels = matches.map((m) => (m.companies || m).name?.split(" ")[0] || "?");
  const matchScores = matches.map((m) => m.match_score || 0);

  const insightEl = document.getElementById("insightChart");
  if (insightEl) {
    if (charts.insight) charts.insight.destroy();
    charts.insight = new Chart(insightEl.getContext("2d"), {
      type: "bar",
      data: { labels: companyLabels.length ? companyLabels : ["No data"], datasets: [{ label: "Your Match %", data: matchScores.length ? matchScores : [0], backgroundColor: c.primary + "cc", borderRadius: 8, barThickness: 18 }] },
      options: baseOpts(c),
    });
  }

  // Trend chart — applications over time (real)
  buildTrendChart(c);
}

async function buildTrendChart(c) {
  const trendEl = document.getElementById("trendChart");
  if (!trendEl) return;
  let appData = [];
  if (supabase && currentUser) {
    const { data } = await supabase.from("applications").select("applied_at").eq("student_id", currentUser.id);
    appData = data || [];
  }
  // Group by month
  const months = {};
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("en", { month: "short" });
    months[key] = 0;
  }
  appData.forEach((a) => {
    const d = new Date(a.applied_at);
    const key = d.toLocaleDateString("en", { month: "short" });
    if (key in months) months[key]++;
  });
  const labels = Object.keys(months);
  const data = Object.values(months);

  if (charts.trend) charts.trend.destroy();
  const ctx = trendEl.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, c.primary + "55");
  grad.addColorStop(1, c.primary + "00");
  charts.trend = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Applications", data, borderColor: c.primary, backgroundColor: grad, fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0, pointHoverRadius: 5 }] },
    options: baseOpts(c),
  });
}

function styleCharts(theme) {
  const c = themeColors(theme);
  if (typeof Chart !== "undefined") Chart.defaults.color = c.text;
  Object.values(charts).forEach((ch) => { if (ch) ch.update(); });
}

/* =========================================================
   MODAL
   ========================================================= */
function openCompanyModal(m) {
  const c = m.companies || m;
  document.getElementById("modalTitle").textContent = c.name;
  document.getElementById("modalBody").innerHTML = `
    <div class="detail-row"><span class="key">Role</span><span class="val">${c.role}</span></div>
    <div class="detail-row"><span class="key">Package</span><span class="val">₹${c.package_lpa} LPA</span></div>
    <div class="detail-row"><span class="key">Match Score</span><span class="val">${m.match_score || 0}%</span></div>
    <div class="detail-row"><span class="key">Why it matches</span><span class="val">${m.reasoning || "—"}</span></div>
    <div class="detail-row"><span class="key">Matched skills</span><span class="val">${(m.matched_skills || []).join(", ") || "None"}</span></div>
    <div class="detail-row"><span class="key">Missing skills</span><span class="val">${(m.missing_skills || []).join(", ") || "None"}</span></div>
    <div class="detail-row"><span class="key">Openings</span><span class="val">${c.openings || "—"}</span></div>
    <div class="detail-row"><span class="key">Eligible</span><span class="val">${m.eligible ? "Yes" : "No"}</span></div>
    <button class="btn-primary" style="margin-top:1rem;width:100%" id="modalApply">Apply Now</button>`;
  document.getElementById("modalOverlay").classList.add("show");
  document.getElementById("modalApply").addEventListener("click", () => { applyToCompany(c.id); closeModal(); });
}
function closeModal() { document.getElementById("modalOverlay").classList.remove("show"); }

/* =========================================================
   AI ASSISTANT
   ========================================================= */
const AI_SUGGESTIONS = [
  "What skills should I learn?",
  "Which companies match me best?",
  "How do I improve my match score?",
  "What's my skill gap?",
];

const AI_FAB_HIDDEN_KEY = "spc-ai-fab-hidden";
const AI_FAB_POS_KEY = "spc-ai-fab-pos";

function initAIAssistant() {
  const fab = document.getElementById("aiFab");
  const chat = document.getElementById("aiChat");
  const closeBtn = document.getElementById("aiChatClose");
  const fabCloseBtn = document.getElementById("aiFabClose");
  const sendBtn = document.getElementById("aiSend");
  const input = document.getElementById("aiInput");
  if (!fab || !chat) return;

  // Restore a saved drag position, and whether the user previously dismissed the fab.
  const savedPos = JSON.parse(localStorage.getItem(AI_FAB_POS_KEY) || "null");
  if (savedPos) positionFab(fab, savedPos.x, savedPos.y);
  if (localStorage.getItem(AI_FAB_HIDDEN_KEY) === "1") fab.hidden = true;

  initFabDrag(fab, chat);

  fabCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fab.hidden = true;
    chat.classList.remove("show");
    localStorage.setItem(AI_FAB_HIDDEN_KEY, "1");
    showToast("AI assistant hidden — reopen it anytime from the sidebar", "info");
  });

  closeBtn.addEventListener("click", () => chat.classList.remove("show"));
  sendBtn.addEventListener("click", sendAIMessage);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendAIMessage(); });

  const sideEntry = document.getElementById("sideAiAssistant");
  if (sideEntry) {
    sideEntry.addEventListener("click", (e) => {
      e.preventDefault();
      fab.hidden = false;
      localStorage.removeItem(AI_FAB_HIDDEN_KEY);
      openAIChat();
    });
  }
}

function openAIChat() {
  const chat = document.getElementById("aiChat");
  const body = document.getElementById("aiChatBody");
  chat.classList.add("show");
  if (!body.children.length) {
    addBotMessage("Hi! I'm your AI career assistant. I can suggest skills to learn, explain your matches, and help improve your profile. Ask me anything!");
    renderAISuggestions();
  }
}

/** Drag-to-move for the FAB. A short drag distance is still treated as a click (opens the chat). */
function initFabDrag(fab, chat) {
  let dragging = false, moved = false, startX = 0, startY = 0, origX = 0, origY = 0;

  const onDown = (clientX, clientY) => {
    dragging = true; moved = false;
    const rect = fab.getBoundingClientRect();
    origX = rect.left; origY = rect.top;
    startX = clientX; startY = clientY;
    fab.classList.add("dragging");
  };
  const onMove = (clientX, clientY) => {
    if (!dragging) return;
    const dx = clientX - startX, dy = clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    const maxX = window.innerWidth - fab.offsetWidth - 8;
    const maxY = window.innerHeight - fab.offsetHeight - 8;
    const x = Math.min(Math.max(8, origX + dx), maxX);
    const y = Math.min(Math.max(8, origY + dy), maxY);
    positionFab(fab, x, y);
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    fab.classList.remove("dragging");
    if (moved) {
      const rect = fab.getBoundingClientRect();
      localStorage.setItem(AI_FAB_POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
    } else {
      chat.classList.toggle("show");
      if (chat.classList.contains("show")) openAIChat();
    }
  };

  fab.addEventListener("mousedown", (e) => { if (e.target.closest("#aiFabClose")) return; onDown(e.clientX, e.clientY); });
  document.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  document.addEventListener("mouseup", onUp);

  fab.addEventListener("touchstart", (e) => { if (e.target.closest("#aiFabClose")) return; onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener("touchmove", (e) => { if (dragging) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener("touchend", onUp);
}

function positionFab(fab, x, y) {
  fab.style.left = x + "px";
  fab.style.top = y + "px";
  fab.style.right = "auto";
  fab.style.bottom = "auto";
}

function renderAISuggestions() {
  const el = document.getElementById("aiSuggestions");
  el.innerHTML = AI_SUGGESTIONS.map((s) => `<button class="ai-suggestion">${s}</button>`).join("");
  el.querySelectorAll(".ai-suggestion").forEach((b) =>
    b.addEventListener("click", () => {
      document.getElementById("aiInput").value = b.textContent;
      sendAIMessage();
    })
  );
}


async function sendAIMessage() {
  const input = document.getElementById("aiInput");
  const text = input.value.trim();
  if (!text) return;
  addUserMessage(text);
  input.value = "";
  document.getElementById("aiSuggestions").innerHTML = "";
  showTyping();

  const reply = await getAIReply(text);

  removeTyping();
  addBotMessage(reply);
  renderAISuggestions();
}

/**
 * Tries the real Claude-powered /.netlify/functions/ai-chat endpoint first
 * (grounded in the student's actual profile + matches). If that endpoint
 * isn't deployed, has no API key configured, or fails for any reason, it
 * silently falls back to the deterministic rule-based reply below so the
 * assistant still works with zero setup.
 */
async function getAIReply(question) {
  try {
    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, profile: currentProfile, matches: allMatches }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ai && data.reply) return data.reply;
    }
  } catch (err) {
    console.warn("AI function unavailable, using rule-based reply:", err);
  }
  return generateAIReply(question);
}

function addBotMessage(text) {
  const body = document.getElementById("aiChatBody");
  const div = document.createElement("div");
  div.className = "ai-msg bot";
  div.innerHTML = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function addUserMessage(text) {
  const body = document.getElementById("aiChatBody");
  const div = document.createElement("div");
  div.className = "ai-msg user";
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showTyping() {
  const body = document.getElementById("aiChatBody");
  const div = document.createElement("div");
  div.className = "ai-msg bot typing";
  div.id = "typingIndicator";
  div.innerHTML = "<span></span><span></span><span></span>";
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

function generateAIReply(question) {
  const q = question.toLowerCase();
  const skills = currentProfile?.skills || [];
  const branch = currentProfile?.branch || "";
  const cgpa = currentProfile?.cgpa || 0;
  const matches = allMatches || [];

  if (q.includes("skill") && (q.includes("learn") || q.includes("should") || q.includes("gap"))) {
    if (!matches.length) return "You don't have any matches yet. Add your skills and CGPA in the Profile page first, and I'll tell you exactly which skills to learn for each company.";
    const allMissing = {};
    matches.forEach((m) => (m.missing_skills || []).forEach((s) => allMissing[s] = (allMissing[s] || 0) + 1));
    const sorted = Object.entries(allMissing).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return "Great news — you have no skill gaps! You meet all requirements for your matched companies. Focus on applying and interview prep.";
    const top = sorted.slice(0, 3);
    return `Based on your matches, here are the most impactful skills to learn:<br><br>${top.map(([s, n]) => `• <strong>${s}</strong> — needed by ${n} compan${n > 1 ? "ies" : "y"}`).join("<br>")}<br><br>Start with <strong>${top[0][0]}</strong> — it unlocks the most opportunities for you.`;
  }

  if (q.includes("company") || q.includes("match") || q.includes("best")) {
    if (!matches.length) return "No matches yet. Complete your profile to see which companies fit you best.";
    const top = matches.slice(0, 3);
    return `Your top matches are:<br><br>${top.map((m, i) => `${i + 1}. <strong>${(m.companies || m).name}</strong> — ${m.match_score}% match (${(m.companies || m).role}, ₹${(m.companies || m).package_lpa} LPA)`).join("<br>")}<br><br>${(top[0].missing_skills || []).length ? `To improve your #1 match, learn: ${(top[0].missing_skills || []).join(", ")}.` : "You're fully eligible for your top match — apply now!"}`;
  }

  if (q.includes("improve") || q.includes("score") || q.includes("increase")) {
    if (!matches.length) return "Add your skills and CGPA first, then I can suggest how to improve your scores.";
    const lowMatches = matches.filter((m) => m.match_score < 75);
    if (!lowMatches.length) return "Your match scores are already strong! Focus on applying and preparing for interviews.";
    const tips = [];
    if (cgpa < 8) tips.push(`• Improve your CGPA — several companies require 7.5+ or 8.0+`);
    if (!branch) tips.push("• Add your branch — it affects eligibility for many companies");
    if (skills.length < 5) tips.push("• Add more skills to your profile — more skills = higher match scores");
    tips.push("• Learn the missing skills shown in your Skill Gap Roadmap");
    return `Here's how to boost your match scores:<br><br>${tips.join("<br>")}`;
  }

  if (q.includes("roadmap") || q.includes("plan")) {
    if (!matches.length) return "Complete your profile first, and I'll build a personalized learning roadmap from your actual skill gaps.";
    const allMissing = {};
    matches.forEach((m) => (m.missing_skills || []).forEach((s) => allMissing[s] = (allMissing[s] || 0) + 1));
    const sorted = Object.entries(allMissing).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return "You have no skill gaps — your roadmap is complete! Focus on interview prep.";
    return `Your personalized roadmap:<br><br>${sorted.map(([s, n], i) => `Step ${i + 1}: <strong>${s}</strong> (needed by ${n} compan${n > 1 ? "ies" : "y"})`).join("<br>")}<br><br>Check the Skill Gap Roadmap page for the full plan.`;
  }

  if (q.includes("profile") || q.includes("cgpa") || q.includes("branch")) {
    return `Your profile:<br>• Skills: ${skills.length ? skills.join(", ") : "None added yet"}<br>• CGPA: ${cgpa || "Not set"}<br>• Branch: ${branch || "Not set"}<br><br>${skills.length < 3 || !cgpa || !branch ? "Your profile is incomplete — head to the Profile page to add your details and unlock better matches." : "Your profile looks good! Upload a resume for even better matching."}`;
  }

  if (q.includes("resume") || q.includes("upload")) {
    return "Upload your resume PDF on the Upload Documents page. I'll extract your skills automatically and recalculate all your matches. The more skills detected, the higher your match scores.";
  }

  if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
    return `Hello${currentProfile?.full_name ? " " + currentProfile.full_name.split(" ")[0] : ""}! I can help with:<br>• Suggesting skills to learn<br>• Explaining your company matches<br>• Tips to improve your match score<br>• Building your skill gap roadmap<br><br>What would you like to know?`;
  }

  return `I can help you with skills to learn, company matches, improving your score, or your skill gap roadmap. Try asking "What skills should I learn?" or "Which companies match me best?" — or check the suggestion chips below.`;
}

/* =========================================================
   HELPERS
   ========================================================= */
function animateCount(id, target, dur = 1000) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setRing(id, percent, circumference = 327) {
  const ring = document.getElementById(id);
  if (!ring) return;
  ring.style.strokeDashoffset = circumference - (percent / 100) * circumference;
}

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3000);
}

function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    document.querySelectorAll("#companyBody tr").forEach((tr) => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

function initChips() {
  document.querySelectorAll(".filter-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const f = chip.dataset.filter;
      let list = allMatches;
      if (f === "high") list = list.filter((m) => m.match_score >= 85);
      else if (f === "medium") list = list.filter((m) => m.match_score >= 75 && m.match_score < 85);
      else if (f === "low") list = list.filter((m) => m.match_score < 75);
      renderCompanyTable(list);
    });
  });
}

function populateProfileUI() {
  if (!currentProfile) return;
  document.getElementById("profileName").textContent = currentProfile.full_name || "Student";
  document.getElementById("profileRole").textContent = currentProfile.role === "admin" ? "Admin" : "Student";
  document.getElementById("avatar").textContent = (currentProfile.full_name || "U").slice(0, 2).toUpperCase();
  document.getElementById("setName").textContent = currentProfile.full_name || "—";
  document.getElementById("setEmail").textContent = currentProfile.email || "—";
  document.getElementById("setRole").textContent = currentProfile.role || "student";
  document.getElementById("setBranch").textContent = currentProfile.branch || "—";
}

/* =========================================================
   BOOT — DASHBOARD
   ========================================================= */
async function initDashboard() {
  initTheme();
  initThemeSwitcher();
  initSupabase();
  initSidebar();
  initSearch();
  initChips();
  initUpload();
  initSimulator();
  initAIAssistant();
  initNotifications();
  closeModal();
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });
  document.getElementById("signOutBtn").addEventListener("click", (e) => { e.preventDefault(); signOut(); });
  document.getElementById("signOutBtn2").addEventListener("click", signOut);
  document.getElementById("refreshApps").addEventListener("click", loadApplications);

  if (!supabase) {
    window.location.href = "login.html";
    return;
  }
  const authed = await requireAuth();
  if (!authed) return;
  await loadProfile();
  populateProfileUI();
  initProfileForm();

  // Load real companies and matches from Supabase
  allCompanies = await loadCompanies();
  allMatches = await loadMatches();

  // If no matches exist yet but profile has skills, generate them
  if (!allMatches.length && currentProfile && (currentProfile.skills?.length || currentProfile.cgpa)) {
    allMatches = await generateAndSaveMatches();
  }

  renderDashboard(allMatches);
  renderMatches(allMatches);
  renderRoadmap(allMatches);
  renderNotifications();
}

/* =========================================================
   NOTIFICATIONS — built from the student's real current state
   ========================================================= */
const NOTIF_DISMISS_KEY = "spc-notif-dismissed";

function initNotifications() {
  const btn = document.getElementById("notifBtn");
  const panel = document.getElementById("notifPanel");
  const clearBtn = document.getElementById("notifClearBtn");
  if (!btn || !panel) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !e.target.closest("#notifWrap")) panel.hidden = true;
  });
  panel.addEventListener("click", (e) => e.stopPropagation());
  clearBtn.addEventListener("click", () => {
    const all = buildNotifications();
    localStorage.setItem(NOTIF_DISMISS_KEY, JSON.stringify(all.map((n) => n.id)));
    renderNotifications();
  });
}

/** Derives a small list of real, current notifications from profile/match state. */
function buildNotifications() {
  const notifs = [];
  const completion = currentProfile?.profile_completion || 0;

  if (allMatches?.length) {
    const strong = allMatches.filter((m) => (m.match_score || 0) >= 75).length;
    if (strong > 0) {
      notifs.push({
        id: "matches-strong",
        icon: "🎯",
        title: `${strong} strong compan${strong > 1 ? "ies" : "y"} match${strong > 1 ? "es" : ""} (75%+)`,
        time: "Based on your current profile",
      });
    }
  }

  if (currentProfile?.resume_filename) {
    notifs.push({
      id: "resume-analyzed",
      icon: "📄",
      title: `Resume "${currentProfile.resume_filename}" analyzed`,
      time: "Skills auto-detected and matches updated",
    });
  }

  if (completion < 100) {
    notifs.push({
      id: "profile-incomplete",
      icon: "📝",
      title: `Your profile is ${completion}% complete`,
      time: "Finish it in Profile to unlock better matches",
    });
  }

  const lowMatches = (allMatches || []).filter((m) => (m.match_score || 0) < 50 && (m.match_score || 0) > 0);
  if (lowMatches.length) {
    notifs.push({
      id: "skill-gaps",
      icon: "📈",
      title: `${lowMatches.length} match${lowMatches.length > 1 ? "es" : ""} held back by missing skills`,
      time: "Check your Skill Gap Roadmap",
    });
  }

  return notifs;
}

function renderNotifications() {
  const list = document.getElementById("notifList");
  const badge = document.getElementById("notifBadge");
  if (!list || !badge) return;

  const dismissed = new Set(JSON.parse(localStorage.getItem(NOTIF_DISMISS_KEY) || "[]"));
  const all = buildNotifications();
  const visible = all.filter((n) => !dismissed.has(n.id));

  if (!visible.length) {
    list.innerHTML = '<div class="notif-empty">You\'re all caught up.</div>';
    badge.hidden = true;
  } else {
    list.innerHTML = visible.map((n) => `
      <div class="notif-item">
        <span class="notif-icon">${n.icon}</span>
        <div class="notif-body">
          <div class="notif-title">${n.title}</div>
          <div class="notif-time">${n.time}</div>
        </div>
      </div>`).join("");
    badge.hidden = false;
    badge.textContent = visible.length > 9 ? "9+" : visible.length;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("login-page")) {
    initAuthPage();
  } else if (document.body.classList.contains("dashboard")) {
    initDashboard();
  }
});
