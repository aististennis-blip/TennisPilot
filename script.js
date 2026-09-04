const KEY = 'tpLinkedDemoV5';
const SESSION_KEY = 'tpSessionV5';

const SESSION_DAYS = 30;

const defaultData = {
  users: [],

  coach: {
    name: 'Coach Demo',
    code: 'KTP482',
    requests: [],
    players: [],
    logged: false
  },

  player: null
};


/* =========================
   DATABASE
========================= */

function data(){

  return JSON.parse(
    localStorage.getItem(KEY) ||
    JSON.stringify(defaultData)
  );

}


function save(d){

  localStorage.setItem(
    KEY,
    JSON.stringify(d)
  );

}


/* =========================
   LOGIN SESSION
========================= */

function getSession(){

  const raw =
    localStorage.getItem(SESSION_KEY);

  if(!raw){
    return null;
  }

  try{

    const s = JSON.parse(raw);

    if(Date.now() > s.expiresAt){

      localStorage.removeItem(SESSION_KEY);

      return null;
    }

    return s;

  }catch{

    return null;

  }

}


function setSession(role){

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({

      role,

      expiresAt:
        Date.now() +
        SESSION_DAYS *
        86400000

    })
  );

}


function refreshSession(){

  const s = getSession();

  if(!s){
    return;
  }

  s.expiresAt =
    Date.now() +
    SESSION_DAYS *
    86400000;

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(s)
  );

}


/* =========================
   AUTH
========================= */

let authMode = 'login';

let selectedRole = null;


