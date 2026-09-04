/* =====================================================
   TENNISPILOT
   Connected Coach + Player Demo
===================================================== */


const STORAGE_KEY =
    "tennisPilotLinkedDemo";


/* =====================================================
   DEFAULT DATA
===================================================== */

const defaultData = {

    coach: {

        name: "Coach Demo",

        code: "MYK7P2",

        logged: false,

        requests: [],

        players: []

    },

    player: null

};


/* =====================================================
   STORAGE
===================================================== */

function getData() {

    const saved =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!saved) {

        return JSON.parse(
            JSON.stringify(defaultData)
        );

    }


    return JSON.parse(saved);

}


function saveData(data) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );

}


/* =====================================================
   LOGIN
===================================================== */

let selectedRole = null;


function chooseRole(role) {

    selectedRole = role;


    document
        .getElementById("roleStep")
        .classList
        .add("hidden");


    document
        .getElementById("loginForm")
        .classList
        .remove("hidden");


    document
        .getElementById("loginTitle")
        .textContent =
        role === "coach"
            ? "Create your coach account"
            : "Create your player account";


    document
        .getElementById("codeWrap")
        .classList
        .toggle(
            "hidden",
            role !== "player"
        );

}


function backRole() {

    document
        .getElementById("roleStep")
        .classList
        .remove("hidden");


    document
        .getElementById("loginForm")
        .classList
        .add("hidden");

}


function demoLogin(event) {

    event.preventDefault();


    const data = getData();


    const name =
        document
            .getElementById("name")
            .value
            .trim();


    if (selectedRole === "coach") {

        data.coach.name =
            name;


        data.coach.logged =
            true;


        data.player =
            null;


        saveData(data);


        window.location.href =
            "dashboard.html";


        return;

    }


    /* =========================
       PLAYER
    ========================= */

    const player = {

        name: name,

        level: "Competitive Player",

        focus: "None",

        coachStatus: "none",

        matches: []

    };


    const code =
        document
            .getElementById("coachCode")
            .value
            .trim()
            .toUpperCase();


    if (code === data.coach.code) {

        player.coachStatus =
            "pending";


        data.coach.requests.push(
            player
        );

    }


    data.player =
        player;


    saveData(data);


    window.location.href =
        "dashboard.html";

}


/* =====================================================
   RESET
===================================================== */

function resetDemo() {

    localStorage.removeItem(
        STORAGE_KEY
    );


    window.location.reload();

}


/* =====================================================
   DASHBOARD INITIALIZATION
===================================================== */

function initializeDashboard() {

    const dashboard =
        document.getElementById(
            "dashboard"
        );


    if (!dashboard) {

        return;

    }


    const data =
        getData();


    const isCoach =
        data.coach.logged === true;


    const profileBox =
        document.getElementById(
            "profileBox"
        );


    if (isCoach) {

        profileBox.innerHTML = `

            <b>
                ${escapeHTML(
                    data.coach.name
                )}
            </b>

            <small>
                Coach Account
            </small>

        `;

    } else {

        profileBox.innerHTML = `

            <b>
                ${escapeHTML(
                    data.player?.name ||
                    "Player"
                )}
            </b>

            <small>
                Player Account
            </small>

        `;

    }


    const nav =
        document.getElementById(
            "nav"
        );


    if (isCoach) {

        nav.innerHTML = `

            <button
                class="active"
                onclick="renderCoach()"
            >
                ▦ Overview
            </button>

            <button
                onclick="renderPlayers()"
            >
                ♟ Players
            </button>

            <button
                onclick="renderRequests()"
            >
                🔗 Connections
            </button>

            <button
                onclick="renderCoachMatches()"
            >
                🎾 Match Reviews
            </button>

        `;


        renderCoach();

    } else {

        nav.innerHTML = `

            <button
                class="active"
                onclick="renderPlayer()"
            >
                ▦ My Dashboard
            </button>

            <button
                onclick="renderPlayerMatch()"
            >
                🎾 Log Match
            </button>

            <button
                onclick="renderPlayerHistory()"
            >
                📋 Match History
            </button>

            <button
                onclick="renderPlayerConnection()"
            >
                🔗 My Coach
            </button>

        `;


        renderPlayer();

    }

}


