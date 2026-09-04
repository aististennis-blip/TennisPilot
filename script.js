const sb = window.tennisPilotSupabase;

const SESSION_DAYS = 30;

let currentProfile = null;
let currentUser = null;
let currentPlayers = [];
let currentMatches = [];
let currentTraining = [];
let currentGoals = [];
let currentCoachRequests = [];

const $ = (id) => document.getElementById(id);

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(message, type = "info") {
  const existing = document.querySelector(".tp-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `tp-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

function setSessionTimestamp() {
  localStorage.setItem("tpSessionTimestamp", String(Date.now()));
}

function sessionIsFresh() {
  const timestamp = Number(localStorage.getItem("tpSessionTimestamp") || 0);
  if (!timestamp) return false;

  return Date.now() - timestamp < SESSION_DAYS * 24 * 60 * 60 * 1000;
}

async function requireUser() {
  const {
    data: { session },
  } = await sb.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  currentUser = session.user;
  setSessionTimestamp();

  const { data: profile, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error(error);
    showMessage(error.message, "error");
    return null;
  }

  currentProfile = profile;
  return profile;
}

function setupAuth() {
  const loginForm = $("loginForm");
  const signupForm = $("signupForm");

  const loginTab = $("loginTab");
  const signupTab = $("signupTab");

  const loginRoleCoach = $("loginRoleCoach");
  const loginRolePlayer = $("loginRolePlayer");

  const signupRoleCoach = $("signupRoleCoach");
  const signupRolePlayer = $("signupRolePlayer");

  const signupCoachCode = $("coachCode");

  if (signupCoachCode) {
    signupCoachCode.addEventListener("input", () => {
      signupCoachCode.value = signupCoachCode.value
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 6)
        .toUpperCase();
    });
  }

  function showLogin() {
    loginForm?.classList.remove("hidden");
    signupForm?.classList.add("hidden");

    loginTab?.classList.add("active");
    signupTab?.classList.remove("active");
  }

  function showSignup() {
    signupForm?.classList.remove("hidden");
    loginForm?.classList.add("hidden");

    signupTab?.classList.add("active");
    loginTab?.classList.remove("active");
  }

  loginTab?.addEventListener("click", showLogin);
  signupTab?.addEventListener("click", showSignup);

  loginRoleCoach?.addEventListener("change", () => {
    if (loginRolePlayer) loginRolePlayer.checked = false;
  });

  loginRolePlayer?.addEventListener("change", () => {
    if (loginRoleCoach) loginRoleCoach.checked = false;
  });

  signupRoleCoach?.addEventListener("change", () => {
    if (signupRolePlayer) signupRolePlayer.checked = false;
    $("codeWrap")?.classList.add("hidden");
  });

  signupRolePlayer?.addEventListener("change", () => {
    if (signupRoleCoach) signupRoleCoach.checked = false;
    $("codeWrap")?.classList.remove("hidden");
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("loginEmail")?.value.trim();
    const password = $("loginPassword")?.value;

    if (!email || !password) {
      showMessage("Enter your email and password.", "error");
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    if (!data.session) {
      showMessage("Login succeeded, but no session was created.", "error");
      return;
    }

    setSessionTimestamp();
    window.location.href = "dashboard.html";
  });

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = $("signupName")?.value.trim();
    const email = $("signupEmail")?.value.trim();
    const password = $("signupPassword")?.value;
    const confirmPassword = $("signupConfirmPassword")?.value;

    const role = signupRolePlayer?.checked ? "player" : "coach";
    const coachCode = $("coachCode")?.value.trim().toUpperCase();

    if (!fullName || !email || !password || !confirmPassword) {
      showMessage("Please fill out all required fields.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      showMessage(
        "Password must be at least 8 characters and include an uppercase letter, number, and special character.",
        "error"
      );
      return;
    }

    if (role === "player" && coachCode && coachCode.length !== 6) {
      showMessage("Coach code must be 6 characters.", "error");
      return;
    }

    let coach = null;

    if (role === "player" && coachCode) {
      const { data: coaches, error: coachError } = await sb.rpc(
        "find_coach_by_code",
        {
          code_input: coachCode,
        }
      );

      if (coachError) {
        showMessage(coachError.message, "error");
        return;
      }

      coach = coaches?.[0] || null;

      if (!coach) {
        showMessage("Coach code not found.", "error");
        return;
      }
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    if (!data.user) {
      showMessage("Account could not be created.", "error");
      return;
    }

    /*
      The profile is created automatically by the Supabase auth trigger.
      Do NOT insert into profiles here.
    */

    if (role === "player" && coach) {
      if (!data.session) {
        showMessage(
          "Account created. Please log in before connecting to your coach.",
          "info"
        );
        return;
      }

      const { error: requestError } = await sb
        .from("connection_requests")
        .insert({
          player_id: data.user.id,
          coach_id: coach.id,
          status: "pending",
        });

      if (requestError) {
        showMessage(requestError.message, "error");
        return;
      }
    }

    if (!data.session) {
      showMessage(
        "Account created. Check your email to finish signing in.",
        "success"
      );
      showLogin();
      return;
    }

    setSessionTimestamp();
    window.location.href = "dashboard.html";
  });
}

async function logout() {
  await sb.auth.signOut();
  localStorage.removeItem("tpSessionTimestamp");
  window.location.href = "login.html";
}

function setupGlobalLogout() {
  $("logoutBtn")?.addEventListener("click", logout);
}

function setupProfileBox(profile) {
  const box = $("profileBox");
  if (!box) return;

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "TP";

  const photo = profile.profile_photo_url
    ? `<img src="${escapeHTML(profile.profile_photo_url)}" alt="Profile photo">`
    : `<span>${escapeHTML(initials)}</span>`;

  box.innerHTML = `
    <div class="profile-avatar">
      ${photo}
    </div>
    <div class="profile-info">
      <strong>${escapeHTML(profile.full_name)}</strong>
      <span>${escapeHTML(profile.role)}</span>
    </div>
  `;
}

function closeModal() {
  $("modalRoot").innerHTML = "";
}

function openModal(content) {
  $("modalRoot").innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-card">
        ${content}
      </div>
    </div>
  `;

  $("modalOverlay")?.addEventListener("click", (event) => {
    if (event.target.id === "modalOverlay") closeModal();
  });
}

function modalTop(title) {
  return `
    <div class="modal-top">
      <button
        type="button"
        class="button secondary modal-back-btn"
        onclick="closeModal()"
      >
        ← Back
      </button>
      <h2>${escapeHTML(title)}</h2>
    </div>
  `;
}

async function loadCoachData() {
  const coachId = currentUser.id;

  const { data: players, error: playerError } = await sb
    .from("profiles")
    .select("*")
    .eq("connected_coach_id", coachId)
    .eq("role", "player")
    .order("full_name");

  if (playerError) {
    console.error(playerError);
    showMessage(playerError.message, "error");
    return;
  }

  currentPlayers = players || [];

  const { data: requests, error: requestError } = await sb
    .from("connection_requests")
    .select("*")
    .eq("coach_id", coachId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (requestError) {
    console.error(requestError);
  }

  currentCoachRequests = requests || [];

  const playerIds = currentPlayers.map((p) => p.id);

  if (!playerIds.length) {
    currentMatches = [];
    currentTraining = [];
    currentGoals = [];
    return;
  }

  const [matchesResult, trainingResult, goalsResult] = await Promise.all([
    sb
      .from("matches")
      .select("*")
      .in("player_id", playerIds)
      .order("match_date", { ascending: false }),

    sb
      .from("training_sessions")
      .select("*")
      .in("player_id", playerIds)
      .order("session_date", { ascending: false }),

    sb
      .from("goals")
      .select("*")
      .in("player_id", playerIds)
      .order("created_at", { ascending: false }),
  ]);

  if (matchesResult.error) {
    console.error(matchesResult.error);
    showMessage(matchesResult.error.message, "error");
  }

  if (trainingResult.error) {
    console.error(trainingResult.error);
  }

  if (goalsResult.error) {
    console.error(goalsResult.error);
  }

  currentMatches = matchesResult.data || [];
  currentTraining = trainingResult.data || [];
  currentGoals = goalsResult.data || [];
}

async function loadPlayerData() {
  const playerId = currentUser.id;

  const [matchesResult, trainingResult, goalsResult] = await Promise.all([
    sb
      .from("matches")
      .select("*")
      .eq("player_id", playerId)
      .order("match_date", { ascending: false }),

    sb
      .from("training_sessions")
      .select("*")
      .eq("player_id", playerId)
      .order("session_date", { ascending: false }),

    sb
      .from("goals")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false }),
  ]);

  if (matchesResult.error) {
    console.error(matchesResult.error);
    showMessage(matchesResult.error.message, "error");
  }

  if (trainingResult.error) {
    console.error(trainingResult.error);
  }

  if (goalsResult.error) {
    console.error(goalsResult.error);
  }

  currentMatches = matchesResult.data || [];
  currentTraining = trainingResult.data || [];
  currentGoals = goalsResult.data || [];
}

function coachPlayerName(playerId) {
  return (
    currentPlayers.find((player) => player.id === playerId)?.full_name ||
    "Unknown player"
  );
}

function formatDate(date) {
  if (!date) return "—";

  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderCoachDashboard() {
  const main = $("dashboard");
  if (!main) return;

  const matchCount = currentMatches.length;

  main.innerHTML = `
    <section class="hero-section">
      <div>
        <p class="eyebrow">COACH DASHBOARD</p>
        <h1>Coach your players smarter.</h1>
        <p class="hero-copy">
          Manage your players, review matches, and keep their development organized in one place.
        </p>
      </div>

      <button class="button primary" onclick="openAddPlayerModal()">
        + Add Player
      </button>
    </section>

    <section class="stats-grid">
      <div class="stat-card">
        <span>Players</span>
        <strong>${currentPlayers.length}</strong>
      </div>

      <div class="stat-card">
        <span>Matches Reviewed</span>
        <strong>${matchCount}</strong>
      </div>

      <div class="stat-card">
        <span>Pending Requests</span>
        <strong>${currentCoachRequests.length}</strong>
      </div>
    </section>

    <section class="content-card">
      <div class="section-header">
        <div>
          <p class="eyebrow">YOUR PLAYERS</p>
          <h2>Player Overview</h2>
        </div>
      </div>

      ${
        currentPlayers.length
          ? `<div class="player-grid">
              ${currentPlayers.map(renderCoachPlayerCard).join("")}
            </div>`
          : `
            <div class="empty-state">
              <h3>No players yet</h3>
              <p>Add a player or wait for a player connection request.</p>
              <button class="button primary" onclick="openAddPlayerModal()">
                + Add Player
              </button>
            </div>
          `
      }
    </section>

    ${
      currentCoachRequests.length
        ? `
      <section class="content-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">CONNECTIONS</p>
            <h2>Pending Requests</h2>
          </div>
        </div>

        <div class="request-list">
          ${currentCoachRequests.map(renderRequest).join("")}
        </div>
      </section>
    `
        : ""
    }
  `;
}

function renderCoachPlayerCard(player) {
  const playerMatches = currentMatches.filter(
    (match) => match.player_id === player.id
  );

  const photo = player.profile_photo_url
    ? `<img src="${escapeHTML(player.profile_photo_url)}" alt="${escapeHTML(
        player.full_name
      )}">`
    : `<span>${escapeHTML(
        player.full_name
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      )}</span>`;

  return `
    <div class="player-card">
      <div class="player-card-top">
        <div class="large-avatar">
          ${photo}
        </div>

        <div>
          <h3>${escapeHTML(player.full_name)}</h3>
          <p>${escapeHTML(player.level || "Player")}</p>
        </div>
      </div>

      <div class="bio-summary">
        ${
          player.age
            ? `<span>${escapeHTML(String(player.age))} years</span>`
            : ""
        }

        ${
          player.dominant_hand
            ? `<span>${escapeHTML(player.dominant_hand)}-handed</span>`
            : ""
        }

        ${
          player.years_playing
            ? `<span>${escapeHTML(
                String(player.years_playing)
              )} yrs tennis</span>`
            : ""
        }
      </div>

      <div class="player-card-stats">
        <div>
          <strong>${playerMatches.length}</strong>
          <span>Matches</span>
        </div>

        <div>
          <strong>${escapeHTML(player.current_focus || "—")}</strong>
          <span>Focus</span>
        </div>
      </div>

      <button
        class="button secondary full-width"
        onclick="openCoachPlayer('${player.id}')"
      >
        View Player
      </button>
    </div>
  `;
}

