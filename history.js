"use strict";

const historyKey = "workout-tracker.history";

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function localDateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("-");
}

function dateFromKey(key) {
  const date = new Date(`${key}T12:00:00`);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && localDateKey(date) === key ? date : null;
}

function newHistory() {
  return { app: "workout-tracker", version: 1, days: {} };
}

function saveExerciseRecord(history, date, planId, record) {
  const plans = history.days[date] ??= {};
  const records = plans[planId] ??= [];
  const index = records.findIndex(({ name }) => name === record.name);

  if (record.done || record.sets.length) {
    if (index === -1) records.push(record);
    else records[index] = record;
  } else if (index !== -1) {
    records.splice(index, 1);
  }

  if (!records.length) delete plans[planId];
  if (!Object.keys(plans).length) delete history.days[date];
}

function exerciseRecord(exercise, sets, done) {
  return {
    name: exercise.name,
    target: exercise.sets ?? null,
    reps: exercise.reps ?? null,
    duration: exercise.duration ?? null,
    sets,
    done,
  };
}

function migrateWeeklyWorkout(legacy, routine) {
  const history = newHistory();
  if (typeof legacy?.week !== "string") return history;

  const monday = dateFromKey(legacy.week.replace(/-(\d)(?=-|$)/g, "-0$1"));
  if (!monday) return history;

  // Weekly progress had no workout timestamps. Its routine day is the available date.
  for (const plan of routine) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + plan.weekday - 1);
    for (const exercise of plan.exercises) {
      const state = legacy.days?.[plan.id]?.[exercise.name];
      if (!Array.isArray(state?.sets)) continue;
      const sets = state.sets.flatMap((checked, index) => checked ? [index + 1] : []);
      saveExerciseRecord(history, localDateKey(date), plan.id, exerciseRecord(exercise, sets, Boolean(state.done)));
    }
  }
  return history;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeWorkoutBackup(existing, backup, routine) {
  if (backup?.app !== "workout-tracker" || backup.version !== 1 || !isRecord(backup.days)) {
    throw new Error("Invalid workout backup");
  }

  const merged = structuredClone(existing);
  for (const [date, plans] of Object.entries(backup.days)) {
    if (!dateFromKey(date) || !isRecord(plans)) throw new Error("Invalid workout date");

    for (const [planId, records] of Object.entries(plans)) {
      if (!routine.some(({ id }) => id === planId) || !Array.isArray(records)) {
        throw new Error("Invalid workout routine");
      }

      for (const record of records) {
        if (!isRecord(record)) throw new Error("Invalid exercise record");
        const { name, target, reps, duration, sets, done } = record;
        if (typeof name !== "string" || !name.trim() || typeof done !== "boolean"
          || (target !== null && (!Number.isSafeInteger(target) || target < 1))
          || (reps !== null && typeof reps !== "string")
          || (duration !== null && typeof duration !== "string")
          || !Array.isArray(sets) || sets.some((set) => !Number.isSafeInteger(set) || set < 1
            || (target !== null && set > target))) {
          throw new Error("Invalid exercise record");
        }

        const current = merged.days[date]?.[planId]?.find((exercise) => exercise.name === name);
        const details = current ?? { name, target, reps, duration };
        const combined = [...new Set([...(current?.sets ?? []), ...sets])].sort((a, b) => a - b);
        saveExerciseRecord(merged, date, planId, {
          ...details,
          sets: details.target === null ? combined : combined.filter((set) => set <= details.target),
          done: Boolean(current?.done || done),
        });
      }
    }
  }
  return merged;
}

