class Bot {
  constructor(x, y, team, name = "") {
    this.x = x;
    this.y = y;
    this.team = team;

    this.w = 68;
    this.h = 102;

    this.spawnX = x;
    this.spawnY = y;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;

    this.moveSpeed = 380;
    this.accel = 2400;
    this.friction = 3000;
    this.jumpPower = 820;
    this.gravity = 2120;
    this.fallMultiplier = 1.12;

    this.maxHealth = 100;
    this.health = 100;

    this.regenDelay = 10;
    this.regenDuration = 5;
    this.regenTimer = 0;
    this.regenRate = this.maxHealth / this.regenDuration;

    this.dead = false;
    this.deathTimer = 0;
    this.deathDuration = 1.0;
    this.deathDir = 1;
    this.respawnTimer = 0;
    this.respawnDuration = 2.5;

    this.name = name || (team === "ally" ? "红队" : "蓝队");
    this.kills = 0;

    this.color = team === "ally" ? "#d11f1f" : "#1f4fd1";
    this.weapon = new Weapon({ autoReload: true, fireInterval: 0.2, reloadDuration: 4 });

    this.facingRight = team === "ally";

    this.brainType = ["aggressive", "steady", "erratic", "cautious"][Math.floor(Math.random() * 4)];
    this.behaviorTimer = 0.3 + Math.random() * 1.8;
    this.behavior = "hold";
    this.wanderDir = Math.random() < 0.5 ? -1 : 1;
    this.jumpTimer = 0.6 + Math.random() * 2.2;

    // 7 或 8 个方块的开火距离
    this.engageRangeTiles = 7 + Math.floor(Math.random() * 2);
  }

  takeDamage(amount, impactDir) {
    if (this.dead) return false;

    this.health -= amount;
    this.regenTimer = this.regenDelay;

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.deathTimer = this.deathDuration;
      this.respawnTimer = this.respawnDuration;
      this.deathDir = impactDir >= 0 ? 1 : -1;
      this.vx = 0;
      this.vy = 0;
      return true;
    }

