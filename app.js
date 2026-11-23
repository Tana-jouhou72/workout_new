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

const workoutKey = "workout-tracker.workout";
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
  } catch {
    // The tracker still works in memory when storage is unavailable.
  }
}

function localDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function mondayOf(date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return monday;
}

let workout = readStorage(workoutKey);
let selectedDay;
let displayedDate;

function refreshWorkoutDate() {
  const today = new Date();
  const date = localDateKey(today);
  if (date === displayedDate) return;

  displayedDate = date;
  const monday = mondayOf(today);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  weekDates.textContent = dateFormat.formatRange(monday, sunday);

  const week = localDateKey(monday);
  if (workout?.week !== week) workout = { week, days: {} };

  const savedDay = workout.selection?.date === date
    ? routine.find((day) => day.id === workout.selection.id)
    : undefined;
  selectedDay = savedDay ?? routine.find((day) => day.weekday === today.getDay()) ?? routine[0];
  renderDay();
}

function exerciseState(exercise) {
  return workout.days[selectedDay.id]?.[exercise.name] ?? { sets: [], done: false };
}

function countSets(state) {
  return state.sets.filter(Boolean).length;
}

function isComplete(exercise, state) {
  return exercise.sets ? countSets(state) === exercise.sets : state.done;
}

function setButton(index) {
  return `<button class="button set-button" type="button" data-set="${index}" aria-pressed="false">
    <span class="check-icon" aria-hidden="true"></span>Set ${index + 1}
  </button>`;
}

const doneButton = `<button class="button set-button" type="button" data-done aria-pressed="false">
  <span class="check-icon" aria-hidden="true"></span>Done
</button>`;

function renderExercise(exercise, index) {
  const { name, sets, reps, duration } = exercise;
  const setCount = sets ?? exerciseState(exercise).sets.length;
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
      <div class="sets">${Array.from({ length: setCount }, (_, set) => setButton(set)).join("")}</div>
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
  const completedSets = countSets(state);

  if (count) {
    count.textContent = exercise.sets
      ? `${completedSets}/${exercise.sets} sets`
      : `${completedSets} ${completedSets === 1 ? "set" : "sets"} logged`;
  }

  if (done) done.setAttribute("aria-pressed", complete);
  for (const button of card.querySelectorAll("[data-set]")) {
    button.setAttribute("aria-pressed", Boolean(state.sets[button.dataset.set]));
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
  workout.selection = { date: displayedDate, id: selectedDay.id };
  writeStorage(workoutKey, workout);
  renderDay();
});

exerciseList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const card = button.closest("[data-exercise]");
  const day = selectedDay;
  refreshWorkoutDate();
  const currentCard = exerciseList.children[card.dataset.exercise];
  if (day !== selectedDay) return;

  const exercise = selectedDay.exercises[card.dataset.exercise];
  const state = exerciseState(exercise);
  if (button.hasAttribute("data-add")) {
    currentCard.querySelector(".sets").insertAdjacentHTML("beforeend", setButton(state.sets.length));
    state.sets.push(true);
  } else if (button.hasAttribute("data-done")) {
    state.done = !state.done;
  } else {
    const index = Number(button.dataset.set);
    state.sets[index] = !state.sets[index];
  }

  workout.days[selectedDay.id] ??= {};
  workout.days[selectedDay.id][exercise.name] = state;
  writeStorage(workoutKey, workout);
  updateExercise(currentCard, exercise);
  updateProgress();
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

toggleTimer.addEventListener("click", () => {
  timer = timer.startedAt === null
    ? { elapsed: timer.elapsed, startedAt: Date.now() }
    : { elapsed: elapsedTime(), startedAt: null };
  writeStorage(timerKey, timer);
  renderTimer();
});

resetTimer.addEventListener("click", () => {
  timer = { elapsed: 0, startedAt: null };
  writeStorage(timerKey, timer);
  renderTimer();
});

function refreshPage() {
  refreshWorkoutDate();
  updateTimerValue();
}

document.addEventListener("visibilitychange", refreshPage);
window.addEventListener("focus", refreshPage);
refreshWorkoutDate();
renderTimer();