/* =====================================================
   COACH OVERVIEW
===================================================== */

function renderCoach() {

    const data =
        getData();


    const players =
        data.coach.players || [];


    const matchCount =
        players.reduce(
            (total, player) => {

                return total +
                    (
                        player.matches?.length ||
                        0
                    );

            },
            0
        );


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            COACH DASHBOARD
        </div>

        <h1>
            Good coaching starts
            with better information.
        </h1>

        <p class="sub">
            See your players, their matches
            and what needs attention.
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
                    Pending Connections
                </h3>

                <div class="stat">
                    ${data.coach.requests.length}
                </div>

            </div>


            <div class="card">

                <h3>
                    Match Reports
                </h3>

                <div class="stat">
                    ${matchCount}
                </div>

            </div>


        </div>


        <div class="card">

            <h3>
                Your Players
            </h3>


            ${
                players.length

                ? players
                    .map(playerCard)
                    .join("")

                : `

                    <div class="empty">

                        <p>
                            No players connected yet.
                        </p>

                        <p>
                            Give players your connection code:
                        </p>

                        <div class="code">
                            ${data.coach.code}
                        </div>

                    </div>

                `
            }

        </div>

    `;

}


/* =====================================================
   PLAYER CARD
===================================================== */

function playerCard(player) {

    const matches =
        player.matches || [];


    const lastMatch =
        matches.length
            ? matches[matches.length - 1]
            : null;


    return `

        <div class="row">

            <div class="row-main">

                <b>
                    ${escapeHTML(
                        player.name
                    )}
                </b>

                <div class="row-details">

                    ${escapeHTML(
                        player.level
                    )}

                    · Focus:

                    ${escapeHTML(
                        player.focus ||
                        "None"
                    )}

                </div>

            </div>


            <span class="pill">

                ${matches.length}
                ${
                    matches.length === 1
                        ? "match"
                        : "matches"
                }

            </span>


            ${
                lastMatch

                ? `

                    <span
                        class="pill
                        ${
                            lastMatch.result === "Win"
                                ? "green"
                                : "red"
                        }"
                    >

                        Last:
                        ${escapeHTML(
                            lastMatch.result
                        )}

                    </span>

                `

                : ""

            }

        </div>

    `;

}


/* =====================================================
   PLAYERS
===================================================== */

function renderPlayers() {

    const data =
        getData();


    const players =
        data.coach.players || [];


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            PLAYERS
        </div>

        <h1>
            Your Players
        </h1>

        <p class="sub">
            Every connected player can send
            match reports directly to you.
        </p>


        <div class="card">

            ${
                players.length

                ? players
                    .map(detailedPlayerCard)
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


function detailedPlayerCard(player) {

    const matches =
        player.matches || [];


    return `

        <div class="row">

            <div class="row-main">

                <b>
                    ${escapeHTML(
                        player.name
                    )}
                </b>

                <div class="row-details">

                    Level:
                    ${escapeHTML(
                        player.level
                    )}

                    <br>

                    Current Focus:
                    <b>
                        ${escapeHTML(
                            player.focus ||
                            "None"
                        )}
                    </b>

                </div>

            </div>


            <span class="pill">

                ${matches.length}
                ${
                    matches.length === 1
                        ? "match"
                        : "matches"
                }

            </span>


            <button
                class="btn ghost small"
                onclick="renderCoachPlayerHistory(
                    '${encodeURIComponent(
                        player.name
                    )}'
                )"
            >

                View History

            </button>

        </div>

    `;

}


/* =====================================================
   COACH PLAYER HISTORY
===================================================== */

function renderCoachPlayerHistory(encodedName) {

    const playerName =
        decodeURIComponent(
            encodedName
        );


    const data =
        getData();


    const player =
        data.coach.players.find(
            p =>
                p.name === playerName
        );


    if (!player) {

        return;

    }


    const matches =
        player.matches || [];


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            PLAYER HISTORY
        </div>

        <h1>
            ${escapeHTML(
                player.name
            )}
        </h1>

        <p class="sub">

            Complete match history.
            Nothing is automatically deleted.

        </p>


        ${renderYearlyHistory(matches)}

    `;

}


/* =====================================================
   CONNECTIONS
===================================================== */

