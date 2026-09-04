const STORAGE_KEY = "tennispilot_coach_v2";


const defaultData = {

  players: [

    {
      id: 1,
      name: "Alex Morgan",
      level: "Competitive",
      focus: "Return Depth",
      note: "Short returns have appeared repeatedly in recent matches.",
      completion: 72,
      attention: true,
      goal: "70%+ deep returns"
    },

    {
      id: 2,
      name: "Jordan Lee",
      level: "Advanced",
      focus: "Serve +1",
      note: "Serve is improving. Keep building the first-ball pattern.",
      completion: 84,
      attention: false,
      goal: "Win more first-ball points"
    },

    {
      id: 3,
      name: "Chris Wilson",
      level: "Junior",
      focus: "Movement",
      note: "Needs better recovery after wide balls.",
      completion: 61,
      attention: true,
      goal: "Recover to neutral faster"
    }

  ],


  matches: [

    {
      player: "Alex Morgan",
      result: "Win",
      score: "6-4, 7-5",
      positive: "Serve +1",
      problem: "Return",
      notes: "Short returns created pressure."
    },

    {
      player: "Jordan Lee",
      result: "Loss",
      score: "4-6, 6-7",
      positive: "Forehand",
      problem: "Decision Making",
      notes: "Too many low-percentage attacks."
    },

    {
      player: "Chris Wilson",
      result: "Win",
      score: "6-3, 6-4",
      positive: "Backhand",
      problem: "Movement",
      notes: "Late recovery on wide balls."
    }

  ],


  sessions: [

    {
      player: "Alex Morgan",
      name: "Return Depth Fundamentals",
      duration: "20 min",
      intensity: "Medium",
      done: true
    },

    {
      player: "Jordan Lee",
      name: "Serve +1 Pattern",
      duration: "30 min",
      intensity: "High",
      done: true
    },

    {
      player: "Chris Wilson",
      name: "Recovery Movement Drill",
      duration: "20 min",
      intensity: "Medium",
      done: false
    },

    {
      player: "Alex Morgan",
      name: "Return Under Pressure",
      duration: "25 min",
      intensity: "High",
      done: false
    }

  ]

};


let data = loadData();



function loadData() {

  try {

    return JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    ) || structuredClone(defaultData);

  }

  catch (error) {

    return structuredClone(defaultData);

  }

}



function saveData() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );

}



function initials(name) {

  return name
    .split(" ")
    .map(x => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

}



function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}



