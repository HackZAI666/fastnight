(() => {
  function pointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  class CangkuItem {
    constructor({
      id = "ak",
      name,
      imageSrc,
      gridX = 0,
      gridY = 0,
      orientation = "horizontal"
    }) {
      this.id = id;
      this.name = name;

      this.gridX = gridX;
      this.gridY = gridY;
      this.orientation = orientation; // horizontal = 5x2, vertical = 2x5

      this.previewGridX = gridX;
      this.previewGridY = gridY;
      this.previewOrientation = orientation;

      this.selected = false;
      this.dragging = false;

      this.dragOffsetX = 0;
      this.dragOffsetY = 0;

      this.originGridX = gridX;
      this.originGridY = gridY;
      this.originOrientation = orientation;

      this.imageSrc = imageSrc;
      this.image = new Image();
      this.loaded = false;
      this.image.src = imageSrc;
      this.image.onload = () => {
        this.loaded = true;
        if (window.cangkuSystem) window.cangkuSystem.draw();
      };
    }
  }

  class CangkuSystem {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.leftPane = canvas.parentElement;

      this.cols = 9;
      this.rows = 18;

      this.visible = false;

      this.cellSize = 48;
      this.gridX = 24;
      this.gridY = 24;
      this.gridW = 0;
      this.gridH = 0;
      this.contentHeight = 0;

      this.grid = [];
      this.items = [];

      this.activeItem = null;

      this._createGrid();

      this._bindEvents();
      this.resize();
      this.loadSaveData(this.getDefaultSaveData());
    }

    _createGrid() {
      this.grid = [];
      for (let y = 0; y < this.rows; y++) {
        const row = [];
        for (let x = 0; x < this.cols; x++) {
          row.push(null);
        }
        this.grid.push(row);
      }
    }

    _createDefaultItem() {
      return new CangkuItem({
        id: "ak",
        name: "AK",
        imageSrc: "assets/weapon-right.png",
        gridX: 0,
        gridY: 0,
        orientation: "horizontal"
      });
    }

    getDefaultSaveData() {
      return {
        version: 1,
        items: [
          {
            id: "ak",
            name: "AK",
            imageSrc: "assets/weapon-right.png",
            gridX: 0,
            gridY: 0,
            orientation: "horizontal"
          }
        ]
      };
    }

    getSaveData() {
      return {
        version: 1,
        items: this.items.map((item) => ({
          id: item.id || "ak",
          name: item.name || "AK",
          imageSrc: item.imageSrc || "assets/weapon-right.png",
          gridX: item.gridX,
          gridY: item.gridY,
          orientation: item.orientation
        }))
      };
    }

    _createItemFromData(data) {
      if (!data || typeof data !== "object") return null;

      const id = data.id || "ak";
      const name = data.name || "AK";
      const imageSrc = data.imageSrc || "assets/weapon-right.png";
      const gridX = Number.isFinite(data.gridX) ? data.gridX : 0;
      const gridY = Number.isFinite(data.gridY) ? data.gridY : 0;
      const orientation = data.orientation === "vertical" ? "vertical" : "horizontal";

      return new CangkuItem({
        id,
        name,
        imageSrc,
        gridX,
        gridY,
        orientation
      });
    }

    loadSaveData(saveData) {
      this._createGrid();
      this.items = [];
      this.activeItem = null;

      const sourceItems =
        saveData && Array.isArray(saveData.items) && saveData.items.length > 0
          ? saveData.items
          : this.getDefaultSaveData().items;

      for (const itemData of sourceItems) {
        const item = this._createItemFromData(itemData);
        if (!item) continue;

        const dims = this._getDims(item.orientation);
        if (
          item.gridX < 0 ||
          item.gridY < 0 ||
          item.gridX + dims.w > this.cols ||
          item.gridY + dims.h > this.rows
        ) {
          continue;
        }

        if (!this._canPlace(item, item.gridX, item.gridY, item.orientation)) {
          continue;
        }

        this.items.push(item);
        this._commitItem(item, item.gridX, item.gridY, item.orientation);
      }

      if (this.items.length === 0) {
        const item = this._createDefaultItem();
        this.items.push(item);
        this._commitItem(item, 0, 0, "horizontal");
      }

      this.ak = this.items.find((it) => it.id === "ak") || this.items[0] || null;

      this.draw();
    }

    _bindEvents() {
      this.canvas.addEventListener("pointerdown", (e) => {
        if (!this.visible) return;

        const p = this._getPointerPos(e);
        const item = this._hitTestItem(p.x, p.y);

        if (!item) {
          if (this.activeItem) this.activeItem.selected = false;
          this.activeItem = null;
          this.draw();
          return;
        }

        this.activeItem = item;
        item.selected = true;
        item.dragging = true;

        const rect = this._getItemRect(item, item.gridX, item.gridY, item.orientation);
        item.dragOffsetX = p.x - rect.x;
        item.dragOffsetY = p.y - rect.y;

        item.originGridX = item.gridX;
        item.originGridY = item.gridY;
        item.originOrientation = item.orientation;

        this._removeItemFromGrid(item);

        if (this.canvas.setPointerCapture) {
          this.canvas.setPointerCapture(e.pointerId);
        }

        this.draw();
      });

      this.canvas.addEventListener("pointermove", (e) => {
        if (!this.visible) return;
        if (!this.activeItem || !this.activeItem.dragging) return;

        const p = this._getPointerPos(e);
        const item = this.activeItem;

        const rawX = p.x - item.dragOffsetX;
        const rawY = p.y - item.dragOffsetY;

        item.previewGridX = Math.round((rawX - this.gridX) / this.cellSize);
        item.previewGridY = Math.round((rawY - this.gridY) / this.cellSize);

        item.previewOrientation = this._resolvePreviewOrientation(
          item,
          item.previewGridX,
          item.previewGridY
        );

        this.draw();
      });

      const finishDrag = () => {
        if (!this.activeItem) return;

        const item = this.activeItem;
        const gx = item.previewGridX;
        const gy = item.previewGridY;

        const resolved = this._resolvePlacement(item, gx, gy);

        if (resolved) {
          this._commitItem(item, resolved.gridX, resolved.gridY, resolved.orientation);
        } else {
          this._commitItem(item, item.originGridX, item.originGridY, item.originOrientation);
        }

        item.dragging = false;
        item.selected = false;
        item.previewOrientation = item.orientation;
        this.activeItem = null;

        this.draw();
      };

      this.canvas.addEventListener("pointerup", finishDrag);
      this.canvas.addEventListener("pointercancel", finishDrag);
      window.addEventListener("blur", finishDrag);
    }

    _getPointerPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    _getDims(orientation) {
      if (orientation === "vertical") {
        return { w: 2, h: 5 };
      }
      return { w: 5, h: 2 };
    }

    _otherOrientation(orientation) {
      return orientation === "horizontal" ? "vertical" : "horizontal";
    }

    _getItemRect(item, gx, gy, orientation) {
      const dims = this._getDims(orientation);
      return {
        x: this.gridX + gx * this.cellSize,
        y: this.gridY + gy * this.cellSize,
        w: dims.w * this.cellSize,
        h: dims.h * this.cellSize
      };
    }

    _hitTestItem(px, py) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        const item = this.items[i];
        const dims = this._getDims(item.orientation);
        const rect = this._getItemRect(item, item.gridX, item.gridY, item.orientation);
        if (pointInRect(px, py, rect.x, rect.y, rect.w, rect.h)) {
          return item;
        }
      }
      return null;
    }

    _canPlace(item, gridX, gridY, orientation) {
      const dims = this._getDims(orientation);

      if (gridX < 0 || gridY < 0) return false;
      if (gridX + dims.w > this.cols) return false;
      if (gridY + dims.h > this.rows) return false;

      for (let y = 0; y < dims.h; y++) {
        for (let x = 0; x < dims.w; x++) {
          if (this.grid[gridY + y][gridX + x] !== null) {
            return false;
          }
        }
      }

      return true;
    }

    _removeItemFromGrid(item) {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.grid[y][x] === item) {
            this.grid[y][x] = null;
          }
        }
      }
    }

    _commitItem(item, gridX, gridY, orientation) {
      this._removeItemFromGrid(item);

      const dims = this._getDims(orientation);
      for (let y = 0; y < dims.h; y++) {
        for (let x = 0; x < dims.w; x++) {
          this.grid[gridY + y][gridX + x] = item;
        }
      }

      item.gridX = gridX;
      item.gridY = gridY;
      item.orientation = orientation;
      item.previewGridX = gridX;
      item.previewGridY = gridY;
      item.previewOrientation = orientation;
    }

    _resolvePreviewOrientation(item, gridX, gridY) {
      if (this._canPlace(item, gridX, gridY, item.orientation)) {
        return item.orientation;
      }

      const alt = this._otherOrientation(item.orientation);
      if (this._canPlace(item, gridX, gridY, alt)) {
        return alt;
      }

      return item.orientation;
    }

    _resolvePlacement(item, gridX, gridY) {
      if (this._canPlace(item, gridX, gridY, item.orientation)) {
        return { gridX, gridY, orientation: item.orientation };
      }

      const alt = this._otherOrientation(item.orientation);
      if (this._canPlace(item, gridX, gridY, alt)) {
        return { gridX, gridY, orientation: alt };
      }

      return null;
    }

    resize() {
      const parentW = Math.max(1, this.leftPane.clientWidth);
      const parentH = Math.max(1, this.leftPane.clientHeight);

      const base = Math.min((parentW - 48) / this.cols, (parentH - 48) / this.rows);
      this.cellSize = Math.max(44, Math.floor(base));

      this.gridW = this.cellSize * this.cols;
      this.gridH = this.cellSize * this.rows;

      this.gridX = 24;
      this.gridY = 24;

      this.contentHeight = this.gridY + this.gridH + 420;

      this.canvas.width = parentW;
      this.canvas.height = this.contentHeight;
      this.canvas.style.width = `${parentW}px`;
      this.canvas.style.height = `${this.contentHeight}px`;

      this.draw();
    }

    show() {
      this.visible = true;
      this.draw();
    }

    hide() {
      this.visible = false;
    }

    draw() {
      if (!this.visible) return;

      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(this.gridX - 8, this.gridY - 8, this.gridW + 16, this.gridH + 16);
      ctx.strokeStyle = "#e7e7e7";
      ctx.lineWidth = 1;
      ctx.strokeRect(this.gridX - 8, this.gridY - 8, this.gridW + 16, this.gridH + 16);
      ctx.restore();

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const px = this.gridX + x * this.cellSize;
          const py = this.gridY + y * this.cellSize;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px, py, this.cellSize, this.cellSize);

          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, this.cellSize, this.cellSize);
        }
      }

      for (const item of this.items) {
        if (item.dragging) continue;

        const dims = this._getDims(item.orientation);
        const drawX = this.gridX + item.gridX * this.cellSize;
        const drawY = this.gridY + item.gridY * this.cellSize;

        for (let yy = 0; yy < dims.h; yy++) {
          for (let xx = 0; xx < dims.w; xx++) {
            const cellX = drawX + xx * this.cellSize;
            const cellY = drawY + yy * this.cellSize;

            ctx.fillStyle = "rgba(140, 140, 140, 0.58)";
            ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);

            ctx.strokeStyle = "rgba(0,0,0,0.14)";
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX, cellY, this.cellSize, this.cellSize);
          }
        }

        this._drawItemSprite(item, drawX, drawY, dims.w, dims.h, item.orientation, 1, 0.92);

        ctx.save();
        ctx.lineWidth = item.selected ? 3 : 2;
        ctx.strokeStyle = item.selected ? "#1f9d42" : "rgba(0,0,0,0.55)";
        ctx.strokeRect(drawX + 1, drawY + 1, dims.w * this.cellSize - 2, dims.h * this.cellSize - 2);
        ctx.restore();
      }

      if (this.activeItem && this.activeItem.dragging) {
        const item = this.activeItem;
        const orientation = item.previewOrientation;
        const dims = this._getDims(orientation);
        const canFit = this._canPlace(item, item.previewGridX, item.previewGridY, orientation);

        const drawX = this.gridX + item.previewGridX * this.cellSize;
        const drawY = this.gridY + item.previewGridY * this.cellSize;

        for (let yy = 0; yy < dims.h; yy++) {
          for (let xx = 0; xx < dims.w; xx++) {
            const cellX = drawX + xx * this.cellSize;
            const cellY = drawY + yy * this.cellSize;

            ctx.fillStyle = canFit
              ? "rgba(60, 205, 90, 0.52)"
              : "rgba(255, 70, 70, 0.72)";
            ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);

            ctx.strokeStyle = "rgba(0,0,0,0.14)";
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX, cellY, this.cellSize, this.cellSize);
          }
        }

        this._drawItemSprite(item, drawX, drawY, dims.w, dims.h, orientation, 1.08, 0.98);

        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = canFit ? "#1f9d42" : "#d64040";
        ctx.strokeRect(drawX + 1, drawY + 1, dims.w * this.cellSize - 2, dims.h * this.cellSize - 2);
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = "#444";
      ctx.font = "15px Arial";
      ctx.fillText("左侧是仓库格子，向下滚动还能看到更多空位", 24, 24);
      ctx.fillText("AK 拖拽时会放大，松手后恢复正常", 24, 46);
      ctx.fillText("AK 竖放时图片会旋转并按比例缩放，不会被拉伸", 24, 68);
      ctx.restore();
    }

    _drawItemSprite(item, drawX, drawY, cellsW, cellsH, orientation, scale = 1, alpha = 1) {
      const pixelW = cellsW * this.cellSize;
      const pixelH = cellsH * this.cellSize;

      const centerX = drawX + pixelW / 2;
      const centerY = drawY + pixelH / 2;

      const imgW = item.image.naturalWidth || item.image.width || 1;
      const imgH = item.image.naturalHeight || item.image.height || 1;

      const effectiveW = orientation === "vertical" ? imgH : imgW;
      const effectiveH = orientation === "vertical" ? imgW : imgH;

      const maxW = pixelW * 0.92;
      const maxH = pixelH * 0.92;
      const fitScale = Math.min(maxW / effectiveW, maxH / effectiveH) * scale;

      const drawW = imgW * fitScale;
      const drawH = imgH * fitScale;

      const angle = orientation === "vertical" ? Math.PI / 2 : 0;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate(angle);

      if (item.loaded) {
        this.ctx.drawImage(item.image, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        this.ctx.fillStyle = "rgba(120,120,120,0.22)";
        this.ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
      }

      this.ctx.restore();
    }
  }

  function boot() {
    const canvas = document.getElementById("warehouseCanvas");
    if (!canvas || window.cangkuSystem) return;
    window.cangkuSystem = new CangkuSystem(canvas);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();