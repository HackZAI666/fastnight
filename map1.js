const WORLD = {
  tileSize: 40,
  cols: 220,                 // 地图变大很多
  rows: 6,
  width: 220 * 40,
  height: 6 * 40,
  skyColor: "#bfe9ff",
  groundColor: "#d8c07a",
  darkSandColor: "#b89d57",
  lineColor: "#000000",
  groundRows: 3              // 地面 3 层
};

function getGroundY(canvasHeight) {
  return canvasHeight - WORLD.groundRows * WORLD.tileSize;
}

function hash2(x, y, s) {
  let n = x * 374761393 + y * 668265263 + s * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function drawMap1(ctx, canvas, cameraX) {
  const w = canvas.width;
  const h = canvas.height;
  const t = WORLD.tileSize;
  const groundY = getGroundY(h);

  ctx.fillStyle = WORLD.skyColor;
  ctx.fillRect(0, 0, w, h);

  const startCol = Math.floor(cameraX / t) - 2;
  const endCol = Math.ceil((cameraX + w) / t) + 2;

  for (let col = startCol; col <= endCol; col++) {
    for (let row = 0; row < WORLD.groundRows; row++) {
      const x = col * t - cameraX;
      const y = groundY + row * t;

      if (x + t < 0 || x > w) continue;

      ctx.fillStyle = WORLD.groundColor;
      ctx.fillRect(x, y, t, t);

      ctx.strokeStyle = WORLD.lineColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, t, t);

      if (hash2(col, row, 1) > 0.72) {
        ctx.fillStyle = WORLD.darkSandColor;
        ctx.fillRect(x + 6, y + 8, 3, 3);
      }
      if (hash2(col, row, 2) > 0.82) {
        ctx.fillStyle = WORLD.darkSandColor;
        ctx.fillRect(x + 22, y + 16, 2, 2);
      }
      if (hash2(col, row, 3) > 0.88) {
        ctx.fillStyle = WORLD.darkSandColor;
        ctx.fillRect(x + 14, y + 24, 2, 2);
      }
    }
  }

  ctx.strokeStyle = WORLD.lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();

  const leftEdgeX = 0 - cameraX;
  const rightEdgeX = WORLD.width - cameraX;

  if (leftEdgeX >= 0 && leftEdgeX <= w) {
    ctx.beginPath();
    ctx.moveTo(leftEdgeX, groundY);
    ctx.lineTo(leftEdgeX, h);
    ctx.stroke();
  }

  if (rightEdgeX >= 0 && rightEdgeX <= w) {
    ctx.beginPath();
    ctx.moveTo(rightEdgeX, groundY);
    ctx.lineTo(rightEdgeX, h);
    ctx.stroke();
  }
}