function renderRequest(request) {
  return `
    <div class="request-row">
      <div>
        <strong>Player connection request</strong>
        <span>${formatDate(request.created_at?.slice(0, 10))}</span>
      </div>

      <div class="request-actions">
        <button
          class="button primary"
          onclick="acceptRequest('${request.id}', '${request.player_id}')"
        >
          Accept
        </button>

        <button
          class="button secondary"
          onclick="declineRequest('${request.id}')"
        >
          Decline
        </button>
      </div>
    </div>
  `;
}

async function acceptRequest(requestId, playerId) {
  const { error } = await sb
    .from("connection_requests")
    .update({ status: "accepted" })
    .eq("id", requestId)
    .eq("coach_id", currentUser.id);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  const { error: playerError } = await sb
    .from("profiles")
    .update({
      connected_coach_id: currentUser.id,
    })
    .eq("id", playerId)
    .eq("role", "player");

  if (playerError) {
    showMessage(playerError.message, "error");
    return;
  }

  showMessage("Player connected.", "success");

  await loadCoachData();
  renderCoachDashboard();
}

async function declineRequest(requestId) {
  const { error } = await sb
    .from("connection_requests")
    .update({ status: "declined" })
    .eq("id", requestId)
    .eq("coach_id", currentUser.id);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  showMessage("Request declined.", "success");

  await loadCoachData();
  renderCoachDashboard();
}

