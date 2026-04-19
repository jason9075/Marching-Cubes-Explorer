// Gradient: Nord 9 (#81a1c1) → Nord 13 (#ebcb8b) → Nord 14 (#a3be8c)
function scalarToCSS(t) {
    const lc = (a, b, s) => Math.round(a + (b - a) * s);
    if (t <= 0.5) {
        const s = t * 2;
        return `rgb(${lc(0x81,0xeb,s)},${lc(0xa1,0xcb,s)},${lc(0xc1,0x8b,s)})`;
    }
    const s = (t - 0.5) * 2;
    return `rgb(${lc(0xeb,0xa3,s)},${lc(0xcb,0xbe,s)},${lc(0x8b,0x8c,s)})`;
}

export class MarchingSquares {
    constructor(canvas, resolution, isoValue, fieldType = 'float') {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resolution = resolution;
        this.isoValue = isoValue;
        this.fieldType = fieldType; // 'float' | 'binary'
        this.scalarField = [];
        this._drawMetrics = null; // set by draw(), used by handleHover()
        this.generateScalarField();
        this.resize();
    }

    resize() {
        // Handle High DPI displays
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.width = rect.width;
        this.height = rect.height;
    }

    generateScalarField() {
        this.scalarField = [];
        const numCenters = 4;
        const centers = [];
        for (let i = 0; i < numCenters; i++) {
            centers.push({
                x: Math.random(),
                y: Math.random(),
                radius: 0.2 + Math.random() * 0.3
            });
        }

        // Compute raw metaball values and track range
        const raw = [];
        let minVal = Infinity, maxVal = -Infinity;
        for (let y = 0; y <= this.resolution; y++) {
            const row = [];
            for (let x = 0; x <= this.resolution; x++) {
                const nx = x / this.resolution;
                const ny = y / this.resolution;
                let val = 0;
                for (const c of centers) {
                    const dx = nx - c.x;
                    const dy = ny - c.y;
                    val += (c.radius * c.radius) / (dx * dx + dy * dy + 0.01);
                }
                const v = val / numCenters;
                row.push(v);
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }
            raw.push(row);
        }

        // Normalize to [0, 1]; binary snaps at 0.5 of the normalized range
        const range = maxVal - minVal || 1;
        for (const row of raw) {
            this.scalarField.push(row.map(v => {
                const t = (v - minVal) / range;
                return this.fieldType === 'binary' ? (t > 0.5 ? 1.0 : 0.0) : t;
            }));
        }
    }

    getScalarValue(x, y) {
        return this.scalarField[y][x];
    }

