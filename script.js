const sb = window.tennisPilotSupabase;

let mode = "login";
let role = "coach";
let currentUser = null;
let profile = null;

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

function showMessage(text, bad = false) {

  const element = $("authMessage");

  if (!element) return;

  element.textContent = text;

  element.className =
    "message " + (bad ? "danger" : "success");
}


/* =========================
   AUTH
========================= */

function setupAuth() {

  const tabs = document.querySelectorAll(".tab");
  const roles = document.querySelectorAll(".role");

  if (!tabs.length) return;

  tabs.forEach(button => {

    button.onclick = () => {

      mode = button.dataset.mode;

      tabs.forEach(tab =>
        tab.classList.toggle(
          "active",
          tab === button
        )
      );

      updateAuth();
    };

  });

  roles.forEach(button => {

    button.onclick = () => {

      role = button.dataset.role;

      roles.forEach(roleButton =>
        roleButton.classList.toggle(
          "active",
          roleButton === button
        )
      );

      updateAuth();
    };

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
    mode === "login"
      ? "Log In"
      : "Create Account";

  $("name").required =
    mode === "signup";

  $("confirm").required =
    mode === "signup";
}


function validPassword(password) {

  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}


function makeCode() {

  const letters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let code = "";

  for (let i = 0; i < 3; i++) {

    code +=
      letters[
        Math.floor(
          Math.random() * letters.length
        )
      ];
  }

  code += Math.floor(
    100 + Math.random() * 900
  );

  return code;
}


async function uniqueCoachCode() {

  for (let attempt = 0; attempt < 30; attempt++) {

    const code = makeCode();

    const { data, error } =
      await sb.rpc(
        "find_coach_by_code",
        {
          code_input: code
        }
      );

    if (!error && !data?.length) {
      return code;
    }
  }

  throw new Error(
    "Could not create a unique coach code."
  );
}


async function handleAuth(event) {

  event.preventDefault();

  showMessage("");

  const email =
    $("email").value.trim();

  const password =
    $("password").value;

  try {

    /* LOGIN */

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


    /* SIGNUP */

    if (!validPassword(password)) {

      throw new Error(
        "Password needs 8+ characters, an uppercase letter, a number and a special symbol."
      );
    }

    if (
      password !==
      $("confirm").value
    ) {

      throw new Error(
        "Passwords do not match."
      );
    }

    const fullName =
      $("name").value.trim();

    if (!fullName) {

      throw new Error(
        "Enter your full name."
      );
    }


    /* CREATE AUTH ACCOUNT */

    const { data, error } =
      await sb.auth.signUp({

        email,

        password,

        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }

      });

    if (error) throw error;

    if (!data.user) {

      throw new Error(
        "Account could not be created."
      );
    }


    let coachId = null;
    let coachCode = null;


    /* COACH CODE */

    if (role === "coach") {

      coachCode =
        await uniqueCoachCode();
    }


    /* PLAYER ENTERED COACH CODE */

    if (
      role === "player" &&
      $("coachCode").value.trim()
    ) {

      const { data: coaches, error } =
        await sb.rpc(
          "find_coach_by_code",
          {
            code_input:
              $("coachCode")
                .value
                .trim()
                .toUpperCase()
          }
        );

      if (error) throw error;

      if (!coaches?.length) {

        throw new Error(
          "Coach code not found."
        );
      }

      coachId =
        coaches[0].id;
    }


    /* CREATE PROFILE */

    const { error: profileError } =
      await sb
        .from("profiles")
        .insert({

          id: data.user.id,

          full_name: fullName,

          role: role,

          coach_code: coachCode,

          connected_coach_id: null

        });

    if (profileError)
      throw profileError;


    /* SEND CONNECTION REQUEST */

    if (
      role === "player" &&
      coachId
    ) {

      const { error: requestError } =
        await sb
          .from("connection_requests")
          .insert({

            player_id:
              data.user.id,

            coach_id:
              coachId,

            status:
              "pending"

          });

      if (requestError)
        throw requestError;
    }


    /* EMAIL CONFIRMATION */

    if (data.session) {

      location.href =
        "dashboard.html";

    } else {

      showMessage(
        "Account created. Check your email to confirm your account, then log in."
      );
    }

  } catch (error) {

    showMessage(
      error.message ||
      "Something went wrong.",
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

    location.href =
      "login.html";

    return false;
  }

  currentUser = user;


  const { data, error } =
    await sb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

  if (error) {

    console.error(error);

    alert(
      "Profile could not be loaded."
    );

    return false;
  }

  profile = data;

  return true;
}


/* =========================
   DASHBOARD SHELL
========================= */

function shell() {

  $("profileBox").innerHTML = `

    <strong>
      ${esc(profile.full_name)}
    </strong>

    <small>
      ${esc(profile.role)}
    </small>

    ${
      profile.role === "coach"
        ? `
        <small>
          Code:
          <b>
            ${esc(
              profile.coach_code || ""
            )}
          </b>
        </small>
        `
        : ""
    }

  `;


  if (profile.role === "coach") {

    $("sideNav").innerHTML = `

      <button
        class="nav-item active"
        data-page="overview">
        Overview
      </button>

      <button
        class="nav-item"
        data-page="players">
        Players
      </button>

      <button
        class="nav-item"
        data-page="requests">
        Requests
      </button>

      <button
        class="nav-item"
        data-page="matches">
        Match Reviews
      </button>

    `;

  } else {

    $("sideNav").innerHTML = `

      <button
        class="nav-item active"
        data-page="overview">
        My Dashboard
      </button>

      <button
        class="nav-item"
        data-page="logmatch">
        Log Match
      </button>

      <button
        class="nav-item"
        data-page="coach">
        My Coach
      </button>

      <button
        class="nav-item"
        data-page="training">
        Training
      </button>

    `;
  }


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.onclick = () =>
        render(
          button.dataset.page
        );

    });


  $("logoutBtn").onclick =
    async () => {

      await sb.auth.signOut();

      location.href =
        "index.html";
    };
}


