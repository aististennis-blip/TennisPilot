const KEY = 'tpLinkedDemoV5';
const SESSION_KEY = 'tpSessionV6';

const SESSION_DAYS = 30;


/* =========================
   DATABASE
========================= */

function data() {

  let saved = localStorage.getItem(KEY);

  if (!saved) {
    const fresh = {
      users: []
    };

    save(fresh);
    return fresh;
  }

  try {

    const d = JSON.parse(saved);

    if (!Array.isArray(d.users)) {
      d.users = [];
    }

    /*
      Repair older coach accounts.
      This keeps existing accounts and
      gives them a proper coach code if needed.
    */

    d.users.forEach(user => {

      if (user.role !== 'coach') return;

      if (!user.profile) {
        user.profile = {};
      }

      if (!user.profile.requests) {
        user.profile.requests = [];
      }

      if (!user.profile.players) {
        user.profile.players = [];
      }

      if (!user.coachCode) {

        user.coachCode =
          generateCoachCode(d);

      }

      user.profile.coachCode =
        user.coachCode;

    });


    /*
      Repair older player accounts.
    */

    d.users.forEach(user => {

      if (user.role !== 'player') return;

      if (!user.profile) {
        user.profile = {};
      }

      if (!Array.isArray(user.profile.matches)) {
        user.profile.matches = [];
      }

      if (!user.profile.focus) {
        user.profile.focus = 'None';
      }

      if (!user.profile.coachStatus) {
        user.profile.coachStatus = 'none';
      }

    });


    save(d);

    return d;

  } catch {

    const fresh = {
      users: []
    };

    save(fresh);

    return fresh;
  }
}


function save(d) {

  localStorage.setItem(
    KEY,
    JSON.stringify(d)
  );

}


/* =========================
   SESSION
========================= */

function getSession() {

  const raw =
    localStorage.getItem(
      SESSION_KEY
    );

  if (!raw) return null;

  try {

    const session =
      JSON.parse(raw);

    if (
      !session.expiresAt ||
      Date.now() > session.expiresAt
    ) {

      localStorage.removeItem(
        SESSION_KEY
      );

      return null;
    }

    return session;

  } catch {

    localStorage.removeItem(
      SESSION_KEY
    );

    return null;
  }
}


function setSession(email, role) {

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({

      email,
      role,

      expiresAt:
        Date.now() +
        SESSION_DAYS * 86400000

    })
  );

}


function refreshSession() {

  const session =
    getSession();

  if (!session) return;

  session.expiresAt =
    Date.now() +
    SESSION_DAYS * 86400000;

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session)
  );

}


function getCurrentUser() {

  const session =
    getSession();

  if (!session) return null;

  const d =
    data();

  return d.users.find(
    user =>
      user.email === session.email &&
      user.role === session.role
  ) || null;

}


/* =========================
   AUTH UI
========================= */

let authMode = 'login';

let selectedRole = null;


function showAuthMode(mode) {

  authMode = mode;

  document
    .getElementById('loginTab')
    .classList
    .toggle(
      'active',
      mode === 'login'
    );

  document
    .getElementById('signupTab')
    .classList
    .toggle(
      'active',
      mode === 'signup'
    );

  document
    .getElementById('authHeading')
    .textContent =
      mode === 'login'
        ? 'Log in to TennisPilot'
        : 'Create your TennisPilot account';

  backRole();

}


