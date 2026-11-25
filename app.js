"use strict";

const routine = [
  {
    id: "mon", name: "Monday", weekday: 1,
    exercises: [
      { name: "Cable lateral raise", sets: 4, reps: "12–20" },
      { name: "Seated dumbbell shoulder press", sets: 3, reps: "8–12" },
      { name: "Incline dumbbell bench press", sets: 3, reps: "8–12" },
      { name: "Machine chest press", sets: 2, reps: "8–12" },
      { name: "Rope triceps pushdown", sets: 3, reps: "10–15" },
      { name: "Jogging + walking", duration: "20 minutes" },
    ],
  },
  {
    id: "tue", name: "Tuesday", weekday: 2,
    exercises: [
      { name: "Lat pulldown", sets: 3, reps: "8–12" },
      { name: "Seated cable row", sets: 3, reps: "8–12" },
      { name: "Chest machine fly", sets: 3, reps: "8–12" },
      { name: "Machine rear-delt fly", sets: 3, reps: "12–20" },
      { name: "Dumbbell biceps curl", sets: 3, reps: "8–12" },
      { name: "Hammer curl", sets: 2, reps: "10–15" },
    ],
  },
  {
    id: "thu", name: "Thursday", weekday: 4,
    exercises: [
      { name: "Dumbbell lateral raise", sets: 4, reps: "12–20" },
      { name: "Lat pulldown", sets: 3, reps: "8–12" },
      { name: "Seated cable row", sets: 3, reps: "8–12" },
      { name: "Machine rear-delt fly", sets: 2, reps: "12–20" },
      { name: "Overhead cable triceps extension", sets: 3, reps: "10–15" },
      { name: "Incline dumbbell biceps curl", sets: 2, reps: "10–15" },
    ],
  },
  {
    id: "fri", name: "Friday", weekday: 5,
    exercises: [
      { name: "Leg press" },
      { name: "Leg curl" },
      { name: "Incline chest" },
      { name: "Overhead dumbbell press" },
    ],
  },
];

const legacyWorkoutKey = "workout-tracker.workout";
const selectionKey = "workout-tracker.selection";
const timerKey = "workout-tracker.timer";
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

const dayPicker = document.querySelector("#day-picker");
const dayTitle = document.querySelector("#day-title");
const dayDetails = document.querySelector("#day-details");
const exerciseList = document.querySelector("#exercise-list");
const progressLabel = document.querySelector("#progress-label");
const progressBar = document.querySelector("#workout-progress");
const weekDates = document.querySelector("#week-dates");
const timerValue = document.querySelector("#timer-value");
const toggleTimer = document.querySelector("#toggle-timer");
const resetTimer = document.querySelector("#reset-timer");
const storageWarning = document.querySelector("#storage-warning");

function mondayOf(date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return monday;
}

const savedHistory = readStorage(historyKey);
const legacyWorkout = savedHistory ? null : readStorage(legacyWorkoutKey);
let workoutHistory = savedHistory ?? migrateWeeklyWorkout(legacyWorkout, routine);
let selection = readStorage(selectionKey);
let selectedDay;
let displayedDate;

function persistHistory() {
  const saved = writeStorage(historyKey, workoutHistory);
  storageWarning.hidden = saved;
  return saved;
}

if (legacyWorkout) persistHistory();

function refreshWorkoutDate() {
  const today = new Date();
  const date = localDateKey(today);
  if (date === displayedDate) return;

  displayedDate = date;
  const monday = mondayOf(today);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  weekDates.textContent = dateFormat.formatRange(monday, sunday);
  weekDates.parentElement.setAttribute("aria-label", `Open workout calendar, ${weekDates.textContent}`);

  const savedDay = selection?.date === date
    ? routine.find((day) => day.id === selection.id)
    : undefined;
  selectedDay = savedDay ?? routine.find((day) => day.weekday === today.getDay()) ?? routine[0];
  renderDay();
}

function exerciseState(exercise) {
  return workoutHistory.days[displayedDate]?.[selectedDay.id]?.find(({ name }) => name === exercise.name)
    ?? { sets: [], done: false };
}

function isComplete(exercise, state) {
  return exercise.sets ? state.sets.length === exercise.sets : state.done;
}

function setButton(number) {
  return `<button class="button set-button" type="button" data-set="${number}" aria-pressed="false">
    <span class="check-icon" aria-hidden="true"></span>Set ${number}
  </button>`;
}

const doneButton = `<button class="button set-button" type="button" data-done aria-pressed="false">
  <span class="check-icon" aria-hidden="true"></span>Done
</button>`;

function renderExercise(exercise, index) {
  const { name, sets, reps, duration } = exercise;
  const setNumbers = sets ? Array.from({ length: sets }, (_, set) => set + 1) : exerciseState(exercise).sets;
  const detail = sets ? `${reps} reps per set` : duration ?? "";
  const addSet = !sets && !duration
    ? '<button class="button add-set" type="button" data-add>+ Log set</button>'
    : "";

  return `<li class="exercise" data-exercise="${index}">
    <div class="exercise-heading">
      <div>
        <h2 id="exercise-${index}">${name}</h2>
        ${detail ? `<p class="exercise-detail">${detail}</p>` : ""}
      </div>
      ${duration ? "" : '<span class="exercise-count"></span>'}
    </div>
    <div class="exercise-actions" role="group" aria-labelledby="exercise-${index}">
      <div class="sets">${setNumbers.map(setButton).join("")}</div>
      ${addSet}
      ${sets ? "" : doneButton}
    </div>
  </li>`;
}

