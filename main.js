const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const killFeedEl = document.getElementById("killFeed");
const scoreboardEl = document.getElementById("scoreboard");
const ammoHudEl = document.getElementById("ammoHud");

const gearBtn = document.getElementById("gearBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const mobileModeCheckbox = document.getElementById("mobileModeCheckbox");

const mobileControls = document.getElementById("mobileControls");
const joystick = document.getElementById("joystick");
const joystickStick = document.getElementById("joystickStick");
const fireBtn = document.getElementById("fireBtn");
const reloadBtn = document.getElementById("reloadBtn");
const jumpBtn = document.getElementById("jumpBtn");

let player = null;
let cameraX = 0;
let lastTime = 0;

const input = {
  left: false,
  right: false,
  jumpPressed: false,
  mouseDown: false
};

let mouseX = window.innerWidth * 0.65;
let mouseY = window.innerHeight * 0.45;

let bots = [];
let bullets = [];

let redKills = 0;
let blueKills = 0;
let killFeed = [];
let scoreboardVisible = false;

let settingsOpen = false;
let mobileModeEnabled = false;

const MOBILE_MODE_STORAGE_KEY = "battleSE_mobileMode";

let joystickActive = false;
let joystickPointerId = null;
let joystickCenterX = 0;
let joystickCenterY = 0;
const joystickRadius = 48;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function teamName(team) {
  return team === "ally" ? "红队" : "蓝队";
}

function teamColor(team) {
  return team === "ally" ? "#ff6666" : "#6bb0ff";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateCamera() {
  cameraX = player.x + player.w / 2 - canvas.width / 2;
  cameraX = clamp(cameraX, 0, Math.max(0, WORLD.width - canvas.width));
}

function getLeaderboardEntries() {
  return [player, ...bots]
    .filter(Boolean)
    .sort((a, b) => {
      if ((b.kills || 0) !== (a.kills || 0)) {
        return (b.kills || 0) - (a.kills || 0);
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

function updateHUD() {
  if (killFeed.length > 0) {
    const latest = killFeed[0];
    killFeedEl.innerHTML = `
      <span style="color:${teamColor(latest.killerTeam)}">${escapeHtml(latest.killerName)}</span>
      击杀
      <span style="color:${teamColor(latest.victimTeam)}">${escapeHtml(latest.victimName)}</span>
    `;
  } else {
    killFeedEl.textContent = "击杀提示（点击查看排行榜）";
  }

  if (player) {
    ammoHudEl.textContent =
      player.weapon.ammo > 0
        ? `${player.weapon.ammo}/${player.weapon.magSize}`
        : "无子弹";
  }

  if (!scoreboardVisible) {
    scoreboardEl.style.display = "none";
    return;
  }

  const leaderboard = getLeaderboardEntries()
    .slice(0, 10)
    .map((entity, index) => {
      return `
        <div style="display:flex; justify-content:space-between; margin:2px 0; color:${teamColor(entity.team)};">
          <span>${index + 1}. ${escapeHtml(entity.name || teamName(entity.team))}</span>
          <span>${entity.kills || 0} 杀</span>
        </div>
      `;
    })
    .join("");

  const recentKills = killFeed
    .map((item) => {
      return `
        <div style="margin:2px 0;">
          <span style="color:${teamColor(item.killerTeam)}">${escapeHtml(item.killerName)}</span>
          击杀
          <span style="color:${teamColor(item.victimTeam)}">${escapeHtml(item.victimName)}</span>
        </div>
      `;
    })
    .join("");

  scoreboardEl.style.display = "block";
  scoreboardEl.innerHTML = `
    <div style="font-size:20px; margin-bottom:8px;">排行榜</div>
    <div style="display:flex; gap:10px; margin-bottom:12px;">
      <div style="flex:1; padding:6px 8px; border:1px solid rgba(255,102,102,0.35); color:#ff6666;">
        红队击杀数：${redKills}
      </div>
      <div style="flex:1; padding:6px 8px; border:1px solid rgba(107,176,255,0.35); color:#6bb0ff;">
        蓝队击杀数：${blueKills}
      </div>
    </div>

    <div style="margin-bottom:6px; font-size:16px;">个人击杀榜</div>
    <div style="line-height:1.5; margin-bottom:12px;">
      ${leaderboard || "<div>暂无排行</div>"}
    </div>

    <div style="margin-bottom:6px; font-size:16px;">最近击杀</div>
    <div style="line-height:1.5;">
      ${recentKills || "<div>暂无击杀</div>"}
    </div>
  `;
}

function toggleScoreboard() {
  scoreboardVisible = !scoreboardVisible;
  updateHUD();
}

killFeedEl.addEventListener("click", toggleScoreboard);

function registerKill(killer, victim) {
  if (!killer || !victim) return;

  killer.kills = (killer.kills || 0) + 1;

  if (killer.team === "ally") redKills += 1;
  if (killer.team === "enemy") blueKills += 1;

  killFeed.unshift({
    killerName: killer.name || teamName(killer.team),
    killerTeam: killer.team,
    victimName: victim.name || teamName(victim.team),
    victimTeam: victim.team
  });

  if (killFeed.length > 6) killFeed.pop();

  updateHUD();
}

function drawHealthBar(ctx, x, y, w, health, maxHealth) {
  const barW = w;
  const barH = 7;
  const pct = Math.max(0, Math.min(1, health / maxHealth));

  ctx.save();
  ctx.fillStyle = "#4b0000";
  ctx.fillRect(x, y, barW, barH);

  ctx.fillStyle = "#39d353";
  ctx.fillRect(x, y, barW * pct, barH);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);
  ctx.restore();
}

function pointInRect(px, py, x, y, w, h, pad = 0) {
  return px >= x - pad && px <= x + w + pad && py >= y - pad && py <= y + h + pad;
}

function getDamageByHit(entity, bulletY) {
  const relY = bulletY - entity.y;

  if (relY <= entity.h * 0.18) return 45;
  if (relY <= entity.h * 0.80) return 32;
  return 18;
}

function buildBotName(team, index) {
  const n = String(index).padStart(2, "0");
  return team === "ally" ? `红队-${n}` : `蓝队-${n}`;
}

function createBots() {
  bots = [];

  const groundY = getGroundY(canvas.height);
  const botY = groundY - 102;
  const spacing = 85;

  for (let i = 0; i < 20; i++) {
    bots.push(new Bot(40 + i * spacing, botY, "ally", buildBotName("ally", i + 1)));
  }

  for (let i = 0; i < 20; i++) {
    bots.push(new Bot(WORLD.width - 40 - 68 - i * spacing, botY, "enemy", buildBotName("enemy", i + 1)));
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update(dt);
    if (!bullets[i].alive) bullets.splice(i, 1);
  }
}

function handleBulletHits() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet.alive) continue;

    let hitTarget = null;

    if (bullet.team !== player.team && !player.dead) {
      if (pointInRect(bullet.x, bullet.y, player.x, player.y, player.w, player.h, 4)) {
        hitTarget = player;
      }
    }

    if (!hitTarget) {
      for (const bot of bots) {
        if (bot.dead) continue;
        if (bullet.team === bot.team) continue;

        if (pointInRect(bullet.x, bullet.y, bot.x, bot.y, bot.w, bot.h, 4)) {
          hitTarget = bot;
          break;
        }
      }
    }

    if (hitTarget) {
      const damage = getDamageByHit(hitTarget, bullet.y);
      const impactDir = bullet.vx >= 0 ? 1 : -1;
      const died = hitTarget.takeDamage(damage, impactDir);

      bullet.alive = false;

      if (died) {
        registerKill(
          bullet.ownerRef || { team: bullet.team, name: teamName(bullet.team), kills: 0 },
          hitTarget
        );
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].alive) bullets.splice(i, 1);
  }
}

function update(dt) {
  player.update(dt, input, canvas.height);

  if (input.mouseDown && !player.dead) {
    const aimWorldX = mouseX + cameraX;
    const aimWorldY = mouseY;

    player.weapon.shootFromWorld(
      player.x,
      player.y,
      player.w,
      player.h,
      aimWorldX,
      aimWorldY,
      bullets,
      player.team,
      player
    );
  }

  for (let i = 0; i < bots.length; i++) {
    bots[i].update(dt, canvas.height, player, bots, bullets);
  }

  updateBullets(dt);
  handleBulletHits();
  updateCamera();
  updateHUD();
}

function draw() {
  drawMap1(ctx, canvas, cameraX);

  for (const bot of bots) {
    bot.draw(ctx, cameraX);
  }

  player.draw(ctx, cameraX, mouseX, mouseY);

  for (const bullet of bullets) {
    bullet.draw(ctx, cameraX);
  }
}

function loop(time) {
  if (!lastTime) lastTime = time;
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

function saveMobileMode(enabled) {
  try {
    localStorage.setItem(MOBILE_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch (e) {
    // 不影响游戏
  }
}

function loadMobileMode() {
  try {
    const saved = localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch (e) {
    // 不影响游戏
  }

  const touchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  return touchDevice;
}

function setSettingsOpen(open) {
  settingsOpen = open;
  settingsPanel.style.display = settingsOpen ? "block" : "none";
}

function updateMobileControlsVisibility() {
  mobileControls.style.display = mobileModeEnabled ? "block" : "none";
}

function applyMobileMode(enabled) {
  mobileModeEnabled = !!enabled;
  mobileModeCheckbox.checked = mobileModeEnabled;
  updateMobileControlsVisibility();
  saveMobileMode(mobileModeEnabled);

  if (!mobileModeEnabled) {
    resetJoystick();
    input.mouseDown = false;
    input.jumpPressed = false;
  }

  requestAnimationFrame(updateJoystickCenter);
}

function updateJoystickCenter() {
  const rect = joystick.getBoundingClientRect();
  joystickCenterX = rect.left + rect.width / 2;
  joystickCenterY = rect.top + rect.height / 2;
}

function setJoystickVisual(dx, dy) {
  joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetJoystick() {
  joystickActive = false;
  joystickPointerId = null;
  input.left = false;
  input.right = false;
  setJoystickVisual(0, 0);
}

function updateJoystickFromPoint(clientX, clientY) {
  const dx = clientX - joystickCenterX;
  const dy = clientY - joystickCenterY;
  const dist = Math.hypot(dx, dy);

  let useX = dx;
  let useY = dy;

  if (dist > joystickRadius) {
    const k = joystickRadius / dist;
    useX *= k;
    useY *= k;
  }

  setJoystickVisual(useX, useY);

  const deadZone = 12;
  input.left = useX < -deadZone;
  input.right = useX > deadZone;
}

function startGame() {
  resizeCanvas();

  player = new Player(300, getGroundY(canvas.height) - 102);
  createBots();

  updateHUD();
  lastTime = 0;

  requestAnimationFrame(updateJoystickCenter);
  requestAnimationFrame(loop);
}

gearBtn.addEventListener("click", () => {
  setSettingsOpen(!settingsOpen);
});

closeSettingsBtn.addEventListener("click", () => {
  setSettingsOpen(false);
});

mobileModeCheckbox.addEventListener("change", () => {
  applyMobileMode(mobileModeCheckbox.checked);
  setSettingsOpen(false);
});

joystick.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled) return;

  e.preventDefault();
  joystickActive = true;
  joystickPointerId = e.pointerId;

  if (joystick.setPointerCapture) {
    joystick.setPointerCapture(e.pointerId);
  }

  updateJoystickCenter();
  updateJoystickFromPoint(e.clientX, e.clientY);
});

window.addEventListener("pointermove", (e) => {
  if (!joystickActive) return;
  if (e.pointerId !== joystickPointerId) return;

  e.preventDefault();
  updateJoystickFromPoint(e.clientX, e.clientY);
});

window.addEventListener("pointerup", (e) => {
  if (e.pointerId !== joystickPointerId) return;
  resetJoystick();
});

window.addEventListener("pointercancel", (e) => {
  if (e.pointerId !== joystickPointerId) return;
  resetJoystick();
});

fireBtn.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled) return;
  e.preventDefault();
  input.mouseDown = true;
  if (fireBtn.setPointerCapture) {
    fireBtn.setPointerCapture(e.pointerId);
  }
});

fireBtn.addEventListener("pointerup", () => {
  input.mouseDown = false;
});

fireBtn.addEventListener("pointercancel", () => {
  input.mouseDown = false;
});

fireBtn.addEventListener("lostpointercapture", () => {
  input.mouseDown = false;
});

reloadBtn.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled) return;
  e.preventDefault();

  if (player) {
    player.weapon.startReload();
  }

  if (reloadBtn.setPointerCapture) {
    reloadBtn.setPointerCapture(e.pointerId);
  }
});