function chooseRole(role) {

  selectedRole = role;

  document
    .getElementById('roleStep')
    .classList
    .add('hidden');

  document
    .getElementById('authForm')
    .classList
    .remove('hidden');

  document
    .getElementById('formEyebrow')
    .textContent =
      authMode === 'login'
        ? 'LOG IN'
        : 'SIGN UP';

  document
    .getElementById('formTitle')
    .textContent =
      `${role === 'coach' ? 'Coach' : 'Player'} ${
        authMode === 'login'
          ? 'Log In'
          : 'Sign Up'
      }`;

  document
    .getElementById('submitBtn')
    .textContent =
      authMode === 'login'
        ? 'Log In'
        : 'Create Account';

  document
    .getElementById('nameLabel')
    .classList
    .toggle(
      'hidden',
      authMode === 'login'
    );

  document
    .getElementById('confirmLabel')
    .classList
    .toggle(
      'hidden',
      authMode === 'login'
    );

  document
    .getElementById('passwordRules')
    .classList
    .toggle(
      'hidden',
      authMode !== 'signup'
    );

  document
    .getElementById('codeWrap')
    .classList
    .toggle(
      'hidden',
      !(
        authMode === 'signup' &&
        role === 'player'
      )
    );

  document
    .getElementById('authMessage')
    .textContent = '';

  updatePasswordRules();

}


function backRole() {

  document
    .getElementById('roleStep')
    .classList
    .remove('hidden');

  document
    .getElementById('authForm')
    .classList
    .add('hidden');

  document
    .getElementById('authMessage')
    .textContent = '';

}


/* =========================
   PASSWORD
========================= */

function validPassword(password) {

  return (
    password.length >= 8 &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    /[A-Z]/.test(password)
  );

}


function updatePasswordRules() {

  const input =
    document.getElementById(
      'password'
    );

  if (!input) return;

  const p =
    input.value;

  const rules = [

    [
      'rLength',
      p.length >= 8,
      'At least 8 characters'
    ],

    [
      'rNumber',
      /[0-9]/.test(p),
      'At least 1 number'
    ],

    [
      'rSpecial',
      /[^A-Za-z0-9]/.test(p),
      'At least 1 special symbol'
    ],

    [
      'rUpper',
      /[A-Z]/.test(p),
      'At least 1 uppercase letter'
    ]

  ];

  rules.forEach(
    ([id, valid, text]) => {

      const el =
        document.getElementById(id);

      if (!el) return;

      el.textContent =
        `${valid ? '✓' : '○'} ${text}`;

      el.classList.toggle(
        'valid',
        valid
      );

    }
  );

}


function msg(text) {

  document
    .getElementById(
      'authMessage'
    )
    .textContent = text;

}


/* =========================
   COACH CODE
========================= */

function generateCoachCode(d) {

  const letters =
    'ABCDEFGHJKLMNPQRSTUVWXYZ';

  const numbers =
    '0123456789';

  let code;

  do {

    code = '';

    for (let i = 0; i < 3; i++) {

      code +=
        letters[
          Math.floor(
            Math.random() *
            letters.length
          )
        ];

    }

    for (let i = 0; i < 3; i++) {

      code +=
        numbers[
          Math.floor(
            Math.random() *
            numbers.length
          )
        ];

    }

  } while (
    d.users.some(
      user =>
        user.role === 'coach' &&
        String(
          user.coachCode || ''
        ).toUpperCase() ===
        code.toUpperCase()
    )
  );

  return code;

}


/* =========================
   FIND COACH
========================= */

function findCoachByCode(
  code,
  d
) {

  const cleanCode =
    String(code || '')
      .trim()
      .toUpperCase();

  if (!cleanCode) {
    return null;
  }

  return d.users.find(
    user => {

      if (
        user.role !== 'coach'
      ) {
        return false;
      }

      const storedCode =
        String(
          user.coachCode ||
          user.profile?.coachCode ||
          ''
        )
        .trim()
        .toUpperCase();

      return (
        storedCode === cleanCode
      );

    }
  ) || null;

}


/* =========================
   LOGIN / SIGNUP
========================= */

