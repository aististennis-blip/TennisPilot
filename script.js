const sb = window.tennisPilotSupabase;
let mode = "login", role = "coach", currentUser = null, profile = null;

const $ = id => document.getElementById(id);

const esc = s => String(s ?? "").replace(
  /[&<>"']/g,
  c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c])
);

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

  const codeInput = $("coachCode");

  if (codeInput) {
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 6)
        .toUpperCase();
    });
  }

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


async function handleAuth(e) {
  e.preventDefault();
  msg("");

  const email = $("email").value.trim();
  const password = $("password").value;

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


    /* SIGN UP */

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


    /* FIND COACH */

    if (
      role === "player" &&
      $("coachCode").value.trim()
    ) {

      const {
        data: c,
        error: ce
      } =
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


    /* CONNECTION REQUEST */

    if (
      role === "player" &&
      coachId
    ) {

      const {
        error: re
      } =
        await sb
          .from("connection_requests")
          .insert({
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
      err.message ||
      "Something went wrong.",
      true
    );

  }
}


/* =========================
   LOAD PROFILE
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

  const {
    data,
    error
  } =
    await sb
      .from("profiles")
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
   DASHBOARD SHELL
========================= */

function shell() {

  $("profileBox").innerHTML =
    `<strong>${esc(profile.full_name)}</strong>
     <small>${esc(profile.role)}</small>` +

    (
      profile.role === "coach"
        ? `<small>
             Code:
             <b>${esc(profile.coach_code || "")}</b>
           </small>`
        : ""
    );


  $("sideNav").innerHTML =
    profile.role === "coach"

      ? `
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
      `

      : `
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
          data-page="bio">
          My Bio
        </button>

        <button
          class="nav-item"
          data-page="training">
          Training
        </button>
      `;


  document
    .querySelectorAll(".nav-item")
    .forEach(b => {
      b.onclick = () =>
        render(b.dataset.page);
    });


  $("logoutBtn").onclick =
    async () => {
      await sb.auth.signOut();
      location.href = "index.html";
    };
}


/* =========================
   CONNECTED PLAYERS
========================= */

async function connectedPlayers() {

  const {
    data,
    error
  } =
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


/* =========================
   PLAYER MATCHES
========================= */

async function playerMatches(
  id = currentUser.id
) {

  const {
    data,
    error
  } =
    await sb
      .from("matches")
      .select("*")
      .eq("player_id", id)
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
   PROFILE PHOTOS
========================= */

async function signedProfilePhoto(path) {

  if (!path) return "";

  const {
    data,
    error
  } =
    await sb
      .storage
      .from("profile-pictures")
      .createSignedUrl(
        path,
        3600
      );

  if (error) return "";

  return data?.signedUrl || "";
}


function photoHTML(
  url,
  name = "Player",
  className = "avatar"
) {

  return url

    ? `
      <img
        class="${className}"
        src="${esc(url)}"
        alt="${esc(name)} profile picture">
      `

    : `
      <div
        class="${className} avatar-placeholder">

        ${esc(
          (name || "P")
            .trim()
            .charAt(0)
            .toUpperCase()
        )}

      </div>
      `;
}


/* =========================
   MAIN RENDER
========================= */

async function render(
  page = "overview"
) {

  document
    .querySelectorAll(".nav-item")
    .forEach(b => {
      b.classList.toggle(
        "active",
        b.dataset.page === page
      );
    });


  const app = $("app");

  app.innerHTML =
    "<div class='empty'>Loading…</div>";


  try {

    if (
      profile.role === "coach"
    ) {

      await renderCoach(page);

    } else {

      await renderPlayer(page);

    }

  } catch (e) {

    app.innerHTML =
      `<div class="card">
        <b>Error:</b>
        ${esc(e.message)}
      </div>`;
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
              profile.coach_code || "—"
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

            ? players
                .map(
                  p => `
                    <div class="list-item">

                      <b>
                        ${esc(
                          p.full_name
                        )}
                      </b>

                      <span
                        class="pill"
                        style="float:right">

                        Connected

                      </span>

                    </div>
                  `
                )
                .join("")

            : `
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

          ? `
            <div class="grid">

              ${
                players
                  .map(
                    p => `

                      <div class="card">

                        <h3>
                          ${esc(
                            p.full_name
                          )}
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

                    `
                  )
                  .join("")
              }

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


  else if (
    page === "requests"
  ) {

    await renderRequests();

  }


  else if (
    page === "matches"
  ) {

    await renderCoachMatches(
      players
    );

  }
}


/* =========================
   REQUESTS
========================= */

async function renderRequests() {

  const {
    data,
    error
  } =
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

    for (const r of data) {

      const {
        data: p
      } =
        await sb
          .from("profiles")
          .select("full_name")
          .eq(
            "id",
            r.player_id
          )
          .single();


      html += `

        <div
          class="card"
          style="margin:10px 0">

          <b>
            ${esc(
              p?.full_name ||
              "Player"
            )}
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

  const {
    error
  } =
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

  const {
    error
  } =
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
   COACH MATCH REVIEWS
========================= */

async function renderCoachMatches(
  players
) {

  const ids =
    players.map(
      p => p.id
    );

  let data = [];


  if (ids.length) {

    const {
      data: matches,
      error
    } =
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

    data = matches || [];
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
      data.length

        ? data
            .map(m => {

              const p =
                players.find(
                  x =>
                    x.id ===
                    m.player_id
                );

              return `

                <div class="match">

                  <b>
                    ${esc(
                      p?.full_name ||
                      "Player"
                    )}
                  </b>

                  ·

                  ${esc(
                    m.result
                  )}


                  <h3>
                    vs
                    ${esc(
                      m.opponent
                    )}
                  </h3>


                  <div class="muted">

                    ${esc(
                      m.match_date
                    )}

                    ·

                    ${esc(
                      m.surface ||
                      "Unknown surface"
                    )}

                    ·

                    ${esc(
                      m.score ||
                      "No score"
                    )}

                  </div>


                  <p>

                    <b>
                      Problem:
                    </b>

                    ${esc(
                      m.biggest_problem ||
                      "None"
                    )}

                  </p>


                  <p>

                    <b>
                      Positive:
                    </b>

                    ${esc(
                      m.biggest_positive ||
                      "None"
                    )}

                  </p>


                  <p>
                    ${esc(
                      m.notes ||
                      ""
                    )}
                  </p>

                </div>

              `;
            })
            .join("")

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
    players.find(
      x => x.id === id
    );

  if (!p) return;


  const matches =
    await playerMatches(id);


  const photo =
    await signedProfilePhoto(
      p.profile_picture_path
    );


  $("app").innerHTML = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          PLAYER
        </span>

        <h1>
          ${esc(
            p.full_name
          )}
        </h1>

      </div>


      <button
        class="btn ghost"
        onclick="render('players')">

        ← Players

      </button>

    </div>


    <div class="profile-hero card">

      ${photoHTML(
        photo,
        p.full_name,
        "avatar profile-avatar"
      )}


      <div>

        <h2>
          ${esc(
            p.full_name
          )}
        </h2>


        <p class="muted">

          ${esc(
            p.age || ""
          )}

          ${
            p.age
              ? " years old · "
              : ""
          }

          ${esc(
            p.dominant_hand || ""
          )}

          ${
            p.dominant_hand
              ? "-handed · "
              : ""
          }

          ${
            p.years_playing != null
              ? esc(
                  p.years_playing
                ) +
                " years playing · "
              : ""
          }

          ${esc(
            p.playing_level ||
            "Player"
          )}

        </p>


        ${
          p.bio
            ? `<p>${esc(
                p.bio
              )}</p>`
            : ""
        }

      </div>

    </div>


    <div
      class="card"
      style="margin-top:18px">

      <h3>
        Player Bio
      </h3>


      <div class="bio-grid">

        <div>
          <span class="muted">
            Age
          </span>

          <b>
            ${esc(
              p.age ||
              "Not added"
            )}
          </b>
        </div>


        <div>
          <span class="muted">
            Dominant hand
          </span>

          <b>
            ${esc(
              p.dominant_hand ||
              "Not added"
            )}
          </b>
        </div>


        <div>
          <span class="muted">
            Years playing
          </span>

          <b>
            ${esc(
              p.years_playing ??
              "Not added"
            )}
          </b>
        </div>


        <div>
          <span class="muted">
            Level
          </span>

          <b>
            ${esc(
              p.playing_level ||
              "Not added"
            )}
          </b>
        </div>


        <div>
          <span class="muted">
            Playing style
          </span>

          <b>
            ${esc(
              p.playing_style ||
              "Not added"
            )}
          </b>
        </div>


        <div>
          <span class="muted">
            Height
          </span>

          <b>
            ${esc(
              p.height ||
              "Not added"
            )}
          </b>
        </div>

      </div>

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

          ? matches
              .map(
                m => `

                  <div class="match">

                    <b>
                      ${esc(
                        m.match_date
                      )}

                      —

                      ${esc(
                        m.result
                      )}
                    </b>

                    vs

                    ${esc(
                      m.opponent
                    )}


                    <br>


                    <span class="muted">

                      ${esc(
                        m.surface ||
                        "Unknown surface"
                      )}

                      ·

                      ${esc(
                        m.score ||
                        ""
                      )}

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

                `
              )
              .join("")

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
            (wins /
              matches.length) *
            100
          )
        : 0;


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

          Match History

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
            ${wins}
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


      <div
        class="card"
        style="margin-top:18px">

        <h3>
          Recent matches
        </h3>


        ${
          matches
            .slice(0, 5)
            .map(
              m => `

                <div class="list-item">

                  <b>

                    ${esc(
                      m.result
                    ).toUpperCase()}

                    vs

                    ${esc(
                      m.opponent
                    )}

                  </b>


                  <span
                    class="muted"
                    style="float:right">

                    ${esc(
                      m.match_date
                    )}

                  </span>


                  <div
                    class="muted"
                    style="margin-top:5px">

                    ${esc(
                      m.surface ||
                      "Unknown surface"
                    )}

                    ·

                    ${esc(
                      m.score ||
                      "No score"
                    )}

                  </div>

                </div>

              `
            )
            .join("")

          ||

          "<p class='muted'>No matches yet.</p>"
        }


        <button
          class="btn small ghost"
          style="margin-top:12px"
          onclick="render('logmatch')">

          View Match History

        </button>

      </div>

    `;
  }


  else if (
    page === "logmatch"
  ) {

    await renderMatchHistory();

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


    $("app").innerHTML = coach

      ? `

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

      : `

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


        <div class="card">

          <h3>
            No coach connected
          </h3>

          <p class="muted">
            Ask your coach for their
            3 letters + 3 numbers
            connection code.
          </p>


          <button
            class="btn"
            onclick="openConnect()">

            Connect to Coach

          </button>

        </div>

      `;
  }


  else if (
    page === "bio"
  ) {

    await renderBio();

  }


  else if (
    page === "training"
  ) {

    const {
      data,
      error
    } =
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

          ? data
              .map(
                s => `

                  <div class="match">

                    <b>
                      ${esc(
                        s.session_name
                      )}
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

                      ${esc(
                        s.session_date
                      )}

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

                      ${esc(
                        s.notes ||
                        ""
                      )}

                    </p>

                  </div>

                `
              )
              .join("")

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
   MATCH HISTORY
========================= */

async function renderMatchHistory() {

  const matches =
    await playerMatches();


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
          (wins /
            matches.length) *
          100
        )
      : 0;


  $("app").innerHTML = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          MATCHES
        </span>

        <h1>
          Match History
        </h1>

        <p class="muted">
          Keep track of every match you've played.
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
          ${wins}
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


    <div
      class="card"
      style="margin-top:18px">

      <div
        style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          align-items:center;
          margin-bottom:18px;
        ">

        <input
          id="matchSearch"
          placeholder="Search opponent..."
          style="
            flex:1;
            min-width:200px;
            padding:12px;
            border:1px solid #d7dee7;
            border-radius:10px;
          ">


        <select
          id="matchFilter"
          style="
            padding:12px;
            border:1px solid #d7dee7;
            border-radius:10px;
          ">

          <option value="all">
            All
          </option>

          <option value="win">
            Wins
          </option>

          <option value="loss">
            Losses
          </option>

          <option value="Hard">
            Hard
          </option>

          <option value="Clay">
            Clay
          </option>

          <option value="Grass">
            Grass
          </option>

          <option value="Carpet">
            Carpet
          </option>

          <option value="Other">
            Other
          </option>

        </select>

      </div>


      <div id="matchHistoryList"></div>

    </div>

  `;


  const search =
    $("matchSearch");

  const filter =
    $("matchFilter");


  function updateMatches() {

    const query =
      search.value
        .trim()
        .toLowerCase();


    const selected =
      filter.value;


    const filtered =
      matches.filter(m => {

        const opponent =
          String(
            m.opponent || ""
          ).toLowerCase();


        const surface =
          m.surface ||
          "Hard";


        const searchMatches =
          !query ||
          opponent.includes(
            query
          );


        let filterMatches =
          true;


        if (
          selected ===
          "win"
        ) {

          filterMatches =
            m.result ===
            "win";

        }


        else if (
          selected ===
          "loss"
        ) {

          filterMatches =
            m.result ===
            "loss";

        }


        else if (
          [
            "Hard",
            "Clay",
            "Grass",
            "Carpet",
            "Other"
          ].includes(selected)
        ) {

          filterMatches =
            surface ===
            selected;

        }


        return (
          searchMatches &&
          filterMatches
        );

      });


    renderMatchCards(
      filtered
    );

  }


  search.oninput =
    updateMatches;

  filter.onchange =
    updateMatches;


  updateMatches();
}


/* =========================
   MATCH CARDS
========================= */

function renderMatchCards(
  matches
) {

  const container =
    $("matchHistoryList");


  if (!matches.length) {

    container.innerHTML = `

      <div class="empty">

        No matches found.

      </div>

    `;

    return;
  }


  const years = {};


  matches.forEach(m => {

    const year =
      String(
        m.match_date || ""
      ).slice(0, 4) ||
      "Other";


    if (!years[year]) {
      years[year] = [];
    }


    years[year].push(m);

  });


  const sortedYears =
    Object.keys(years)
      .sort(
        (a, b) =>
          Number(b) -
          Number(a)
      );


  container.innerHTML =
    sortedYears
      .map(year => {

        return `

          <section
            style="margin-bottom:28px">

            <h2
              style="
                margin:0 0 12px;
                font-size:24px;
              ">

              ${esc(year)}

            </h2>


            ${years[year]
              .map(
                m => {

                  const isWin =
                    m.result ===
                    "win";


                  const surface =
                    m.surface ||
                    "Hard";


                  return `

                    <div
                      class="match"
                      style="
                        cursor:pointer;
                        margin-bottom:10px;
                      "
                      onclick="toggleMatchDetails('${m.id}')">


                      <div
                        style="
                          display:flex;
                          justify-content:space-between;
                          gap:12px;
                          flex-wrap:wrap;
                        ">


                        <div>

                          <strong>

                            <span
                              class="pill">

                              ${
                                isWin
                                  ? "WIN"
                                  : "LOSS"
                              }

                            </span>

                            vs
                            ${esc(
                              m.opponent
                            )}

                          </strong>


                          <div
                            class="muted"
                            style="margin-top:7px">

                            ${esc(
                              formatMatchDate(
                                m.match_date
                              )
                            )}

                            ·

                            ${esc(
                              surface
                            )}

                            ·

                            ${esc(
                              m.score ||
                              "No score"
                            )}

                          </div>

                        </div>


                        <span
                          class="muted">

                          View details
                          ↓

                        </span>

                      </div>


                      <div
                        id="match-details-${esc(m.id)}"
                        class="hidden"
                        style="
                          border-top:1px solid #e5e9ef;
                          margin-top:15px;
                          padding-top:15px;
                        ">


                        <p>

                          <b>
                            Surface:
                          </b>

                          ${esc(
                            surface
                          )}

                        </p>


                        <p>

                          <b>
                            Result:
                          </b>

                          ${esc(
                            m.result
                              .charAt(0)
                              .toUpperCase() +
                            m.result.slice(1)
                          )}

                        </p>


                        <p>

                          <b>
                            Score:
                          </b>

                          ${esc(
                            m.score ||
                            "Not added"
                          )}

                        </p>


                        <p>

                          <b>
                            Biggest problem:
                          </b>

                          ${esc(
                            m.biggest_problem ||
                            "None"
                          )}

                        </p>


                        <p>

                          <b>
                            Biggest positive:
                          </b>

                          ${esc(
                            m.biggest_positive ||
                            "None"
                          )}

                        </p>


                        ${
                          m.notes
                            ? `
                              <p>

                                <b>
                                  Notes:
                                </b>

                                ${esc(
                                  m.notes
                                )}

                              </p>
                            `
                            : ""
                        }

                      </div>

                    </div>

                  `;
                }
              )
              .join("")}

          </section>

        `;
      })
      .join("");
}


function formatMatchDate(
  date
) {

  if (!date) return "";

  const parts =
    date.split("-");

  if (
    parts.length !== 3
  ) {
    return date;
  }


  const [
    year,
    month,
    day
  ] = parts;


  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];


  return `${names[
    Number(month) - 1
  ] || month} ${Number(day)}, ${year}`;
}


function toggleMatchDetails(
  id
) {

  const el =
    document.getElementById(
      `match-details-${id}`
    );


  if (!el) return;


  el.classList.toggle(
    "hidden"
  );
}


/* =========================
   VIEW PLAYER
========================= */

async function renderBio() {

  const photo =
    await signedProfilePhoto(
      profile.profile_picture_path
    );


  $("app").innerHTML = `

    <div class="dash-head">

      <div>

        <span class="eyebrow">
          PLAYER PROFILE
        </span>

        <h1>
          My Bio
        </h1>

      </div>

    </div>


    <div class="card bio-profile-card">

      <div class="bio-photo-wrap">

        ${photoHTML(
          photo,
          profile.full_name,
          "avatar profile-avatar"
        )}


        <div class="photo-actions">

          <label
            class="btn small ghost photo-btn">

            Choose from Gallery

            <input
              id="galleryPhoto"
              type="file"
              accept="image/*">

          </label>


          <label
            class="btn small photo-btn">

            Take a Photo

            <input
              id="cameraPhoto"
              type="file"
              accept="image/*"
              capture="environment">

          </label>

        </div>


        <button
          id="removePhoto"
          class="btn small ghost"
          type="button"
          ${
            profile.profile_picture_path
              ? ""
              : "disabled"
          }>

          Remove Photo

        </button>

      </div>


      <form
        id="bioForm"
        class="bio-form">


        <label>

          Age

          <input
            id="bioAge"
            type="number"
            min="1"
            max="100"
            value="${esc(
              profile.age ?? ""
            )}"
            placeholder="17">

        </label>


        <label>

          Dominant Hand

          <select id="bioHand">

            <option value="">
              Select
            </option>

            <option
              ${
                profile.dominant_hand ===
                "Right"
                  ? "selected"
                  : ""
              }>

              Right

            </option>

            <option
              ${
                profile.dominant_hand ===
                "Left"
                  ? "selected"
                  : ""
              }>

              Left

            </option>

          </select>

        </label>


        <label>

          Years Playing Tennis

          <input
            id="bioYears"
            type="number"
            min="0"
            max="100"
            value="${esc(
              profile.years_playing ?? ""
            )}"
            placeholder="10">

        </label>


        <label>

          Playing Level

          <select id="bioLevel">

            <option value="">
              Select
            </option>

            <option
              ${
                profile.playing_level ===
                "Beginner"
                  ? "selected"
                  : ""
              }>

              Beginner

            </option>

            <option
              ${
                profile.playing_level ===
                "Recreational"
                  ? "selected"
                  : ""
              }>

              Recreational

            </option>

            <option
              ${
                profile.playing_level ===
                "Competitive"
                  ? "selected"
                  : ""
              }>

              Competitive

            </option>

            <option
              ${
                profile.playing_level ===
                "Tournament"
                  ? "selected"
                  : ""
              }>

              Tournament

            </option>

          </select>

        </label>


        <label>

          Playing Style

          <select id="bioStyle">

            <option value="">
              Select
            </option>

            <option
              ${
                profile.playing_style ===
                "Aggressive"
                  ? "selected"
                  : ""
              }>

              Aggressive

            </option>

            <option
              ${
                profile.playing_style ===
                "Defensive"
                  ? "selected"
                  : ""
              }>

              Defensive

            </option>

            <option
              ${
                profile.playing_style ===
                "All-court"
                  ? "selected"
                  : ""
              }>

              All-court

            </option>

            <option
              ${
                profile.playing_style ===
                "Serve & volley"
                  ? "selected"
                  : ""
              }>

              Serve & volley

            </option>

            <option
              ${
                profile.playing_style ===
                "Other"
                  ? "selected"
                  : ""
              }>

              Other

            </option>

          </select>

        </label>


        <label>

          Height
          <span class="muted">
            (optional)
          </span>

          <input
            id="bioHeight"
            value="${esc(
              profile.height ?? ""
            )}"
            placeholder="6'1">

        </label>


        <label
          class="bio-wide">

          Short Bio
          <span class="muted">
            (optional)
          </span>

          <textarea
            id="bioText"
            rows="4"
            placeholder="Tell your coach a little about your game...">${esc(
              profile.bio ?? ""
            )}</textarea>

        </label>


        <div
          class="modal-actions bio-wide">

          <button class="btn">

            Save Bio

          </button>

        </div>


      </form>

    </div>

  `;


  const upload = async file => {

    if (!file) return;


    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      return alert(
        "Please choose an image."
      );

    }


    if (
      file.size >
      5 * 1024 * 1024
    ) {

      return alert(
        "Please choose an image smaller than 5 MB."
      );

    }


    const ext =
      (
        file.name
          .split(".")
          .pop() ||
        "jpg"
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        ) ||
      "jpg";


    const path =
      `${currentUser.id}/profile-${Date.now()}.${ext}`;


    const {
      error
    } =
      await sb
        .storage
        .from("profile-pictures")
        .upload(
          path,
          file,
          {
            upsert: false,
            contentType:
              file.type
          }
        );


    if (error)
      return alert(
        error.message
      );


    const {
      error: updateError
    } =
      await sb
        .from("profiles")
        .update({
          profile_picture_path:
            path
        })
        .eq(
          "id",
          currentUser.id
        );


    if (updateError) {

      await sb
        .storage
        .from("profile-pictures")
        .remove([path]);

      return alert(
        updateError.message
      );

    }


    profile.profile_picture_path =
      path;


    render("bio");

  };


  $("galleryPhoto").onchange =
    e =>
      upload(
        e.target.files[0]
      );


  $("cameraPhoto").onchange =
    e =>
      upload(
        e.target.files[0]
      );


  $("removePhoto").onclick =
    async () => {

      if (
        !profile.profile_picture_path
      )
        return;


      const old =
        profile.profile_picture_path;


      const {
        error
      } =
        await sb
          .storage
          .from("profile-pictures")
          .remove([old]);


      if (error)
        return alert(
          error.message
        );


      const {
        error: updateError
      } =
        await sb
          .from("profiles")
          .update({
            profile_picture_path:
              null
          })
          .eq(
            "id",
            currentUser.id
          );


      if (updateError)
        return alert(
          updateError.message
        );


      profile.profile_picture_path =
        null;


      render("bio");

    };


  $("bioForm").onsubmit =
    async e => {

      e.preventDefault();


      const payload = {

        age:
          Number(
            $("bioAge").value
          ) || null,

        dominant_hand:
          $("bioHand").value ||
          null,

        years_playing:
          Number(
            $("bioYears").value
          ) || 0,

        playing_level:
          $("bioLevel").value ||
          null,

        playing_style:
          $("bioStyle").value ||
          null,

        height:
          $("bioHeight").value.trim() ||
          null,

        bio:
          $("bioText").value.trim() ||
          null

      };


      const {
        data,
        error
      } =
        await sb
          .from("profiles")
          .update(payload)
          .eq(
            "id",
            currentUser.id
          )
          .select("*")
          .single();


      if (error)
        return alert(
          error.message
        );


      profile = data;


      alert(
        "Bio saved."
      );


      render("bio");

    };
}


/* =========================
   ADD MATCH
========================= */

function openMatch() {

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div class="modal">


        <div class="modal-top">

          <button
            type="button"
            class="btn ghost modal-back-btn"
            onclick="closeModal();render('logmatch')">

            ← Back

          </button>


          <h2>
            Add Match
          </h2>

        </div>


        <form
          id="matchForm">


          <label>

            Opponent

            <input
              id="opponent"
              required>

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
              required>

          </label>


          <label>

            Surface

            <select
              id="surface"
              required>

              <option
                value=""
                selected
                disabled>

                Select surface

              </option>

              <option>
                Hard
              </option>

              <option>
                Clay
              </option>

              <option>
                Grass
              </option>

              <option>
                Carpet
              </option>

              <option>
                Other
              </option>

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
              placeholder="6-4, 3-6, 10-8">

          </label>


          <label>

            Biggest problem

            <select id="problem">

              <option>
                None
              </option>

              <option>
                Serve
              </option>

              <option>
                Return
              </option>

              <option>
                Forehand
              </option>

              <option>
                Backhand
              </option>

              <option>
                Movement
              </option>

              <option>
                Mental game
              </option>

              <option>
                Consistency
              </option>

              <option>
                Other
              </option>

            </select>

          </label>


          <label>

            Biggest positive

            <select id="positive">

              <option>
                None
              </option>

              <option>
                Serve
              </option>

              <option>
                Return
              </option>

              <option>
                Forehand
              </option>

              <option>
                Backhand
              </option>

              <option>
                Movement
              </option>

              <option>
                Mental game
              </option>

              <option>
                Consistency
              </option>

              <option>
                Other
              </option>

            </select>

          </label>


          <label>

            Notes

            <textarea
              id="notes"
              rows="4"></textarea>

          </label>


          <div
            class="modal-actions">


            <button
              type="button"
              class="btn ghost"
              onclick="closeModal();render('logmatch')">

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
    async e => {

      e.preventDefault();


      const {
        error
      } =
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

            surface:
              $("surface")
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

        render(
          "logmatch"
        );

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


        <div class="modal-top">

          <button
            type="button"
            class="btn ghost modal-back-btn"
            onclick="closeModal()">

            ← Back

          </button>


          <h2>
            Connect to Coach
          </h2>

        </div>


        <p class="muted">

          Enter the coach's
          3 letters + 3 numbers.

        </p>


        <form
          id="connectForm">


          <input
            id="newCode"
            maxlength="6"
            placeholder="ABC123"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            style="text-transform:uppercase"
            required>


          <div
            class="modal-actions">


            <button
              type="button"
              class="btn ghost"
              onclick="closeModal()">

              Cancel

            </button>


            <button class="btn">

              Send Request

            </button>

          </div>


        </form>


      </div>

    </div>

  `;


  $("newCode").addEventListener(
    "input",
    () => {

      $("newCode").value =
        $("newCode")
          .value
          .replace(
            /[^a-zA-Z0-9]/g,
            ""
          )
          .slice(0, 6)
          .toUpperCase();

    }
  );


  $("connectForm").onsubmit =
    async e => {

      e.preventDefault();


      const code =
        $("newCode")
          .value
          .trim()
          .toUpperCase();


      const {
        data,
        error
      } =
        await sb.rpc(
          "find_coach_by_code",
          {
            code_input:
              code
          }
        );


      if (error) {

        alert(
          error.message
        );

      }


      else if (
        !data?.length
      ) {

        alert(
          "Coach code not found."
        );

      }


      else {

        const {
          error: re
        } =
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


        if (re) {

          alert(
            re.message
          );

        } else {

          closeModal();

          alert(
            "Connection request sent."
          );

          render(
            "coach"
          );

        }

      }

    };
}


/* =========================
   TRAINING SESSION
========================= */

function openSession() {

  $("modalRoot").innerHTML = `

    <div class="modal-back">

      <div class="modal">

        <h2>
          Add Training Session
        </h2>


        <form
          id="sessionForm">


          <label>

            Session name

            <input
              id="sessionName"
              required>

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
              }">

          </label>


          <label>

            Duration (minutes)

            <input
              id="duration"
              type="number"
              min="1">

          </label>


          <label>

            Focus

            <select id="focus">

              <option>
                None
              </option>

              <option>
                Serve
              </option>

              <option>
                Return
              </option>

              <option>
                Forehand
              </option>

              <option>
                Backhand
              </option>

              <option>
                Movement
              </option>

              <option>
                Mental game
              </option>

              <option>
                Consistency
              </option>

            </select>

          </label>


          <label>

            Notes

            <textarea
              id="sessionNotes"
              rows="3"></textarea>

          </label>


          <div
            class="modal-actions">


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
    async e => {

      e.preventDefault();


      const {
        error
      } =
        await sb
          .from(
            "training_sessions"
          )
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

        render(
          "training"
        );

      }

    };
}


/* =========================
   CLOSE MODAL
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

    if (
      await loadProfile()
    ) {

      shell();

      render(
        "overview"
      );

    }

  }

}


start();