    *solveStepByStep() {
        // Yield each cell processing
        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                yield { type: 'cell_start', pos: { x, y } };

                const v0 = this.getScalarValue(x, y);         // Top-left
                const v1 = this.getScalarValue(x + 1, y);     // Top-right
                const v2 = this.getScalarValue(x + 1, y + 1); // Bottom-right
                const v3 = this.getScalarValue(x, y + 1);     // Bottom-left

                let state = 0;
                if (v0 > this.isoValue) state |= 1;
                if (v1 > this.isoValue) state |= 2;
                if (v2 > this.isoValue) state |= 4;
                if (v3 > this.isoValue) state |= 8;

                // Simple interpolation function
                const getInterp = (vA, vB) => {
                    if (Math.abs(vA - vB) < 0.00001) return 0.5;
                    return (this.isoValue - vA) / (vB - vA);
                };

                const lines = [];

                // Edges:
                // 0: top (v0 - v1)
                // 1: right (v1 - v2)
                // 2: bottom (v2 - v3)
                // 3: left (v3 - v0)
                
                const pt0 = { cx: x + getInterp(v0, v1), cy: y };
                const pt1 = { cx: x + 1, cy: y + getInterp(v1, v2) };
                const pt2 = { cx: x + 1 - getInterp(v2, v3), cy: y + 1 };
                const pt3 = { cx: x, cy: y + 1 - getInterp(v3, v0) }; // v3→v0 goes bottom→top, so cy = (y+1) - t

                switch (state) {
                    case 1: lines.push([pt3, pt0]); break;
                    case 2: lines.push([pt0, pt1]); break;
                    case 3: lines.push([pt3, pt1]); break;
                    case 4: lines.push([pt1, pt2]); break;
                    case 5: lines.push([pt0, pt1], [pt2, pt3]); break; // saddle point
                    case 6: lines.push([pt0, pt2]); break;
                    case 7: lines.push([pt3, pt2]); break;
                    case 8: lines.push([pt2, pt3]); break;
                    case 9: lines.push([pt0, pt2]); break;
                    case 10: lines.push([pt3, pt0], [pt1, pt2]); break; // saddle point
                    case 11: lines.push([pt1, pt2]); break;
                    case 12: lines.push([pt3, pt1]); break;
                    case 13: lines.push([pt0, pt1]); break;
                    case 14: lines.push([pt3, pt0]); break;
                }

                yield { type: 'cell_complete', pos: { x, y }, lines, state };
            }
        }
    }

    draw(activeCell = null, lines = [], showGrid = true, showPoints = true) {
        if (!this.width) this.resize();
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Use the smaller dimension so cells are always square, then center the grid
        const pad = 40;
        const gridSize = Math.min(this.width - pad * 2, this.height - pad * 2);
        const cell = gridSize / this.resolution;
        const ox = (this.width - gridSize) / 2;
        const oy = (this.height - gridSize) / 2;

        // Draw grid
        if (showGrid) {
            this.ctx.strokeStyle = '#4c566a';
            this.ctx.lineWidth = 1;
            for (let y = 0; y <= this.resolution; y++) {
                for (let x = 0; x <= this.resolution; x++) {
                    const px = ox + x * cell;
                    const py = oy + y * cell;
                    if (x < this.resolution) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(px, py);
                        this.ctx.lineTo(px + cell, py);
                        this.ctx.stroke();
                    }
                    if (y < this.resolution) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(px, py);
                        this.ctx.lineTo(px, py + cell);
                        this.ctx.stroke();
                    }
                }
            }
        }

        // Draw active cell highlight
        if (activeCell) {
            this.ctx.fillStyle = 'rgba(235, 203, 139, 0.3)'; // Nord 13
            this.ctx.fillRect(ox + activeCell.x * cell, oy + activeCell.y * cell, cell, cell);
            this.ctx.strokeStyle = '#ebcb8b';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(ox + activeCell.x * cell, oy + activeCell.y * cell, cell, cell);
        }

        // Draw isosurface lines
        this.ctx.strokeStyle = '#88c0d0'; // Nord 8
        this.ctx.lineWidth = 3;
        for (const line of lines) {
            this.ctx.beginPath();
            this.ctx.moveTo(ox + line[0].cx * cell, oy + line[0].cy * cell);
            this.ctx.lineTo(ox + line[1].cx * cell, oy + line[1].cy * cell);
            this.ctx.stroke();
        }

        // Draw scalar points with gradient color based on normalized value
        if (showPoints) {
            let minVal = Infinity, maxVal = -Infinity;
            for (let y = 0; y <= this.resolution; y++) {
                for (let x = 0; x <= this.resolution; x++) {
                    const v = this.scalarField[y][x];
                    if (v < minVal) minVal = v;
                    if (v > maxVal) maxVal = v;
                }
            }
            const range = maxVal - minVal || 1;

            for (let y = 0; y <= this.resolution; y++) {
                for (let x = 0; x <= this.resolution; x++) {
                    const t = (this.scalarField[y][x] - minVal) / range;
                    this.ctx.beginPath();
                    this.ctx.arc(ox + x * cell, oy + y * cell, 4, 0, Math.PI * 2);
                    this.ctx.fillStyle = scalarToCSS(t);
                    this.ctx.fill();
                }
            }
        }

        this._drawMetrics = { ox, oy, cell };
    }

    /** Called by main.js on canvas mousemove events. */
    handleHover(e) {
        const tooltip = document.getElementById('tooltip-2d');
        if (!this._drawMetrics) { tooltip.style.display = 'none'; return; }
        const { ox, oy, cell } = this._drawMetrics;

        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const gx = Math.round((mx - ox) / cell);
        const gy = Math.round((my - oy) / cell);

        if (gx >= 0 && gx <= this.resolution && gy >= 0 && gy <= this.resolution) {
            const dist = Math.hypot(mx - (ox + gx * cell), my - (oy + gy * cell));
            if (dist < cell * 0.4) {
                const val = this.scalarField[gy][gx];
                tooltip.textContent = `[${gx}, ${gy}] = ${val.toFixed(3)}`;
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX + 14}px`;
                tooltip.style.top = `${e.clientY - 28}px`;
                return;
            }
        }
        tooltip.style.display = 'none';
    }
}