function renderRequests() {

    const data =
        getData();


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            CONNECTIONS
        </div>

        <h1>
            Connect Players
        </h1>

        <p class="sub">
            Give your players this code.
            They enter it when creating their account.
        </p>


        <div class="card">

            <p>
                Your Coach Connection Code
            </p>

            <div class="code">
                ${data.coach.code}
            </div>

        </div>


        <div
            class="card"
            style="margin-top:18px"
        >

            <h3>
                Pending Requests
            </h3>


            ${
                data.coach.requests.length

                ? data.coach.requests
                    .map(
                        requestRow
                    )
                    .join("")

                : `

                    <div class="empty">

                        No pending connection requests.

                    </div>

                `
            }

        </div>

    `;

}


function requestRow(
    player,
    index
) {

    return `

        <div class="row">

            <div class="row-main">

                <b>
                    ${escapeHTML(
                        player.name
                    )}
                </b>

                <div class="row-details">

                    ${escapeHTML(
                        player.level
                    )}

                </div>

            </div>


            <button
                class="btn primary small"
                onclick="acceptRequest(${index})"
            >

                Accept

            </button>

        </div>

    `;

}


function acceptRequest(index) {

    const data =
        getData();


    const player =
        data.coach.requests
            .splice(index, 1)[0];


    if (!player) {

        return;

    }


    player.coachStatus =
        "connected";


    data.coach.players.push(
        player
    );


    if (
        data.player &&
        data.player.name ===
        player.name
    ) {

        data.player.coachStatus =
            "connected";

    }


    saveData(data);


    renderRequests();

}


/* =====================================================
   COACH MATCH REVIEWS
===================================================== */

function renderCoachMatches() {

    const data =
        getData();


    const players =
        data.coach.players || [];


    const allMatches = [];


    players.forEach(
        player => {

            (
                player.matches || []
            ).forEach(
                match => {

                    allMatches.push({

                        ...match,

                        playerName:
                            player.name

                    });

                }
            );

        }
    );


    allMatches.sort(
        (a, b) =>
            new Date(b.timestamp) -
            new Date(a.timestamp)
    );


    const recent =
        allMatches.slice(0, 5);


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            MATCH REVIEWS
        </div>

        <h1>
            Recent Match Reviews
        </h1>

        <p class="sub">
            The five most recent player-submitted
            matches are shown here.
        </p>


        <div class="card">

            ${
                recent.length

                ? recent
                    .map(
                        coachMatchRow
                    )
                    .join("")

                : `

                    <div class="empty">

                        No match reviews yet.

                    </div>

                `
            }

        </div>


        ${
            allMatches.length > 5

            ? `

                <div class="notice">

                    Showing the 5 most recent matches.

                    <br><br>

                    To see a player's complete
                    history, go to
                    <b>Players → View History</b>.

                </div>

            `

            : ""

        }

    `;

}


function coachMatchRow(match) {

    return `

        <div class="match-card">

            <div class="match-top">

                <div>

                    <div class="match-opponent">

                        ${escapeHTML(
                            match.playerName
                        )}

                        vs.

                        ${escapeHTML(
                            match.opponent ||
                            "Unknown Opponent"
                        )}

                    </div>


                    <div class="match-meta">

                        ${escapeHTML(
                            match.date
                        )}

                        ·

                        ${escapeHTML(
                            match.score
                        )}

                    </div>

                </div>


                <span
                    class="pill
                    ${
                        match.result === "Win"
                            ? "green"
                            : "red"
                    }"
                >

                    ${escapeHTML(
                        match.result
                    )}

                </span>

            </div>


            <div class="match-details">

                <div class="match-detail">

                    <span>
                        Biggest Weakness
                    </span>

                    <b>
                        ${escapeHTML(
                            match.weakness
                        )}
                    </b>

                </div>


                <div class="match-detail">

                    <span>
                        Biggest Positive
                    </span>

                    <b>
                        ${escapeHTML(
                            match.positive
                        )}
                    </b>

                </div>

            </div>

        </div>

    `;

}


/* =====================================================
   PLAYER DASHBOARD
===================================================== */