function submitAuth(e) {

  e.preventDefault();

  const d =
    data();

  const email =
    document
      .getElementById('email')
      .value
      .trim()
      .toLowerCase();

  const password =
    document
      .getElementById('password')
      .value;

  const name =
    document
      .getElementById('name')
      .value
      .trim();


  /* =========================
     LOGIN
  ========================= */

  if (
    authMode === 'login'
  ) {

    const user =
      d.users.find(
        u =>
          u.email === email &&
          u.role === selectedRole
      );

    if (
      !user ||
      user.password !== password
    ) {

      msg(
        'Incorrect email, password, or account type.'
      );

      return;
    }

    setSession(
      user.email,
      user.role
    );

    location.href =
      'dashboard.html';

    return;
  }


  /* =========================
     SIGNUP VALIDATION
  ========================= */

  if (!name) {

    msg(
      'Please enter your name.'
    );

    return;
  }


  if (!validPassword(password)) {

    msg(
      'Please meet all password requirements.'
    );

    return;
  }


  const confirm =
    document
      .getElementById(
        'confirmPassword'
      )
      .value;


  if (
    password !== confirm
  ) {

    msg(
      'Passwords do not match.'
    );

    return;
  }


  if (
    d.users.some(
      user =>
        user.email === email
    )
  ) {

    msg(
      'An account with this email already exists.'
    );

    return;
  }


  /* =========================
     COACH SIGNUP
  ========================= */

  if (
    selectedRole === 'coach'
  ) {

    const coachCode =
      generateCoachCode(d);

    const profile = {

      name,

      coachCode,

      requests: [],

      players: []

    };


    const coachUser = {

      email,

      password,

      role: 'coach',

      coachCode,

      profile

    };


    d.users.push(
      coachUser
    );


    save(d);


    setSession(
      email,
      'coach'
    );


    location.href =
      'dashboard.html';

    return;
  }


  /* =========================
     PLAYER SIGNUP
  ========================= */

  const player = {

    name,

    level: 'Junior',

    focus: 'None',

    coachStatus: 'none',

    connectedCoachEmail: null,

    connectedCoachCode: null,

    matches: []

  };


  const codeInput =
    document
      .getElementById(
        'coachCode'
      )
      .value
      .trim()
      .toUpperCase();


  /* =========================
     COACH CODE CHECK
  ========================= */

  if (codeInput) {

    const coach =
      findCoachByCode(
        codeInput,
        d
      );


    if (!coach) {

      msg(
        'Coach code not found. Check the code and try again.'
      );

      return;
    }


    player.coachStatus =
      'pending';

    player.connectedCoachEmail =
      coach.email;

    player.connectedCoachCode =
      coach.coachCode;


    if (
      !coach.profile.requests ||
      !Array.isArray(
        coach.profile.requests
      )
    ) {

      coach.profile.requests =
        [];

    }


    const alreadyRequested =
      coach.profile.requests.some(
        request =>
          request.email === email
      );


    if (!alreadyRequested) {

      coach.profile.requests.push({

        name,

        level:
          player.level,

        email

      });

    }

  }


  const playerUser = {

    email,

    password,

    role: 'player',

    profile: player

  };


  d.users.push(
    playerUser
  );


  save(d);


  setSession(
    email,
    'player'
  );


  location.href =
    'dashboard.html';

}


/* =========================
   LOGOUT
========================= */

function logout() {

  localStorage.removeItem(
    SESSION_KEY
  );

  location.href =
    'login.html';

}


/* =========================
   RESET DEMO
========================= */

function resetDemo() {

  /*
    This intentionally deletes the
    prototype accounts and data.
  */

  localStorage.removeItem(
    KEY
  );

  localStorage.removeItem(
    SESSION_KEY
  );

  location.href =
    'login.html';

}


/* =========================
   DASHBOARD
========================= */

