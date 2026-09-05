const sb = window.tennisPilotSupabase;
let mode = "login", role = "coach", currentUser = null, profile = null;

const $ = id => document.getElementById(id);

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const msg = (text, bad = false) => {
  const e = $("authMessage");
  if (e) {
    e.textContent = text;
    e.className = "message " + (bad ? "danger" : "success");
  }
};

/* =========================
   AUTH
========================= */

function setupAuth() {
  const tabs = document.querySelectorAll(".tab");
  const roles = document.querySelectorAll(".role");

  if (!tabs.length) return;

  tabs.forEach(b => b.onclick = () => {
    mode = b.dataset.mode;

    tabs.forEach(x =>
      x.classList.toggle("active", x === b)
    );

    updateAuth();
  });

  roles.forEach(b => b.onclick = () => {
    role = b.dataset.role;

    roles.forEach(x =>
      x.classList.toggle("active", x === b)
    );

    updateAuth();
  });

  $("authForm").onsubmit = handleAuth;

  updateAuth();
}

function updateAuth() {
  $("name").parentElement.classList.toggle(
    "hidden",
    mode === "login"
  );

  $("confirmWrap").classList.toggle(
    "hidden",
    mode === "login"
  );

  $("passwordHint").classList.toggle(
    "hidden",
    mode === "login"
  );

  $("codeWrap").classList.toggle(
    "hidden",
    !(mode === "signup" && role === "player")
  );

  $("submitBtn").textContent =
    mode === "login" ? "Log In" : "Create Account";

  $("name").required = mode === "signup";
  $("confirm").required = mode === "signup";
}

function validPassword(p) {
  return (
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)
  );
}

function makeCode() {
  return (
    String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
    String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
    String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
    Math.floor(100 + Math.random() * 900)
  );
}

async function uniqueCode() {
  for (let i = 0; i < 30; i++) {
    const c = makeCode();

    const { data, error } =
      await sb.rpc("find_coach_by_code", {
        code_input: c
      });

    if (!error && !data?.length) return c;
  }

  throw Error("Could not create a unique coach code.");
}

async function handleAuth(e) {
  e.preventDefault();
  msg("");

  const email = $("email").value.trim();
  const password = $("password").value;

  try {
    if (mode === "login") {
      const { error } =
        await sb.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      location.href = "dashboard.html";
      return;
    }

    if (!validPassword(password)) {
      throw Error(
        "Password needs 8+ characters, an uppercase letter, a number and a special symbol."
      );
    }

    if (password !== $("confirm").value) {
      throw Error("Passwords do not match.");
    }

    const fullName = $("name").value.trim();

    if (!fullName) {
      throw Error("Enter your full name.");
    }

    const { data, error } =
      await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role
          }
        }
      });

    if (error) throw error;

    if (!data.user) {
      throw Error("Account could not be created.");
    }

    let coachId = null;

    if (
      role === "player" &&
      $("coachCode").value.trim()
    ) {
      const { data: c, error: ce } =
        await sb.rpc("find_coach_by_code", {
          code_input: $("coachCode")
            .value
            .trim()
            .toUpperCase()
        });

      if (ce) throw ce;

      if (!c || !c.length) {
        throw Error("Coach code not found.");
      }

      coachId = c[0].id;
    }

    /*
      Profile is created automatically
      by the Supabase auth trigger.
    */

    if (role === "player" && coachId) {
      const { error: re } =
        await sb.from("connection_requests").insert({
          player_id: data.user.id,
          coach_id: coachId,
          status: "pending"
        });

      if (re) throw re;
    }

    if (data.session) {
      location.href = "dashboard.html";
    } else {
      msg(
        "Account created. Check your email to confirm your account, then log in."
      );
    }

  } catch (err) {
    msg(
      err.message || "Something went wrong.",
      true
    );
  }
}

/* =========================
   PROFILE
========================= */

async function loadProfile() {
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    location.href = "login.html";
    return false;
  }

  currentUser = user;

  const { data, error } =
    await sb.from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

  if (error) {
    console.error(error);
    alert("Profile could not be loaded.");
    return false;
  }

  profile = data;

  return true;
}

/* =========================
   APP SHELL
========================= */

function shell() {
  $("profileBox").innerHTML =
    `<strong>${esc(profile.full_name)}</strong>
     <small>${esc(profile.role)}</small>` +
    (
      profile.role === "coach"
        ? `<small>Code: <b>${esc(profile.coach_code || "")}</b></small>`
        : ""
    );

  $("sideNav").innerHTML =
    profile.role === "coach"
      ? `
        <button class="nav-item active" data-page="overview">
          Overview
        </button>

        <button class="nav-item" data-page="players">
          Players
        </button>

        <button class="nav-item" data-page="requests">
          Requests
        </button>

        <button class="nav-item" data-page="matches">
          Match Reviews
        </button>
      `
      : `
        <button class="nav-item active" data-page="overview">
          My Dashboard
        </button>

        <button class="nav-item" data-page="matches">
          Match History
        </button>

        <button class="nav-item" data-page="coach">
          My Coach
        </button>

        <button class="nav-item" data-page="training">
          Training
        </button>

        <button class="nav-item" data-page="progress">
          Progress
        </button>
      `;

  document
    .querySelectorAll(".nav-item")
    .forEach(b => {
      b.onclick = () => render(b.dataset.page);
    });

  $("logoutBtn").onclick = async () => {
    await sb.auth.signOut();
    location.href = "index.html";
  };
}

/* =========================
   DATA
========================= */

async function connectedPlayers() {
  const { data, error } =
    await sb.from("profiles")
      .select("*")
      .eq("connected_coach_id", currentUser.id)
      .eq("role", "player");

  if (error) throw error;

  return data || [];
}

async function playerMatches(id = currentUser.id) {
  const { data, error } =
    await sb.from("matches")
      .select("id, player_id, opponent, match_date, result, score, biggest_problem, biggest_positive, notes, created_at, surface")
      .eq("player_id", id)
      .order("match_date", {
        ascending: false
      });

  if (error) throw error;

  return data || [];
}

/* =========================
   PAGE RENDER
========================= */

async function render(page = "overview") {
  document
    .querySelectorAll(".nav-item")
    .forEach(b =>
      b.classList.toggle(
        "active",
        b.dataset.page === page
      )
    );

  const app = $("app");

  app.innerHTML =
    "<div class='empty'>Loading…</div>";

  try {
    if (profile.role === "coach") {
      await renderCoach(page);
    } else {
      await renderPlayer(page);
    }
  } catch (e) {
    app.innerHTML =
      `<div class="card">
        <b>Error:</b> ${esc(e.message)}
      </div>`;
  }
}

/* =========================
   COACH DASHBOARD
========================= */