document.addEventListener(
  "DOMContentLoaded",
  () => {


    const panels =
      document.querySelectorAll(".panel");


    const links =
      document.querySelectorAll(".side-link");


    const title =
      document.getElementById("pageTitle");


    const subtitle =
      document.getElementById("pageSubtitle");



    function showPanel(id) {

      panels.forEach(panel => {

        panel.classList.remove("active");

      });


      links.forEach(link => {

        link.classList.remove("active");

      });


      document
        .getElementById(id)
        ?.classList.add("active");


      document
        .querySelector(
          `[data-panel="${id}"]`
        )
        ?.classList.add("active");



      const titles = {

        overview:
          "Good afternoon, Coach.",

        players:
          "Your Players",

        matches:
          "Match Reviews",

        training:
          "Training Plans",

        progress:
          "Player Progress"

      };



      const subtitles = {

        overview:
          "Here's what needs your attention.",

        players:
          "Add your players and manage their development.",

        matches:
          "Turn competition into useful coaching information.",

        training:
          "Connect sessions to each player's development priorities.",

        progress:
          "Track development across your roster."

      };



      if (title) {

        title.textContent =
          titles[id] || "TennisPilot";

      }



      if (subtitle) {

        subtitle.textContent =
          subtitles[id] || "";

      }



      render();

    }



    links.forEach(link => {

      link.addEventListener(
        "click",
        () => {

          showPanel(
            link.dataset.panel
          );

        }
      );

    });



    document
      .querySelectorAll("[data-panel-target]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            showPanel(
              button.dataset.panelTarget
            );

          }
        );

      });



    function openModal(id) {

      fillPlayerSelects();

      document
        .getElementById(id)
        ?.classList.add("open");

    }



    function closeModal(id) {

      document
        .getElementById(id)
        ?.classList.remove("open");

    }



    document
      .querySelectorAll("[data-close]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            closeModal(
              button.dataset.close
            );

          }
        );

      });



    document
      .querySelectorAll(".modal-overlay")
      .forEach(modal => {

        modal.addEventListener(
          "click",
          event => {

            if (
              event.target === modal
            ) {

              closeModal(modal.id);

            }

          }
        );

      });



    document
      .getElementById("addPlayerBtn")
      ?.addEventListener(
        "click",
        () => openModal("playerModal")
      );



    document
      .getElementById("addPlayerTop")
      ?.addEventListener(
        "click",
        () => openModal("playerModal")
      );



    document
      .getElementById("addMatchBtn")
      ?.addEventListener(
        "click",
        () => openModal("matchModal")
      );



    document
      .getElementById("addSessionBtn")
      ?.addEventListener(
        "click",
        () => openModal("sessionModal")
      );



    /* ADD PLAYER */

    document
      .getElementById("playerForm")
      ?.addEventListener(
        "submit",
        event => {

          event.preventDefault();


          const player = {

            id: Date.now(),

            name:
              document
                .getElementById("playerName")
                .value
                .trim(),

            level:
              document
                .getElementById("playerLevel")
                .value,

            focus:
              document
                .getElementById("playerFocus")
                .value,

            note:
              document
                .getElementById("playerNote")
                .value
                .trim(),

            completion: 0,

            attention: true,

            goal:
              "Set a development goal"

          };


          if (!player.name) {

            return;

          }


          data.players.push(player);


          saveData();


          event.target.reset();


          closeModal("playerModal");


          showPanel("players");

        }
      );



    /* ADD MATCH */

    document
      .getElementById("matchForm")
      ?.addEventListener(
        "submit",
        event => {

          event.preventDefault();


          const player =
            document.getElementById(
              "matchPlayer"
            ).value;


          const result =
            document.getElementById(
              "matchResult"
            ).value;


          const score =
            document.getElementById(
              "matchScore"
            ).value;


          const positive =
            document.getElementById(
              "matchPositive"
            ).value;


          const problem =
            document.getElementById(
              "matchProblem"
            ).value;


          const notes =
            document.getElementById(
              "matchNotes"
            ).value;



          data.matches.unshift({

            player,

            result,

            score,

            positive,

            problem,

            notes

          });



          const selectedPlayer =
            data.players.find(
              p => p.name === player
            );


          if (selectedPlayer) {

            selectedPlayer.focus =
              problem;

            selectedPlayer.attention =
              true;

          }



          saveData();


          event.target.reset();


          closeModal("matchModal");


          showPanel("matches");

        }
      );



    /* ADD SESSION */

    document
      .getElementById("sessionForm")
      ?.addEventListener(
        "submit",
        event => {

          event.preventDefault();


          data.sessions.push({

            player:
              document
                .getElementById("sessionPlayer")
                .value,

            name:
              document
                .getElementById("sessionName")
                .value
                .trim(),

            duration:
              document
                .getElementById("sessionDuration")
                .value,

            intensity:
              document
                .getElementById("sessionIntensity")
                .value,

            done: false

          });



          saveData();


          event.target.reset();


          closeModal("sessionModal");


          showPanel("training");

        }
      );



    /* RESET */

    document
      .getElementById("resetDemo")
      ?.addEventListener(
        "click",
        () => {

          if (
            confirm(
              "Reset all demo data and remove your added players?"
            )
          ) {

            data =
              structuredClone(
                defaultData
              );


            saveData();


            showPanel("overview");

          }

        }
      );



    function fillPlayerSelects() {

      [
        "matchPlayer",
        "sessionPlayer"
      ]

      .forEach(id => {

        const select =
          document.getElementById(id);


        if (!select) {

          return;

        }


        const oldValue =
          select.value;


        select.innerHTML =
          data.players
            .map(
              player =>
                `<option>${escapeHTML(
                  player.name
                )}</option>`
            )
            .join("");


        if (
          data.players.some(
            player =>
              player.name === oldValue
          )
        ) {

          select.value =
            oldValue;

        }

      });

    }



    function render() {

      fillPlayerSelects();


      const playerCount =
        document.getElementById(
          "playerCount"
        );


      const attentionCount =
        document.getElementById(
          "attentionCount"
        );


      const completion =
        data.players.length

          ? Math.round(
              data.players.reduce(
                (total, player) =>
                  total + player.completion,
                0
              ) / data.players.length
            )

          : 0;



      if (playerCount) {

        playerCount.textContent =
          data.players.length;

      }



      if (attentionCount) {

        attentionCount.textContent =
          data.players.filter(
            player =>
              player.attention
          ).length;

      }



      const overall =
        document.getElementById(
          "overallCompletion"
        );


      if (overall) {

        overall.textContent =
          completion + "%";

      }



      const sessions =
        document.getElementById(
          "sessionCount"
        );


      if (sessions) {

        sessions.textContent =
          data.sessions.length;

      }



      const goals =
        document.getElementById(
          "goalCount"
        );


      if (goals) {

        goals.textContent =
          data.players.length + 2;

      }



      renderAttention();

      renderPlayers();

      renderMatches();

      renderSessions();

      renderProgress();

    }



    function renderAttention() {

      const element =
        document.getElementById(
          "attentionList"
        );


      if (!element) {

        return;

      }



      const players =
        data.players.filter(
          player =>
            player.attention
        );



      if (!players.length) {

        element.innerHTML =
          `<p style="color:#748095;font-size:13px">
            No players need attention.
          </p>`;

        return;

      }



      element.innerHTML =
        players

          .map(
            player => `

              <div class="attention-item">

                <div>

                  <strong>
                    ${escapeHTML(
                      player.name
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      player.focus
                    )}
                    ·
                    ${player.completion}%
                    training completion
                  </span>

                </div>

                <span class="alert-pill">
                  ATTENTION
                </span>

              </div>

            `
          )

          .join("");

    }



    function playerCard(player) {

      return `

        <div class="player-card">

          <div class="player-top">

            <div class="player-avatar">

              ${initials(
                player.name
              )}

            </div>

            <div>

              <h3>
                ${escapeHTML(
                  player.name
                )}
              </h3>

              <span class="level">

                ${escapeHTML(
                  player.level
                )}

              </span>

            </div>

          </div>


          <div class="focus-box">

            CURRENT FOCUS

            <b>
              ${escapeHTML(
                player.focus
              )}
            </b>

          </div>


          <div class="team-row">

            <span>
              Training completion
            </span>

            <b>
              ${player.completion}%
            </b>

          </div>


          <div class="bar">

            <i
              style="width:${player.completion}%"
            ></i>

          </div>


          <div class="focus-box">

            <span>
              GOAL
            </span>

            <b>
              ${escapeHTML(
                player.goal
              )}
            </b>

          </div>

        </div>

      `;

    }



    function renderPlayers() {

      const overview =
        document.getElementById(
          "overviewPlayers"
        );


      const playerGrid =
        document.getElementById(
          "playerGrid"
        );


      if (overview) {

        overview.innerHTML =
          data.players
            .map(playerCard)
            .join("");

      }


      if (playerGrid) {

        playerGrid.innerHTML =
          data.players
            .map(playerCard)
            .join("");

      }

    }



    function renderMatches() {

      const element =
        document.getElementById(
          "matchList"
        );


      if (!element) {

        return;

      }



      if (!data.matches.length) {

        element.innerHTML =
          `<div style="padding:25px;color:#748095">
            No matches yet.
          </div>`;

        return;

      }



      element.innerHTML =
        data.matches

          .map(
            match => `

              <div class="match-item">

                <div class="match-player">

                  <strong>
                    ${escapeHTML(
                      match.player
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      match.score
                    )}
                  </span>

                </div>


                <div>

                  <span class="${
                    match.result === "Win"
                      ? "result-win"
                      : "result-loss"
                  }">

                    ${escapeHTML(
                      match.result
                    )}

                  </span>

                </div>


                <div>

                  <span>
                    MAIN PROBLEM
                  </span>

                  <strong>
                    ${escapeHTML(
                      match.problem
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    POSITIVE
                  </span>

                  <strong>
                    ${escapeHTML(
                      match.positive
                    )}
                  </strong>

                </div>

              </div>

            `
          )

          .join("");

    }



    function renderSessions() {

      const element =
        document.getElementById(
          "trainingList"
        );


      if (!element) {

        return;

      }



      element.innerHTML =
        data.sessions

          .map(
            (session, index) => `

              <div class="training-row">

                <div>

                  <strong>
                    ${escapeHTML(
                      session.player
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      session.name
                    )}
                  </span>

                </div>


                <div>

                  <span>
                    ${escapeHTML(
                      session.duration
                    )}
                  </span>

                </div>


                <div>

                  <span>
                    ${escapeHTML(
                      session.intensity
                    )}
                  </span>

                </div>


                <label>

                  <input
                    type="checkbox"
                    class="session-check"
                    data-index="${index}"
                    ${
                      session.done
                        ? "checked"
                        : ""
                    }
                  >

                  ${
                    session.done
                      ? "Completed"
                      : "Upcoming"
                  }

                </label>

              </div>

            `
          )

          .join("");



      document
        .querySelectorAll(
          ".session-check"
        )
        .forEach(checkbox => {

          checkbox.addEventListener(
            "change",
            () => {

              const index =
                Number(
                  checkbox.dataset.index
                );


              data.sessions[index].done =
                checkbox.checked;


              saveData();


              render();

            }
          );

        });

    }



    function renderProgress() {

      const element =
        document.getElementById(
          "progressList"
        );


      if (!element) {

        return;

      }



      element.innerHTML =
        data.players

          .map(
            player => `

              <div class="progress-card">

                <div class="progress-head">

                  <div>

                    <strong>
                      ${escapeHTML(
                        player.name
                      )}
                    </strong>

                    <small>
                      ${escapeHTML(
                        player.focus
                      )}
                    </small>

                  </div>


                  <span class="progress-number">

                    ${player.completion}%

                  </span>

                </div>


                <div class="bar">

                  <i
                    style="width:${player.completion}%"
                  ></i>

                </div>


                <div class="focus-box">

                  <span>
                    NEXT GOAL
                  </span>

                  <b>
                    ${escapeHTML(
                      player.goal
                    )}
                  </b>

                </div>

              </div>

            `
          )

          .join("");

    }



    render();

  }
);
