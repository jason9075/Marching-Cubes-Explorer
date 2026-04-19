export class MarchingSquares {
    constructor(canvas, resolution, isoValue) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resolution = resolution;
        this.isoValue = isoValue;
        this.scalarField = [];
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

        for (let y = 0; y <= this.resolution; y++) {
            const row = [];
            for (let x = 0; x <= this.resolution; x++) {
                const nx = x / this.resolution;
                const ny = y / this.resolution;
                let val = 0;
                for (const c of centers) {
                    const dx = nx - c.x;
                    const dy = ny - c.y;
                    const d2 = dx * dx + dy * dy;
                    val += (c.radius * c.radius) / (d2 + 0.01);
                }
                row.push(val / numCenters);
            }
            this.scalarField.push(row);
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

        // Draw scalar points
        if (showPoints) {
            for (let y = 0; y <= this.resolution; y++) {
                for (let x = 0; x <= this.resolution; x++) {
                    const val = this.scalarField[y][x];
                    this.ctx.beginPath();
                    this.ctx.arc(ox + x * cell, oy + y * cell, 4, 0, Math.PI * 2);
                    this.ctx.fillStyle = val > this.isoValue ? '#a3be8c' : '#bf616a'; // Nord 14 / 11
                    this.ctx.fill();
                }
            }
        }
    }
}
