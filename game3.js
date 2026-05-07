// ===========================
// Game 3 – Flashcards
// ===========================
let g3Deck = [];
let g3Index = 0;
let g3Flipped = false;

const g3el = {
  cardCounter:  document.getElementById("g3-card-counter"),
  progressFill: document.getElementById("g3-progress-fill"),
  flashcard:    document.getElementById("g3-flashcard"),
  frontWord:    document.getElementById("g3-front-word"),
  backWord:     document.getElementById("g3-back-word"),
  prevBtn:      document.getElementById("g3-prev-btn"),
  nextBtn:      document.getElementById("g3-next-btn"),
};

function startGame3() {
  g3Deck = shuffle([...WORDS]);
  g3Index = 0;
  showScreen("game3-screen");
  g3LoadCard();
}

function g3LoadCard() {
  g3Flipped = false;
  g3el.flashcard.classList.remove("flipped");

  const word = g3Deck[g3Index];
  g3el.frontWord.textContent = word.english;
  g3el.backWord.textContent = word.spanish;

  g3el.cardCounter.textContent = `${g3Index + 1} / ${g3Deck.length}`;
  g3el.progressFill.style.width = `${((g3Index + 1) / g3Deck.length) * 100}%`;

  g3el.prevBtn.disabled = g3Index === 0;
  g3el.nextBtn.textContent = g3Index === g3Deck.length - 1 ? "Done ✓" : "Next →";
}

g3el.flashcard.addEventListener("click", () => {
  g3Flipped = !g3Flipped;
  g3el.flashcard.classList.toggle("flipped", g3Flipped);
});

g3el.prevBtn.addEventListener("click", () => {
  if (g3Index > 0) { g3Index--; g3LoadCard(); }
});

g3el.nextBtn.addEventListener("click", () => {
  if (g3Index < g3Deck.length - 1) {
    g3Index++;
    g3LoadCard();
  } else {
    showScreen("home-screen");
  }
});

document.getElementById("g3-shuffle-btn").addEventListener("click", () => {
  g3Deck = shuffle([...WORDS]);
  g3Index = 0;
  g3LoadCard();
});

document.getElementById("g3-home-btn").addEventListener("click", () => showScreen("home-screen"));
document.getElementById("pick-game3").addEventListener("click", () => startGame3());
