const STORAGE_KEY = "chrombites-edamame-days-v3";

const macroColors = {
  carb: "#b0dde6",
  protein: "#fec2cb",
  fats: "#f6e524",
  fibre: "#a4ce57",
};

const foodWords = {
  carb: [
    "noodle",
    "noodles",
    "rice",
    "bread",
    "toast",
    "pasta",
    "ramen",
    "cup",
    "bun",
    "potato",
    "oats",
    "cereal",
    "porridge",
    "strawberries",
    "strawberry",
  ],
  protein: [
    "egg",
    "eggs",
    "tofu",
    "yogurt",
    "yoghurt",
    "beans",
    "bean",
    "chicken",
    "fish",
    "beef",
    "pork",
    "tempeh",
    "lentils",
  ],
  fats: [
    "avocado",
    "oil",
    "butter",
    "cheese",
    "nuts",
    "nut",
    "almonds",
    "almond",
    "peanut",
    "pumpkin",
    "sesame",
    "cream",
    "mayo",
    "seeds",
    "seed",
  ],
  fibre: [
    "cabbage",
    "cucumber",
    "fruit",
    "greens",
    "green",
    "vegetables",
    "vegetable",
    "veg",
    "salad",
    "apple",
    "banana",
    "broccoli",
    "spinach",
  ],
};

const fallbackWeights = {
  carb: 3,
  protein: 1,
  fats: 2,
  fibre: 1,
};

let foodMacroLookup = [];
const commonFoodAliases = {
  yoghurt: "yogurt",
  ramen: "noodles",
  noodle: "noodles",
  cabbage: "greens",
  cucumber: "vegetables",
  tofu: "soy",
};

const homeScreen = document.querySelector("#homeScreen");
const dayScreen = document.querySelector("#dayScreen");
const addScreen = document.querySelector("#addScreen");
const paletteScroll = document.querySelector("#paletteScroll");
const homeWeekday = document.querySelector("#homeWeekday");
const homeDate = document.querySelector("#homeDate");
const dateSearchForm = document.querySelector("#dateSearchForm");
const dateSearch = document.querySelector("#dateSearch");
const clearDateSearch = document.querySelector("#clearDateSearch");
const backToHome = document.querySelector("#backToHome");
const backToDay = document.querySelector("#backToDay");
const dayTitle = document.querySelector("#dayTitle");
const dayRelative = document.querySelector("#dayRelative");
const addTitle = document.querySelector("#addTitle");
const dayPalette = document.querySelector("#dayPalette");
const dailyNudge = document.querySelector("#dailyNudge");
const mealList = document.querySelector("#mealList");
const openAddMeal = document.querySelector("#openAddMeal");
const mealForm = document.querySelector("#mealForm");
const mealInput = document.querySelector("#mealInput");
const chipButtons = document.querySelectorAll("[data-food]");
const tagButtons = document.querySelectorAll("[data-tag]");

let days = loadDays();
let selectedDayId = todayId();
let activeHomeDayId = selectedDayId;
let selectedTag = null;
let scrollFrame = null;
let editingMealId = null;

loadFoodMacros();
renderHome();
const initialScreen = screenFromHash();

if (initialScreen === "home") {
  showScreen("home", { replace: true });
} else {
  const initialDayId = selectedDayId;
  window.history.replaceState({ screen: "home", dayId: initialDayId }, "", "#home");
  selectedDayId = initialDayId;
  activeHomeDayId = initialDayId;
  showScreen(initialScreen);
}

window.addEventListener("popstate", (event) => {
  const state = event.state || {};
  if (state.dayId && days.some((day) => day.id === state.dayId)) {
    selectedDayId = state.dayId;
    activeHomeDayId = state.dayId;
  }
  showScreen(state.screen || screenFromHash(), { history: false });
});

backToHome.addEventListener("click", () => showScreen("home", { replace: true }));
backToDay.addEventListener("click", () => showScreen("day", { replace: true }));
openAddMeal.addEventListener("click", () => {
  editingMealId = null;
  showScreen("add");
});

dayPalette.addEventListener("click", () => {
  const day = getSelectedDay();
  day.paletteShift = ((day.paletteShift || 0) + 5) % 16;
  saveDays();
  renderDay();
});

dateSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = dateSearch.value.trim().toLowerCase();
  const match = days.find((day) => {
    const display = `${formatDay(day.date).weekday} ${formatDay(day.date).shortNumeric} ${formatDay(day.date).title}`;
    return display.toLowerCase().includes(query);
  });

  if (match) {
    selectedDayId = match.id;
    activeHomeDayId = match.id;
    renderHome();
    scrollPaletteIntoView(match.id);
  }
});

clearDateSearch.addEventListener("click", () => {
  dateSearch.value = "";
  updateSearchClear();
  dateSearch.focus();
});

dateSearch.addEventListener("input", updateSearchClear);

paletteScroll.addEventListener("scroll", () => {
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame);
  }

  scrollFrame = window.requestAnimationFrame(syncHomeToCenter);
});

chipButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const current = mealInput.value.trim();
    mealInput.value = current ? `${current}, ${button.dataset.food.toLowerCase()}` : button.dataset.food;
    mealInput.focus();
  });
});

tagButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedTag = button.dataset.tag;
    updateSelectedTag();
  });
});

mealForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = mealInput.value.trim();

  if (!text) {
    mealInput.focus();
    return;
  }

  const day = getSelectedDay();
  const existingMeal = day.meals.find((meal) => meal.id === editingMealId);

  if (existingMeal) {
    const weights = interpretMeal(text);
    existingMeal.text = text;
    existingMeal.tag = selectedTag;
    existingMeal.weights = weights;
    existingMeal.caption = makeMealCaption(text, weights);
  } else {
    day.meals.push(makeMeal(text, selectedTag));
  }

  editingMealId = null;
  mealInput.value = "";
  saveDays();
  renderHome();
  renderDay();
  showScreen("day", { replace: true });
});

function showScreen(name, options = {}) {
  const screenName = ["home", "day", "add"].includes(name) ? name : "home";

  homeScreen.classList.toggle("active", screenName === "home");
  dayScreen.classList.toggle("active", screenName === "day");
  addScreen.classList.toggle("active", screenName === "add");

  if (options.history !== false) {
    const state = { screen: screenName, dayId: selectedDayId };
    const hash = screenHash(screenName);
    if (options.replace) {
      window.history.replaceState(state, "", hash);
    } else {
      window.history.pushState(state, "", hash);
    }
  }

  if (screenName === "home") {
    renderHome();
    window.setTimeout(() => scrollPaletteIntoView(activeHomeDayId), 0);
  }

  if (screenName === "day") {
    renderDay();
  }

  if (screenName === "add") {
    renderAdd();
    window.setTimeout(() => mealInput.focus(), 80);
  }
}

function screenFromHash() {
  const hash = window.location.hash.replace("#", "");
  const dayMatch = hash.match(/^(day|add)-(.+)$/);

  if (dayMatch && days.some((day) => day.id === dayMatch[2])) {
    selectedDayId = dayMatch[2];
    activeHomeDayId = dayMatch[2];
    return dayMatch[1];
  }

  return "home";
}

function screenHash(name) {
  if (name === "day" || name === "add") {
    return `#${name}-${selectedDayId}`;
  }

  return "#home";
}

function renderHome() {
  paletteScroll.innerHTML = "";

  days.forEach((day) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-card";
    button.dataset.dayId = day.id;
    button.setAttribute("aria-label", `Open ${formatDay(day.date).title}`);

    const grid = document.createElement("span");
    grid.className = `palette-grid${day.meals.length === 0 ? " is-empty" : ""}`;

    buildBlocks(day, 16).forEach((category) => {
      const block = document.createElement("span");
      block.className = `palette-block block-${category}`;
      grid.append(block);
    });

    button.append(grid);

    button.addEventListener("click", () => {
      selectedDayId = day.id;
      activeHomeDayId = day.id;
      showScreen("day");
    });

    paletteScroll.append(button);
  });

  updateHomeDate(activeHomeDayId);
  updateHomeActiveCard();
  updateSearchClear();
  window.requestAnimationFrame(syncHomeToCenter);
}