function openAddPlayerModal() {
  openModal(`
    ${modalTop("Add Player")}

    <form id="addPlayerForm" class="form-grid">
      <label>
        Player Name
        <input id="newPlayerName" required>
      </label>

      <label>
        Level
        <select id="newPlayerLevel">
          <option>Beginner</option>
          <option>Recreational</option>
          <option selected>Competitive</option>
          <option>Tournament</option>
        </select>
      </label>

      <label>
        Development Focus
        <select id="newPlayerFocus">
          <option>None</option>
          <option>Serve</option>
          <option>Return</option>
          <option>Forehand</option>
          <option>Backhand</option>
          <option>Movement</option>
          <option>Mental Game</option>
          <option>Match Strategy</option>
        </select>
      </label>

      <label>
        Coach Note
        <textarea id="newPlayerNote"></textarea>
      </label>

      <button class="button primary" type="submit">
        Add Player
      </button>
    </form>
  `);

  $("addPlayerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    showMessage(
      "Players should normally join through their connection code.",
      "info"
    );
    closeModal();
  });
}

function openCoachPlayer(playerId) {
  const player = currentPlayers.find((p) => p.id === playerId);

  if (!player) {
    showMessage("Player not found.", "error");
    return;
  }

  const matches = currentMatches
    .filter((match) => match.player_id === playerId)
    .sort((a, b) => new Date(b.match_date) - new Date(a.match_date));

  const playerTraining = currentTraining.filter(
    (session) => session.player_id === playerId
  );

  const photo = player.profile_photo_url
    ? `<img src="${escapeHTML(player.profile_photo_url)}" alt="${escapeHTML(
        player.full_name
      )}">`
    : `<span>${escapeHTML(
        player.full_name
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      )}</span>`;

  openModal(`
    ${modalTop("Player Profile")}

    <div class="player-profile-header">
      <div class="profile-photo-large">
        ${photo}
      </div>

      <div>
        <h2>${escapeHTML(player.full_name)}</h2>
        <p>${escapeHTML(player.level || "Player")}</p>
      </div>
    </div>

    <div class="bio-grid">
      ${bioItem("Age", player.age ? `${player.age}` : "Not added")}
      ${bioItem(
        "Dominant Hand",
        player.dominant_hand || "Not added"
      )}
      ${bioItem(
        "Years Playing",
        player.years_playing ? `${player.years_playing}` : "Not added"
      )}
      ${bioItem("Level", player.level || "Not added")}
      ${bioItem(
        "Playing Style",
        player.playing_style || "Not added"
      )}
      ${bioItem(
        "Height",
        player.height ? player.height : "Not added"
      )}
    </div>

    ${
      player.short_bio
        ? `
      <div class="bio-note">
        <strong>About</strong>
        <p>${escapeHTML(player.short_bio)}</p>
      </div>
    `
        : ""
    }

    <div class="focus-box">
      <span>Current Focus</span>
      <strong>${escapeHTML(player.current_focus || "None")}</strong>
    </div>

    <div class="player-profile-stats">
      <div>
        <strong>${matches.length}</strong>
        <span>Matches</span>
      </div>

      <div>
        <strong>${playerTraining.length}</strong>
        <span>Training Sessions</span>
      </div>
    </div>

    <h3>Recent Matches</h3>

    ${
      matches.length
        ? `<div class="match-list">
            ${matches.slice(0, 10).map(renderCoachMatch).join("")}
          </div>`
        : `<div class="empty-state small"><p>No matches yet.</p></div>`
    }
  `);
}

