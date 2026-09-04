document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     DASHBOARD NAVIGATION
  ========================= */

  const sideButtons =
    document.querySelectorAll(".side-link");

  sideButtons.forEach(button => {

    button.addEventListener("click", () => {

      showPanel(
        button.dataset.panel,
        button
      );

    });

  });


  /* =========================
     BUTTONS THAT OPEN PANELS
  ========================= */

  document.querySelectorAll("[data-go]").forEach(button => {

    button.addEventListener("click", () => {

      const target =
        document.querySelector(
          `.side-link[data-panel="${button.dataset.go}"]`
        );

      showPanel(
        button.dataset.go,
        target
      );

    });

  });


  /* =========================
     ASSESSMENT
  ========================= */

  setupAssessment();


  /* =========================
     TRAINING
  ========================= */

  setupTraining();


  /* =========================
     RESET
  ========================= */

  const resetButton =
    document.getElementById("resetBtn");

  if (resetButton) {

    resetButton.addEventListener(
      "click",
      resetDemo
    );

  }


  /* =========================
     SAVE ASSESSMENT
  ========================= */

  const saveButton =
    document.getElementById("saveAssessment");

  if (saveButton) {

    saveButton.addEventListener(
      "click",
      () => {
        alert(
          "Assessment saved in demo mode."
        );
      }
    );

  }

});



/* =========================
   SHOW PANEL
========================= */

function showPanel(id, button) {

  document
    .querySelectorAll(".panel")
    .forEach(panel => {

      panel.classList.remove("active");

    });


  const target =
    document.getElementById(id);

  if (target) {

    target.classList.add("active");

  }


  document
    .querySelectorAll(".side-link")
    .forEach(btn => {

      btn.classList.remove("active");

    });


  if (button) {

    button.classList.add("active");

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}



/* =========================
   ASSESSMENT DATA
========================= */

const skills = [

  ["Forehand", 8],

  ["Backhand", 7],

  ["Serve", 8],

  ["Return", 6],

  ["Footwork", 7],

  ["Tactics", 8]

];



/* =========================
   SETUP ASSESSMENT
========================= */

function setupAssessment() {

  const firstBox =
    document.getElementById("skillsA");

  const secondBox =
    document.getElementById("skillsB");


  if (!firstBox || !secondBox) {

    return;

  }


  const groups = [

    {
      box: firstBox,
      skills: skills.slice(0, 3)
    },

    {
      box: secondBox,
      skills: skills.slice(3, 6)
    }

  ];


  groups.forEach(group => {

    group.skills.forEach(
      ([name, value]) => {

        const key =
          name
            .toLowerCase()
            .replace(" ", "");


        const wrapper =
          document.createElement("div");

        wrapper.className = "skill";


        wrapper.innerHTML = `

          <div class="skill-head">

            <b>
              ${name}
            </b>

            <span id="${key}Value">
              ${value}/10
            </span>

          </div>


          <div class="rating">

            ${Array.from(
              { length: 10 },
              (_, index) => {

                const number =
                  index + 1;

                return `

                  <button
                    class="${
                      number === value
                        ? "selected"
                        : ""
                    }"

                    data-skill="${key}"

                    data-value="${number}"
                  >

                    ${number}

                  </button>

                `;

              }
            ).join("")}

          </div>

        `;


        group.box.appendChild(
          wrapper
        );

      }
    );

  });


  document
    .querySelectorAll(".rating button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const skill =
            button.dataset.skill;

          const value =
            Number(
              button.dataset.value
            );


          document
            .querySelectorAll(
              `[data-skill="${skill}"]`
            )
            .forEach(item => {

              item.classList.remove(
                "selected"
              );

            });


          button.classList.add(
            "selected"
          );


          const valueElement =
            document.getElementById(
              skill + "Value"
            );


          if (valueElement) {

            valueElement.textContent =
              value + "/10";

          }

        }
      );

    });

}



/* =========================
   TRAINING DATA
========================= */

function setupTraining() {

  const grid =
    document.getElementById(
      "trainingGrid"
    );


  if (!grid) {

    return;

  }


  const sessions = [

    [
      "Second Serve Return",
      "Crosscourt return with a target two feet inside the baseline."
    ],

    [
      "Return + 1",
      "Return crosscourt, recover, then attack the next short ball."
    ],

    [
      "20-Point Challenge",
      "Score one point for every return landing in the target zone."
    ],

    [
      "Wide Serve Returns",
      "Recover quickly after wide returns and protect the open court."
    ],

    [
      "Pressure Games",
      "Start games at 30–30 and play around return quality."
    ],

    [
      "Match Simulation",
      "Track return depth during competitive games and review afterward."
    ]

  ];


  grid.innerHTML =
    sessions.map(
      (session, index) => {

        return `

          <div class="training-item">

            <h3>
              ${session[0]}
            </h3>

            <p>
              ${session[1]}
            </p>

            <label>

              <input
                type="checkbox"
                class="trainingCheck"
                data-index="${index}"
              >

              Completed

            </label>

          </div>

        `;

      }
    ).join("");


  const saved =
    JSON.parse(
      localStorage.getItem(
        "tpTraining"
      ) || "[]"
    );


  document
    .querySelectorAll(".trainingCheck")
    .forEach(check => {

      const index =
        Number(
          check.dataset.index
        );


      check.checked =
        Boolean(saved[index]);


      check.addEventListener(
        "change",
        saveTraining
      );

    });

}



/* =========================
   SAVE TRAINING
========================= */

function saveTraining() {

  const values =
    Array.from(
      document.querySelectorAll(
        ".trainingCheck"
      )
    ).map(
      checkbox =>
        checkbox.checked
    );


  localStorage.setItem(
    "tpTraining",
    JSON.stringify(values)
  );

}



/* =========================
   RESET EVERYTHING
========================= */

function resetDemo() {

  localStorage.removeItem(
    "tpTraining"
  );


  document
    .querySelectorAll(
      ".trainingCheck"
    )
    .forEach(check => {

      check.checked = false;

    });


  skills.forEach(
    ([name, value]) => {

      const key =
        name
          .toLowerCase()
          .replace(" ", "");


      const buttons =
        document.querySelectorAll(
          `[data-skill="${key}"]`
        );


      buttons.forEach(
        (button, index) => {

          button.classList.toggle(
            "selected",
            index === value - 1
          );

        }
      );


      const valueElement =
        document.getElementById(
          key + "Value"
        );


      if (valueElement) {

        valueElement.textContent =
          value + "/10";

      }

    }
  );


  const overviewButton =
    document.querySelector(
      '.side-link[data-panel="overview"]'
    );


  showPanel(
    "overview",
    overviewButton
  );


  alert(
    "Demo reset successfully."
  );

}