function syncHomeToCenter() {
  const cards = [...paletteScroll.querySelectorAll(".palette-card")];

  if (cards.length === 0) {
    return;
  }

  const scrollRect = paletteScroll.getBoundingClientRect();
  const scrollCenter = scrollRect.top + scrollRect.height / 2;
  const centered = cards
    .map((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.top + rect.height / 2;
      return { card, distance: Math.abs(cardCenter - scrollCenter) };
    })
    .sort((a, b) => a.distance - b.distance)[0].card;

  if (centered.dataset.dayId !== activeHomeDayId) {
    activeHomeDayId = centered.dataset.dayId;
    updateHomeDate(activeHomeDayId);
  }

  updateHomeActiveCard();
}

function updateHomeDate(dayId) {
  const day = days.find((item) => item.id === dayId) || getSelectedDay();
  const formatted = formatDay(day.date);
  homeWeekday.textContent = formatted.weekday;
  homeDate.textContent = formatted.shortNumeric;
}

function updateHomeActiveCard() {
  paletteScroll.querySelectorAll(".palette-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.dayId === activeHomeDayId);
  });
}

function scrollPaletteIntoView(dayId) {
  const card = paletteScroll.querySelector(`[data-day-id="${dayId}"]`);
  if (card) {
    card.scrollIntoView({ block: "center" });
  }
}

function renderDay() {
  const day = getSelectedDay();
  const formatted = formatDay(day.date);
  dayTitle.textContent = formatted.title;
  dayRelative.textContent = formatted.relative;
  addTitle.textContent = formatted.title;
  dailyNudge.textContent = makeDailyNudge(getTotals(day));
  renderDayPalette(day);
  renderMeals(day);
}

function renderAdd() {
  const formatted = formatDay(getSelectedDay().date);
  addTitle.textContent = formatted.title;

  if (!editingMealId) {
    mealInput.value = "";
    selectedTag = null;
    updateSelectedTag();
  }
}

function renderDayPalette(day) {
  dayPalette.innerHTML = "";
  buildBlocks(day, 16).forEach((category) => {
    const block = document.createElement("span");
    block.className = `day-block block-${category}`;
    dayPalette.append(block);
  });
}

