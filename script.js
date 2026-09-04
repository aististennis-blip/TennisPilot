document.addEventListener("DOMContentLoaded", () => {

  const panels = document.querySelectorAll(".panel");
  const sideLinks = document.querySelectorAll(".side-link");

  function showPanel(panelId) {

    panels.forEach(panel => {
      panel.classList.remove("active");
    });

    sideLinks.forEach(link => {
      link.classList.remove("active");
    });

    const target = document.getElementById(panelId);
    const button = document.querySelector(
      `.side-link[data-panel="${panelId}"]`
    );

    if (target) {
      target.classList.add("active");
    }

    if (button) {
      button.classList.add("active");
    }

    const titles = {
      overview: "Good afternoon, Alex.",
      assessment: "Assess your game.",
      training: "Train with purpose.",
      matches: "Learn from your matches.",
      progress: "Track your development.",
      coach: "Coach View."
    };

    const subtitles = {
      overview: "Here's what you should focus on this week.",
      assessment: "Rate your current strengths and weaknesses.",
      training: "Complete the sessions connected to your current priority.",
      matches: "Turn match performance into useful information.",
      progress: "See how your development is trending.",
      coach: "Review the player's current development plan."
    };

    const title = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");

    if (title) {
      title.textContent = titles[panelId] || "TennisPilot";
    }

    if (subtitle) {
      subtitle.textContent = subtitles[panelId] || "";
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  sideLinks.forEach(link => {

    link.addEventListener("click", () => {

      const panelId = link.dataset.panel;

      if (panelId) {
        showPanel(panelId);
      }

    });

  });


  document.querySelectorAll("[data-panel-target]").forEach(button => {

    button.addEventListener("click", () => {

      const panelId = button.dataset.panelTarget;

      if (panelId) {
        showPanel(panelId);
      }

    });

  });


  /* -------------------------
     ADD SESSION MODAL
  ------------------------- */

  const sessionModal = document.getElementById("sessionModal");

  const addSessionButtons = [
    document.getElementById("addSessionBtn"),
    document.getElementById("addSessionBtn2")
  ].filter(Boolean);

  const closeSessionModal =
    document.getElementById("closeSessionModal");

  const cancelSession =
    document.getElementById("cancelSession");

  const sessionForm =
    document.getElementById("sessionForm");


  function openSessionModal() {

    if (sessionModal) {
      sessionModal.classList.add("open");

      const nameInput =
        document.getElementById("sessionName");

      if (nameInput) {
        setTimeout(() => nameInput.focus(), 100);
      }
    }

  }


  function closeModal() {

    if (sessionModal) {
      sessionModal.classList.remove("open");
    }

  }


  addSessionButtons.forEach(button => {

    button.addEventListener("click", openSessionModal);

  });


  if (closeSessionModal) {
    closeSessionModal.addEventListener("click", closeModal);
  }


  if (cancelSession) {
    cancelSession.addEventListener("click", closeModal);
  }


  if (sessionModal) {

    sessionModal.addEventListener("click", event => {

      if (event.target === sessionModal) {
        closeModal();
      }

    });

  }


  document.addEventListener("keydown", event => {

    if (
      event.key === "Escape" &&
      sessionModal &&
      sessionModal.classList.contains("open")
    ) {
      closeModal();
    }

  });


  if (sessionForm) {

    sessionForm.addEventListener("submit", event => {

      event.preventDefault();

      const name =
        document.getElementById("sessionName").value.trim();

      const date =
        document.getElementById("sessionDate").value;

      const duration =
        document.getElementById("sessionDuration").value;

      const focus =
        document.getElementById("sessionFocus").value;

      const intensity =
        document.getElementById("sessionIntensity").value;

      const objective =
        document.getElementById("sessionObjective").value.trim();

      if (!name || !date) {
        return;
      }


      const sessionList =
        document.getElementById("sessionList");

      if (!sessionList) {
        closeModal();
        return;
      }


      const dateObject = new Date(date + "T12:00:00");

      const dayNames = [
        "SUN",
        "MON",
        "TUE",
        "WED",
        "THU",
        "FRI",
        "SAT"
      ];

      const day =
        dayNames[dateObject.getDay()];

      const dayNumber =
        String(dateObject.getDate()).padStart(2, "0");


      const sessionRow =
        document.createElement("div");

      sessionRow.className = "session-row";


      sessionRow.innerHTML = `
        <div class="session-date">
          <strong>${day}</strong>
          <span>${dayNumber}</span>
        </div>

        <div class="session-info">
          <strong>${escapeHTML(name)}</strong>
          <span>${escapeHTML(duration)} · ${escapeHTML(intensity)} · ${escapeHTML(focus)}</span>
        </div>

        <span class="session-status upcoming">
          Upcoming
        </span>
      `;


      sessionList.appendChild(sessionRow);


      sessionForm.reset();

      closeModal();


      const trainingPanel =
        document.getElementById("training");

      if (trainingPanel) {

        const trainingList =
          trainingPanel.querySelector(".training-list");

        if (trainingList) {

          const trainingItem =
            document.createElement("label");

          trainingItem.className = "training-item";

          trainingItem.innerHTML = `
            <input type="checkbox" class="training-check">

            <div>
              <strong>${escapeHTML(name)}</strong>
              <span>${escapeHTML(duration)} · ${escapeHTML(focus)} · ${escapeHTML(intensity)}</span>
            </div>

            <em>${escapeHTML(day)}</em>
          `;

          trainingList.appendChild(trainingItem);

          setupTrainingCheckbox(
            trainingItem.querySelector(".training-check")
          );

        }

      }

    });

  }


  function escapeHTML(value) {

    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }


  /* -------------------------
     TRAINING CHECKBOXES
  ------------------------- */

  const trainingChecks =
    document.querySelectorAll(".training-check");


  function setupTrainingCheckbox(checkbox) {

    if (!checkbox) {
      return;
    }

    checkbox.addEventListener("change", updateTrainingProgress);

  }


  trainingChecks.forEach(setupTrainingCheckbox);


  function updateTrainingProgress() {

    const checks =
      document.querySelectorAll(".training-check");

    if (!checks.length) {
      return;
    }

    const completed =
      [...checks].filter(check => check.checked).length;

    const percentage =
      Math.round((completed / checks.length) * 100);


    const trainingPercent =
      document.getElementById("trainingPercent");

    const progressNumber =
      document.getElementById("progressNumber");


    if (trainingPercent) {
      trainingPercent.textContent =
        `${percentage}%`;
    }

    if (progressNumber) {
      progressNumber.textContent =
        `${percentage}%`;
    }


    const progressRing =
      document.querySelector(".progress-ring");

    if (progressRing) {

      progressRing.style.background =
        `conic-gradient(#2563eb 0 ${percentage}%, #e9edf3 ${percentage}% 100%)`;

    }

  }


  /* -------------------------
     ASSESSMENT
  ------------------------- */

  const sliders =
    document.querySelectorAll(".assessment-card input[type='range']");


  sliders.forEach(slider => {

    const output =
      slider.parentElement.querySelector("span");

    slider.addEventListener("input", () => {

      if (output) {
        output.textContent =
          `${slider.value} / 10`;
      }

    });

  });


  const saveAssessment =
    document.getElementById("saveAssessment");


  if (saveAssessment) {

    saveAssessment.addEventListener("click", () => {

      saveAssessment.textContent =
        "Saved ✓";

      setTimeout(() => {

        saveAssessment.textContent =
          "Save Assessment";

      }, 1600);

    });

  }


  /* -------------------------
     MATCH
  ------------------------- */

  const addMatch =
    document.getElementById("addMatch");


  if (addMatch) {

    addMatch.addEventListener("click", () => {

      addMatch.textContent =
        "Match Added ✓";

      setTimeout(() => {

        addMatch.textContent =
          "+ Add Match";

      }, 1600);

    });

  }


  /* -------------------------
     COACH NOTES
  ------------------------- */

  const saveCoachNotes =
    document.getElementById("saveCoachNotes");


  if (saveCoachNotes) {

    saveCoachNotes.addEventListener("click", () => {

      saveCoachNotes.textContent =
        "Saved ✓";

      setTimeout(() => {

        saveCoachNotes.textContent =
          "Save Notes";

      }, 1600);

    });

  }


  /* -------------------------
     RESET DEMO
  ------------------------- */

  const resetDemo =
    document.getElementById("resetDemo");


  if (resetDemo) {

    resetDemo.addEventListener("click", () => {

      const confirmed =
        confirm("Reset the TennisPilot demo to its original state?");

      if (!confirmed) {
        return;
      }


      /* Reset training */

      document
        .querySelectorAll(".training-check")
        .forEach((checkbox, index) => {

          checkbox.checked =
            index < 2;

        });


      /* Reset assessment */

      const defaultValues =
        [8, 6, 9, 8, 8, 7];


      sliders.forEach((slider, index) => {

        slider.value =
          defaultValues[index];

        const output =
          slider.parentElement.querySelector("span");

        if (output) {
          output.textContent =
            `${slider.value} / 10`;
        }

      });


      /* Reset coach notes */

      const notes =
        document.getElementById("coachNotes");

      if (notes) {
        notes.value = "";
      }


      /* Remove sessions created by user */

      const sessionList =
        document.getElementById("sessionList");

      if (sessionList) {

        const rows =
          sessionList.querySelectorAll(".session-row");

        rows.forEach((row, index) => {

          if (index > 2) {
            row.remove();
          }

        });

      }


      /* Reset progress */

      updateTrainingProgress();


      /* Return to overview */

      showPanel("overview");


      resetDemo.textContent =
        "Reset ✓";

      setTimeout(() => {

        resetDemo.textContent =
          "Reset Demo";

      }, 1500);

    });

  }


  /* Initial state */

  updateTrainingProgress();

});