function bioItem(label, value) {
  return `
    <div class="bio-item">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>
  `;
}

function renderCoachMatch(match) {
  return `
    <div class="match-row">
      <div>
        <strong>${escapeHTML(match.opponent)}</strong>
        <span>${formatDate(match.match_date)}</span>
      </div>

      <div>
        <strong class="${match.result === "win" ? "win-text" : "loss-text"}">
          ${match.result === "win" ? "WIN" : "LOSS"}
        </strong>
        <span>${escapeHTML(match.score || "—")}</span>
      </div>
    </div>
  `;
}

function renderCoachMatchReviews() {
  const main = $("dashboard");
  if (!main) return;

  main.innerHTML = `
    <section class="page-heading">
      <p class="eyebrow">MATCH REVIEWS</p>
      <h1>Match History</h1>
      <p>Review the matches reported by your connected players.</p>
    </section>

    ${
      currentMatches.length
        ? renderYearlyMatches(currentMatches)
        : `
          <div class="content-card empty-state">
            <h3>No matches yet</h3>
            <p>Your connected players' match reports will appear here.</p>
          </div>
        `
    }
  `;
}

function renderYearlyMatches(matches) {
  const grouped = {};

  [...matches]
    .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
    .forEach((match) => {
      const year = new Date(`${match.match_date}T12:00:00`).getFullYear();

      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(match);
    });

  return Object.keys(grouped)
    .sort((a, b) => Number(b) - Number(a))
    .map(
      (year) => `
      <section class="content-card year-section">
        <div class="section-header">
          <h2>${escapeHTML(year)}</h2>
          <span>${grouped[year].length} matches</span>
        </div>

        <div class="match-history">
          ${grouped[year]
            .map(
              (match) => `
              <div class="history-match">
                <div class="history-date">
                  ${formatDate(match.match_date)}
                </div>

                <div class="history-main">
                  <strong>${escapeHTML(
                    coachPlayerName(match.player_id)
                  )}</strong>
                  <span>vs ${escapeHTML(match.opponent)}</span>
                </div>

                <div class="history-result">
                  <strong class="${
                    match.result === "win" ? "win-text" : "loss-text"
                  }">
                    ${match.result === "win" ? "W" : "L"}
                  </strong>
                  <span>${escapeHTML(match.score || "—")}</span>
                </div>

                <div class="history-detail">
                  <span>
                    Problem:
                    ${escapeHTML(match.biggest_problem || "None")}
                  </span>

                  <span>
                    Positive:
                    ${escapeHTML(match.biggest_positive || "None")}
                  </span>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      </section>
    `
    )
    .join("");
}

function renderPlayerDashboard() {
  const main = $("dashboard");
  if (!main) return;

  const wins = currentMatches.filter((m) => m.result === "win").length;
  const losses = currentMatches.filter((m) => m.result === "loss").length;

  const completedTraining = currentTraining.filter(
    (session) => session.completed
  ).length;

  main.innerHTML = `
    <section class="hero-section">
      <div>
        <p class="eyebrow">PLAYER DASHBOARD</p>
        <h1>Welcome back, ${escapeHTML(currentProfile.full_name.split(" ")[0])}.</h1>
        <p class="hero-copy">
          Keep your matches, training, goals, and development in one place.
        </p>
      </div>

      <button class="button primary" onclick="openLogMatchModal()">
        + Log Match
      </button>
    </section>

    <section class="content-card profile-card">
      <div class="profile-card-left">
        <div class="profile-photo-large clickable-photo" onclick="openBioModal()">
          ${
            currentProfile.profile_photo_url
              ? `<img src="${escapeHTML(
                  currentProfile.profile_photo_url
                )}" alt="Profile photo">`
              : `<span>+</span>`
          }
        </div>

        <div>
          <p class="eyebrow">MY PROFILE</p>
          <h2>${escapeHTML(currentProfile.full_name)}</h2>
          <p>${escapeHTML(currentProfile.level || "Player")}</p>

          <div class="bio-summary">
            ${
              currentProfile.age
                ? `<span>${escapeHTML(
                    String(currentProfile.age)
                  )} years</span>`
                : ""
            }

            ${
              currentProfile.dominant_hand
                ? `<span>${escapeHTML(
                    currentProfile.dominant_hand
                  )}-handed</span>`
                : ""
            }

            ${
              currentProfile.years_playing
                ? `<span>${escapeHTML(
                    String(currentProfile.years_playing)
                  )} yrs tennis</span>`
                : ""
            }
          </div>
        </div>
      </div>

      <button class="button secondary" onclick="openBioModal()">
        Edit Bio
      </button>
    </section>

    <section class="stats-grid">
      <div class="stat-card">
        <span>Matches</span>
        <strong>${currentMatches.length}</strong>
      </div>

      <div class="stat-card">
        <span>Wins</span>
        <strong>${wins}</strong>
      </div>

      <div class="stat-card">
        <span>Losses</span>
        <strong>${losses}</strong>
      </div>

      <div class="stat-card">
        <span>Training Completed</span>
        <strong>${completedTraining}</strong>
      </div>
    </section>

    <section class="content-card">
      <div class="section-header">
        <div>
          <p class="eyebrow">CURRENT DEVELOPMENT</p>
          <h2>${escapeHTML(currentProfile.current_focus || "None")}</h2>
        </div>
      </div>

      ${
        currentProfile.short_bio
          ? `<p>${escapeHTML(currentProfile.short_bio)}</p>`
          : `<p>Add a short bio so your coach can quickly understand your game.</p>`
      }
    </section>

    <section class="content-card">
      <div class="section-header">
        <div>
          <p class="eyebrow">RECENT MATCHES</p>
          <h2>Match History</h2>
        </div>

        <button class="button secondary" onclick="openLogMatchModal()">
          + Log Match
        </button>
      </div>

      ${
        currentMatches.length
          ? renderPlayerRecentMatches()
          : `
            <div class="empty-state">
              <h3>No matches yet</h3>
              <p>Log your first match to start building your history.</p>
            </div>
          `
      }
    </section>
  `;
}

function renderPlayerRecentMatches() {
  const grouped = {};

  currentMatches.forEach((match) => {
    const year = new Date(`${match.match_date}T12:00:00`).getFullYear();

    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(match);
  });

  return Object.keys(grouped)
    .sort((a, b) => Number(b) - Number(a))
    .map(
      (year) => `
      <div class="year-block">
        <h3>${escapeHTML(year)}</h3>

        ${grouped[year]
          .map(
            (match) => `
            <div class="history-match">
              <div class="history-date">
                ${formatDate(match.match_date)}
              </div>

              <div class="history-main">
                <strong>vs ${escapeHTML(match.opponent)}</strong>
                <span>${escapeHTML(match.score || "—")}</span>
              </div>

              <div class="history-result">
                <strong class="${
                  match.result === "win" ? "win-text" : "loss-text"
                }">
                  ${match.result === "win" ? "W" : "L"}
                </strong>
              </div>
            </div>
          `
          )
          .join("")}
      </div>
    `
    )
    .join("");
}

async function openLogMatchModal() {
  openModal(`
    ${modalTop("Log Match")}

    <form id="matchForm" class="form-grid">
      <label>
        Opponent
        <input id="matchOpponent" placeholder="Opponent name" required>
      </label>

      <label>
        Date
        <input id="matchDate" type="date" value="${
          new Date().toISOString().split("T")[0]
        }" required>
      </label>

      <label>
        Result
        <select id="matchResult" required>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
        </select>
      </label>

      <label>
        Score
        <input id="matchScore" placeholder="6-2 7-5">
      </label>

      <label>
        Biggest Problem
        <select id="matchProblem">
          <option>None</option>
          <option>Serve</option>
          <option>Return</option>
          <option>Forehand</option>
          <option>Backhand</option>
          <option>Movement</option>
          <option>Mental Game</option>
          <option>Match Strategy</option>
        </select>
      </label>

      <label>
        Biggest Positive
        <select id="matchPositive">
          <option>None</option>
          <option>Serve</option>
          <option>Return</option>
          <option>Forehand</option>
          <option>Backhand</option>
          <option>Movement</option>
          <option>Mental Game</option>
          <option>Match Strategy</option>
        </select>
      </label>

      <label>
        Notes
        <textarea id="matchNotes" placeholder="Anything important from the match?"></textarea>
      </label>

      <button class="button primary" type="submit">
        Save Match
      </button>
    </form>
  `);

  $("matchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const match = {
      player_id: currentUser.id,
      opponent: $("matchOpponent").value.trim(),
      match_date: $("matchDate").value,
      result: $("matchResult").value,
      score: $("matchScore").value.trim() || null,
      biggest_problem: $("matchProblem").value,
      biggest_positive: $("matchPositive").value,
      notes: $("matchNotes").value.trim() || null,
    };

    const { error } = await sb.from("matches").insert(match);

    if (error) {
      console.error(error);
      showMessage(error.message, "error");
      return;
    }

    closeModal();
    showMessage("Match saved.", "success");

    await loadPlayerData();
    renderPlayerDashboard();
  });
}

function openBioModal() {
  const p = currentProfile;

  openModal(`
    ${modalTop("My Bio")}

    <form id="bioForm" class="form-grid">
      <div class="photo-upload-section">
        <div class="profile-photo-large bio-photo-preview" id="bioPhotoPreview">
          ${
            p.profile_photo_url
              ? `<img src="${escapeHTML(
                  p.profile_photo_url
                )}" alt="Profile photo">`
              : `<span>+</span>`
          }
        </div>

        <div class="photo-buttons">
          <label class="button secondary photo-button">
            🖼️ Choose from Gallery
            <input
              id="galleryPhoto"
              type="file"
              accept="image/*"
              hidden
            >
          </label>

          <label class="button secondary photo-button">
            📷 Take a Photo
            <input
              id="cameraPhoto"
              type="file"
              accept="image/*"
              capture="user"
              hidden
            >
          </label>

          ${
            p.profile_photo_url
              ? `<button
                  type="button"
                  class="button danger"
                  id="removePhotoBtn"
                >
                  Remove Photo
                </button>`
              : ""
          }
        </div>
      </div>

      <label>
        Age
        <input
          id="bioAge"
          type="number"
          min="1"
          max="100"
          value="${escapeHTML(p.age || "")}"
        >
      </label>

      <label>
        Dominant Hand
        <select id="bioHand">
          <option value="">Select</option>
          <option value="Right" ${
            p.dominant_hand === "Right" ? "selected" : ""
          }>Right</option>
          <option value="Left" ${
            p.dominant_hand === "Left" ? "selected" : ""
          }>Left</option>
        </select>
      </label>

      <label>
        Years Playing Tennis
        <input
          id="bioYears"
          type="number"
          min="0"
          max="100"
          value="${escapeHTML(p.years_playing || "")}"
        >
      </label>

      <label>
        Playing Level
        <select id="bioLevel">
          <option value="">Select</option>
          <option ${p.level === "Beginner" ? "selected" : ""}>Beginner</option>
          <option ${
            p.level === "Recreational" ? "selected" : ""
          }>Recreational</option>
          <option ${
            p.level === "Competitive" ? "selected" : ""
          }>Competitive</option>
          <option ${
            p.level === "Tournament" ? "selected" : ""
          }>Tournament</option>
        </select>
      </label>

      <label>
        Playing Style
        <select id="bioStyle">
          <option value="">Select</option>
          <option ${
            p.playing_style === "Aggressive" ? "selected" : ""
          }>Aggressive</option>
          <option ${
            p.playing_style === "Defensive" ? "selected" : ""
          }>Defensive</option>
          <option ${
            p.playing_style === "All-court" ? "selected" : ""
          }>All-court</option>
          <option ${
            p.playing_style === "Serve & volley" ? "selected" : ""
          }>Serve & volley</option>
          <option ${
            p.playing_style === "Other" ? "selected" : ""
          }>Other</option>
        </select>
      </label>

      <label>
        Height
        <input
          id="bioHeight"
          placeholder="e.g. 6'1"
          value="${escapeHTML(p.height || "")}"
        >
      </label>

      <label>
        Short Bio
        <textarea
          id="bioShort"
          placeholder="Tell your coach a little about your game..."
        >${escapeHTML(p.short_bio || "")}</textarea>
      </label>

      <button class="button primary" type="submit">
        Save Bio
      </button>
    </form>
  `);

  let selectedPhotoFile = null;
  let removePhoto = false;

  function previewPhoto(file) {
    if (!file) return;

    selectedPhotoFile = file;
    removePhoto = false;

    const reader = new FileReader();

    reader.onload = () => {
      $("bioPhotoPreview").innerHTML = `
        <img src="${reader.result}" alt="New profile photo">
      `;
    };

    reader.readAsDataURL(file);
  }

  $("galleryPhoto")?.addEventListener("change", (event) => {
    previewPhoto(event.target.files?.[0]);
  });

  $("cameraPhoto")?.addEventListener("change", (event) => {
    previewPhoto(event.target.files?.[0]);
  });

  $("removePhotoBtn")?.addEventListener("click", () => {
    selectedPhotoFile = null;
    removePhoto = true;

    $("bioPhotoPreview").innerHTML = `<span>+</span>`;
  });

  $("bioForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const updates = {
      age: $("bioAge").value
        ? Number($("bioAge").value)
        : null,

      dominant_hand: $("bioHand").value || null,

      years_playing: $("bioYears").value
        ? Number($("bioYears").value)
        : null,

      level: $("bioLevel").value || null,

      playing_style: $("bioStyle").value || null,

      height: $("bioHeight").value.trim() || null,

      short_bio: $("bioShort").value.trim() || null,
    };

    if (selectedPhotoFile) {
      const extension =
        selectedPhotoFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `${currentUser.id}/profile.${extension}`;

      const { error: uploadError } = await sb.storage
        .from("profile-photos")
        .upload(filePath, selectedPhotoFile, {
          upsert: true,
          contentType: selectedPhotoFile.type,
        });

      if (uploadError) {
        console.error(uploadError);
        showMessage(uploadError.message, "error");
        return;
      }

      const { data: publicUrlData } = sb.storage
        .from("profile-photos")
        .getPublicUrl(filePath);

      updates.profile_photo_url = publicUrlData.publicUrl;
    }

    if (removePhoto) {
      updates.profile_photo_url = null;

      const { data: files } = await sb.storage
        .from("profile-photos")
        .list(currentUser.id);

      if (files?.length) {
        await sb.storage.from("profile-photos").remove(
          files.map((file) => `${currentUser.id}/${file.name}`)
        );
      }
    }

    const { data, error } = await sb
      .from("profiles")
      .update(updates)
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      showMessage(error.message, "error");
      return;
    }

    currentProfile = data;

    closeModal();
    showMessage("Bio updated.", "success");

    setupProfileBox(currentProfile);
    renderPlayerDashboard();
  });
}

async function openConnectCoachModal() {
  openModal(`
    ${modalTop("Connect to Coach")}

    <form id="connectCoachForm" class="form-grid">
      <label>
        Coach Connection Code
        <input
          id="connectCoachCode"
          placeholder="ABC123"
          maxlength="6"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          style="text-transform:uppercase"
          required
        >
      </label>

      <button class="button primary" type="submit">
        Connect
      </button>
    </form>
  `);

  $("connectCoachCode")?.addEventListener("input", () => {
    $("connectCoachCode").value = $("connectCoachCode").value
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 6)
      .toUpperCase();
  });

  $("connectCoachForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const code = $("connectCoachCode").value.trim().toUpperCase();

    const { data: coaches, error } = await sb.rpc(
      "find_coach_by_code",
      {
        code_input: code,
      }
    );

    if (error) {
      showMessage(error.message, "error");
      return;
    }

    const coach = coaches?.[0];

    if (!coach) {
      showMessage("Coach code not found.", "error");
      return;
    }

    const { error: requestError } = await sb
      .from("connection_requests")
      .insert({
        player_id: currentUser.id,
        coach_id: coach.id,
        status: "pending",
      });

    if (requestError) {
      if (requestError.code === "23505") {
        showMessage("You already have a request with this coach.", "info");
      } else {
        showMessage(requestError.message, "error");
      }
      return;
    }

    closeModal();
    showMessage("Connection request sent.", "success");

    renderPlayerDashboard();
  });
}

async function renderPlayerCoach() {
  const main = $("dashboard");
  if (!main) return;

  if (!currentProfile.connected_coach_id) {
    main.innerHTML = `
      <section class="page-heading">
        <p class="eyebrow">MY COACH</p>
        <h1>Connect to a Coach</h1>
        <p>Enter your coach's connection code to send a request.</p>
      </section>

      <div class="content-card connect-card">
        <h2>No coach connected</h2>
        <p>Ask your coach for their six-character connection code.</p>

        <button class="button primary" onclick="openConnectCoachModal()">
          Connect to Coach
        </button>
      </div>
    `;

    return;
  }

  const { data: coach, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", currentProfile.connected_coach_id)
    .single();

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  main.innerHTML = `
    <section class="page-heading">
      <p class="eyebrow">MY COACH</p>
      <h1>Your Coach</h1>
      <p>Your TennisPilot connection.</p>
    </section>

    <div class="content-card coach-profile-card">
      <div class="large-avatar">
        ${
          coach.profile_photo_url
            ? `<img src="${escapeHTML(
                coach.profile_photo_url
              )}" alt="Coach photo">`
            : `<span>${escapeHTML(
                coach.full_name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}</span>`
        }
      </div>

      <div>
        <p class="eyebrow">CONNECTED COACH</p>
        <h2>${escapeHTML(coach.full_name)}</h2>
        <p>Coach</p>
      </div>
    </div>
  `;
}

function setupNavigation(profile) {
  const nav = $("nav");
  if (!nav) return;

  if (profile.role === "coach") {
    nav.innerHTML = `
      <button class="nav-item active" data-page="overview">
        Overview
      </button>

      <button class="nav-item" data-page="players">
        Players
      </button>

      <button class="nav-item" data-page="matches">
        Match Reviews
      </button>

      <button class="nav-item" data-page="training">
        Training Plans
      </button>

      <button class="nav-item" data-page="progress">
        Progress
      </button>
    `;
  } else {
    nav.innerHTML = `
      <button class="nav-item active" data-page="overview">
        My Dashboard
      </button>

      <button class="nav-item" data-page="logmatch">
        Log Match
      </button>

      <button class="nav-item" data-page="coach">
        My Coach
      </button>
    `;
  }

  nav.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", async () => {
      nav.querySelectorAll(".nav-item").forEach((item) =>
        item.classList.remove("active")
      );

      button.classList.add("active");

      const page = button.dataset.page;

      if (profile.role === "coach") {
        if (page === "overview") renderCoachDashboard();
        if (page === "players") renderCoachPlayers();
        if (page === "matches") renderCoachMatchReviews();
        if (page === "training") renderCoachTraining();
        if (page === "progress") renderCoachProgress();
      } else {
        if (page === "overview") renderPlayerDashboard();
        if (page === "logmatch") openLogMatchModal();
        if (page === "coach") renderPlayerCoach();
      }
    });
  });
}

function renderCoachPlayers() {
  const main = $("dashboard");
  if (!main) return;

  main.innerHTML = `
    <section class="page-heading">
      <p class="eyebrow">PLAYERS</p>
      <h1>Your Players</h1>
      <p>Only players connected to your coach account appear here.</p>
    </section>

    ${
      currentPlayers.length
        ? `<div class="player-grid">
            ${currentPlayers.map(renderCoachPlayerCard).join("")}
          </div>`
        : `
          <div class="content-card empty-state">
            <h3>No connected players</h3>
            <p>Give your connection code to a player.</p>
          </div>
        `
    }
  `;
}

function renderCoachTraining() {
  const main = $("dashboard");
  if (!main) return;

  main.innerHTML = `
    <section class="page-heading">
      <p class="eyebrow">TRAINING PLANS</p>
      <h1>Training</h1>
      <p>Review training sessions from your connected players.</p>
    </section>

    ${
      currentTraining.length
        ? `
        <div class="content-card">
          ${currentTraining
            .map(
              (session) => `
              <div class="history-match">
                <div class="history-date">
                  ${formatDate(session.session_date)}
                </div>

                <div class="history-main">
                  <strong>${escapeHTML(
                    coachPlayerName(session.player_id)
                  )}</strong>
                  <span>${escapeHTML(session.session_name)}</span>
                </div>

                <div>
                  <strong>${session.completed ? "Completed" : "Planned"}</strong>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      `
        : `
          <div class="content-card empty-state">
            <h3>No training sessions yet</h3>
          </div>
        `
    }
  `;
}