function renderMeals(day) {
  mealList.innerHTML = "";

  if (day.meals.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "no meals here yet. the palette is loitering politely.";
    mealList.append(empty);
    return;
  }

  [...day.meals].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)).forEach((meal) => {
    const entry = document.createElement("article");
    entry.className = "meal-entry";

    const time = document.createElement("p");
    time.className = "meal-time";
    time.textContent = meal.time;

    const rule = document.createElement("span");
    rule.className = "meal-rule";

    const body = document.createElement("div");
    body.className = "meal-body";

    const strip = document.createElement("div");
    strip.className = "meal-strip";
    expandedSequence(meal.weights, 6).forEach((category) => {
      const swatch = document.createElement("span");
      swatch.className = `block-${category}`;
      strip.append(swatch);
    });

    const text = document.createElement("p");
    text.className = "meal-text";
    text.append(document.createTextNode(`${meal.text} `));

    if (meal.tag) {
      const tag = document.createElement("span");
      tag.className = "meal-tag";
      tag.textContent = `#${meal.tag}`;
      text.append(tag);
    }

    const actions = document.createElement("div");
    actions.className = "meal-actions";

    const editButton = document.createElement("button");
    editButton.className = "icon-button";
    editButton.type = "button";
    editButton.setAttribute("aria-label", `Edit ${meal.text}`);
    editButton.innerHTML = '<img src="assets/edit.svg" alt="" />';
    editButton.addEventListener("click", () => startEditMeal(meal.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-button";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete ${meal.text}`);
    deleteButton.innerHTML = '<img src="assets/trash.svg" alt="" />';
    deleteButton.addEventListener("click", () => deleteMeal(meal.id));

    actions.append(editButton, deleteButton);

    body.append(strip, text, actions);
    entry.append(time, rule, body);
    mealList.append(entry);
  });
}

function updateSearchClear() {
  clearDateSearch.classList.toggle("is-visible", dateSearch.value.trim().length > 0);
}

async function loadFoodMacros() {
  try {
    const response = await fetch("data/food-macros.json");
    if (!response.ok) {
      return;
    }
    foodMacroLookup = await response.json();
  } catch {
    foodMacroLookup = [];
  }
}

function startEditMeal(mealId) {
  const day = getSelectedDay();
  const meal = day.meals.find((item) => item.id === mealId);

  if (!meal) {
    return;
  }

  editingMealId = meal.id;
  selectedTag = meal.tag;
  mealInput.value = meal.text;
  updateSelectedTag();
  showScreen("add");
}

function deleteMeal(mealId) {
  const day = getSelectedDay();
  day.meals = day.meals.filter((meal) => meal.id !== mealId);
  saveDays();
  renderHome();
  renderDay();
}

function updateSelectedTag() {
  tagButtons.forEach((tag) => tag.classList.toggle("selected", tag.dataset.tag === selectedTag));
}

function buildBlocks(day, size) {
  if (day.meals.length === 0) {
    return Array.from({ length: size }, () => "empty");
  }

  const sequence = expandedSequence(getTotals(day), size);
  const shift = day.paletteShift || 0;
  return sequence.map((_, index) => sequence[(index + shift) % sequence.length]);
}

function makeMeal(text, tag) {
  const weights = interpretMeal(text);

  return {
    id: makeId(),
    text,
    tag,
    time: makeTimeLabel(),
    weights,
    caption: makeMealCaption(text, weights),
  };
}

function interpretMeal(text) {
  const clean = text.toLowerCase();
  const weights = { carb: 0, protein: 0, fats: 0, fibre: 0 };

  Object.entries(foodWords).forEach(([category, words]) => {
    words.forEach((word) => {
      const matcher = new RegExp(`\b${word}\b`, "i");
      if (matcher.test(clean)) {
        weights[category] += 2;
      }
    });
  });

  const usdaWeights = interpretMealFromLookup(text);
  if (usdaWeights) {
    Object.keys(weights).forEach((category) => {
      weights[category] += usdaWeights[category];
    });
  }

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return total > 0 ? weights : { ...fallbackWeights };
}

function interpretMealFromLookup(text) {
  if (foodMacroLookup.length === 0) {
    return null;
  }

  const words = mealTokens(text);
  const matches = foodMacroLookup
    .map((food) => ({ food, score: foodMatchScore(food, words) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (matches.length === 0) {
    return null;
  }

  const weights = { carb: 0, protein: 0, fats: 0, fibre: 0 };
  matches.forEach(({ food, score }) => {
    Object.keys(weights).forEach((category) => {
      weights[category] += (food.macros[category] || 0) * score;
    });
  });

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return total > 0 ? softenWeights(weights) : null;
}

function mealTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s,]/g, " ")
    .split(/[\s,]+/)
    .map((word) => commonFoodAliases[word] || word)
    .filter((word) => word.length > 2);
}

function foodMatchScore(food, words) {
  const description = food.description.toLowerCase();
  return words.reduce((score, word) => {
    if (food.tokens.includes(word)) {
      return score + 3;
    }

    if (description.includes(word)) {
      return score + 1;
    }

    return score;
  }, 0);
}

function softenWeights(weights) {
  const strongest = Math.max(...Object.values(weights));
  if (strongest <= 0) {
    return { ...fallbackWeights };
  }

  return Object.fromEntries(
    Object.entries(weights).map(([category, value]) => [category, Math.max(0, Math.round((value / strongest) * 5))]),
  );
}

function makeMealCaption(text, weights) {
  const lower = text.toLowerCase();
  const top = sortedCategories(weights)[0];

  if (lower.includes("ramen") || lower.includes("noodle")) {
    return weights.fibre > 0 ? "warm, slurpy, a little green" : "warm, slurpy, fully committed";
  }

  if (top === "fibre") {
    return "crunch has entered the chat";
  }

  if (top === "protein") {
    return "pink is carrying a tiny chair.";
  }

  if (weights.fats >= 2 && weights.fibre >= 2) {
    return "bright, mossy, quietly pleased.";
  }

  return "softly sorted. not science homework.";
}

function makeDailyNudge(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return "No bites logged yet. The palette is blank, but in a dignified way.";
  }

  const share = (category) => weights[category] / total;

  if (share("protein") < 0.16) {
    return "A little low in red. Adding protein will help you feel satiated longer.";
  }

  if (share("fibre") < 0.16) {
    return "Green is shy today. Fruit, beans, cucumber, or seeds could make the day less floppy.";
  }

  if (share("carb") > 0.45) {
    return "Very blue and soft today. Respectable. A little crunch might make it sing.";
  }

  if (share("fats") > 0.34) {
    return "Yellow is lounging. Delicious behavior. Maybe invite something green next.";
  }

  return "A gentle mix today. Nobody needs to make a spreadsheet about it.";
}

