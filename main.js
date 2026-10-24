// ゲーム状態管理
const SAVE_KEY = "tensho_mission_save_v1";

let gameState = {
  version: STORY_DATA.version,
  protagonist: null,
  currentEventId: null,
  params: {
    faith: 0, // 信念
    bond: 0,  // 絆
    adapt: 0  // 適応
  },
  historyLog: []
};

// 初期化処理
document.addEventListener("DOMContentLoaded", () => {
  initTitleScreen();
  renderProtagonistCards();
  bindEvents();
});

// 画面切り替え関数
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(el => {
    el.classList.remove("active");
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

// タイトル画面の初期化（セーブデータの有無確認）
function initTitleScreen() {
  const saved = loadGameFromStorage();
  const btnContinue = document.getElementById("btn-continue");
  if (saved && saved.currentEventId) {
    btnContinue.disabled = false;
  } else {
    btnContinue.disabled = true;
  }
}

// 主人公選択カードの生成
function renderProtagonistCards() {
  const container = document.getElementById("protagonist-list");
  container.innerHTML = "";

  Object.values(STORY_DATA.protagonists).forEach(proto => {
    const card = document.createElement("div");
    card.className = "protagonist-card";
    card.innerHTML = `
      <h3>${proto.name} <small>（${proto.lifespan}）</small></h3>
      <p class="protagonist-theme">${proto.theme}</p>
      <p class="protagonist-desc">${proto.summary}</p>
      <button class="primary-btn" data-proto="${proto.id}">${proto.name}で始める</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      startNewGame(proto.id);
    });
    container.appendChild(card);
  });
}

// 各種ボタンイベントの登録
function bindEvents() {
  // タイトル画面ボタン
  document.getElementById("btn-new-game").addEventListener("click", () => {
    showScreen("select-screen");
  });

  document.getElementById("btn-continue").addEventListener("click", () => {
    const saved = loadGameFromStorage();
    if (saved) {
      gameState = saved;
      showScreen("story-screen");
      renderEvent(gameState.currentEventId);
    }
  });

  document.getElementById("btn-profiles").addEventListener("click", () => {
    openProfilesModal();
  });

  // 主人公選択からタイトルへ戻る
  document.getElementById("btn-back-to-title").addEventListener("click", () => {
    initTitleScreen();
    showScreen("title-screen");
  });

  // ストーリー画面のヘッダーボタン
  document.getElementById("btn-to-title").addEventListener("click", () => {
    initTitleScreen();
    showScreen("title-screen");
  });

  document.getElementById("btn-log").addEventListener("click", () => {
    openLogModal();
  });

  // エンディング画面ボタン
  document.getElementById("btn-reselect").addEventListener("click", () => {
    showScreen("select-screen");
  });

  document.getElementById("btn-ending-to-title").addEventListener("click", () => {
    initTitleScreen();
    showScreen("title-screen");
  });

  // モーダルを閉じる
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("hidden");
  });
}

// 新規ゲーム開始
function startNewGame(protagonistId) {
  gameState = {
    version: STORY_DATA.version,
    protagonist: protagonistId,
    currentEventId: "prologue_1",
    params: { faith: 0, bond: 0, adapt: 0 },
    historyLog: []
  };
  saveGameToStorage();
  showScreen("story-screen");
  renderEvent(gameState.currentEventId);
}

// イベントの表示処理
function renderEvent(eventId) {
  // エンディングIDの場合はエンディング画面へ
  if (eventId.startsWith("ending_")) {
    renderEnding(eventId);
    return;
  }

  const ev = STORY_DATA.events[eventId];
  if (!ev) {
    console.error("イベントが見つかりません:", eventId);
    return;
  }

  gameState.currentEventId = eventId;
  saveGameToStorage();

  // 主人公名とパラメータの更新
  const proto = STORY_DATA.protagonists[gameState.protagonist];
  document.getElementById("protagonist-name-display").textContent = `視点：${proto.name}`;
  document.getElementById("param-faith").textContent = gameState.params.faith;
  document.getElementById("param-bond").textContent = gameState.params.bond;
  document.getElementById("param-adapt").textContent = gameState.params.adapt;

  // 日付・場所・史実区分バッジ
  document.getElementById("story-date").textContent = ev.date;
  document.getElementById("story-location").textContent = ev.location;

  const statusEl = document.getElementById("story-status");
  statusEl.className = "status-badge";
  if (ev.historical_status === "fact") {
    statusEl.textContent = "史実 (fact)";
    statusEl.classList.add("status-fact");
  } else if (ev.historical_status === "reconstruction") {
    statusEl.textContent = "史実再構成 (reconstruction)";
    statusEl.classList.add("status-reconstruction");
  } else {
    statusEl.textContent = "創作 (fiction)";
    statusEl.classList.add("status-fiction");
  }

  // 背景・立ち絵プレースホルダー更新
  document.getElementById("bg-placeholder").textContent = `背景: ${ev.bg || ev.location}`;
  document.getElementById("chara-placeholder").textContent = `人物: ${ev.chara || proto.name}`;

  // 本文と出典
let fullText = ev.text;
  if (ev.protagonist_thoughts && ev.protagonist_thoughts[gameState.protagonist]) {
    fullText += "\n\n" + ev.protagonist_thoughts[gameState.protagonist];
  }
  document.getElementById("story-text").textContent = fullText;

  const sourcesEl = document.getElementById("story-sources");
  if (ev.sources && ev.sources.length > 0) {
    sourcesEl.textContent = "参考・根拠: " + ev.sources.join(" / ");
  } else {
    sourcesEl.textContent = "";
  }
  // 会話ログへの記録（重複防止）
  const lastLog = gameState.historyLog[gameState.historyLog.length - 1];
  if (!lastLog || lastLog.eventId !== eventId) {
    gameState.historyLog.push({
      eventId: eventId,
      title: `${ev.chapter}（${ev.date}・${ev.location}）`,
      text: ev.text
    });
  }

  // 選択肢 または「次へ」ボタンの表示制御
  const choicesContainer = document.getElementById("choices-container");
  const btnNext = document.getElementById("btn-next");
  choicesContainer.innerHTML = "";

  if (ev.choices && ev.choices.length > 0) {
    btnNext.style.display = "none";
    ev.choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = choice.text;
      btn.addEventListener("click", () => {
        applyChoice(choice);
      });
      choicesContainer.appendChild(btn);
    });
  } else {
    btnNext.style.display = "inline-block";
    btnNext.onclick = () => {
      const nextId = resolveNextEventId(ev.next);
      renderEvent(nextId);
    };
  }
}

// 選択肢を選んだ際の処理
function applyChoice(choice) {
  if (choice.effects) {
    gameState.params.faith = Math.min(5, Math.max(0, gameState.params.faith + (choice.effects.faith || 0)));
    gameState.params.bond = Math.min(5, Math.max(0, gameState.params.bond + (choice.effects.bond || 0)));
    gameState.params.adapt = Math.min(5, Math.max(0, gameState.params.adapt + (choice.effects.adapt || 0)));
  }

  gameState.historyLog.push({
    eventId: "choice",
    title: "【あなたの選択】",
    text: `＞ ${choice.text}`
  });

  const nextId = resolveNextEventId(choice.next);
  renderEvent(nextId);
}

// 特殊遷移先（@protagonist_route）の解決
function resolveNextEventId(nextId) {
  if (nextId === "@protagonist_route") {
    const proto = STORY_DATA.protagonists[gameState.protagonist];
    return proto.startNextId;
  }
  return nextId;
}

// エンディング画面の表示
function renderEnding(endingId) {
  const endData = STORY_DATA.endings[endingId];
  if (!endData) return;

  document.getElementById("ending-title").textContent = endData.title;
  document.getElementById("ending-text").textContent = endData.endingText;

  // パラメータに応じた回想・解釈テキストの生成
  const reflectionText = buildReflectionText(gameState.params);
  document.getElementById("ending-reflection").textContent = reflectionText;

  document.getElementById("historical-note").textContent = endData.historicalNote;
  document.getElementById("historical-sources").textContent =
    "主な確認資料: " + (endData.sources ? endData.sources.join(" / ") : "なし");

  // エンディング到達時は進行中セーブデータをクリア
  clearSaveStorage();
  showScreen("ending-screen");
}

// パラメータ（信念・絆・適応）に応じたエピローグ解釈文
function buildReflectionText(params) {
  const { faith, bond, adapt } = params;
  let line = `【あなたの選択が映し出す旅の記憶（信念:${faith} / 絆:${bond} / 適応:${adapt}）】\n`;

  if (faith >= bond && faith >= adapt) {
    line += "あなたは旅の始まりから終わりまで、「自らの信じる道や使命とは何か」を強く問い続けました。時代がどれほど激しく変わろうとも、胸の奥にある信念の灯火が、彼の歩みを支えていました。";
  } else if (bond >= faith && bond >= adapt) {
    line += "あなたは遠い異国への旅でも、帰国後の厳しい時代においても、「共に旅した仲間や人々との繋がり」を何より大切にしました。4人で海を渡った記憶は、生涯消えることのない絆となっていました。";
  } else {
    line += "あなたは未知の文化や移り変わる日本の現実を冷静に見つめ、「変化のなかでどう生きるべきか」を模索し続けました。広い世界を知ったからこそ見えた視点が、彼の人生を形作っていました。";
  }
  return line;
}

// モーダル表示：人物紹介
function openProfilesModal() {
  document.getElementById("modal-title").textContent = "天正遣欧少年使節 ― 4人の人物紹介";
  const body = document.getElementById("modal-body");
  body.innerHTML = Object.values(STORY_DATA.protagonists).map(p => {
    return `■ ${p.name}（${p.lifespan}）\n${p.theme}\n${p.summary}\n`;
  }).join("\n");
  document.getElementById("modal-overlay").classList.remove("hidden");
}

// モーダル表示：会話ログ
function openLogModal() {
  document.getElementById("modal-title").textContent = "これまでの歩み（会話履歴）";
  const body = document.getElementById("modal-body");
  if (gameState.historyLog.length === 0) {
    body.textContent = "履歴はまだありません。";
  } else {
    body.textContent = gameState.historyLog.map(item => `${item.title}\n${item.text}\n`).join("\n----------------\n");
  }
  document.getElementById("modal-overlay").classList.remove("hidden");
}

// セーブ・ロード（localStorage非対応環境でもエラーで止まらない設計）
function saveGameToStorage() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  } catch (e) {
    console.warn("localStorageが利用できないため、メモリ上のみで進行します。");
  }
}

function loadGameFromStorage() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearSaveStorage() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // 無視
  }
}