function renderCoachProgress() {
  const main = $("dashboard");
  if (!main) return;

  main.innerHTML = `
    <section class="page-heading">
      <p class="eyebrow">PROGRESS</p>
      <h1>Player Progress</h1>
      <p>See how your connected players are progressing.</p>
    </section>

    <div class="player-grid">
      ${
        currentPlayers.length
          ? currentPlayers
              .map((player) => {
                const sessions = currentTraining.filter(
                  (s) => s.player_id === player.id
                );

                const completed = sessions.filter(
                  (s) => s.completed
                ).length;

                return `
                  <div class="content-card">
                    <h3>${escapeHTML(player.full_name)}</h3>

                    <div class="progress-bar">
                      <div style="width:${
                        sessions.length
                          ? Math.round(
                              (completed / sessions.length) * 100
                            )
                          : 0
                      }%"></div>
                    </div>

                    <p>
                      ${completed} of ${sessions.length}
                      training sessions completed
                    </p>
                  </div>
                `;
              })
              .join("")
          : `
            <div class="content-card empty-state">
              <h3>No players yet</h3>
            </div>
          `
      }
    </div>
  `;
}

async function startDashboard() {
  if (!sb) {
    console.error("Supabase client is missing.");
    showMessage("Supabase is not configured correctly.", "error");
    return;
  }

  const profile = await requireUser();

  if (!profile) return;

  setupProfileBox(profile);
  setupGlobalLogout();
  setupNavigation(profile);

  if (profile.role === "coach") {
    await loadCoachData();
    renderCoachDashboard();
  } else {
    await loadPlayerData();
    renderPlayerDashboard();
  }
}

async function startLogin() {
  if (!sb) {
    console.error("Supabase client is missing.");
    return;
  }

  const {
    data: { session },
  } = await sb.auth.getSession();

  if (session && sessionIsFresh()) {
    window.location.href = "dashboard.html";
    return;
  }

  setupAuth();
}

if (location.pathname.endsWith("login.html")) {
  startLogin();
}

if (location.pathname.endsWith("dashboard.html")) {
  startDashboard();
}