function showAuthMode(mode){

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


function chooseRole(role){

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
      (role === 'coach'
        ? 'Coach'
        : 'Player')
      +
      ' '
      +
      (
        authMode === 'login'
          ? 'Log In'
          : 'Sign Up'
      );

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

}


function backRole(){

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
   PASSWORD REQUIREMENTS
========================= */

function validPassword(password){

  return (
    password.length >= 8 &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    /[A-Z]/.test(password)
  );

}


function updatePasswordRules(){

  const input =
    document.getElementById('password');

  if(!input){
    return;
  }

  const p = input.value;

  const rules = [

    [
      'rLength',
      p.length >= 8
    ],

    [
      'rNumber',
      /[0-9]/.test(p)
    ],

    [
      'rSpecial',
      /[^A-Za-z0-9]/.test(p)
    ],

    [
      'rUpper',
      /[A-Z]/.test(p)
    ]

  ];


  rules.forEach(
    ([id, ok]) => {

      const el =
        document.getElementById(id);

      if(!el){
        return;
      }

      const original =
        el.textContent.slice(2);

      el.textContent =
        (ok ? '✓ ' : '○ ')
        +
        original;

      el.classList.toggle(
        'valid',
        ok
      );

    }
  );

}


function msg(text){

  document
    .getElementById('authMessage')
    .textContent = text;

}


/* =========================
   COACH CODE
========================= */

function generateCoachCode(d){

  const letters =
    'ABCDEFGHJKLMNPQRSTUVWXYZ';

  const nums =
    '0123456789';

  let code;

  do{

    code = '';

    for(let i = 0; i < 3; i++){

      code +=
        letters[
          Math.floor(
            Math.random() *
            letters.length
          )
        ];

    }

    for(let i = 0; i < 3; i++){

      code +=
        nums[
          Math.floor(
            Math.random() *
            nums.length
          )
        ];

    }

  }
  while(
    d.users.some(
      u =>
        u.role === 'coach' &&
        u.coachCode.toUpperCase() ===
        code.toUpperCase()
    )
  );

  return code;

}


/* =========================
   SUBMIT LOGIN / SIGNUP
========================= */

function submitAuth(e){

  e.preventDefault();

  const d = data();

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


  /* LOGIN */

  if(authMode === 'login'){

    const user =
      d.users.find(
        x =>
          x.email === email &&
          x.role === selectedRole
      );


    if(
      !user ||
      user.password !== password
    ){

      msg(
        'Incorrect email, password, or account type.'
      );

      return;
    }


    if(selectedRole === 'coach'){

      d.coach =
        user.profile;

      d.coach.logged = true;

      d.player = null;

    }

    else{

      d.player =
        user.profile;

      d.coach.logged = false;

    }


    save(d);

    setSession(selectedRole);

    location.href =
      'dashboard.html';

    return;

  }


  /* SIGN UP */

  if(!name){

    msg(
      'Please enter your name.'
    );

    return;

  }


  if(!validPassword(password)){

    msg(
      'Please meet all password requirements.'
    );

    return;

  }


  const confirm =
    document
      .getElementById('confirmPassword')
      .value;


  if(password !== confirm){

    msg(
      'Passwords do not match.'
    );

    return;

  }


  if(
    d.users.some(
      u =>
        u.email === email
    )
  ){

    msg(
      'An account with this email already exists.'
    );

    return;

  }


  /* COACH SIGNUP */

  if(selectedRole === 'coach'){

    const profile = {

      name,

      code:
        generateCoachCode(d),

      requests: [],

      players: [],

      logged: true

    };


    d.users.push({

      email,

      password,

      role: 'coach',

      coachCode:
        profile.code,

      profile

    });


    d.coach =
      profile;

    d.player =
      null;


    save(d);

    setSession('coach');

    location.href =
      'dashboard.html';

    return;

  }


  /* PLAYER SIGNUP */

  const player = {

    name,

    level: 'Junior',

    focus: 'None',

    coachStatus: 'none',

    connectedCoachId: null,

    matches: []

  };


  let code =
    document
      .getElementById('coachCode')
      .value
      .trim()
      .toUpperCase();


  if(code){

    const coach =
      d.users.find(
        u =>
          u.role === 'coach' &&
          u.coachCode.toUpperCase() ===
          code
      );


    if(!coach){

      msg(
        'That coach connection code was not found.'
      );

      return;

    }


    player.coachStatus =
      'pending';

    player.connectedCoachId =
      coach.email;


    coach.profile.requests =
      coach.profile.requests || [];


    coach.profile.requests.push({

      name: player.name,

      level: player.level,

      email,

      playerId: email

    });

  }


  d.users.push({

    email,

    password,

    role: 'player',

    profile: player

  });


  d.player =
    player;

  d.coach.logged =
    false;


  save(d);

  setSession('player');

  location.href =
    'dashboard.html';

}


/* =========================
   LOGOUT
========================= */

function logout(){

  localStorage.removeItem(
    SESSION_KEY
  );

  const d =
    data();

  d.coach.logged =
    false;

  save(d);

  location.href =
    'login.html';

}


/* =========================
   RESET
========================= */

function resetDemo(){

  localStorage.removeItem(KEY);

  localStorage.removeItem(
    SESSION_KEY
  );

  location.reload();

}


/* =========================
   DASHBOARD
========================= */

function dashboard(){

  const session =
    getSession();


  if(!session){

    location.href =
      'login.html';

    return;

  }


  refreshSession();


  const d =
    current();


  let role =
    session.role;


  document
    .getElementById('profileBox')
    .innerHTML =

    role === 'coach'

      ?

      `
      <b>${esc(d.coach.name)}</b>
      <small>Coach Account</small>
      `

      :

      `
      <b>${esc(d.player?.name || 'Player')}</b>
      <small>Player Account</small>
      `;


  document
    .getElementById('nav')
    .innerHTML =

    role === 'coach'

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


  if(role === 'coach'){

    renderCoach();

  }

  else{

    renderPlayer();

  }

}


function current(){

  return data();

}


/* =========================
   COACH DASHBOARD
========================= */

function renderCoach(){

  const d =
    current();

  const players =
    d.coach.players || [];


  document
    .getElementById('dashboard')
    .innerHTML =

    `
    <div class="eyebrow">
      COACH DASHBOARD
    </div>

    <h1>
      Good coaching starts with better information.
    </h1>

    <p class="sub">
      See your players, their match reports and what needs attention.
    </p>

    <div class="cards">

      <div class="card">
        <h3>Players</h3>
        <div class="stat">
          ${players.length}
        </div>
      </div>

      <div class="card">
        <h3>Pending connections</h3>
        <div class="stat">
          ${d.coach.requests.length}
        </div>
      </div>

      <div class="card">
        <h3>Match reports</h3>
        <div class="stat">
          ${
            players.reduce(
              (a,p) =>
                a +
                (p.matches?.length || 0),
              0
            )
          }
        </div>
      </div>

    </div>

    <div class="card">

      <h3>
        Recent player activity
      </h3>

      ${
        players.length

        ?

        players
          .map(
            p =>

            `
            <div class="row">

              <div>

                <b>
                  ${esc(p.name)}
                </b>

                <div class="muted">
                  ${esc(
                    p.focus ||
                    'No focus set'
                  )}
                </div>

              </div>

              <span class="pill">
                ${
                  p.matches?.length || 0
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

          Share your connection code:

          <div class="code">
            ${d.coach.code}
          </div>

        </div>
        `
      }

    </div>
    `;

}


/* =========================
   PLAYERS
========================= */

function renderPlayers(){

  const d =
    current();

  const players =
    d.coach.players || [];


  document
    .getElementById('dashboard')
    .innerHTML =

    `
    <div class="eyebrow">
      PLAYERS
    </div>

    <h1>
      Your Players
    </h1>

    <p class="sub">
      Every connected player can send match reports directly to you.
    </p>

    <div class="card">

      ${
        players.length

        ?

        players
          .map(
            p =>

            `
            <div class="row">

              <div>

                <b>
                  ${esc(p.name)}
                </b>

                <div class="muted">
                  ${esc(p.level)}
                  · Focus:
                  ${esc(p.focus || 'None')}
                </div>

              </div>

              <span class="pill">

                ${
                  p.matches?.length || 0
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

function renderRequests(){

  const d =
    current();


  document
    .getElementById('dashboard')
    .innerHTML =

    `
    <div class="eyebrow">
      CONNECTIONS
    </div>

    <h1>
      Connect players
    </h1>

    <p class="sub">
      Give this code to your players.
      They enter it when creating their account.
    </p>

    <div class="card">

      <p>
        Your coach connection code
      </p>

      <div class="code">
        ${d.coach.code}
      </div>

    </div>

    <div
      class="card"
      style="margin-top:18px">

      <h3>
        Pending requests
      </h3>

      ${
        d.coach.requests.length

        ?

        d.coach.requests
          .map(
            (p,i) =>

            `
            <div class="row">

              <div>

                <b>
                  ${esc(p.name)}
                </b>

                <div class="muted">
                  ${esc(p.level)}
                </div>

              </div>

              <button
                class="btn primary small"
                onclick="acceptRequest(${i})">

                Accept

              </button>

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
   ACCEPT PLAYER
========================= */

function acceptRequest(i){

  const d =
    current();


  const request =
    d.coach.requests.splice(
      i,
      1
    )[0];


  if(!request){

    return;

  }


  const playerUser =
    d.users.find(
      u =>
        u.role === 'player' &&
        (
          u.email === request.email ||
          u.profile?.name === request.name
        )
    );


  if(!playerUser){

    save(d);

    renderRequests();

    return;

  }


  playerUser.profile.coachStatus =
    'connected';

  playerUser.profile.connectedCoachId =
    d.coach.code;


  d.coach.players.push(
    playerUser.profile
  );


  save(d);

  renderRequests();

}


/* =========================
   PLAYER DASHBOARD
========================= */

function renderPlayer(){

  const d =
    current();

  const p =
    d.player;

  const matches =
    p?.matches || [];


  document
    .getElementById('dashboard')
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
            p.focus || 'None'
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
            p.coachStatus === 'connected'

              ? 'Connected'

              : p.coachStatus === 'pending'

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

          After a match, log the score and what
          you felt were your biggest weaknesses
          and positives.

        </div>
        `
      }

    </div>
    `;

}


/* =========================
   PLAYER MATCH
========================= */

function renderPlayerMatch(){

  document
    .getElementById('dashboard')
    .innerHTML =

    `
    <div class="eyebrow">
      POST-MATCH
    </div>

    <h1>
      Log a match
    </h1>

    <p class="sub">
      You don't need your coach to have watched the match.
      Report what you experienced.
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
          placeholder="What happened in the match?">
        </textarea>

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

function saveMatch(){

  const d =
    current();

  const p =
    d.player;


  const match = {

    result:
      document.getElementById('mr').value,

    opponent:
      document.getElementById('mo').value.trim()
      || 'Unknown',

    date:
      document.getElementById('md').value
      ||
      new Date()
        .toISOString()
        .split('T')[0],

    score:
      document.getElementById('ms').value
      ||
      'Not entered',

    weakness:
      document.getElementById('mw').value,

    positive:
      document.getElementById('mp').value,

    notes:
      document.getElementById('mn').value.trim()

  };


  p.matches =
    p.matches || [];


  p.matches.push(match);


  save(d);


  renderPlayer();

}


/* =========================
   PLAYER CONNECTION
========================= */

function renderPlayerConnection(){

  const d =
    current();

  const p =
    d.player;


  document
    .getElementById('dashboard')
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
          p.coachStatus === 'connected'

            ? 'Connected to your coach'

            : p.coachStatus === 'pending'

            ? 'Connection pending'

            : 'No coach connected'
        }

      </h3>

      <p class="muted">

        ${
          p.coachStatus === 'connected'

            ?

            'Your match reviews are shared with your coach.'

            :

          p.coachStatus === 'pending'

            ?

            'Your coach needs to approve your request.'

            :

            'Ask your coach for their connection code and use it when creating your account.'
        }

      </p>

    </div>
    `;

}


/* =========================
   TENNIS OPTIONS
========================= */

function focusOptions(){

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
      x =>
        `<option>${x}</option>`
    )
    .join('');

}


function positiveOptions(){

  return focusOptions();

}


/* =========================
   MATCH DISPLAY
========================= */

function matchRow(m){

  return `

    <div class="row">

      <div>

        <b>
          ${esc(
            m.opponent ||
            'Unknown'
          )}
        </b>

        <div class="muted">

          ${esc(
            m.date
          )}

          ·

          ${esc(
            m.score
          )}

        </div>

      </div>


      <span
        class="pill ${
          m.result === 'Win'
            ? 'green'
            : 'red'
        }">

        ${esc(m.result)}

      </span>


      <div>

        Weakness:

        <b>
          ${esc(
            m.weakness
          )}
        </b>

      </div>


      <div>

        Positive:

        <b>
          ${esc(
            m.positive
          )}
        </b>

      </div>

    </div>

  `;

}


/* =========================
   SECURITY / HTML ESCAPING
========================= */

function esc(s){

  return String(
    s ?? ''
  ).replace(
    /[&<>"']/g,

    c => ({

      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'

    }[c])

  );

}


/* =========================
   START DASHBOARD
========================= */

if(
  document.getElementById(
    'dashboard'
  )
){

  dashboard();

}
