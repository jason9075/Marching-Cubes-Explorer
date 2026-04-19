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
                const pt3 = { cx: x, cy: y + Math.abs(getInterp(v3, v0)) }; // fix direction for v3 to v0

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

        const pad = 40;
        const cellW = (this.width - pad * 2) / this.resolution;
        const cellH = (this.height - pad * 2) / this.resolution;

        // Draw grid
        if (showGrid) {
            this.ctx.strokeStyle = '#4c566a';
            this.ctx.lineWidth = 1;
            for (let y = 0; y <= this.resolution; y++) {
                for (let x = 0; x <= this.resolution; x++) {
                    const px = pad + x * cellW;
                    const py = pad + y * cellH;
                    
                    if (x < this.resolution) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(px, py);
                        this.ctx.lineTo(px + cellW, py);
                        this.ctx.stroke();
                    }
                    if (y < this.resolution) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(px, py);
                        this.ctx.lineTo(px, py + cellH);
                        this.ctx.stroke();
                    }
                }
            }
        }

        // Draw active cell highlight
        if (activeCell) {
            this.ctx.fillStyle = 'rgba(235, 203, 139, 0.3)'; // Nord 13
            this.ctx.fillRect(pad + activeCell.x * cellW, pad + activeCell.y * cellH, cellW, cellH);
            this.ctx.strokeStyle = '#ebcb8b';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(pad + activeCell.x * cellW, pad + activeCell.y * cellH, cellW, cellH);
        }

        // Draw lines
        this.ctx.strokeStyle = '#88c0d0'; // Nord 8
        this.ctx.lineWidth = 3;
        for (const line of lines) {
            const p1x = pad + line[0].cx * cellW;
            const p1y = pad + line[0].cy * cellH;
            const p2x = pad + line[1].cx * cellW;
            const p2y = pad + line[1].cy * cellH;
            
            this.ctx.beginPath();
            this.ctx.moveTo(p1x, p1y);
            this.ctx.lineTo(p2x, p2y);
            this.ctx.stroke();
        }

        // Draw scalar points
        if (showPoints) {
            for (let y = 0; y <= this.resolution; y++) {
                for (let x = 0; x <= this.resolution; x++) {
                    const px = pad + x * cellW;
                    const py = pad + y * cellH;
                    const val = this.scalarField[y][x];

                    this.ctx.beginPath();
                    this.ctx.arc(px, py, 4, 0, Math.PI * 2);
                    if (val > this.isoValue) {
                        this.ctx.fillStyle = '#a3be8c'; // Nord 14
                    } else {
                        this.ctx.fillStyle = '#bf616a'; // Nord 11
                    }
                    this.ctx.fill();

                    // Optional: draw values
                    // this.ctx.fillStyle = '#d8dee9';
                    // this.ctx.font = '10px Arial';
                    // this.ctx.fillText(val.toFixed(2), px + 6, py - 6);
                }
            }
        }
    }
}