async function renderCoach(page) {
  const players = await connectedPlayers();

  if (page === "overview") {
    const playerStats = await Promise.all(
      players.map(async (p) => {
        const [matches, trainingResult] = await Promise.all([
          playerMatches(p.id),
          sb.from("training_sessions")
            .select("id, player_id, session_date, session_name, duration_minutes, focus, completed")
            .eq("player_id", p.id)
            .order("session_date", { ascending: false })
        ]);

        if (trainingResult.error) throw trainingResult.error;

        const sessions = trainingResult.data || [];
        const wins = matches.filter(m => m.result === "win").length;
        const losses = matches.filter(m => m.result === "loss").length;
        const completed = sessions.filter(s => s.completed).length;
        const completion = sessions.length
          ? Math.round((completed / sessions.length) * 100)
          : 0;

        const recent = matches.slice(0, 6);
        const problemCounts = {};

        recent.forEach(m => {
          const problem = String(m.biggest_problem || "").trim();
          if (!problem || problem.toLowerCase() === "none") return;
          problemCounts[problem] = (problemCounts[problem] || 0) + 1;
        });

        const topProblem = Object.entries(problemCounts)
          .sort((a, b) => b[1] - a[1])[0];

        return {
          ...p,
          matches,
          sessions,
          wins,
          losses,
          completion,
          topProblem: topProblem ? topProblem[0] : null,
          topProblemCount: topProblem ? topProblem[1] : 0,
          recentMatch: matches[0] || null
        };
      })
    );

    const needsAttention = playerStats.filter(p =>
      p.matches.length === 0 ||
      (p.topProblemCount >= 2) ||
      (p.sessions.length > 0 && p.completion < 50)
    );

    $("app").innerHTML = `
      <div class="dash-head">
        <div>
          <span class="eyebrow">COACH DASHBOARD</span>
          <h1>Overview</h1>
          <p class="muted">See who needs attention and what each player should work on next.</p>
        </div>

        <button class="btn" onclick="render('players')">
          View players
        </button>
      </div>

      <div class="grid">
        <div class="card">
          <span class="muted">Players</span>
          <div class="stat">${players.length}</div>
        </div>

        <div class="card">
          <span class="muted">Total Matches</span>
          <div class="stat">${playerStats.reduce((sum, p) => sum + p.matches.length, 0)}</div>
        </div>

        <div class="card">
          <span class="muted">Training Sessions</span>
          <div class="stat">${playerStats.reduce((sum, p) => sum + p.sessions.length, 0)}</div>
        </div>

        <div class="card">
          <span class="muted">Connection Code</span>
          <div class="stat" style="font-size:22px;">${esc(profile.coach_code || "—")}</div>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:18px;">
          <div>
            <span class="eyebrow">COACH ATTENTION</span>
            <h2 style="margin:5px 0 0;">Players to check</h2>
          </div>
          <span class="muted">${needsAttention.length} need${needsAttention.length === 1 ? "s" : ""} attention</span>
        </div>

        ${
          needsAttention.length
            ? needsAttention.map(p => {
                let reason = "Review their development.";
                if (!p.matches.length) {
                  reason = "No match history yet.";
                } else if (p.sessions.length > 0 && p.completion < 50) {
                  reason = `Training completion is ${p.completion}%.`;
                } else if (p.topProblem) {
                  reason = `${esc(p.topProblem)} has appeared ${p.topProblemCount} times in recent match reviews.`;
                }

                return `
                  <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;gap:15px;align-items:center;flex-wrap:wrap;">
                      <div>
                        <h3 style="margin:0 0 5px;">${esc(p.full_name)}</h3>
                        <span class="muted">${reason}</span>
                      </div>
                      <button class="btn small" onclick="viewPlayer('${p.id}')">View Player</button>
                    </div>
                  </div>
                `;
              }).join("")
            : `<div class="empty">Everyone looks on track. Open a player to review their development.</div>`
        }
      </div>

      <div class="card" style="margin-top:18px;">
        <div style="margin-bottom:18px;">
          <span class="eyebrow">PLAYER SNAPSHOT</span>
          <h2 style="margin:5px 0 0;">Your Players</h2>
        </div>

        ${
          playerStats.length
            ? `
              <div style="display:grid;gap:12px;">
                ${playerStats.map(p => `
                  <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;">
                    <div style="display:flex;justify-content:space-between;gap:15px;align-items:flex-start;flex-wrap:wrap;">
                      <div>
                        <h3 style="margin:0 0 5px;">${esc(p.full_name)}</h3>
                        <span class="muted">
                          ${p.matches.length} matches · ${p.wins} wins · ${p.losses} losses
                        </span>
                      </div>

                      <button class="btn small" onclick="viewPlayer('${p.id}')">
                        Open
                      </button>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:15px;">
                      <div style="background:#f8fafc;padding:12px;border-radius:10px;">
                        <span class="muted">Current Priority</span>
                        <div style="font-weight:800;margin-top:4px;">
                          ${esc(p.topProblem || "Not enough data")}
                        </div>
                      </div>

                      <div style="background:#f8fafc;padding:12px;border-radius:10px;">
                        <span class="muted">Training</span>
                        <div style="font-weight:800;margin-top:4px;">
                          ${p.sessions.length ? `${p.completion}% complete` : "No sessions"}
                        </div>
                      </div>

                      <div style="background:#f8fafc;padding:12px;border-radius:10px;">
                        <span class="muted">Last Match</span>
                        <div style="font-weight:800;margin-top:4px;">
                          ${p.recentMatch
                            ? `${p.recentMatch.result === "win" ? "Win" : "Loss"} vs ${esc(p.recentMatch.opponent)}`
                            : "No matches"}
                        </div>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            `
            : `<div class="empty">No players connected yet. Give a player your connection code.</div>`
        }
      </div>

      <div class="card" style="margin-top:18px;background:#f8fafc;">
        <span class="eyebrow">TENNISPILOT DEVELOPMENT LOOP</span>
        <h2 style="margin:5px 0 4px;">From match data to the next training session</h2>
        <p class="muted" style="margin-top:0;">
          Review the player's match patterns, identify the recurring priority, then assign training around it.
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px;">
          <div style="padding:15px;background:white;border-radius:12px;"><b>1. Match</b><p class="muted" style="margin-bottom:0;">Player competes.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>2. Review</b><p class="muted" style="margin-bottom:0;">Player records what happened.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>3. Priority</b><p class="muted" style="margin-bottom:0;">Patterns become visible.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>4. Train</b><p class="muted" style="margin-bottom:0;">Coach assigns the next focus.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>5. Review again</b><p class="muted" style="margin-bottom:0;">The next match updates the plan.</p></div>
        </div>
      </div>
    `;
  }

  else if (page === "players") {
    const playerStats = await Promise.all(
      players.map(async (p) => {
        const [matches, trainingResult] = await Promise.all([
          playerMatches(p.id),
          sb.from("training_sessions")
            .select("id, completed")
            .eq("player_id", p.id)
        ]);

        if (trainingResult.error) throw trainingResult.error;

        const sessions = trainingResult.data || [];
        const completed = sessions.filter(s => s.completed).length;

        const problemCounts = {};
        matches.slice(0, 6).forEach(m => {
          const problem = String(m.biggest_problem || "").trim();
          if (!problem || problem.toLowerCase() === "none") return;
          problemCounts[problem] = (problemCounts[problem] || 0) + 1;
        });

        const topProblem = Object.entries(problemCounts)
          .sort((a, b) => b[1] - a[1])[0];

        return {
          ...p,
          matches,
          sessions,
          completion: sessions.length ? Math.round((completed / sessions.length) * 100) : 0,
          topProblem: topProblem ? topProblem[0] : null
        };
      })
    );

    $("app").innerHTML = `
      <div class="dash-head">
        <div>
          <span class="eyebrow">YOUR PLAYERS</span>
          <h1>Players</h1>
          <p class="muted">Open a player to see their match patterns, training, and current priority.</p>
        </div>
      </div>

      ${
        playerStats.length
          ? `
            <div class="grid">
              ${playerStats.map(p => `
                <div class="card">
                  <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                    <div>
                      <h3 style="margin:0 0 5px;">${esc(p.full_name)}</h3>
                      <p class="muted" style="margin:0;">${p.matches.length} matches</p>
                    </div>
                    <span class="pill">Connected</span>
                  </div>

                  <div style="display:grid;gap:9px;margin:18px 0;">
                    <div style="display:flex;justify-content:space-between;gap:10px;">
                      <span class="muted">Current priority</span>
                      <b>${esc(p.topProblem || "Not enough data")}</b>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:10px;">
                      <span class="muted">Training</span>
                      <b>${p.sessions.length ? `${p.completion}%` : "None assigned"}</b>
                    </div>
                  </div>

                  <button class="btn small" onclick="viewPlayer('${p.id}')">
                    Open player
                  </button>
                </div>
              `).join("")}
            </div>
          `
          : `
            <div class="empty">
              No players yet.
              Give a player your connection code.
            </div>
          `
      }
    `;
  }

  else if (page === "requests") {
    await renderRequests();
  }

  else if (page === "matches") {
    await renderCoachMatches(players);
  }
}

/* =========================
   CONNECTION REQUESTS
========================= */

async function renderRequests() {

  const { data, error } =
    await sb.from("connection_requests")
      .select("*")
      .eq("coach_id", currentUser.id)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false
      });

  if (error) throw error;

  let html = `
    <div class="dash-head">
      <div>
        <span class="eyebrow">
          CONNECTIONS
        </span>

        <h1>Requests</h1>
      </div>
    </div>
  `;

  if (!data.length) {

    html += `
      <div class="empty">
        No pending requests.
      </div>
    `;

  } else {

    for (const r of data) {

      const { data: p } =
        await sb.from("profiles")
          .select("full_name")
          .eq("id", r.player_id)
          .single();

      html += `
        <div class="card"
          style="margin:10px 0">

          <b>
            ${esc(p?.full_name || "Player")}
          </b>

          <div class="modal-actions">

            <button
              class="btn small"
              onclick="acceptReq('${r.id}')">
              Accept
            </button>

            <button
              class="btn small ghost"
              onclick="declineReq('${r.id}')">
              Decline
            </button>

          </div>

        </div>
      `;
    }
  }

  $("app").innerHTML = html;
}

async function acceptReq(id) {

  const { error } =
    await sb.rpc(
      "accept_connection_request",
      {
        request_uuid: id
      }
    );

  if (error) {
    alert(error.message);
  } else {
    render("requests");
  }
}

async function declineReq(id) {

  const { error } =
    await sb.rpc(
      "decline_connection_request",
      {
        request_uuid: id
      }
    );

  if (error) {
    alert(error.message);
  } else {
    render("requests");
  }
}

/* =========================
   COACH MATCHES
========================= */

async function renderCoachMatches(players) {

  const ids = players.map(p => p.id);
  let data = [];

  if (ids.length) {

    const {
      data: d,
      error
    } = await sb.from("matches")
      .select("*")
      .in("player_id", ids)
      .order("match_date", {
        ascending: false
      });

    if (error) throw error;

    data = d || [];
  }

  $("app").innerHTML = `
    <div class="dash-head">
      <div>
        <span class="eyebrow">
          MATCH HISTORY
        </span>

        <h1>Match Reviews</h1>
      </div>
    </div>

    ${
      data.length
        ? data.map(m => {

            const p =
              players.find(
                x => x.id === m.player_id
              );

            return `
              <div class="match">

                <b>
                  ${esc(p?.full_name || "Player")}
                </b>

                · ${esc(m.result)}

                <h3>
                  vs ${esc(m.opponent)}
                </h3>

                <div class="muted">
                  ${esc(m.match_date)}
                  ·
                  ${esc(m.score || "No score")}
                </div>

                <p>
                  <b>Problem:</b>
                  ${esc(m.biggest_problem || "None")}
                </p>

                <p>
                  <b>Positive:</b>
                  ${esc(m.biggest_positive || "None")}
                </p>

                <p>
                  ${esc(m.notes || "")}
                </p>

              </div>
            `;

          }).join("")
        : `
          <div class="empty">
            No match reviews yet.
          </div>
        `
    }
  `;
}

/* =========================
   TRAINING PLAN
========================= */

function getTrainingPlan(problem) {
  const plans = {
    Serve: [
      ["Serve technique + targets", "Work on first-serve mechanics, contact point and 3 target areas.", 60],
      ["Serve + first ball", "Serve to a target, then play the first ball with an attacking intention.", 75],
      ["Pressure serving", "Play serving games focused on reliable targets and fewer double faults.", 60]
    ],
    Return: [
      ["Return position + timing", "Build a consistent return setup and timing against controlled serves.", 60],
      ["Return + first two shots", "Return crosscourt, recover, and play the next ball with a neutralizing goal.", 75],
      ["Return under pressure", "Play return games where the goal is to get a high percentage of returns in play.", 60]
    ],
    Forehand: [
      ["Forehand consistency", "Build repeatable contact and depth with controlled crosscourt repetitions.", 60],
      ["Forehand direction change", "Train crosscourt patterns followed by changing direction at the right ball.", 75],
      ["Forehand under pressure", "Use point-based drills to make the forehand reliable in competitive situations.", 60]
    ],
    Backhand: [
      ["Backhand consistency", "Focus on clean contact, height and depth through repeatable rally patterns.", 60],
      ["Backhand direction", "Train crosscourt control and changing direction without losing margin.", 75],
      ["Backhand under pressure", "Play competitive backhand patterns and track errors versus successful balls.", 60]
    ],
    Movement: [
      ["Movement + recovery", "Train split step, first movement and recovery after every shot.", 60],
      ["Movement in point patterns", "Use live-ball drills that force movement before and after contact.", 75],
      ["Movement under pressure", "Play point games where every ball requires a full recovery.", 60]
    ],
    "Mental game": [
      ["Between-point routine", "Build a simple repeatable routine for resetting after every point.", 45],
      ["Pressure point training", "Use score-based games to practice decision-making under pressure.", 60],
      ["Match simulation", "Play a practice set with specific mental goals and review afterward.", 90]
    ],
    Consistency: [
      ["High-percentage rally", "Train height, depth and margin with controlled crosscourt rally targets.", 60],
      ["Consistency + direction", "Build points through a safe pattern before changing direction.", 75],
      ["Consistency under pressure", "Play point games focused on reducing unforced errors.", 60]
    ]
  };
  return plans[problem] || [
    ["Technical focus session", "Build a repeatable technical pattern around the current priority.", 60],
    ["Priority in point play", "Take the priority into live-ball patterns and competitive points.", 75],
    ["Match simulation", "Test the priority in a realistic match environment and review the result.", 90]
  ];
}

/* =========================
   VIEW PLAYER
========================= */

async function viewPlayer(id) {
  try {
    const players = await connectedPlayers();
    const player = players.find(p => p.id === id);
    if (!player) {
      alert("Player not found.");
      return;
    }

    const matches = await playerMatches(id);
    const { data: training, error: trainingError } = await sb
      .from("training_sessions")
      .select("*")
      .eq("player_id", id)
      .order("session_date", { ascending: false });

    if (trainingError) throw trainingError;

    const sessions = training || [];
    const wins = matches.filter(m => m.result === "win").length;
    const losses = matches.filter(m => m.result === "loss").length;
    const winRate = matches.length ? Math.round((wins / matches.length) * 100) : 0;

    const recentMatches = matches.slice(0, 6);
    const problemCounts = {};
    const problemLastIndex = {};

    recentMatches.forEach((match, index) => {
      const problem = String(match.biggest_problem || "").trim();
      if (!problem || problem.toLowerCase() === "none") return;
      problemCounts[problem] = (problemCounts[problem] || 0) + 1;
      if (problemLastIndex[problem] === undefined) problemLastIndex[problem] = index;
    });

    const sortedProblems = Object.entries(problemCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return problemLastIndex[a[0]] - problemLastIndex[b[0]];
    });

    const topProblem = sortedProblems.length ? sortedProblems[0][0] : null;
    const topProblemCount = sortedProblems.length ? sortedProblems[0][1] : 0;
    const topProblemMatch = topProblem
      ? recentMatches.find(m => String(m.biggest_problem || "").trim() === topProblem)
      : null;

    const problemHTML = sortedProblems.length
      ? sortedProblems.slice(0, 5).map(([problem, count]) => {
          const percentage = recentMatches.length ? Math.round((count / recentMatches.length) * 100) : 0;
          return `
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;gap:12px;">
                <b>${esc(problem)}</b>
                <span class="muted">${count} match${count === 1 ? "" : "es"}</span>
              </div>
              <div style="width:100%;height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
                <div style="width:${percentage}%;height:100%;background:#2563eb;border-radius:99px;"></div>
              </div>
            </div>`;
        }).join("")
      : `<div class="empty">Not enough match-review data yet.</div>`;

    const priorityHTML = topProblem
      ? `
        <div style="display:flex;gap:18px;align-items:flex-start;">
          <div style="width:54px;height:54px;border-radius:14px;background:#e8f0ff;display:flex;align-items:center;justify-content:center;font-size:25px;flex-shrink:0;">🎯</div>
          <div style="flex:1;">
            <span class="eyebrow" style="color:#2563eb">RECOMMENDED PRIORITY</span>
            <h2 style="margin:5px 0 8px;">${esc(topProblem)}</h2>
            <p class="muted" style="margin:0;line-height:1.6;">
              ${esc(topProblem)} has been reported as a problem in
              <b>${topProblemCount} of ${recentMatches.length}</b>
              of the player's last ${recentMatches.length} match${recentMatches.length === 1 ? "" : "es"}.
            </p>
            ${topProblemMatch ? `<p class="muted" style="margin-top:10px;">Most recently reported vs <b>${esc(topProblemMatch.opponent)}</b> on ${esc(topProblemMatch.match_date || "No date")}.</p>` : ""}
          </div>
        </div>`
      : `
        <div style="display:flex;gap:18px;align-items:center;">
          <div style="width:54px;height:54px;border-radius:14px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:25px;">🎯</div>
          <div>
            <span class="eyebrow">RECOMMENDED PRIORITY</span>
            <h3 style="margin:5px 0;">Not enough data yet</h3>
            <p class="muted" style="margin:0;">Have the player complete more match reviews to identify recurring patterns.</p>
          </div>
        </div>`;

    const plan = topProblem ? getTrainingPlan(topProblem) : [];
    const planHTML = topProblem
      ? `
        <div class="card" style="margin-top:18px;border:1px solid #dbe7ff;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:15px;flex-wrap:wrap;margin-bottom:18px;">
            <div>
              <span class="eyebrow" style="color:#2563eb">NEXT 7 DAYS</span>
              <h2 style="margin:5px 0 4px;">Training Plan</h2>
              <p class="muted" style="margin:0;">Three sessions built around the player's current priority: <b>${esc(topProblem)}</b>.</p>
            </div>
            <span class="pill">${esc(topProblem)}</span>
          </div>
          <div style="display:grid;gap:12px;">
            ${plan.map((item, index) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;flex-wrap:wrap;">
                <div style="display:flex;gap:14px;align-items:flex-start;flex:1;min-width:230px;">
                  <div style="width:34px;height:34px;border-radius:10px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;">${index + 1}</div>
                  <div>
                    <b>${esc(item[0])}</b>
                    <div class="muted" style="margin-top:4px;line-height:1.5;">${esc(item[1])}</div>
                    <div class="muted" style="margin-top:6px;">${item[2]} min · Focus: ${esc(topProblem)}</div>
                  </div>
                </div>
                <button class="btn small" onclick="openSession('${id}', '${esc(topProblem)}', '${esc(item[0])}')">+ Add Session</button>
              </div>`).join("")}
          </div>
        </div>`
      : `
        <div class="card" style="margin-top:18px;">
          <span class="eyebrow">NEXT 7 DAYS</span>
          <h2 style="margin:5px 0 4px;">Training Plan</h2>
          <p class="muted" style="margin:0;">Once enough match-review data is available, TennisPilot will recommend the player's next training priority.</p>
        </div>`;

    const completedSessions = sessions.filter(s => s.completed).length;
    const trainingCompletion = sessions.length ? Math.round((completedSessions / sessions.length) * 100) : 0;

    const recentTraining = sessions.slice(0, 5);
    const trainingHTML = recentTraining.length
      ? recentTraining.map(s => `
          <div class="list-item" style="padding:15px 0;">
            <div>
              <b>${esc(s.session_name)}</b>
              <div class="muted">${esc(s.session_date || "No date")} · ${esc(s.focus || "No focus")}${s.duration_minutes ? ` · ${esc(s.duration_minutes)} min` : ""}</div>
            </div>
            <span class="pill" style="background:${s.completed ? "#dcfce7" : "#fef3c7"};color:${s.completed ? "#15803d" : "#a16207"};">${s.completed ? "Completed" : "Planned"}</span>
            <button class="btn small ${s.completed ? "ghost" : ""}" onclick="toggleTrainingSession('${s.id}', ${s.completed ? "false" : "true"}, '${id}')">${s.completed ? "Undo Complete" : "Mark Complete"}</button>
          </div>`).join("")
      : `<div class="empty">No training sessions yet.</div>`;

    const recentMatchesHTML = recentMatches.length
      ? recentMatches.map(m => `
          <div class="match" style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;">
              <div>
                <span class="pill" style="background:${m.result === "win" ? "#dcfce7" : "#fee2e2"};color:${m.result === "win" ? "#15803d" : "#b91c1c"};">${esc(m.result).toUpperCase()}</span>
                <h3 style="margin:8px 0 4px;">vs ${esc(m.opponent)}</h3>
                <span class="muted">${esc(m.match_date || "No date")} · ${esc(m.surface || "Surface not recorded")}</span>
              </div>
              <div style="font-weight:800;font-size:18px;">${esc(m.score || "—")}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px;">
              <div style="background:#f8fafc;padding:11px;border-radius:9px;"><span class="muted">Problem</span><br><b>${esc(m.biggest_problem || "None")}</b></div>
              <div style="background:#f8fafc;padding:11px;border-radius:9px;"><span class="muted">Positive</span><br><b>${esc(m.biggest_positive || "None")}</b></div>
            </div>
          </div>`).join("")
      : `<div class="empty">This player has not logged any matches yet.</div>`;

    $("app").innerHTML = `
      <div class="dash-head">
        <div>
          <span class="eyebrow">PLAYER DEVELOPMENT</span>
          <h1>${esc(player.full_name)}</h1>
          <p class="muted">Match → Review → Priority → Train → Next Match</p>
        </div>
        <button class="btn ghost" onclick="render('players')">← Players</button>
      </div>

      <div class="grid">
        <div class="card"><span class="muted">Matches</span><div class="stat">${matches.length}</div></div>
        <div class="card"><span class="muted">Wins</span><div class="stat">${wins}</div></div>
        <div class="card"><span class="muted">Losses</span><div class="stat">${losses}</div></div>
        <div class="card"><span class="muted">Win Rate</span><div class="stat">${winRate}%</div></div>
      </div>

      <div class="card" style="margin-top:18px;border:1px solid #dbe7ff;">${priorityHTML}</div>
      ${planHTML}

      <div class="card" style="margin-top:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:20px;">
          <div><span class="eyebrow">MATCH PATTERNS</span><h2 style="margin:5px 0 0;">Recurring Problems</h2></div>
          <span class="muted">Based on last ${recentMatches.length} match${recentMatches.length === 1 ? "" : "es"}</span>
        </div>
        ${problemHTML}
      </div>

      <div class="card" style="margin-top:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:18px;">
          <div><span class="eyebrow">TRAINING</span><h2 style="margin:5px 0 0;">Training Progress</h2></div>
          <div style="text-align:right;"><div style="font-size:24px;font-weight:800;">${trainingCompletion}%</div><span class="muted">completion</span></div>
        </div>
        <div style="width:100%;height:10px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin-bottom:20px;"><div style="width:${trainingCompletion}%;height:100%;background:#2563eb;border-radius:99px;"></div></div>
        ${sessions.length ? `<p class="muted">${completedSessions} of ${sessions.length} training sessions completed.</p>` : ""}
        ${trainingHTML}
      </div>

      <div class="card" style="margin-top:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:18px;">
          <div><span class="eyebrow">MATCH HISTORY</span><h2 style="margin:5px 0 0;">Recent Matches</h2></div>
          <span class="muted">${matches.length} total</span>
        </div>
        ${recentMatchesHTML}
      </div>

      <div class="card" style="margin-top:18px;background:#f8fafc;">
        <span class="eyebrow">TENNISPILOT DEVELOPMENT LOOP</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px;">
          <div style="padding:15px;background:white;border-radius:12px;"><b>1. Match</b><p class="muted" style="margin-bottom:0;">Player competes.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>2. Review</b><p class="muted" style="margin-bottom:0;">Player records what happened.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>3. Priority</b><p class="muted" style="margin-bottom:0;">TennisPilot identifies patterns.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>4. Train</b><p class="muted" style="margin-bottom:0;">Coach builds the next training focus.</p></div>
          <div style="padding:15px;background:white;border-radius:12px;"><b>5. Review again</b><p class="muted" style="margin-bottom:0;">The next match updates the priority.</p></div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    alert(err.message || "Could not load player.");
  }
}

/* =========================
   PLAYER MATCH HISTORY
========================= */

async function renderPlayerMatchHistory() {
  try {
    const matches = await playerMatches();
    const wins = matches.filter(m => m.result === "win").length;
  const losses = matches.filter(m => m.result === "loss").length;
  const winRate = matches.length ? Math.round((wins / matches.length) * 100) : 0;

  const grouped = {};
  matches.forEach(m => {
    const year = String(m.match_date || "").slice(0, 4) || "Unknown";
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(m);
  });

  const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  $("app").innerHTML = `
    <div class="dash-head">
      <div>
        <span class="eyebrow">MATCH HISTORY</span>
        <h1>My Matches</h1>
        <p class="muted">Your permanent match history and reviews.</p>
      </div>
      <button class="btn" onclick="openMatch()">+ Add Match</button>
    </div>

    <div class="grid">
      <div class="card"><span class="muted">Matches</span><div class="stat">${matches.length}</div></div>
      <div class="card"><span class="muted">Wins</span><div class="stat">${wins}</div></div>
      <div class="card"><span class="muted">Losses</span><div class="stat">${losses}</div></div>
      <div class="card"><span class="muted">Win Rate</span><div class="stat">${winRate}%</div></div>
    </div>

    <div style="margin-top:22px;">
      ${matches.length ? years.map(year => `
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h2 style="margin:0;">${esc(year)}</h2>
            <span class="muted">${grouped[year].length} ${grouped[year].length === 1 ? "match" : "matches"}</span>
          </div>
          <div style="display:grid;gap:12px;">
            ${grouped[year].map(m => `
              <div class="card">
                <div style="display:flex;justify-content:space-between;gap:15px;align-items:flex-start;flex-wrap:wrap;">
                  <div>
                    <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;">
                      <span class="pill" style="${m.result === "win" ? "background:#dcfce7;color:#15803d;" : "background:#fee2e2;color:#b91c1c;"}">${m.result === "win" ? "WIN" : "LOSS"}</span>
                      <span class="muted">${esc(m.match_date)}</span>
                    </div>
                    <h3 style="margin:9px 0 4px;">vs ${esc(m.opponent)}</h3>
                    <div class="muted">${esc(m.score || "No score recorded")}${m.surface ? ` · ${esc(m.surface)}` : ""}</div>
                  </div>
                </div>
                <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e5e7eb;display:grid;gap:7px;">
                  <div><b>Biggest problem:</b> ${esc(m.biggest_problem || "None")}</div>
                  <div><b>Biggest positive:</b> ${esc(m.biggest_positive || "None")}</div>
                  ${m.notes ? `<div><b>Notes:</b> ${esc(m.notes)}</div>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("") : `
        <div class="card"><div class="empty"><h3>No matches yet</h3><p>Add your first match to start building your permanent match history.</p><button class="btn" onclick="openMatch()">+ Add Match</button></div></div>
      `}
    </div>
  `;
  } catch (err) {
    console.error("Match history error:", err);
    $("app").innerHTML = `
      <div class="card">
        <div class="empty">
          <h3>Could not load Match History</h3>
          <p>${esc(err?.message || "Unknown database error")}</p>
          <button class="btn" onclick="renderPlayerMatchHistory()">Try Again</button>
        </div>
      </div>
    `;
  }
}

/* =========================
   PLAYER DASHBOARD
========================= */

async function renderPlayer(page) {

  if (page === "overview") {

    const matches =
      await playerMatches();

    $("app").innerHTML = `
      <div class="dash-head">

        <div>
          <span class="eyebrow">
            PLAYER DASHBOARD
          </span>

          <h1>
            Welcome,
            ${esc(
              profile.full_name
                .split(" ")[0]
            )}
          </h1>
        </div>

        <button
          class="btn"
          onclick="openMatch()">
          + Log Match
        </button>

      </div>

      <div class="grid">

        <div class="card">
          <span class="muted">
            Matches
          </span>

          <div class="stat">
            ${matches.length}
          </div>
        </div>

        <div class="card">
          <span class="muted">
            Wins
          </span>

          <div class="stat">
            ${matches.filter(
              m => m.result === "win"
            ).length}
          </div>
        </div>

        <div class="card">
          <span class="muted">
            Losses
          </span>

          <div class="stat">
            ${matches.filter(
              m => m.result === "loss"
            ).length}
          </div>
        </div>

      </div>

      <div class="card"
        style="margin-top:18px">

        <h3>Recent matches</h3>

        ${
          matches.slice(0, 5).map(m => `
            <div class="list-item">

              <b>
                ${esc(m.result).toUpperCase()}
                vs
                ${esc(m.opponent)}
              </b>

              <span
                class="muted"
                style="float:right">

                ${esc(m.match_date)}

              </span>

            </div>
          `).join("")
          ||
          "<p class='muted'>Log your first match.</p>"
        }

      </div>
    `;
  }

  /* =========================
     MATCH HISTORY
  ========================= */

  else if (page === "matches") {

    await renderPlayerMatchHistory();

  }

  /* =========================
     MY COACH — UPDATED
  ========================= */

  else if (page === "coach") {

    await renderMyCoach();

  }

  /* =========================
     LOG MATCH
  ========================= */

  else if (page === "logmatch") {

    openMatch();

  }

  /* =========================
     TRAINING
  ========================= */

  else if (page === "training") {

    const {
      data,
      error
    } = await sb.from("training_sessions")
      .select("*")
      .eq("player_id", currentUser.id)
      .order("session_date", {
        ascending: false
      });

    if (error) throw error;

    $("app").innerHTML = `
      <div class="dash-head">

        <div>
          <span class="eyebrow">
            TRAINING
          </span>

          <h1>My Training</h1>
        </div>

        <span class="muted" style="align-self:center;">Training is assigned by your coach</span>

      </div>

      ${
        data?.length
          ? data.map(s => `
              <div class="match" style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                  <div>
                    <b>${esc(s.session_name)}</b>
                    <p class="muted" style="margin:7px 0 0;">
                      ${esc(s.session_date)} · ${esc(s.duration_minutes || "—")} min · ${esc(s.focus || "No focus")}
                    </p>
                  </div>
                  <span class="pill" style="background:${s.completed ? "#dcfce7" : "#fef3c7"};color:${s.completed ? "#15803d" : "#a16207"};">
                    ${s.completed ? "Completed" : "Planned"}
                  </span>
                </div>
                ${s.notes ? `<p style="margin:12px 0 0;">${esc(s.notes)}</p>` : ""}
                <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                  <button class="btn small ${s.completed ? "ghost" : ""}" onclick="toggleTrainingSession('${s.id}', ${s.completed ? "false" : "true"})">
                    ${s.completed ? "Undo Complete" : "✓ Mark Complete"}
                  </button>
                  <span class="muted">${s.completed ? "Counts toward your progress. Click Undo Complete if needed." : "Complete this session when you're done training."}</span>
                </div>
              </div>
            `).join("")
          : `
            <div class="empty">
              No training sessions yet.
            </div>
          `
      }
    `;
  }

  /* =========================
     PROGRESS
  ========================= */
  else if (page === "progress") {
    const { data: sessions, error: trainingError } = await sb
      .from("training_sessions")
      .select("*")
      .eq("player_id", currentUser.id)
      .order("session_date", { ascending: false });

    if (trainingError) throw trainingError;

    const allSessions = sessions || [];
    const completedSessions = allSessions.filter(s => s.completed);
    const completion = allSessions.length
      ? Math.round((completedSessions.length / allSessions.length) * 100)
      : 0;

    const matches = await playerMatches();
    const recentMatches = matches.slice(0, 6);
    const problemCounts = {};
    recentMatches.forEach(match => {
      const problem = String(match.biggest_problem || "").trim();
      if (!problem || problem.toLowerCase() === "none") return;
      problemCounts[problem] = (problemCounts[problem] || 0) + 1;
    });

    const sortedProblems = Object.entries(problemCounts).sort((a, b) => b[1] - a[1]);
    const currentPriority = sortedProblems.length ? sortedProblems[0][0] : "Not enough data";
    const priorityCount = sortedProblems.length ? sortedProblems[0][1] : 0;

    const focusCounts = {};
    completedSessions.forEach(session => {
      const focus = String(session.focus || "").trim();
      if (!focus || focus.toLowerCase() === "none") return;
      focusCounts[focus] = (focusCounts[focus] || 0) + 1;
    });
    const completedFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1]);
    const mainTrainingFocus = completedFocus.length ? completedFocus[0][0] : "No completed focus yet";
    const priorityTrainingSessions = currentPriority !== "Not enough data"
      ? completedSessions.filter(session => String(session.focus || "").trim().toLowerCase() === currentPriority.toLowerCase())
      : [];
    const recentCompleted = completedSessions.slice(0, 5);

    $("app").innerHTML = `
      <div class="dash-head">
        <div>
          <span class="eyebrow">PLAYER DEVELOPMENT</span>
          <h1>Progress</h1>
          <p class="muted">Track completed training and see how it connects to your match priorities.</p>
        </div>
      </div>

      <div class="grid">
        <div class="card"><span class="muted">Training completion</span><div class="stat">${completion}%</div><p class="muted" style="margin-bottom:0;">${completedSessions.length} of ${allSessions.length} sessions completed.</p></div>
        <div class="card"><span class="muted">Current priority</span><div class="stat" style="font-size:28px;">${esc(currentPriority)}</div><p class="muted" style="margin-bottom:0;">${sortedProblems.length ? `${priorityCount} of ${recentMatches.length} recent matches` : "Log more match reviews to find a pattern."}</p></div>
        <div class="card"><span class="muted">Training toward priority</span><div class="stat">${priorityTrainingSessions.length}</div><p class="muted" style="margin-bottom:0;">Completed ${esc(currentPriority)} session${priorityTrainingSessions.length === 1 ? "" : "s"}.</p></div>
      </div>

      <div class="card" style="margin-top:18px;border:1px solid #dbe7ff;background:#f8fbff;">
        <span class="eyebrow" style="color:#2563eb">WHAT YOUR TRAINING IS DOING</span>
        <h2 style="margin:5px 0 8px;">${esc(currentPriority)}</h2>
        <p class="muted" style="line-height:1.6;margin:0;">
          ${currentPriority === "Not enough data"
            ? "Log more match reviews and TennisPilot will identify a recurring priority."
            : priorityTrainingSessions.length
              ? `You have completed <b>${priorityTrainingSessions.length}</b> training session${priorityTrainingSessions.length === 1 ? "" : "s"} focused on ${esc(currentPriority)}. Your next match review will show whether this problem is still appearing.`
              : `Your current match priority is ${esc(currentPriority)}, but you have not completed a training session focused on it yet.`}
        </p>
      </div>

      <div class="card" style="margin-top:18px;border:1px solid #dbe7ff;">
        <span class="eyebrow" style="color:#2563eb">DEVELOPMENT LOOP</span>
        <h2 style="margin:5px 0 8px;">Match → Review → Priority → Train</h2>
        <p class="muted" style="line-height:1.6;margin-bottom:18px;">Completing training now records that work against your current priority. Your next match review is the feedback check: did the same problem appear again?</p>
        <div style="width:100%;height:10px;background:#e5e7eb;border-radius:99px;overflow:hidden;"><div style="width:${completion}%;height:100%;background:#2563eb;border-radius:99px;"></div></div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;">
          <div><span class="eyebrow">COMPLETED TRAINING</span><h2 style="margin:5px 0 0;">Recent sessions</h2></div>
          <button class="btn small" onclick="render('training')">View Training</button>
        </div>
        ${recentCompleted.length ? recentCompleted.map(s => `
          <div class="list-item">
            <div><b>${esc(s.session_name)}</b><div class="muted">${esc(s.session_date)} · ${esc(s.focus || "No focus")}${s.duration_minutes ? ` · ${esc(s.duration_minutes)} min` : ""}</div></div>
            <span class="pill" style="background:#dcfce7;color:#15803d;">Completed</span>
          </div>
        `).join("") : `<div class="empty">Complete your first training session and it will appear here.</div>`}
      </div>
    `;
  }
}

/* =========================
   MY COACH PAGE
========================= */

async function renderMyCoach() {

  let coach = null;

  /* Check if player is already connected */
  if (profile.connected_coach_id) {

    const {
      data,
      error
    } = await sb.from("profiles")
      .select(
        "id,full_name,role,coach_code"
      )
      .eq(
        "id",
        profile.connected_coach_id
      )
      .single();

    if (error) throw error;

    coach = data;
  }

  /* Check for pending request */
  const {
    data: pendingRequests,
    error: pendingError
  } = await sb.from("connection_requests")
    .select(
      "id,coach_id,status,created_at"
    )
    .eq(
      "player_id",
      currentUser.id
    )
    .eq(
      "status",
      "pending"
    )
    .order("created_at", {
      ascending: false
    });

  if (pendingError) {
    throw pendingError;
  }

  const pending =
    pendingRequests &&
    pendingRequests.length > 0;

  /* =========================
     CONNECTED STATE
  ========================= */

  if (coach) {

    const initials =
      coach.full_name
        .split(" ")
        .map(x => x[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    $("app").innerHTML = `

      <div class="dash-head">

        <div>

          <span class="eyebrow">
            CONNECTION
          </span>

          <h1>
            My Coach
          </h1>

        </div>

      </div>

      <div class="card"
        style="
          padding:28px;
          margin-bottom:18px;
        ">

        <div
          style="
            display:flex;
            align-items:center;
            gap:22px;
            flex-wrap:wrap;
          ">

          <div
            style="
              width:82px;
              height:82px;
              border-radius:50%;
              background:#e5edff;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:28px;
              font-weight:800;
              color:#132c47;
            ">

            ${esc(initials)}

          </div>

          <div style="flex:1">

            <span
              class="muted"
              style="
                text-transform:uppercase;
                font-size:12px;
                font-weight:800;
                letter-spacing:1px;
              ">

              YOUR COACH

            </span>

            <h2
              style="
                margin:5px 0 3px;
              ">

              ${esc(coach.full_name)}

            </h2>

            <p
              class="muted"
              style="margin:0">

              Tennis Coach

            </p>

            <div style="margin-top:12px">

              <span
                class="pill"
                style="
                  background:#dcfce7;
                  color:#15803d;
                ">

                ● Connected

              </span>

            </div>

          </div>

          <div
            style="
              min-width:190px;
              padding-left:20px;
              border-left:1px solid #e5e7eb;
            ">

            <span class="muted">
              Coach Code
            </span>

            <div
              style="
                font-size:22px;
                font-weight:800;
                margin-top:5px;
                letter-spacing:1px;
              ">

              ${esc(
                coach.coach_code || "—"
              )}

            </div>

          </div>

        </div>

        <div
          style="
            display:flex;
            gap:10px;
            margin-top:25px;
            flex-wrap:wrap;
          ">

          <button
            class="btn"
            onclick="viewCoachProfile()">

            View Coach Profile

          </button>

          <button
            class="btn ghost"
            onclick="disconnectCoach()"
            style="color:#b91c1c">

            Disconnect Coach

          </button>

        </div>

      </div>

      <div class="card">

        <h3>
          Your TennisPilot connection
        </h3>

        <p class="muted">
          Your coach can see the information
          connected to your player account,
          including your match reviews and
          training progress.
        </p>

      </div>

    `;

    return;
  }

  /* =========================
     PENDING STATE
  ========================= */

  if (pending) {

    const request =
      pendingRequests[0];

    let pendingCoach = null;

    const {
      data: coachData
    } = await sb.from("profiles")
      .select(
        "full_name,role,coach_code"
      )
      .eq(
        "id",
        request.coach_id
      )
      .single();

    pendingCoach = coachData;

    $("app").innerHTML = `

      <div class="dash-head">

        <div>

          <span class="eyebrow">
            CONNECTION
          </span>

          <h1>
            My Coach
          </h1>

        </div>

      </div>

      <div class="card"
        style="padding:30px">

        <div
          style="
            width:64px;
            height:64px;
            border-radius:50%;
            background:#fff7ed;
            color:#c2410c;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:26px;
            margin-bottom:18px;
          ">

          ⏳

        </div>

        <span
          class="eyebrow"
          style="color:#c2410c">

          REQUEST SENT

        </span>

        <h2 style="margin:6px 0">

          ${
            esc(
              pendingCoach?.full_name ||
              "Your coach"
            )
          }

        </h2>

        <p class="muted">

          Your connection request is waiting
          for your coach to accept it.

        </p>

        <div
          style="
            background:#f8fafc;
            border-radius:12px;
            padding:16px;
            margin-top:20px;
          ">

          <b>
            What happens next?
          </b>

          <p
            class="muted"
            style="margin-bottom:0">

            Your coach will see your request
            in their Requests section.
            Once they accept, their profile
            will appear here.

          </p>

        </div>

      </div>

    `;

    return;
  }

  /* =========================
     NO COACH
  ========================= */

  $("app").innerHTML = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          CONNECTION
        </span>

        <h1>
          My Coach
        </h1>

      </div>

    </div>

    <div class="card"
      style="
        padding:30px;
        margin-bottom:18px;
      ">

      <span class="eyebrow">
        NO COACH CONNECTED
      </span>

      <h2
        style="
          margin:7px 0;
        ">

        Add Your Coach

      </h2>

      <p class="muted">

        Connect your TennisPilot account
        to your coach using their
        3 letters + 3 numbers code.

      </p>

      <div
        style="
          display:flex;
          gap:12px;
          max-width:700px;
          margin-top:24px;
          flex-wrap:wrap;
        ">

        <div style="flex:1;min-width:220px">

          <label
            style="
              display:block;
              font-weight:700;
              margin-bottom:7px;
            ">

            Coach Code

          </label>

          <input
            id="coachSearchCode"
            maxlength="6"
            placeholder="e.g. ABC123"
            autocomplete="off"
            style="
              width:100%;
              box-sizing:border-box;
              text-transform:uppercase;
            "
          >

        </div>

        <div
          style="
            display:flex;
            align-items:flex-end;
          ">

          <button
            class="btn"
            onclick="findCoach()">

            Find Coach

          </button>

        </div>

      </div>

    </div>

    <div class="card">

      <h3>
        Why connect with a coach?
      </h3>

      <div
        style="
          display:grid;
          gap:14px;
          margin-top:15px;
        ">

        <div>
          ✓ Share your match history
        </div>

        <div>
          ✓ Get personalized feedback
        </div>

        <div>
          ✓ Track your development together
        </div>

      </div>

    </div>

  `;

  const input =
    $("coachSearchCode");

  if (input) {

    input.addEventListener(
      "input",
      () => {
        input.value =
          input.value
            .replace(/[^a-zA-Z0-9]/g, "")
            .toUpperCase();
      }
    );

    input.addEventListener(
      "keydown",
      e => {
        if (e.key === "Enter") {
          findCoach();
        }
      }
    );
  }
}

/* =========================
   FIND COACH
========================= */

async function findCoach() {

  const input =
    $("coachSearchCode");

  if (!input) return;

  const code =
    input.value
      .trim()
      .toUpperCase();

  if (!/^[A-Z]{3}[0-9]{3}$/.test(code)) {

    alert(
      "Enter a valid coach code with 3 letters and 3 numbers, for example ABC123."
    );

    return;
  }

  try {

    const {
      data,
      error
    } = await sb.rpc(
      "find_coach_by_code",
      {
        code_input: code
      }
    );

    if (error) throw error;

    if (!data || !data.length) {

      alert(
        "No coach was found with that code."
      );

      return;
    }

    const coach = data[0];

    if (coach.role !== "coach") {

      alert(
        "That code does not belong to a coach."
      );

      return;
    }

    openCoachConfirmation(coach);

  } catch (err) {

    alert(
      err.message ||
      "Could not find coach."
    );
  }
}

/* =========================
   COACH CONFIRMATION
========================= */

function openCoachConfirmation(coach) {

  const initials =
    coach.full_name
      .split(" ")
      .map(x => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div
        class="modal"
        style="
          max-width:620px;
        ">

        <button
          type="button"
          onclick="closeModal()"
          style="
            float:right;
            border:0;
            background:none;
            font-size:26px;
            cursor:pointer;
            color:#64748b;
          ">

          ×

        </button>

        <span class="eyebrow">
          COACH FOUND
        </span>

        <h2>
          ${esc(coach.full_name)}
        </h2>

        <p class="muted">

          We found a coach with this code.
          Send them a connection request?

        </p>

        <div
          style="
            display:flex;
            align-items:center;
            gap:18px;
            background:#f8fafc;
            border-radius:14px;
            padding:18px;
            margin:22px 0;
          ">

          <div
            style="
              width:64px;
              height:64px;
              border-radius:50%;
              background:#e5edff;
              color:#132c47;
              display:flex;
              align-items:center;
              justify-content:center;
              font-weight:800;
              font-size:22px;
            ">

            ${esc(initials)}

          </div>

          <div>

            <h3
              style="
                margin:0 0 4px;
              ">

              ${esc(coach.full_name)}

            </h3>

            <p
              class="muted"
              style="margin:0">

              Tennis Coach

            </p>

            <p
              class="muted"
              style="margin:4px 0 0">

              Code:
              <b>
                ${esc(coach.coach_code)}
              </b>

            </p>

          </div>

        </div>

        <div class="modal-actions">

          <button
            type="button"
            class="btn ghost"
            onclick="closeModal()">

            Cancel

          </button>

          <button
            type="button"
            class="btn"
            onclick="sendCoachRequest('${coach.id}')">

            Send Connection Request

          </button>

        </div>

      </div>

    </div>

  `;
}

/* =========================
   SEND COACH REQUEST
========================= */

async function sendCoachRequest(
  coachId
) {

  try {

    /* Prevent connecting to yourself */
    if (coachId === currentUser.id) {

      alert(
        "You cannot connect to yourself."
      );

      return;
    }

    /* Check if request already exists */
    const {
      data: existing,
      error: existingError
    } = await sb.from("connection_requests")
      .select("id,status")
      .eq(
        "player_id",
        currentUser.id
      )
      .eq(
        "coach_id",
        coachId
      )
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing?.status === "pending") {

      closeModal();

      await render("coach");

      return;
    }

    const {
      error
    } = await sb.from(
      "connection_requests"
    ).insert({

      player_id:
        currentUser.id,

      coach_id:
        coachId,

      status:
        "pending"

    });

    if (error) throw error;

    closeModal();

    await render("coach");

  } catch (err) {

    alert(
      err.message ||
      "Could not send connection request."
    );
  }
}

/* =========================
   VIEW COACH PROFILE
========================= */

async function viewCoachProfile() {

  if (!profile.connected_coach_id)
    return;

  const {
    data: coach,
    error
  } = await sb.from("profiles")
    .select(
      "full_name,role,coach_code"
    )
    .eq(
      "id",
      profile.connected_coach_id
    )
    .single();

  if (error) {

    alert(error.message);
    return;

  }

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div class="modal">

        <h2>
          ${esc(coach.full_name)}
        </h2>

        <p class="muted">
          Tennis Coach
        </p>

        <div
          class="card"
          style="
            margin:20px 0;
            box-shadow:none;
          ">

          <span class="muted">
            Coach Code
          </span>

          <h2
            style="
              margin:5px 0 0;
              letter-spacing:1px;
            ">

            ${esc(
              coach.coach_code || "—"
            )}

          </h2>

        </div>

        <div class="modal-actions">

          <button
            class="btn"
            onclick="closeModal()">

            Done

          </button>

        </div>

      </div>

    </div>

  `;
}

/* =========================
   DISCONNECT COACH
========================= */

async function disconnectCoach() {

  const confirmed =
    confirm(
      "Are you sure you want to disconnect from your coach?"
    );

  if (!confirmed) return;

  try {

    const {
      error
    } = await sb.from("profiles")
      .update({
        connected_coach_id: null
      })
      .eq(
        "id",
        currentUser.id
      );

    if (error) throw error;

    profile.connected_coach_id = null;

    await render("coach");

  } catch (err) {

    alert(
      err.message ||
      "Could not disconnect coach."
    );
  }
}

/* =========================
   MATCH MODAL
========================= */

function openMatch() {

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div class="modal">

        <h2>
          Log Match
        </h2>

        <form id="matchForm">

          <label>
            Opponent
            <input
              id="opponent"
              required
            >
          </label>

          <label>
            Date
            <input
              id="matchDate"
              type="date"
              value="${
                new Date()
                  .toISOString()
                  .slice(0, 10)
              }"
              required
            >
          </label>

          <label>
            Result

            <select id="result">

              <option value="win">
                Win
              </option>

              <option value="loss">
                Loss
              </option>

            </select>

          </label>

          <label>
            Score

            <input
              id="score"
              placeholder="6-4, 3-6, 10-8"
            >

          </label>

          <label>
            Biggest problem

            <select id="problem">

              <option>None</option>
              <option>Serve</option>
              <option>Return</option>
              <option>Forehand</option>
              <option>Backhand</option>
              <option>Movement</option>
              <option>Mental game</option>
              <option>Consistency</option>
              <option>Other</option>

            </select>

          </label>

          <label>
            Biggest positive

            <select id="positive">

              <option>None</option>
              <option>Serve</option>
              <option>Return</option>
              <option>Forehand</option>
              <option>Backhand</option>
              <option>Movement</option>
              <option>Mental game</option>
              <option>Consistency</option>
              <option>Other</option>

            </select>

          </label>

          <label>
            Notes

            <textarea
              id="notes"
              rows="4">
            </textarea>

          </label>

          <div class="modal-actions">

            <button
              type="button"
              class="btn ghost"
              onclick="closeModal()">

              Cancel

            </button>

            <button class="btn">

              Save Match

            </button>

          </div>

        </form>

      </div>

    </div>

  `;

  $("matchForm").onsubmit =
    async e => {

      e.preventDefault();

      const {
        error
      } = await sb.from("matches")
        .insert({

          player_id:
            currentUser.id,

          opponent:
            $("opponent")
              .value
              .trim(),

          match_date:
            $("matchDate")
              .value,

          result:
            $("result")
              .value,

          score:
            $("score")
              .value
              .trim(),

          biggest_problem:
            $("problem")
              .value,

          biggest_positive:
            $("positive")
              .value,

          surface:
            $("surface")
              ? $("surface").value
              : null,

          notes:
            $("notes")
              .value
              .trim()

        });

      if (error) {

        alert(error.message);

      } else {

        closeModal();
        await renderPlayerMatchHistory();

      }
    };
}

/* =========================
   TRAINING MODAL
========================= */

function openSession(targetPlayerId = currentUser.id, defaultFocus = "None", defaultSessionName = "") {
  const focusOptions = ["None", "Serve", "Return", "Forehand", "Backhand", "Movement", "Mental game", "Consistency"];
  const selectedFocus = focusOptions.includes(defaultFocus) ? defaultFocus : "None";
  const today = new Date().toISOString().slice(0, 10);

  $("modalRoot").innerHTML = `
    <div class="modal-back">
      <div class="modal">
        <h2>Add Training Session</h2>

        <form id="sessionForm">
          <label>
            Session name
            <input id="sessionName" required value="${esc(defaultSessionName)}">
          </label>

          <label>
            Date
            <input id="sessionDate" type="date" value="${today}">
          </label>

          <label>
            Duration (minutes)
            <input
              id="duration"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="e.g. 60"
              maxlength="4"
            >
          </label>

          <label>
            Focus
            <select id="focus">
              ${focusOptions.map(option => `<option${option === selectedFocus ? " selected" : ""}>${esc(option)}</option>`).join("")}
            </select>
          </label>

          <label>
            Notes
            <textarea id="sessionNotes" rows="3"></textarea>
          </label>

          <div class="modal-actions">
            <button type="button" class="btn ghost" onclick="closeModal()">Cancel</button>
            <button class="btn">Add Session</button>
          </div>
        </form>
      </div>
    </div>
  `;

  $("duration").addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  $("sessionForm").onsubmit = async e => {
    e.preventDefault();

    const durationValue = $("duration").value.trim();
    const duration = durationValue ? Number(durationValue) : null;

    if (duration !== null && (!Number.isInteger(duration) || duration < 1)) {
      alert("Duration must be a whole number of minutes.");
      return;
    }

    const { error } = await sb.from("training_sessions").insert({
      player_id: targetPlayerId,
      session_name: $("sessionName").value.trim(),
      session_date: $("sessionDate").value,
      duration_minutes: duration,
      focus: $("focus").value,
      notes: $("sessionNotes").value.trim()
    });

    if (error) {
      alert(error.message);
      return;
    }

    closeModal();

    if (targetPlayerId !== currentUser.id && currentUser && profile?.role === "coach") {
      await viewPlayer(targetPlayerId);
    } else {
      await render("training");
    }
  };
}

/* =========================
   TRAINING COMPLETION
========================= */

async function toggleTrainingSession(sessionId, completed, returnPlayerId = null) {
  try {
    let error = null;

    if (profile?.role === "coach") {
      const result = await sb
        .from("training_sessions")
        .update({ completed })
        .eq("id", sessionId);
      error = result.error;
    } else {
      const result = await sb.rpc("toggle_training_completion", {
        session_id: sessionId,
        completed_input: completed
      });
      error = result.error;
    }

    if (error) throw error;

    if (returnPlayerId && profile?.role === "coach") {
      await viewPlayer(returnPlayerId);
    } else {
      await render("training");
    }
  } catch (err) {
    alert(err.message || "Could not update training session.");
  }
}

/* =========================
   MODAL
========================= */

function closeModal() {
  $("modalRoot").innerHTML = "";
}

/* =========================
   START
========================= */

async function start() {

  if (
    document.getElementById(
      "authForm"
    )
  ) {

    setupAuth();
    return;

  }

  if (
    document.getElementById(
      "app"
    )
  ) {

    if (await loadProfile()) {

      shell();
      render("overview");

    }

  }
}

start();