jumpBtn.addEventListener("pointerdown", (e) => {
  if (!mobileModeEnabled) return;
  e.preventDefault();
  input.jumpPressed = true;

  if (jumpBtn.setPointerCapture) {
    jumpBtn.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" || e.pointerType === "pen") {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch" || e.pointerType === "pen") {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  updateJoystickCenter();

  if (player) {
    player.spawnY = getGroundY(canvas.height) - player.h;
    player.y = player.spawnY;
    createBots();
    updateCamera();
    draw();
    updateHUD();
  }
});

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

window.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    input.mouseDown = true;
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    input.mouseDown = false;
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "a" || e.key === "A") input.left = true;
  if (e.key === "d" || e.key === "D") input.right = true;

  if ((e.key === "w" || e.key === "W") && !e.repeat) {
    input.jumpPressed = true;
  }

  if (e.key === "e" || e.key === "E") {
    if (player) {
      player.weapon.startReload();
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "a" || e.key === "A") input.left = false;
  if (e.key === "d" || e.key === "D") input.right = false;
});

function clearInputs() {
  input.left = false;
  input.right = false;
  input.jumpPressed = false;
  input.mouseDown = false;
  resetJoystick();
}

window.addEventListener("blur", clearInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInputs();
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

window.addEventListener("load", () => {
  resizeCanvas();
  mobileModeEnabled = loadMobileMode();
  mobileModeCheckbox.checked = mobileModeEnabled;
  updateMobileControlsVisibility();
  updateJoystickCenter();
  startGame();
});