function getTotals(day) {
  return day.meals.reduce(
    (sum, meal) => ({
      carb: sum.carb + meal.weights.carb,
      protein: sum.protein + meal.weights.protein,
      fats: sum.fats + meal.weights.fats,
      fibre: sum.fibre + meal.weights.fibre,
    }),
    { carb: 0, protein: 0, fats: 0, fibre: 0 },
  );
}

function expandedSequence(weights, size) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const base = total > 0 ? weights : fallbackWeights;
  const baseTotal = Object.values(base).reduce((sum, value) => sum + value, 0);
  const sequence = [];

  Object.keys(macroColors).forEach((category) => {
    const count = Math.max(1, Math.round((base[category] / baseTotal) * size));
    for (let index = 0; index < count; index += 1) {
      sequence.push(category);
    }
  });

  const sorted = sequence.sort((a, b) => sortedCategories(base).indexOf(a) - sortedCategories(base).indexOf(b));

  while (sorted.length < size) {
    sorted.push(sortedCategories(base)[0]);
  }

  return sorted.slice(0, size);
}

function sortedCategories(weights) {
  return Object.keys(macroColors).sort((a, b) => weights[b] - weights[a]);
}

function getSelectedDay() {
  return days.find((day) => day.id === selectedDayId) || days[0];
}

function loadDays() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      return normalizeDays(JSON.parse(stored));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return normalizeDays(makeSeedDays());
}

function saveDays() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}

function makeSeedDays() {
  const today = new Date();
  const offsets = [-6, -5, -4, -3, -2, -1, 0];
  const seedMeals = [
    ["rice, tofu, cucumber", "lunch"],
    ["ramen cup, cabbage", "dinner"],
    ["1 cup of yogurt, 5 frozen strawberries, 1tsp of pumpkin seeds", "breakfast"],
    ["10 almonds, 1 apple", "snack"],
    ["toast, egg, avocado", "breakfast"],
    ["coffee, toast", "breakfast"],
    ["tofu, cucumber, rice", "lunch"],
  ];

  return offsets.map((offset, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const meals = offset === 0 ? [] : [seedMeals[index]];

    return {
      id: toDateId(date),
      date: toDateId(date),
      paletteShift: index * 3,
      meals: meals.map(([text, tag], mealIndex) => ({
        ...makeMeal(text, tag),
        time: mealIndex === 0 ? "8:30AM" : "11:30AM",
      })),
    };
  });
}

function normalizeDays(inputDays) {
  const byId = new Map();
  const windowIds = new Set();

  for (let offset = -6; offset <= 0; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    windowIds.add(toDateId(date));
  }

  if (Array.isArray(inputDays)) {
    inputDays.forEach((day) => {
      if (day && day.date && windowIds.has(day.date)) {
        byId.set(day.date, {
          ...day,
          id: day.date,
          meals: Array.isArray(day.meals) ? day.meals : [],
        });
      }
    });
  }

  for (let offset = -6; offset <= 0; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const id = toDateId(date);

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        date: id,
        paletteShift: (offset + 6) * 2,
        meals: [],
      });
    }
  }

  return [...byId.values()].sort((a, b) => fromDateId(a.date) - fromDateId(b.date));
}

function formatDay(dateId) {
  const date = fromDateId(dateId);
  const today = new Date();
  const isToday = toDateId(today) === dateId;
  const weekday = new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
  const month = new Intl.DateTimeFormat("en", { month: "long" }).format(date);
  const dateNumber = date.getDate();

  return {
    weekday,
    shortNumeric: `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`,
    title: `${weekday} ${dateNumber} ${month}`,
    relative: isToday ? "Today" : "",
    date,
  };
}

function todayId() {
  return toDateId(new Date());
}

function toDateId(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromDateId(dateId) {
  const [year, month, day] = dateId.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function makeTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date())
    .replace(" ", "");
}

function timeToMinutes(label) {
  const match = label.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);

  if (!match) {
    return 0;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) {
    hours += 12;
  }

  if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