function dashboard() {

  const session =
    getSession();

  if (!session) {

    location.href =
      'login.html';

    return;
  }


  refreshSession();


  const user =
    getCurrentUser();


  if (!user) {

    logout();

    return;
  }


  document
    .getElementById(
      'profileBox'
    )
    .innerHTML =

    user.role === 'coach'

      ?

      `
      <b>
        ${esc(user.profile.name)}
      </b>

      <small>
        Coach Account
      </small>
      `

      :

      `
      <b>
        ${esc(user.profile.name)}
      </b>

      <small>
        Player Account
      </small>
      `;


  document
    .getElementById(
      'nav'
    )
    .innerHTML =

    user.role === 'coach'

      ?

      `
      <button
        class="active"
        onclick="renderCoach()">
        ▦ Overview
      </button>

      <button
        onclick="renderPlayers()">
        ♟ Players
      </button>

      <button
        onclick="renderRequests()">
        🔗 Connections
      </button>
      `

      :

      `
      <button
        class="active"
        onclick="renderPlayer()">
        ▦ My Dashboard
      </button>

      <button
        onclick="renderPlayerMatch()">
        🎾 Log Match
      </button>

      <button
        onclick="renderPlayerConnection()">
        🔗 My Coach
      </button>
      `;


  if (
    user.role === 'coach'
  ) {

    renderCoach();

  } else {

    renderPlayer();

  }

}


/* =========================
   GET COACH PLAYERS
========================= */

function getCoachPlayers(
  coachUser,
  d
) {

  return d.users

    .filter(
      user =>
        user.role === 'player'
    )

    .filter(
      user =>
        user.profile &&
        user.profile.connectedCoachEmail ===
        coachUser.email &&
        user.profile.coachStatus ===
        'connected'
    )

    .map(
      user => ({
        ...user.profile,
        email: user.email
      })
    );

}


/* =========================
   COACH DASHBOARD
========================= */

function renderCoach() {

  const d =
    data();

  const coach =
    getCurrentUser();


  if (
    !coach ||
    coach.role !== 'coach'
  ) {

    logout();

    return;
  }


  const players =
    getCoachPlayers(
      coach,
      d
    );


  const requests =
    coach.profile.requests ||
    [];


  document
    .getElementById(
      'dashboard'
    )
    .innerHTML =

    `
    <div class="eyebrow">
      COACH DASHBOARD
    </div>

    <h1>
      Good coaching starts with better information.
    </h1>

    <p class="sub">
      See your players, match reports and what needs attention.
    </p>

    <div class="cards">

      <div class="card">

        <h3>
          Players
        </h3>

        <div class="stat">
          ${players.length}
        </div>

      </div>


      <div class="card">

        <h3>
          Pending connections
        </h3>

        <div class="stat">
          ${requests.length}
        </div>

      </div>


      <div class="card">

        <h3>
          Match reports
        </h3>

        <div class="stat">

          ${
            players.reduce(
              (total, player) =>
                total +
                (
                  player.matches?.length ||
                  0
                ),
              0
            )
          }

        </div>

      </div>

    </div>


    <div class="card">

      <h3>
        Your Connection Code
      </h3>

      <p class="muted">
        Give this code to your players.
      </p>

      <div class="code">
        ${esc(coach.coachCode)}
      </div>

    </div>


    <div
      class="card"
      style="margin-top:18px">

      <h3>
        Your Players
      </h3>

      ${
        players.length

          ?

          players
            .map(
              player =>

                `
                <div class="row">

                  <div>

                    <b>
                      ${esc(player.name)}
                    </b>

                    <div class="muted">

                      Focus:
                      ${esc(
                        player.focus ||
                        'None'
                      )}

                    </div>

                  </div>


                  <span class="pill">

                    ${
                      player.matches?.length ||
                      0
                    }

                    matches

                  </span>

                </div>
                `
            )
            .join('')

          :

          `
          <div class="empty">
            No connected players yet.
          </div>
          `
      }

    </div>
    `;

}


/* =========================
   PLAYERS
========================= */

