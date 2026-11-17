/* ===== MindScope · frontend logic ===== */
// Backend API endpoint — the model is deployed on Render.
// When running the local FastAPI dev server the frontend is served on the same
// origin (http://127.0.0.1:8000), so a relative '/predict' is used.
// Everywhere else (opened as a file, hosted on GitHub Pages, etc.) it calls the
// deployed Render backend directly.
const RENDER_API = "https://mindscope-qs6k.onrender.com/predict";
const API_URL = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
  ? "/predict"
  : RENDER_API;

const form      = document.getElementById("predictForm");
const note      = document.getElementById("formNote");
const predictBtn= document.getElementById("predictBtn");
const resetBtn  = document.getElementById("resetBtn");
const resultCard= document.getElementById("resultCard");
const formCard  = document.getElementById("formCard");
const againBtn  = document.getElementById("againBtn");

/* ---- Segmented controls: keep one active, store value in data ---- */
document.querySelectorAll(".seg").forEach((seg) => {
  const buttons = seg.querySelectorAll(".seg-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      seg.dataset.value = btn.dataset.val;
    });
  });
  // init value from the active button
  seg.dataset.value = seg.querySelector(".seg-btn.active").dataset.val;
});

/* ---- Range sliders: live value labels ---- */
const sliders = [
  "avg_daily_usage_hours",
  "daily_unlocks",
  "study_hours",
  "physical_activity_hours",
  "sleep_hours_per_night",
];
sliders.forEach((id) => {
  const el = document.getElementById(id);
  const label = document.getElementById(id + "_val");
  const fmt = id === "daily_unlocks" ? (v) => v : (v) => Number(v).toFixed(1);
  const update = () => (label.textContent = fmt(el.value));
  el.addEventListener("input", update);
  update();
});

/* ---- Build payload from form ---- */
function buildPayload() {
  const fd = new FormData(form);
  const segGender  = document.querySelector('.seg[data-name="gender"]');
  const segStress  = document.querySelector('.seg[data-name="stress_level"]');

  return {
    age: parseInt(fd.get("age"), 10),
    gender: segGender.dataset.value,
    country: fd.get("country"),
    academic_level: fd.get("academic_level"),
    most_used_platform: fd.get("most_used_platform"),
    purpose_of_use: fd.get("purpose_of_use"),
    avg_daily_usage_hours: parseFloat(fd.get("avg_daily_usage_hours")),
    daily_unlocks: parseInt(fd.get("daily_unlocks"), 10),
    study_hours: parseFloat(fd.get("study_hours")),
    physical_activity_hours: parseFloat(fd.get("physical_activity_hours")),
    sleep_hours_per_night: parseFloat(fd.get("sleep_hours_per_night")),
    stress_level: segStress.dataset.value,
  };
}

/* ---- Interpretation of the score (data range ~3.6–9.4 on a 0–10 scale) ---- */
function interpret(score) {
  if (score >= 8)
    return { status: "Excellent", color: "#34d399",
      desc: "Your predicted mental‑health score is strong. Your current balance of sleep, activity, and screen time appears supportive of wellbeing." };
  if (score >= 6.5)
    return { status: "Good", color: "#818cf8",
      desc: "A solid, above‑average score. Small tweaks to sleep or social‑media usage could push it even higher." };
  if (score >= 5)
    return { status: "Moderate", color: "#fbbf24",
      desc: "You're around the average. Consider reducing late‑night usage and increasing physical activity or sleep." };
  if (score >= 3.5)
    return { status: "Needs Attention", color: "#fb923c",
      desc: "Your predicted score is below average. High usage hours, low sleep, or elevated stress may be weighing on your wellbeing." };
  return { status: "At Risk", color: "#fb7185",
    desc: "Your predicted score is low. Prioritise sleep, reduce screen time, and consider reaching out to a support service." };
}

/* ---- Insight chips summarising key inputs ---- */
function buildFactors(p) {
  return [
    { label: "Daily usage",  value: `${p.avg_daily_usage_hours} h` },
    { label: "Sleep",         value: `${p.sleep_hours_per_night} h` },
    { label: "Unlocks",      value: `${p.daily_unlocks}/day` },
    { label: "Stress",       value: p.stress_level },
    { label: "Activity",     value: `${p.physical_activity_hours} h` },
  ];
}

/* ---- Animate the circular gauge + count‑up number ---- */
function animateGauge(score) {
  const r = 85;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score / 10, 0), 1); // clamp 0–10
  const fill = document.getElementById("gaugeFill");
  fill.style.strokeDashoffset = circumference * (1 - pct);

  // count up
  const numEl = document.getElementById("scoreNum");
  const start = performance.now();
  const dur = 1400;
  function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    numEl.textContent = (score * eased).toFixed(1);
    if (t < 1) requestAnimationFrame(tick);
    else numEl.textContent = score.toFixed(2);
  }
  requestAnimationFrame(tick);
}

/* ---- Show result ---- */
function showResult(score, payload) {
  const info = interpret(score);

  document.getElementById("scoreNum").textContent = "0.0";
  document.getElementById("resultLabel").textContent = "Predicted Mental Health Score";
  const statusEl = document.getElementById("resultStatus");
  statusEl.textContent = info.status;
  statusEl.style.color = info.color;
  document.getElementById("resultDesc").textContent = info.desc;

  const factorsEl = document.getElementById("resultFactors");
  factorsEl.innerHTML = "";
  buildFactors(payload).forEach((f) => {
    const chip = document.createElement("span");
    chip.className = "factor";
    chip.innerHTML = `${f.label}: <b>${f.value}</b>`;
    factorsEl.appendChild(chip);
  });

  resultCard.hidden = false;
  setTimeout(() => animateGauge(score), 120);
}

/* ---- Submit ---- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  note.textContent = "";
  note.className = "form-note";

  const payload = buildPayload();

  // basic client-side validation
  if (!payload.age || payload.age < 10 || payload.age > 100) {
    note.textContent = "Please enter a valid age between 10 and 100.";
    note.className = "form-note error";
    return;
  }

  predictBtn.classList.add("loading");
  predictBtn.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const score = data.predicted_mental_health_score;
    showResult(score, payload);

    // smooth scroll to result
    setTimeout(() => resultCard.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  } catch (err) {
    note.textContent =
      "Could not reach the API. Make sure the FastAPI server is running on http://127.0.0.1:8000  (" +
      err.message + ")";
    note.className = "form-note error";
  } finally {
    predictBtn.classList.remove("loading");
    predictBtn.disabled = false;
  }
});

/* ---- Reset ---- */
const defaults = {
  age: 20, country: "India", academic_level: "Undergraduate",
  most_used_platform: "Instagram", purpose_of_use: "Entertainment",
  avg_daily_usage_hours: 4.5, daily_unlocks: 80, study_hours: 3,
  physical_activity_hours: 1, sleep_hours_per_night: 6.5,
};

function setSeg(name, val) {
  const seg = document.querySelector(`.seg[data-name="${name}"]`);
  seg.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.val === val);
  });
  seg.dataset.value = val;
}

resetBtn.addEventListener("click", () => {
  Object.entries(defaults).forEach(([k, v]) => {
    const el = document.getElementById(k);
    if (el) {
      el.value = v;
      el.dispatchEvent(new Event("input"));
    }
  });
  setSeg("gender", "Male");
  setSeg("stress_level", "Medium");
  resultCard.hidden = true;
  note.textContent = "";
  note.className = "form-note";
  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
});

againBtn.addEventListener("click", () => {
  resultCard.hidden = true;
  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
});
