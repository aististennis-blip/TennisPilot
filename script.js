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

        <button class="nav-item" data-page="logmatch">
          Log Match
        </button>

        <button class="nav-item" data-page="coach">
          My Coach
        </button>

        <button class="nav-item" data-page="training">
          Training
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
      .select("*")
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
  if (!app) return;

  try {
    if (profile.role === "coach") {
      app.innerHTML = "<div class='empty'>Loading…</div>";
      await renderCoach(page);
    } else {
      if (page === "logmatch") {
        await renderMatchHistory();
      } else {
        app.innerHTML = "<div class='empty'>Loading…</div>";
        await renderPlayer(page);
      }
    }
  } catch (e) {
    console.error(e);
    app.innerHTML =
      `<div class="card">
        <b>Error:</b> ${esc(e.message || "Something went wrong.")}
      </div>`;
  }
}

/* =========================
   COACH DASHBOARD
========================= */

async function renderCoach(page) {
  const players = await connectedPlayers();

  if (page === "overview") {

    $("app").innerHTML = `
      <div class="dash-head">
        <div>
          <span class="eyebrow">COACH DASHBOARD</span>
          <h1>Overview</h1>
        </div>

        <button class="btn"
          onclick="render('players')">
          View players
        </button>
      </div>

      <div class="grid">

        <div class="card">
          <span class="muted">Players</span>
          <div class="stat">
            ${players.length}
          </div>
        </div>

        <div class="card">
          <span class="muted">
            Connection code
          </span>

          <div class="stat">
            ${esc(profile.coach_code || "—")}
          </div>
        </div>

        <div class="card">
          <span class="muted">System</span>
          <div class="stat">Live</div>
        </div>

      </div>

      <div class="card"
        style="margin-top:18px">

        <h3>Players</h3>

        ${
          players.length
            ? players.map(p => `
                <div class="list-item">
                  <b>${esc(p.full_name)}</b>
                  <span class="pill"
                    style="float:right">
                    Connected
                  </span>
                </div>
              `).join("")
            : "<div class='empty'>No players connected yet.</div>"
        }

      </div>
    `;
  }

  else if (page === "players") {

    $("app").innerHTML = `
      <div class="dash-head">
        <div>
          <span class="eyebrow">
            YOUR PLAYERS
          </span>
          <h1>Players</h1>
        </div>
      </div>

      ${
        players.length
          ? `
            <div class="grid">
              ${players.map(p => `
                <div class="card">

                  <h3>
                    ${esc(p.full_name)}
                  </h3>

                  <p class="muted">
                    Player account
                  </p>

                  <button
                    class="btn small"
                    onclick="viewPlayer('${p.id}')">
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
                  ${esc(m.surface || "Surface not recorded")}
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
   VIEW PLAYER
========================= */

async function viewPlayer(id) {

  const players =
    await connectedPlayers();

  const p =
    players.find(x => x.id === id);

  if (!p) return;

  const matches =
    await playerMatches(id);

  $("app").innerHTML = `
    <div class="dash-head">

      <div>
        <span class="eyebrow">
          PLAYER
        </span>

        <h1>
          ${esc(p.full_name)}
        </h1>
      </div>

      <button
        class="btn ghost"
        onclick="render('players')">
        ← Players
      </button>

    </div>

    <div class="grid">

      <div class="card">
        <span class="muted">
          Matches reviewed
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

      <h3>Match history</h3>

      ${
        matches.length
          ? matches.map(m => `
              <div class="match">

                <b>
                  ${esc(m.match_date)}
                  —
                  ${esc(m.result)}
                </b>

                vs
                ${esc(m.opponent)}

                <br>

                <span class="muted">
                  ${esc(m.surface || "Surface not recorded")}
                  ·
                  ${esc(m.score || "")}
                </span>

                <p>
                  Problem:
                  ${esc(
                    m.biggest_problem ||
                    "None"
                  )}
                </p>

                <p>
                  Positive:
                  ${esc(
                    m.biggest_positive ||
                    "None"
                  )}
                </p>

              </div>
            `).join("")
          : `
            <p class="muted">
              No matches yet.
            </p>
          `
      }

    </div>
  `;
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
          onclick="render('logmatch')">
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

  else if (page === "coach") {

    await renderMyCoach();

  }

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

        <button
          class="btn"
          onclick="openSession()">
          + Add Session
        </button>

      </div>

      ${
        data?.length
          ? data.map(s => `
              <div class="match">

                <b>
                  ${esc(s.session_name)}
                </b>

                <span
                  class="pill"
                  style="float:right">

                  ${
                    s.completed
                      ? "Completed"
                      : "Planned"
                  }

                </span>

                <p class="muted">

                  ${esc(s.session_date)}
                  ·
                  ${esc(
                    s.duration_minutes ||
                    "—"
                  )}
                  min
                  ·
                  ${esc(
                    s.focus ||
                    "No focus"
                  )}

                </p>

                <p>
                  ${esc(s.notes || "")}
                </p>

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
}

/* =========================
   MY COACH PAGE
========================= */

async function renderMyCoach() {

  let coach = null;

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

    if (coachId === currentUser.id) {

      alert(
        "You cannot connect to yourself."
      );

      return;
    }

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
   PLAYER MATCH HISTORY
========================= */

async function renderMatchHistory() {

  const matches = await playerMatches();

  const years = {};

  matches.forEach(m => {

    const year = m.match_date
      ? String(m.match_date).slice(0, 4)
      : "Unknown";

    if (!years[year]) {
      years[year] = [];
    }

    years[year].push(m);
  });

  const sortedYears =
    Object.keys(years).sort(
      (a, b) => b.localeCompare(a)
    );

  const wins =
    matches.filter(
      m => m.result === "win"
    ).length;

  const losses =
    matches.filter(
      m => m.result === "loss"
    ).length;

  const winRate =
    matches.length
      ? Math.round(
          (wins / matches.length) * 100
        )
      : 0;

  let historyHTML = "";

  if (!matches.length) {

    historyHTML = `
      <div class="empty">

        <h3 style="margin-top:0">
          No matches yet
        </h3>

        <p>
          Log your first match to start
          building your match history.
        </p>

        <button
          class="btn"
          onclick="openMatch()">

          + Add Match

        </button>

      </div>
    `;

  } else {

    historyHTML =
      sortedYears.map(year => `

        <section style="margin-top:28px">

          <div
            style="
              display:flex;
              align-items:center;
              gap:12px;
              margin-bottom:12px;
            ">

            <h2 style="margin:0">
              ${esc(year)}
            </h2>

            <span class="pill">
              ${years[year].length}
              match${years[year].length === 1 ? "" : "es"}
            </span>

          </div>

          ${years[year].map(m => `

            <div
              class="match"
              style="margin-bottom:12px">

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  gap:15px;
                  flex-wrap:wrap;
                ">

                <div>

                  <span
                    class="pill"
                    style="
                      background:${
                        m.result === "win"
                          ? "#dcfce7"
                          : "#fee2e2"
                      };
                      color:${
                        m.result === "win"
                          ? "#15803d"
                          : "#b91c1c"
                      };
                    ">

                    ${esc(m.result).toUpperCase()}

                  </span>

                  <h3
                    style="
                      margin:10px 0 4px;
                    ">

                    vs ${esc(m.opponent)}

                  </h3>

                  <div class="muted">

                    ${esc(
                      m.match_date ||
                      "Date not recorded"
                    )}

                    ·

                    ${esc(
                      m.surface ||
                      "Surface not recorded"
                    )}

                  </div>

                </div>

                <div
                  style="
                    text-align:right;
                    min-width:120px;
                  ">

                  <span class="muted">
                    Score
                  </span>

                  <div
                    style="
                      font-size:20px;
                      font-weight:800;
                      margin-top:4px;
                    ">

                    ${esc(m.score || "—")}

                  </div>

                </div>

              </div>

              <details
                style="margin-top:16px">

                <summary
                  style="
                    cursor:pointer;
                    font-weight:700;
                  ">

                  View match review

                </summary>

                <div
                  style="
                    margin-top:14px;
                    display:grid;
                    gap:9px;
                  ">

                  <div>

                    <b>
                      Biggest problem:
                    </b>

                    ${esc(
                      m.biggest_problem ||
                      "None"
                    )}

                  </div>

                  <div>

                    <b>
                      Biggest positive:
                    </b>

                    ${esc(
                      m.biggest_positive ||
                      "None"
                    )}

                  </div>

                  ${
                    m.notes
                      ? `
                        <div>
                          <b>Notes:</b>
                          ${esc(m.notes)}
                        </div>
                      `
                      : ""
                  }

                </div>

              </details>

            </div>

          `).join("")}

        </section>

      `).join("");
  }

  $("app").innerHTML = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          MATCH HISTORY
        </span>

        <h1>
          My Matches
        </h1>

        <p
          class="muted"
          style="margin-top:5px">

          Your complete match history stays
          saved and organized by year.

        </p>

      </div>

      <button
        class="btn"
        onclick="openMatch()">

        + Add Match

      </button>

    </div>

    <div class="grid">

      <div class="card">

        <span class="muted">
          Total Matches
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
          ${wins}
        </div>

      </div>

      <div class="card">

        <span class="muted">
          Losses
        </span>

        <div class="stat">
          ${losses}
        </div>

      </div>

      <div class="card">

        <span class="muted">
          Win Rate
        </span>

        <div class="stat">
          ${winRate}%
        </div>

      </div>

    </div>

    ${historyHTML}

  `;
}

/* =========================
   MATCH MODAL
========================= */

function openMatch() {

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div class="modal">

        <h2>
          Add Match
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
            Surface

            <select id="surface">

              <option>Hard</option>
              <option>Clay</option>
              <option>Grass</option>
              <option>Carpet</option>
              <option>Other</option>

            </select>

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
              onclick="closeModal(); render('logmatch')">

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

          surface:
            $("surface")
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

          notes:
            $("notes")
              .value
              .trim()

        });

      if (error) {

        alert(error.message);

      } else {

        closeModal();
        render("logmatch");

      }
    };
}

/* =========================
   TRAINING MODAL
========================= */

function openSession() {

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div class="modal">

        <h2>
          Add Training Session
        </h2>

        <form id="sessionForm">

          <label>
            Session name

            <input
              id="sessionName"
              required
            >

          </label>

          <label>
            Date

            <input
              id="sessionDate"
              type="date"
              value="${
                new Date()
                  .toISOString()
                  .slice(0, 10)
              }"
            >

          </label>

          <label>
            Duration (minutes)

            <input
              id="duration"
              type="number"
              min="1"
            >

          </label>

          <label>
            Focus

            <select id="focus">

              <option>None</option>
              <option>Serve</option>
              <option>Return</option>
              <option>Forehand</option>
              <option>Backhand</option>
              <option>Movement</option>
              <option>Mental game</option>
              <option>Consistency</option>

            </select>

          </label>

          <label>
            Notes

            <textarea
              id="sessionNotes"
              rows="3">
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

              Add Session

            </button>

          </div>

        </form>

      </div>

    </div>

  `;

  $("sessionForm").onsubmit =
    async e => {

      e.preventDefault();

      const {
        error
      } = await sb.from(
        "training_sessions"
      ).insert({

        player_id:
          currentUser.id,

        session_name:
          $("sessionName")
            .value
            .trim(),

        session_date:
          $("sessionDate")
            .value,

        duration_minutes:
          Number(
            $("duration")
              .value
          ) || null,

        focus:
          $("focus")
            .value,

        notes:
          $("sessionNotes")
            .value
            .trim()

      });

      if (error) {

        alert(error.message);

      } else {

        closeModal();
        render("training");

      }
    };
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