function mountWorkoutCalendar({ routine, getHistory, restoreBackup, refreshWorkoutDate }) {
  const dialog = document.querySelector("#workout-calendar");
  const monthHeading = document.querySelector("#calendar-month");
  const dates = document.querySelector("#calendar-days");
  const logDate = document.querySelector("#log-date");
  const logDetails = document.querySelector("#log-details");
  const fileInput = document.querySelector("#backup-file");
  const backupStatus = document.querySelector("#backup-status");
  const monthFormat = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
  const dayFormat = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" });
  let month;
  let selectedDate;

  function renderLog() {
    const date = selectedDate && dateFromKey(selectedDate);
    const plans = getHistory().days[selectedDate];
    logDate.textContent = date ? dayFormat.format(date) : "Workout log";
    logDetails.replaceChildren();

    if (!plans) {
      const message = document.createElement("p");
      message.textContent = date ? "No workout logged for this date." : "Select a date to view its workout.";
      logDetails.append(message);
      return;
    }

    for (const plan of routine) {
      const records = plans[plan.id];
      if (!records) continue;

      const heading = document.createElement("h4");
      heading.textContent = `${plan.name} routine`;
      const list = document.createElement("ul");
      for (const record of records) {
        const row = document.createElement("li");
        const name = document.createElement("strong");
        const detail = document.createElement("span");
        const count = record.sets.length;
        const complete = record.target === null ? record.done : count === record.target;
        const summary = [];
        if (record.target !== null) summary.push(`${count}/${record.target} sets`);
        else if (!record.duration) summary.push(`${count} ${count === 1 ? "set" : "sets"} logged`);
        if (count) summary.push(`Set${count === 1 ? "" : "s"} ${record.sets.join(", ")}`);
        if (record.reps) summary.push(`${record.reps} reps/set target`);
        if (record.duration) summary.push(record.duration);
        if (complete) summary.push("Done");
        name.textContent = record.name;
        detail.textContent = summary.join(" · ");
        row.append(name, detail);
        list.append(row);
      }
      logDetails.append(heading, list);
    }
  }

  function renderCalendar() {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const offset = (month.getDay() + 6) % 7;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const today = localDateKey(new Date());
    const history = getHistory().days;
    const cells = document.createDocumentFragment();
    monthHeading.textContent = monthFormat.format(month);

    for (let offsetIndex = 0; offsetIndex < offset; offsetIndex++) {
      cells.append(document.createElement("span"));
    }

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, monthIndex, day, 12);
      const key = localDateKey(date);
      const logged = Boolean(history[key]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = logged ? "calendar-day has-workout" : "calendar-day";
      button.dataset.date = key;
      button.textContent = day;
      button.setAttribute("aria-label", `${dayFormat.format(date)}${logged ? ", workout logged" : ""}`);
      button.setAttribute("aria-pressed", key === selectedDate);
      if (key === today) button.setAttribute("aria-current", "date");
      cells.append(button);
    }
    dates.replaceChildren(cells);
    renderLog();
  }

  function changeMonth(direction) {
    month.setMonth(month.getMonth() + direction);
    selectedDate = null;
    renderCalendar();
  }

  function showBackupStatus(message) {
    backupStatus.hidden = false;
    backupStatus.textContent = message;
  }

  document.querySelector("#open-calendar").addEventListener("click", () => {
    refreshWorkoutDate();
    const today = new Date();
    month = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    selectedDate = localDateKey(today);
    backupStatus.hidden = true;
    renderCalendar();
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  document.querySelector("#previous-month").addEventListener("click", () => changeMonth(-1));
  document.querySelector("#next-month").addEventListener("click", () => changeMonth(1));

  dates.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;

    dates.querySelector('[aria-pressed="true"]')?.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-pressed", "true");
    selectedDate = button.dataset.date;
    renderLog();
    logDate.scrollIntoView({ block: "nearest" });
  });

  document.querySelector("#export-backup").addEventListener("click", () => {
    const file = new Blob([JSON.stringify(getHistory(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workout-tracker-${localDateKey(new Date())}.json`;
    dialog.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    showBackupStatus("Backup export started.");
  });

  document.querySelector("#restore-backup").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileInput.value = "";

    try {
      const saved = restoreBackup(JSON.parse(await file.text()));
      renderCalendar();
      showBackupStatus(saved ? "Backup merged with your workout history." : "Backup loaded for this session. Device storage is unavailable.");
    } catch {
      showBackupStatus("Could not restore this file. Choose a Workout Tracker JSON backup.");
    }
  });

  return () => {
    if (dialog.open) renderCalendar();
  };
}