function updateExercise(card, exercise) {
  const state = exerciseState(exercise);
  const complete = isComplete(exercise, state);
  card.classList.toggle("is-complete", complete);

  const count = card.querySelector(".exercise-count");
  const done = card.querySelector("[data-done]");
  const completedSets = state.sets.length;

  if (count) {
    count.textContent = exercise.sets
      ? `${completedSets}/${exercise.sets} sets`
      : `${completedSets} ${completedSets === 1 ? "set" : "sets"} logged`;
  }

  if (done) done.setAttribute("aria-pressed", complete);
  for (const button of card.querySelectorAll("[data-set]")) {
    button.setAttribute("aria-pressed", state.sets.includes(Number(button.dataset.set)));
  }
}

function updateProgress() {
  const completed = selectedDay.exercises.filter((exercise) => isComplete(exercise, exerciseState(exercise))).length;
  const total = selectedDay.exercises.length;
  const label = `${completed} of ${total} exercises complete`;
  if (progressLabel.textContent !== label) progressLabel.textContent = label;
  progressBar.max = total;
  progressBar.value = completed;
}

function renderDay() {
  for (const button of dayPicker.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", button.dataset.day === selectedDay.id);
  }

  const { name, exercises } = selectedDay;
  const totalSets = exercises.reduce((total, exercise) => total + (exercise.sets ?? 0), 0);
  dayTitle.textContent = name;
  dayDetails.textContent = `${exercises.length} exercises${totalSets ? ` · ${totalSets} sets` : ""}`;
  exerciseList.innerHTML = exercises.map(renderExercise).join("");
  exercises.forEach((exercise, index) => updateExercise(exerciseList.children[index], exercise));
  updateProgress();
}

dayPicker.innerHTML = routine.map((day) => `
  <button class="day-button" type="button" data-day="${day.id}" aria-pressed="false">${day.name}</button>
`).join("");

dayPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (!button) return;

  refreshWorkoutDate();
  selectedDay = routine.find((day) => day.id === button.dataset.day);
  selection = { date: displayedDate, id: selectedDay.id };
  writeStorage(selectionKey, selection);
  renderDay();
});

function addOpenSet(card, checkedSets) {
  let number = 1;
  while (checkedSets.includes(number)) number++;

  const buttons = card.querySelector(".sets");
  if (!buttons.querySelector(`[data-set="${number}"]`)) {
    const next = Array.from(buttons.children).find((button) => Number(button.dataset.set) > number);
    if (next) next.insertAdjacentHTML("beforebegin", setButton(number));
    else buttons.insertAdjacentHTML("beforeend", setButton(number));
  }
  return number;
}

exerciseList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const card = button.closest("[data-exercise]");
  const day = selectedDay;
  refreshWorkoutDate();
  const currentCard = exerciseList.children[card.dataset.exercise];
  if (day !== selectedDay) return;

  const exercise = selectedDay.exercises[card.dataset.exercise];
  let { sets, done } = exerciseState(exercise);
  let setCompleted = false;
  if (button.hasAttribute("data-done")) {
    done = !done;
  } else {
    const number = button.hasAttribute("data-add") ? addOpenSet(currentCard, sets) : Number(button.dataset.set);
    setCompleted = !sets.includes(number);
    sets = setCompleted ? [...sets, number].sort((a, b) => a - b) : sets.filter((set) => set !== number);
  }

  saveExerciseRecord(workoutHistory, displayedDate, selectedDay.id, exerciseRecord(exercise, sets, done));
  persistHistory();
  updateExercise(currentCard, exercise);
  updateProgress();
  if (setCompleted) setTimer({ elapsed: 0, startedAt: Date.now() });
});

let timer = readStorage(timerKey) ?? { elapsed: 0, startedAt: null };
let tick;

function elapsedTime() {
  return timer.elapsed + (timer.startedAt === null ? 0 : Math.max(0, Date.now() - timer.startedAt));
}

function updateTimerValue() {
  const totalSeconds = Math.floor(elapsedTime() / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const value = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (timerValue.textContent !== value) timerValue.textContent = value;
}

function renderTimer() {
  clearInterval(tick);
  const running = timer.startedAt !== null;
  toggleTimer.textContent = running ? "Pause" : timer.elapsed > 0 ? "Resume" : "Start";
  updateTimerValue();
  if (running) tick = setInterval(updateTimerValue, 100);
}

function setTimer(state) {
  timer = state;
  writeStorage(timerKey, timer);
  renderTimer();
}

toggleTimer.addEventListener("click", () => {
  setTimer(timer.startedAt === null
    ? { elapsed: timer.elapsed, startedAt: Date.now() }
    : { elapsed: elapsedTime(), startedAt: null });
});

resetTimer.addEventListener("click", () => {
  setTimer({ elapsed: 0, startedAt: null });
});

const refreshCalendar = mountWorkoutCalendar({
  routine,
  getHistory: () => workoutHistory,
  restoreBackup(backup) {
    workoutHistory = mergeWorkoutBackup(workoutHistory, backup, routine);
    const saved = persistHistory();
    refreshWorkoutDate();
    renderDay();
    return saved;
  },
  refreshWorkoutDate,
});

window.addEventListener("storage", (event) => {
  if (event.key === historyKey && event.newValue) {
    workoutHistory = readStorage(historyKey) ?? workoutHistory;
    renderDay();
    refreshCalendar();
  }
  if (event.key === timerKey && event.newValue) {
    timer = readStorage(timerKey) ?? timer;
    renderTimer();
  }
});

function refreshPage() {
  refreshWorkoutDate();
  updateTimerValue();
}

document.addEventListener("visibilitychange", refreshPage);
window.addEventListener("focus", refreshPage);
refreshWorkoutDate();
renderTimer();

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Offline setup failed:", error));
}