    return false;
  }

  _respawn(canvasHeight) {
    this.x = this.spawnX;
    this.y = this.spawnY || (getGroundY(canvasHeight) - this.h);
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;

    this.health = 100;
    this.dead = false;
    this.deathTimer = 0;
    this.respawnTimer = 0;
    this.regenTimer = 0;

    this.weapon.ammo = this.weapon.magSize;
    this.weapon.isReloading = false;
    this.weapon.cooldown = 0;

    this.behaviorTimer = 0.3 + Math.random() * 1.8;
    this.behavior = "hold";
    this.wanderDir = Math.random() < 0.5 ? -1 : 1;
    this.jumpTimer = 0.6 + Math.random() * 2.2;
    this.facingRight = this.team === "ally";
  }

  _chooseBehavior() {
    const r = Math.random();

    if (this.brainType === "aggressive") {
      if (r < 0.50) this.behavior = "advance";
      else if (r < 0.68) this.behavior = "hold";
      else if (r < 0.82) this.behavior = "retreat";
      else this.behavior = "wander";
    } else if (this.brainType === "cautious") {
      if (r < 0.22) this.behavior = "advance";
      else if (r < 0.52) this.behavior = "hold";
      else if (r < 0.78) this.behavior = "retreat";
      else this.behavior = "wander";
    } else if (this.brainType === "erratic") {
      if (r < 0.35) this.behavior = "wander";
      else if (r < 0.60) this.behavior = "advance";
      else if (r < 0.80) this.behavior = "hold";
      else this.behavior = "retreat";
    } else {
      if (r < 0.34) this.behavior = "advance";
      else if (r < 0.60) this.behavior = "hold";
      else if (r < 0.82) this.behavior = "wander";
      else this.behavior = "retreat";
    }

    this.behaviorTimer = 0.7 + Math.random() * 2.5;
    this.wanderDir = Math.random() < 0.5 ? -1 : 1;
  }

  _aliveEnemies(player, bots) {
    const out = [];

    if (this.team === "ally") {
      for (const bot of bots) {
        if (bot.team === "enemy" && !bot.dead) out.push(bot);
      }
    } else {
      if (!player.dead) out.push(player);
      for (const bot of bots) {
        if (bot.team === "ally" && !bot.dead) out.push(bot);
      }
    }

    return out;
  }

  _pickTarget(player, bots) {
    const list = this._aliveEnemies(player, bots);
    if (list.length === 0) return null;

    const centerX = this.x + this.w / 2;

    const nearest = () => {
      let best = list[0];
      let bestDist = Math.abs((best.x + best.w / 2) - centerX);

      for (const e of list) {
        const d = Math.abs((e.x + e.w / 2) - centerX);
        if (d < bestDist) {
          best = e;
          bestDist = d;
        }
      }
      return best;
    };

    const farthest = () => {
      let best = list[0];
      let bestDist = Math.abs((best.x + best.w / 2) - centerX);

      for (const e of list) {
        const d = Math.abs((e.x + e.w / 2) - centerX);
        if (d > bestDist) {
          best = e;
          bestDist = d;
        }
      }
      return best;
    };

    const roll = Math.random();
    if (roll < 0.65) return nearest();
    if (roll < 0.85) return list[Math.floor(Math.random() * list.length)];
    return farthest();
  }

  update(dt, canvasHeight, player, bots, bullets) {
    this.weapon.update(dt);

    if (this.dead) {
      this.deathTimer -= dt;
      this.respawnTimer -= dt;

      if (this.respawnTimer <= 0) {
        this._respawn(canvasHeight);
      }
      return true;
    }

    if (this.regenTimer > 0) {
      this.regenTimer -= dt;
    } else if (this.health < this.maxHealth) {
      this.health += this.regenRate * dt;
      if (this.health > this.maxHealth) this.health = this.maxHealth;
    }

    const groundY = getGroundY(canvasHeight);
    const teamDir = this.team === "ally" ? 1 : -1;

    this.behaviorTimer -= dt;
    if (this.behaviorTimer <= 0) {
      this._chooseBehavior();
    }

    const target = this._pickTarget(player, bots);

    let moveDir = 0;
    if (this.behavior === "advance") moveDir = teamDir;
    else if (this.behavior === "retreat") moveDir = -teamDir;
    else if (this.behavior === "wander") moveDir = this.wanderDir;
    else moveDir = 0;

    const leftBattleEdge = WORLD.width * 0.08;
    const rightBattleEdge = WORLD.width * 0.92;

    if (this.team === "ally" && this.x < leftBattleEdge) {
      moveDir = Math.max(moveDir, 1);
    }
    if (this.team === "enemy" && this.x > rightBattleEdge) {
      moveDir = Math.min(moveDir, -1);
    }

    const ignoreEnemy = Math.random() < 0.20 && this.behavior !== "hold";

    if (moveDir !== 0) {
      this.vx += moveDir * this.accel * dt;
    } else {
      if (this.vx > 0) {
        this.vx -= this.friction * dt;
        if (this.vx < 0) this.vx = 0;
      } else if (this.vx < 0) {
        this.vx += this.friction * dt;
        if (this.vx > 0) this.vx = 0;
      }
    }

    if (this.vx > this.moveSpeed) this.vx = this.moveSpeed;
    if (this.vx < -this.moveSpeed) this.vx = -this.moveSpeed;

    this.jumpTimer -= dt;
    if (this.onGround && this.jumpTimer <= 0) {
      if (Math.random() < 0.45 && (moveDir !== 0 || this.behavior === "advance")) {
        this.vy = -this.jumpPower;
        this.onGround = false;
      }
      this.jumpTimer = 1.0 + Math.random() * 2.8;
    }

    if (target && !ignoreEnemy) {
      const centerX = this.x + this.w / 2;
      const targetCenterX = target.x + target.w / 2;
      const targetCenterY = target.y + target.h / 2;
      const dist = Math.abs(targetCenterX - centerX);

      const engageRange = WORLD.tileSize * this.engageRangeTiles;

      if (dist <= engageRange && this.weapon.canShoot()) {
        this.facingRight = targetCenterX >= centerX;

        const aimError = (Math.random() - 0.5) * 18;
        this.weapon.shootFromWorld(
          this.x,
          this.y,
          this.w,
          this.h,
          targetCenterX + aimError,
          targetCenterY + aimError,
          bullets,
          this.team,
          this
        );
      } else if (moveDir !== 0) {
        this.facingRight = moveDir > 0;
      } else {
        this.facingRight = targetCenterX >= centerX;
      }
    } else if (moveDir !== 0) {
      this.facingRight = moveDir > 0;
    }

    if (this.vy > 0) {
      this.vy += this.gravity * this.fallMultiplier * dt;
    } else {
      this.vy += this.gravity * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < 0) this.x = 0;
    if (this.x > WORLD.width - this.w) this.x = WORLD.width - this.w;

    if (this.y + this.h >= groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    }

    return true;
  }

  draw(ctx, cameraX) {
    const sx = this.x - cameraX;
    const sy = this.y;

    if (this.dead) {
      const progress = Math.max(0, Math.min(1, 1 - (this.deathTimer / this.deathDuration)));
      const angle = this.deathDir * (Math.PI / 2) * progress;

      ctx.save();
      ctx.globalAlpha = Math.max(0.35, this.deathTimer / this.deathDuration);
      ctx.translate(sx + this.w / 2, sy + this.h / 2);
      ctx.rotate(angle);

      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);

      ctx.restore();
      return;
    }

    ctx.fillStyle = this.color;
    ctx.fillRect(sx, sy, this.w, this.h);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, this.w, this.h);

    ctx.fillStyle = "#666666";
    ctx.fillRect(sx + 6, sy + 6, this.w - 12, 14);

    ctx.save();
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = this.team === "ally" ? "#ff8a8a" : "#8ab8ff";
    ctx.strokeText(this.name, sx + this.w / 2, sy - 18);
    ctx.fillText(this.name, sx + this.w / 2, sy - 18);
    ctx.restore();

    if (typeof drawHealthBar === "function") {
      drawHealthBar(ctx, sx, sy - 14, this.w, this.health, this.maxHealth);
    }

    this.weapon.drawFacing(ctx, sx, sy, this.w, this.h, this.facingRight);
  }
}