function renderPlayer() {

    const data =
        getData();


    const player =
        data.player;


    if (!player) {

        return;

    }


    const matches =
        player.matches || [];


    const recent =
        matches
            .slice()
            .reverse()
            .slice(0, 5);


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            PLAYER DASHBOARD
        </div>

        <h1>
            Welcome,
            ${escapeHTML(
                player.name
            )}.
        </h1>

        <p class="sub">
            Your match feedback goes directly
            to your connected coach.
        </p>


        <div class="cards">


            <div class="card">

                <h3>
                    Current Focus
                </h3>

                <div
                    class="stat"
                    style="font-size:24px"
                >

                    ${escapeHTML(
                        player.focus ||
                        "None"
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
                    style="font-size:20px"
                >

                    ${
                        player.coachStatus ===
                        "connected"

                        ? escapeHTML(
                            data.coach.name
                        )

                        : player.coachStatus ===
                          "pending"

                        ? "Pending"

                        : "Not Connected"
                    }

                </div>

            </div>

        </div>


        <div class="card">

            <h3>
                Recent Matches
            </h3>


            ${
                recent.length

                ? recent
                    .map(
                        playerMatchRow
                    )
                    .join("")

                : `

                    <div class="empty">

                        No matches logged yet.

                        <br><br>

                        After a match, log the
                        opponent, score, positives
                        and weaknesses.

                    </div>

                `
            }


            ${
                matches.length > 5

                ? `

                    <button
                        class="btn ghost"
                        style="margin-top:15px"
                        onclick="renderPlayerHistory()"
                    >

                        View Full Match History →

                    </button>

                `

                : ""

            }

        </div>

    `;

}


/* =====================================================
   PLAYER MATCH ROW
===================================================== */

function playerMatchRow(match) {

    return `

        <div class="match-card">

            <div class="match-top">

                <div>

                    <div class="match-opponent">

                        vs.
                        ${escapeHTML(
                            match.opponent ||
                            "Unknown Opponent"
                        )}

                    </div>

                    <div class="match-meta">

                        ${escapeHTML(
                            match.date
                        )}

                        ·

                        ${escapeHTML(
                            match.score
                        )}

                    </div>

                </div>


                <span
                    class="pill
                    ${
                        match.result === "Win"
                            ? "green"
                            : "red"
                    }"
                >

                    ${escapeHTML(
                        match.result
                    )}

                </span>

            </div>


            <div class="match-details">

                <div class="match-detail">

                    <span>
                        Biggest Weakness
                    </span>

                    <b>
                        ${escapeHTML(
                            match.weakness
                        )}
                    </b>

                </div>


                <div class="match-detail">

                    <span>
                        Biggest Positive
                    </span>

                    <b>
                        ${escapeHTML(
                            match.positive
                        )}
                    </b>

                </div>

            </div>

        </div>

    `;

}


/* =====================================================
   PLAYER FULL HISTORY
===================================================== */

function renderPlayerHistory() {

    const data =
        getData();


    const player =
        data.player;


    if (!player) {

        return;

    }


    const matches =
        player.matches || [];


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            MATCH HISTORY
        </div>

        <h1>
            ${escapeHTML(
                player.name
            )}
        </h1>

        <p class="sub">

            Your complete match history,
            organized by year.

        </p>


        ${
            renderYearlyHistory(
                matches
            )
        }

    `;

}


/* =====================================================
   YEARLY HISTORY
===================================================== */

function renderYearlyHistory(matches) {

    if (!matches.length) {

        return `

            <div class="empty">

                No matches have been recorded yet.

            </div>

        `;

    }


    const grouped = {};


    matches.forEach(
        match => {

            const date =
                new Date(
                    match.timestamp
                );


            const year =
                isNaN(date.getTime())
                    ? "Unknown Year"
                    : date.getFullYear();


            if (!grouped[year]) {

                grouped[year] = [];

            }


            grouped[year].push(
                match
            );

        }
    );


    const years =
        Object.keys(grouped)
            .sort(
                (a, b) =>
                    Number(b) -
                    Number(a)
            );


    return years
        .map(
            year => {

                const yearMatches =
                    grouped[year];


                const wins =
                    yearMatches.filter(
                        m =>
                            m.result ===
                            "Win"
                    ).length;


                const losses =
                    yearMatches.filter(
                        m =>
                            m.result ===
                            "Loss"
                    ).length;


                const total =
                    yearMatches.length;


                const winRate =
                    total
                        ? Math.round(
                            (
                                wins /
                                total
                            ) * 100
                        )
                        : 0;


                return `

                    <div class="year-section">


                        <div class="year-header">

                            <h2>
                                ${escapeHTML(
                                    year
                                )}
                            </h2>


                            <div class="year-stats">

                                <span
                                    class="year-stat"
                                >

                                    ${total}
                                    Matches

                                </span>


                                <span
                                    class="year-stat"
                                >

                                    ${wins} Wins

                                </span>


                                <span
                                    class="year-stat"
                                >

                                    ${losses} Losses

                                </span>


                                <span
                                    class="year-stat"
                                >

                                    ${winRate}%
                                    Win Rate

                                </span>

                            </div>

                        </div>


                        ${

                            yearMatches
                                .slice()
                                .sort(
                                    (a, b) =>
                                        new Date(
                                            b.timestamp
                                        ) -
                                        new Date(
                                            a.timestamp
                                        )
                                )
                                .map(
                                    historyMatchCard
                                )
                                .join("")

                        }

                    </div>

                `;

            }
        )
        .join("");

}


/* =====================================================
   HISTORY MATCH CARD
===================================================== */

function historyMatchCard(match) {

    return `

        <div class="match-card">

            <div class="match-top">


                <div>

                    <div class="match-opponent">

                        vs.
                        ${escapeHTML(
                            match.opponent ||
                            "Unknown Opponent"
                        )}

                    </div>


                    <div class="match-meta">

                        ${escapeHTML(
                            match.date
                        )}

                        ·

                        ${escapeHTML(
                            match.score
                        )}

                    </div>

                </div>


                <span
                    class="pill
                    ${
                        match.result === "Win"
                            ? "green"
                            : "red"
                    }"
                >

                    ${escapeHTML(
                        match.result
                    )}

                </span>


            </div>


            <div class="match-details">


                <div class="match-detail">

                    <span>
                        Biggest Weakness
                    </span>

                    <b>
                        ${escapeHTML(
                            match.weakness
                        )}
                    </b>

                </div>


                <div class="match-detail">

                    <span>
                        Biggest Positive
                    </span>

                    <b>
                        ${escapeHTML(
                            match.positive
                        )}
                    </b>

                </div>


                <div class="match-detail">

                    <span>
                        Notes
                    </span>

                    <b>
                        ${
                            escapeHTML(
                                match.notes ||
                                "No notes"
                            )
                        }
                    </b>

                </div>


            </div>

        </div>

    `;

}


/* =====================================================
   PLAYER MATCH FORM
===================================================== */

function renderPlayerMatch() {

    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            POST-MATCH
        </div>

        <h1>
            Log a Match
        </h1>

        <p class="sub">

            Your coach doesn't have to be
            at the match. Tell them what
            you experienced.

        </p>


        <div class="card">


            <label>

                Opponent

                <input
                    id="matchOpponent"
                    placeholder="Opponent's name"
                    required
                >

            </label>


            <label>

                Result

                <select id="matchResult">

                    <option value="Win">
                        Win
                    </option>

                    <option value="Loss">
                        Loss
                    </option>

                </select>

            </label>


            <label>

                Score

                <input
                    id="matchScore"
                    placeholder="6-3, 6-4"
                >

            </label>


            <label>

                Biggest Weakness

                <select id="matchWeakness">

                    ${focusOptions()}

                </select>

            </label>


            <label>

                Biggest Positive

                <select id="matchPositive">

                    ${positiveOptions()}

                </select>

            </label>


            <label>

                Match Notes

                <textarea
                    id="matchNotes"
                    rows="5"
                    placeholder="What happened? What felt good? What caused problems?"
                ></textarea>

            </label>


            <button
                class="btn primary"
                onclick="saveMatch()"
            >

                Submit Match Review

            </button>

        </div>

    `;

}


/* =====================================================
   SAVE MATCH
===================================================== */

function saveMatch() {

    const data =
        getData();


    const player =
        data.player;


    if (!player) {

        return;

    }


    const opponent =
        document
            .getElementById(
                "matchOpponent"
            )
            .value
            .trim();


    if (!opponent) {

        alert(
            "Please enter the opponent's name."
        );

        return;

    }


    const result =
        document
            .getElementById(
                "matchResult"
            )
            .value;


    const score =
        document
            .getElementById(
                "matchScore"
            )
            .value
            .trim();


    const weakness =
        document
            .getElementById(
                "matchWeakness"
            )
            .value;


    const positive =
        document
            .getElementById(
                "matchPositive"
            )
            .value;


    const notes =
        document
            .getElementById(
                "matchNotes"
            )
            .value
            .trim();


    const now =
        new Date();


    const match = {

        opponent:
            opponent,

        result:
            result,

        score:
            score ||
            "Not entered",

        weakness:
            weakness,

        positive:
            positive,

        notes:
            notes,

        date:
            now.toLocaleDateString(),

        timestamp:
            now.toISOString()

    };


    if (!player.matches) {

        player.matches = [];

    }


    /*
        IMPORTANT:
        We push the match into the
        permanent history.

        Nothing automatically gets deleted.
    */

    player.matches.push(
        match
    );


    /*
        Update matching player
        inside coach account.
    */

    const coachPlayer =
        data.coach.players.find(
            p =>
                p.name ===
                player.name
        );


    if (coachPlayer) {

        coachPlayer.matches =
            player.matches;

    }


    saveData(data);


    renderPlayer();

}


/* =====================================================
   PLAYER CONNECTION
===================================================== */

function renderPlayerConnection() {

    const data =
        getData();


    const player =
        data.player;


    document.getElementById(
        "dashboard"
    ).innerHTML = `

        <div class="eyebrow">
            MY COACH
        </div>

        <h1>
            Coach Connection
        </h1>


        <div class="card">

            ${
                player.coachStatus ===
                "connected"

                ? `

                    <h3>

                        ${escapeHTML(
                            data.coach.name
                        )}

                    </h3>

                    <p class="muted">

                        🟢 Connected

                    </p>

                    <p>

                        Your match reviews are
                        shared with your coach.

                    </p>

                `

                :

                player.coachStatus ===
                "pending"

                ? `

                    <h3>
                        Connection Pending
                    </h3>

                    <p class="muted">

                        🟡 Waiting for your coach
                        to approve the connection.

                    </p>

                `

                : `

                    <h3>
                        No Coach Connected
                    </h3>

                    <p class="muted">

                        Ask your coach for their
                        connection code.

                    </p>

                `
            }

        </div>

    `;

}


/* =====================================================
   FOCUS OPTIONS
===================================================== */

function focusOptions() {

    const options = [

        "None",

        /* Technical */

        "Serve",
        "Return",
        "Forehand",
        "Backhand",
        "Volley",
        "Overhead",
        "Slice",
        "Drop Shot",
        "Approach Shot",
        "Passing Shot",

        /* Consistency */

        "Rally Consistency",
        "Shot Depth",
        "Directional Control",
        "Reducing Unforced Errors",
        "Playing Under Pressure",

        /* Movement */

        "Footwork",
        "Court Positioning",
        "Recovery Position",
        "Movement to the Ball",
        "Transition Movement",

        /* Tactical */

        "Point Construction",
        "Serve + 1",
        "Return + 1",
        "Attacking Short Balls",
        "Defending",
        "Net Play",
        "Shot Selection",
        "Opponent Patterns",
        "Match Strategy",

        /* Mental */

        "Confidence",
        "Focus",
        "Decision Making",
        "Competing Under Pressure",
        "Between-Point Routine",
        "Match Preparation",

        /* Physical */

        "Speed",
        "Agility",
        "Endurance",
        "Explosiveness",
        "Mobility",

        /* Other */

        "Match Fitness",
        "Tournament Preparation",
        "Overall Game"

    ];


    return options
        .map(
            option => `

                <option
                    value="${escapeHTML(
                        option
                    )}"
                >

                    ${escapeHTML(
                        option
                    )}

                </option>

            `
        )
        .join("");

}


function positiveOptions() {

    return focusOptions();

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        character => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"

        })[character]
    );

}


/* =====================================================
   START
===================================================== */

if (
    document.getElementById(
        "dashboard"
    )
) {

    initializeDashboard();

}