/* =========================
   DATA
========================= */

async function connectedPlayers() {

  const { data, error } =
    await sb
      .from("profiles")
      .select("*")
      .eq(
        "connected_coach_id",
        currentUser.id
      )
      .eq(
        "role",
        "player"
      );

  if (error) throw error;

  return data || [];
}


async function playerMatches(
  playerId = currentUser.id
) {

  const { data, error } =
    await sb
      .from("matches")
      .select("*")
      .eq(
        "player_id",
        playerId
      )
      .order(
        "match_date",
        {
          ascending: false
        }
      );

  if (error) throw error;

  return data || [];
}


/* =========================
   ROUTER
========================= */

async function render(
  page = "overview"
) {

  document
    .querySelectorAll(".nav-item")
    .forEach(button =>
      button.classList.toggle(
        "active",
        button.dataset.page === page
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

  } catch (error) {

    app.innerHTML = `

      <div class="card">

        <b>Error:</b>

        ${esc(error.message)}

      </div>

    `;
  }
}


/* =========================
   COACH
========================= */

async function renderCoach(page) {

  const players =
    await connectedPlayers();


  if (page === "overview") {

    $("app").innerHTML = `

      <div class="dash-head">

        <div>

          <span class="eyebrow">
            COACH DASHBOARD
          </span>

          <h1>
            Overview
          </h1>

        </div>

        <button
          class="btn"
          onclick="render('players')">
          View players
        </button>

      </div>


      <div class="grid">

        <div class="card">

          <span class="muted">
            Players
          </span>

          <div class="stat">
            ${players.length}
          </div>

        </div>


        <div class="card">

          <span class="muted">
            Connection code
          </span>

          <div class="stat">
            ${esc(
              profile.coach_code ||
              "—"
            )}
          </div>

        </div>


        <div class="card">

          <span class="muted">
            System
          </span>

          <div class="stat">
            Live
          </div>

        </div>

      </div>


      <div
        class="card"
        style="margin-top:18px">

        <h3>
          Players
        </h3>

        ${
          players.length

          ?

          players
            .map(player => `

              <div class="list-item">

                <b>
                  ${esc(
                    player.full_name
                  )}
                </b>

                <span
                  class="pill"
                  style="float:right">
                  Connected
                </span>

              </div>

            `)
            .join("")

          :

          `
          <div class="empty">
            No players connected yet.
          </div>
          `
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

          <h1>
            Players
          </h1>

        </div>

      </div>


      ${
        players.length

        ?

        `<div class="grid">

          ${players
            .map(player => `

              <div class="card">

                <h3>
                  ${esc(
                    player.full_name
                  )}
                </h3>

                <p class="muted">
                  Player account
                </p>

                <button
                  class="btn small"
                  onclick="viewPlayer('${player.id}')">
                  Open player
                </button>

              </div>

            `)
            .join("")}

        </div>`

        :

        `
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

    await renderCoachMatches(
      players
    );

  }
}


/* =========================
   REQUESTS
========================= */

async function renderRequests() {

  const { data, error } =
    await sb
      .from("connection_requests")
      .select("*")
      .eq(
        "coach_id",
        currentUser.id
      )
      .eq(
        "status",
        "pending"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) throw error;


  let html = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          CONNECTIONS
        </span>

        <h1>
          Requests
        </h1>

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

    for (const request of data) {

      const { data: player } =
        await sb
          .from("profiles")
          .select("full_name")
          .eq(
            "id",
            request.player_id
          )
          .single();


      html += `

        <div
          class="card"
          style="margin:10px 0">

          <b>
            ${esc(
              player?.full_name ||
              "Player"
            )}
          </b>

          <div class="modal-actions">

            <button
              class="btn small"
              onclick="acceptReq('${request.id}')">
              Accept
            </button>

            <button
              class="btn small ghost"
              onclick="declineReq('${request.id}')">
              Decline
            </button>

          </div>

        </div>

      `;
    }
  }


  $("app").innerHTML =
    html;
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

async function renderCoachMatches(
  players
) {

  const ids =
    players.map(
      player => player.id
    );

  let matches = [];


  if (ids.length) {

    const { data, error } =
      await sb
        .from("matches")
        .select("*")
        .in(
          "player_id",
          ids
        )
        .order(
          "match_date",
          {
            ascending: false
          }
        );

    if (error) throw error;

    matches =
      data || [];
  }


  $("app").innerHTML = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          MATCH HISTORY
        </span>

        <h1>
          Match Reviews
        </h1>

      </div>

    </div>


    ${
      matches.length

      ?

      matches.map(match => {

        const player =
          players.find(
            p =>
              p.id ===
              match.player_id
          );


        return `

          <div class="match">

            <b>
              ${esc(
                player?.full_name ||
                "Player"
              )}
            </b>

            ·

            ${esc(match.result)}

            <h3>
              vs ${esc(
                match.opponent
              )}
            </h3>

            <div class="muted">

              ${esc(
                match.match_date
              )}

              ·

              ${esc(
                match.score ||
                "No score"
              )}

            </div>

            <p>

              <b>
                Problem:
              </b>

              ${esc(
                match.biggest_problem ||
                "None"
              )}

            </p>

            <p>

              <b>
                Positive:
              </b>

              ${esc(
                match.biggest_positive ||
                "None"
              )}

            </p>

            <p>
              ${esc(
                match.notes ||
                ""
              )}
            </p>

          </div>

        `;

      }).join("")

      :

      `
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

  const player =
    players.find(
      p => p.id === id
    );

  if (!player) return;


  const matches =
    await playerMatches(id);


  $("app").innerHTML = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          PLAYER
        </span>

        <h1>
          ${esc(
            player.full_name
          )}
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
          ${
            matches.filter(
              m =>
                m.result ===
                "win"
            ).length
          }
        </div>

      </div>


      <div class="card">

        <span class="muted">
          Losses
        </span>

        <div class="stat">
          ${
            matches.filter(
              m =>
                m.result ===
                "loss"
            ).length
          }
        </div>

      </div>

    </div>


    <div
      class="card"
      style="margin-top:18px">

      <h3>
        Match history
      </h3>

      ${
        matches.length

        ?

        matches.map(match => `

          <div class="match">

            <b>
              ${esc(
                match.match_date
              )}

              —

              ${esc(
                match.result
              )}
            </b>

            vs

            ${esc(
              match.opponent
            )}

            <br>

            <span class="muted">
              ${esc(
                match.score ||
                ""
              )}
            </span>

            <p>
              Problem:
              ${esc(
                match.biggest_problem ||
                "None"
              )}
            </p>

            <p>
              Positive:
              ${esc(
                match.biggest_positive ||
                "None"
              )}
            </p>

          </div>

        `).join("")

        :

        `
        <p class="muted">
          No matches yet.
        </p>
        `
      }

    </div>

  `;
}


/* =========================
   PLAYER
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
            ${
              matches.filter(
                m =>
                  m.result ===
                  "win"
              ).length
            }
          </div>

        </div>


        <div class="card">

          <span class="muted">
            Losses
          </span>

          <div class="stat">
            ${
              matches.filter(
                m =>
                  m.result ===
                  "loss"
              ).length
            }
          </div>

        </div>

      </div>


      <div
        class="card"
        style="margin-top:18px">

        <h3>
          Recent matches
        </h3>

        ${
          matches
            .slice(0,5)
            .map(match => `

              <div class="list-item">

                <b>
                  ${esc(
                    match.result
                  ).toUpperCase()}

                  vs

                  ${esc(
                    match.opponent
                  )}
                </b>

                <span
                  class="muted"
                  style="float:right">

                  ${esc(
                    match.match_date
                  )}

                </span>

              </div>

            `)
            .join("")

          ||

          `
          <p class="muted">
            Log your first match.
          </p>
          `
        }

      </div>

    `;

  }


  else if (
    page === "logmatch"
  ) {

    openMatch();

  }


  else if (
    page === "coach"
  ) {

    let coach = null;


    if (
      profile.connected_coach_id
    ) {

      coach =
        (
          await sb
            .from("profiles")
            .select(
              "full_name,coach_code"
            )
            .eq(
              "id",
              profile.connected_coach_id
            )
            .single()
        ).data;
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


      ${
        coach

        ?

        `

        <div class="card">

          <h2>
            ${esc(
              coach.full_name
            )}
          </h2>

          <p class="muted">
            Your connected coach
          </p>

        </div>

        `

        :

        `

        <div class="card">

          <h3>
            No coach connected
          </h3>

          <p class="muted">

            Ask your coach for their
            3 letters + 3 number
            connection code.

          </p>

          <button
            class="btn"
            onclick="openConnect()">

            Connect to Coach

          </button>

        </div>

        `
      }

    `;

  }


  else if (
    page === "training"
  ) {

    const { data, error } =
      await sb
        .from("training_sessions")
        .select("*")
        .eq(
          "player_id",
          currentUser.id
        )
        .order(
          "session_date",
          {
            ascending: false
          }
        );

    if (error) throw error;


    $("app").innerHTML = `

      <div class="dash-head">

        <div>

          <span class="eyebrow">
            TRAINING
          </span>

          <h1>
            My Training
          </h1>

        </div>

        <button
          class="btn"
          onclick="openSession()">

          + Add Session

        </button>

      </div>


      ${
        data?.length

        ?

        data.map(session => `

          <div class="match">

            <b>
              ${esc(
                session.session_name
              )}
            </b>

            <span
              class="pill"
              style="float:right">

              ${
                session.completed
                  ? "Completed"
                  : "Planned"
              }

            </span>

            <p class="muted">

              ${esc(
                session.session_date
              )}

              ·

              ${esc(
                session.duration_minutes ||
                "—"
              )}

              min

              ·

              ${esc(
                session.focus ||
                "No focus"
              )}

            </p>

            <p>
              ${esc(
                session.notes ||
                ""
              )}
            </p>

          </div>

        `).join("")

        :

        `
        <div class="empty">
          No training sessions yet.
        </div>
        `
      }

    `;

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
                  .slice(0,10)
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

            <button
              class="btn">

              Save Match

            </button>

          </div>

        </form>

      </div>

    </div>

  `;


  $("matchForm").onsubmit =
    async event => {

      event.preventDefault();


      const { error } =
        await sb
          .from("matches")
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

            notes:
              $("notes")
                .value
                .trim()

          });


      if (error) {

        alert(
          error.message
        );

      } else {

        closeModal();

        render("overview");

      }

    };
}


/* =========================
   CONNECT TO COACH
========================= */

function openConnect() {

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div class="modal">

        <h2>
          Connect to Coach
        </h2>

        <p class="muted">

          Enter the coach's
          3 letters + 3 numbers.

        </p>

        <form id="connectForm">

          <input
            id="newCode"
            maxlength="6"
            placeholder="ABC123"
            required
          >

          <div class="modal-actions">

            <button
              type="button"
              class="btn ghost"
              onclick="closeModal()">

              Cancel

            </button>

            <button
              class="btn">

              Send Request

            </button>

          </div>

        </form>

      </div>

    </div>

  `;


  $("connectForm").onsubmit =
    async event => {

      event.preventDefault();


      const code =
        $("newCode")
          .value
          .trim()
          .toUpperCase();


      const { data, error } =
        await sb.rpc(
          "find_coach_by_code",
          {
            code_input: code
          }
        );


      if (error) {

        alert(
          error.message
        );

        return;
      }


      if (!data?.length) {

        alert(
          "Coach code not found."
        );

        return;
      }


      const { error: requestError } =
        await sb
          .from(
            "connection_requests"
          )
          .insert({

            player_id:
              currentUser.id,

            coach_id:
              data[0].id,

            status:
              "pending"

          });


      if (requestError) {

        alert(
          requestError.message
        );

        return;
      }


      closeModal();

      alert(
        "Connection request sent."
      );

      render("coach");
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
                  .slice(0,10)
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

            <button
              class="btn">

              Add Session

            </button>

          </div>

        </form>

      </div>

    </div>

  `;


  $("sessionForm").onsubmit =
    async event => {

      event.preventDefault();


      const { error } =
        await sb
          .from("training_sessions")
          .insert({

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

        alert(
          error.message
        );

      } else {

        closeModal();

        render("training");

      }

    };
}


function closeModal() {

  $("modalRoot").innerHTML =
    "";
}


/* =========================
   START APP
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

    const loaded =
      await loadProfile();

    if (loaded) {

      shell();

      render(
        "overview"
      );

    }

  }
}


start();