function renderPlayers() {

  const d =
    data();

  const coach =
    getCurrentUser();


  if (
    !coach ||
    coach.role !== 'coach'
  ) {

    logout();

    return;
  }


  const players =
    getCoachPlayers(
      coach,
      d
    );


  document
    .getElementById(
      'dashboard'
    )
    .innerHTML =

    `
    <div class="eyebrow">
      PLAYERS
    </div>

    <h1>
      Your Players
    </h1>

    <p class="sub">
      Only players connected to your account appear here.
    </p>

    <div class="card">

      ${
        players.length

          ?

          players
            .map(
              player =>

                `
                <div class="row">

                  <div>

                    <b>
                      ${esc(player.name)}
                    </b>

                    <div class="muted">

                      ${esc(
                        player.level ||
                        'Player'
                      )}

                      · Focus:

                      ${esc(
                        player.focus ||
                        'None'
                      )}

                    </div>

                  </div>


                  <span class="pill">

                    ${
                      player.matches?.length ||
                      0
                    }

                    matches

                  </span>

                </div>
                `
            )
            .join('')

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


/* =========================
   CONNECTION REQUESTS
========================= */

function renderRequests() {

  const d =
    data();

  const coach =
    getCurrentUser();


  if (
    !coach ||
    coach.role !== 'coach'
  ) {

    logout();

    return;
  }


  const requests =
    coach.profile.requests ||
    [];


  document
    .getElementById(
      'dashboard'
    )
    .innerHTML =

    `
    <div class="eyebrow">
      CONNECTIONS
    </div>

    <h1>
      Connect players
    </h1>

    <p class="sub">
      Share your connection code with your players.
    </p>


    <div class="card">

      <p>
        Your coach connection code
      </p>

      <div class="code">
        ${esc(coach.coachCode)}
      </div>

    </div>


    <div
      class="card"
      style="margin-top:18px">

      <h3>
        Pending requests
      </h3>

      ${
        requests.length

          ?

          requests
            .map(
              (request, index) =>

                `
                <div class="row">

                  <div>

                    <b>
                      ${esc(request.name)}
                    </b>

                    <div class="muted">
                      ${esc(
                        request.level ||
                        'Player'
                      )}
                    </div>

                  </div>


                  <div>

                    <button
                      class="btn primary small"
                      onclick="acceptRequest(${index})">

                      Accept

                    </button>


                    <button
                      class="btn small"
                      onclick="declineRequest(${index})">

                      Decline

                    </button>

                  </div>

                </div>
                `
            )
            .join('')

          :

          `
          <div class="empty">
            No pending requests.
          </div>
          `
      }

    </div>
    `;

}


/* =========================
   ACCEPT REQUEST
========================= */

function acceptRequest(index) {

  const d =
    data();

  const coach =
    getCurrentUser();


  if (
    !coach ||
    coach.role !== 'coach'
  ) {

    return;
  }


  const requests =
    coach.profile.requests ||
    [];


  const request =
    requests[index];


  if (!request) {
    return;
  }


  const playerUser =
    d.users.find(
      user =>
        user.role === 'player' &&
        user.email === request.email
    );


  if (!playerUser) {

    requests.splice(
      index,
      1
    );

    save(d);

    renderRequests();

    return;
  }


  playerUser.profile.coachStatus =
    'connected';

  playerUser.profile.connectedCoachEmail =
    coach.email;

  playerUser.profile.connectedCoachCode =
    coach.coachCode;


  coach.profile.players =
    coach.profile.players ||
    [];


  const alreadyConnected =
    coach.profile.players.some(
      player =>
        player.email ===
        playerUser.email
    );


  if (!alreadyConnected) {

    coach.profile.players.push({

      ...playerUser.profile,

      email:
        playerUser.email

    });

  }


  requests.splice(
    index,
    1
  );


  save(d);

  renderRequests();

}


/* =========================
   DECLINE REQUEST
========================= */

function declineRequest(index) {

  const d =
    data();

  const coach =
    getCurrentUser();


  if (
    !coach ||
    coach.role !== 'coach'
  ) {

    return;
  }


  const requests =
    coach.profile.requests ||
    [];


  const request =
    requests[index];


  if (!request) {
    return;
  }


  const playerUser =
    d.users.find(
      user =>
        user.role === 'player' &&
        user.email === request.email
    );


  if (playerUser) {

    playerUser.profile.coachStatus =
      'none';

    playerUser.profile.connectedCoachEmail =
      null;

    playerUser.profile.connectedCoachCode =
      null;

  }


  requests.splice(
    index,
    1
  );


  save(d);

  renderRequests();

}


/* =========================
   PLAYER DASHBOARD
========================= */

function renderPlayer() {

  const playerUser =
    getCurrentUser();


  if (
    !playerUser ||
    playerUser.role !== 'player'
  ) {

    logout();

    return;
  }


  const p =
    playerUser.profile;

  const matches =
    p.matches || [];


  document
    .getElementById(
      'dashboard'
    )
    .innerHTML =

    `
    <div class="eyebrow">
      PLAYER DASHBOARD
    </div>

    <h1>
      Welcome, ${esc(p.name)}.
    </h1>

    <p class="sub">
      Your match feedback goes directly to your connected coach.
    </p>


    <div class="cards">

      <div class="card">

        <h3>
          Current Focus
        </h3>

        <div
          class="stat"
          style="font-size:24px">

          ${esc(
            p.focus ||
            'None'
          )}

        </div>

      </div>


      <div class="card">

        <h3>
          Matches Logged
        </h3>

        <div class="stat">
          ${matches.length}
        </div>

      </div>


      <div class="card">

        <h3>
          Coach
        </h3>

        <div
          class="stat"
          style="font-size:20px">

          ${
            p.coachStatus ===
            'connected'

              ? 'Connected ✓'

              : p.coachStatus ===
                'pending'

              ? 'Pending'

              : 'Not connected'
          }

        </div>

      </div>

    </div>


    <div class="card">

      <h3>
        Recent Matches
      </h3>

      ${
        matches.length

          ?

          matches
            .slice(-5)
            .reverse()
            .map(
              match =>
                matchRow(match)
            )
            .join('')

          :

          `
          <div class="empty">

            No matches logged yet.

            After a match, log the score
            and what you felt were your
            biggest weaknesses and positives.

          </div>
          `
      }

    </div>
    `;

}


/* =========================
   PLAYER MATCH
========================= */

function renderPlayerMatch() {

  document
    .getElementById(
      'dashboard'
    )
    .innerHTML =

    `
    <div class="eyebrow">
      POST-MATCH
    </div>

    <h1>
      Log a match
    </h1>

    <p class="sub">
      Report what you experienced in the match.
    </p>


    <div class="card">

      <label>

        Result

        <select id="mr">

          <option>
            Win
          </option>

          <option>
            Loss
          </option>

        </select>

      </label>


      <label>

        Opponent

        <input
          id="mo"
          placeholder="Opponent name">

      </label>


      <label>

        Match Date

        <input
          id="md"
          type="date">

      </label>


      <label>

        Score

        <input
          id="ms"
          placeholder="6-3, 6-4">

      </label>


      <label>

        Biggest Weakness

        <select id="mw">

          ${focusOptions()}

        </select>

      </label>


      <label>

        Biggest Positive

        <select id="mp">

          ${positiveOptions()}

        </select>

      </label>


      <label>

        Player Notes

        <textarea
          id="mn"
          rows="4"
          placeholder="What happened in the match?"></textarea>

      </label>


      <button
        class="btn primary"
        onclick="saveMatch()">

        Submit Match Review

      </button>

    </div>
    `;

}


/* =========================
   SAVE MATCH
========================= */

function saveMatch() {

  const d =
    data();

  const playerUser =
    getCurrentUser();


  if (
    !playerUser ||
    playerUser.role !== 'player'
  ) {

    return;
  }


  const match = {

    result:
      document
        .getElementById('mr')
        .value,

    opponent:
      document
        .getElementById('mo')
        .value
        .trim()
      ||
      'Unknown',

    date:
      document
        .getElementById('md')
        .value
      ||
      new Date()
        .toISOString()
        .split('T')[0],

    score:
      document
        .getElementById('ms')
        .value
        .trim()
      ||
      'Not entered',

    weakness:
      document
        .getElementById('mw')
        .value,

    positive:
      document
        .getElementById('mp')
        .value,

    notes:
      document
        .getElementById('mn')
        .value
        .trim()

  };


  playerUser.profile.matches =
    playerUser.profile.matches ||
    [];


  playerUser.profile.matches.push(
    match
  );


  save(d);

  renderPlayer();

}


/* =========================
   PLAYER CONNECTION
========================= */

function renderPlayerConnection() {

  const playerUser =
    getCurrentUser();


  if (
    !playerUser ||
    playerUser.role !== 'player'
  ) {

    return;
  }


  const p =
    playerUser.profile;


  document
    .getElementById(
      'dashboard'
    )
    .innerHTML =

    `
    <div class="eyebrow">
      MY COACH
    </div>

    <h1>
      Coach connection
    </h1>


    <div class="card">

      <h3>

        ${
          p.coachStatus ===
          'connected'

            ? 'Connected to your coach ✓'

            : p.coachStatus ===
              'pending'

            ? 'Connection pending'

            : 'No coach connected'
        }

      </h3>


      <p class="muted">

        ${
          p.coachStatus ===
          'connected'

            ?

            'Your match reviews are shared with your coach.'

            :

          p.coachStatus ===
          'pending'

            ?

            'Your connection request is waiting for your coach to approve it.'

            :

            'Ask your coach for their connection code.'
        }

      </p>

    </div>
    `;

}


/* =========================
   TENNIS OPTIONS
========================= */

function focusOptions() {

  const options = [

    'None',

    'Serve',
    'First Serve',
    'Second Serve',
    'Serve Placement',
    'Serve + 1',

    'Return',
    'Return Depth',
    'Return + 1',

    'Forehand',
    'Backhand',

    'Volley',
    'Overhead',
    'Slice',

    'Drop Shot',
    'Approach Shot',
    'Passing Shot',

    'Rally Consistency',
    'Shot Depth',
    'Directional Control',
    'Reducing Unforced Errors',

    'Footwork',
    'Court Positioning',
    'Recovery Position',
    'Movement to the Ball',
    'Transition Movement',

    'Point Construction',
    'Attacking Short Balls',
    'Defending',
    'Net Play',

    'Shot Selection',
    'Opponent Patterns',
    'Match Strategy',

    'Confidence',
    'Focus',
    'Decision Making',
    'Playing Under Pressure',

    'Between-Point Routine',
    'Match Preparation',

    'Speed',
    'Agility',
    'Endurance',
    'Explosiveness',
    'Mobility',
    'Match Fitness',

    'Tournament Preparation',

    'Overall Game'

  ];


  return options
    .map(
      option =>
        `<option>${esc(option)}</option>`
    )
    .join('');

}


function positiveOptions() {

  return focusOptions();

}


/* =========================
   MATCH DISPLAY
========================= */

function matchRow(match) {

  return `

    <div class="row">

      <div>

        <b>
          ${esc(
            match.opponent ||
            'Unknown'
          )}
        </b>

        <div class="muted">

          ${esc(
            match.date
          )}

          ·

          ${esc(
            match.score
          )}

        </div>

      </div>


      <span
        class="pill ${
          match.result === 'Win'
            ? 'green'
            : 'red'
        }">

        ${esc(match.result)}

      </span>


      <div>

        Weakness:

        <b>
          ${esc(
            match.weakness
          )}
        </b>

      </div>


      <div>

        Positive:

        <b>
          ${esc(
            match.positive
          )}
        </b>

      </div>

    </div>

  `;

}


/* =========================
   ESCAPE HTML
========================= */

function esc(value) {

  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,

    character => ({

      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'

    }[character])

  );

}


/* =========================
   START DASHBOARD
========================= */

if (
  document.getElementById(
    'dashboard'
  )
) {

  dashboard();

}
