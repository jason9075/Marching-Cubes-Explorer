import { MarchingCubesSolver } from './marching/Algorithm.js?v=2';
import { SceneManager } from './marching/SceneManager.js?v=2';
import { MarchingSquares } from './marching/MarchingSquares.js?v=2';

class App {
    constructor() {
        this.container3D = document.getElementById('canvas-container');
        this.canvas2D = document.getElementById('canvas-2d');
        
        this.mode = '3D'; // '2D' or '3D'
        this.sceneManager = new SceneManager(this.container3D);
        
        this.resolution = 8;
        this.isoValue = 0.5;
        this.isRunning = false;
        this.solver = null;
        this.generator = null;
        
        // 2D state
        this.lines2D = [];

        this.initUI();
        this.reset();
    }

    initUI() {
        // Display elements
        this.isoDisplay = document.getElementById('iso-value-display');
        this.resDisplay = document.getElementById('grid-res-display');
        this.statsDisplay = document.getElementById('stats');
        this.playBtn = document.getElementById('play-pause-btn');

        // Inputs
        this.isoSlider = document.getElementById('iso-value');
        this.resSlider = document.getElementById('grid-res');

        this.isoSlider.addEventListener('input', (e) => {
            this.isoValue = parseFloat(e.target.value);
            this.isoDisplay.textContent = this.isoValue.toFixed(2);
            if (!this.isRunning) this.recompute();
        });

        this.resSlider.addEventListener('input', (e) => {
            this.resolution = parseInt(e.target.value);
            this.resDisplay.textContent = this.resolution;
            this.reset();
        });

        this.zoomSlider = document.getElementById('camera-zoom');
        this.zoomDisplay = document.getElementById('camera-zoom-display');
        this.zoomSlider.addEventListener('input', (e) => {
            const zoomVal = parseFloat(e.target.value);
            this.zoomDisplay.textContent = zoomVal.toFixed(1);
            if (this.mode === '3D') {
                // Map 0.1 - 5.0 to FOV (e.g., 100 to 20)
                // 1.0 zoom -> 75 FOV
                const newFov = 75 / zoomVal;
                this.sceneManager.camera.fov = newFov;
                this.sceneManager.camera.updateProjectionMatrix();
            }
        });

        // Buttons
        this.playBtn.addEventListener('click', () => this.togglePlay());
        document.getElementById('step-btn').addEventListener('click', () => this.step());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());

        // Mode switches
        document.getElementById('mode-2d-btn').addEventListener('click', (e) => {
            this.setMode('2D');
            e.target.classList.add('primary');
            document.getElementById('mode-3d-btn').classList.remove('primary');
        });
        document.getElementById('mode-3d-btn').addEventListener('click', (e) => {
            this.setMode('3D');
            e.target.classList.add('primary');
            document.getElementById('mode-2d-btn').classList.remove('primary');
        });

        // Checkboxes
        document.getElementById('show-grid').addEventListener('change', (e) => {
            if (this.mode === '3D') {
                this.sceneManager.gridGroup.visible = e.target.checked;
            } else {
                this.render2D();
            }
        });
        document.getElementById('show-vertices').addEventListener('change', (e) => {
            if (this.mode === '3D') {
                this.sceneManager.pointsGroup.visible = e.target.checked;
            } else {
                this.render2D();
            }
        });
    }

    setMode(newMode) {
        if (this.mode === newMode) return;
        this.mode = newMode;
        const zoomContainer = document.getElementById('zoom-control-container');
        
        if (this.mode === '2D') {
            this.container3D.style.display = 'none';
            this.canvas2D.style.display = 'block';
            if (zoomContainer) zoomContainer.style.display = 'none';
        } else {
            this.container3D.style.display = 'block';
            this.canvas2D.style.display = 'none';
            if (zoomContainer) zoomContainer.style.display = 'block';
            this.sceneManager.resize();
        }
        this.reset();
    }

    reset() {
        this.isRunning = false;
        this.playBtn.querySelector('span').textContent = 'Play Simulation';
        
        if (this.mode === '3D') {
            this.solver = new MarchingCubesSolver(this.resolution, this.isoValue);
            this.generator = this.solver.solveStepByStep();
            this.sceneManager.setupGrid(this.resolution);
            this.sceneManager.setupPoints(this.resolution, this.solver);
            this.sceneManager.pointsGroup.visible = document.getElementById('show-vertices').checked;
            this.triangles = [];
            this.updateStats('IDLE', [0, 0, 0], 0);
        } else {
            this.solver2D = new MarchingSquares(this.canvas2D, this.resolution, this.isoValue);
            this.generator = this.solver2D.solveStepByStep();
            this.lines2D = [];
            this.render2D();
            this.updateStats('IDLE', [0, 0], 0);
        }
    }

    recompute() {
        // Instant recompute for slider changes when not in animation mode
        if (this.mode === '3D') {
            const solver = new MarchingCubesSolver(this.resolution, this.isoValue);
            const gen = solver.solveStepByStep();
            let result = gen.next();
            let triangles = [];
            
            while (!result.done) {
                if (result.value.type === 'cell_complete') {
                    triangles = triangles.concat(result.value.triangles);
                }
                result = gen.next();
            }
            
            this.sceneManager.setupPoints(this.resolution, solver);
            this.sceneManager.pointsGroup.visible = document.getElementById('show-vertices').checked;
            this.sceneManager.updateFullMesh(triangles);
            this.updateStats('COMPLETED', [this.resolution-1, this.resolution-1, this.resolution-1], triangles.length);
        } else {
            this.solver2D.isoValue = this.isoValue;
            const gen = this.solver2D.solveStepByStep();
            let result = gen.next();
            this.lines2D = [];
            
            while (!result.done) {
                if (result.value.type === 'cell_complete' && result.value.lines) {
                    this.lines2D = this.lines2D.concat(result.value.lines);
                }
                result = gen.next();
            }
            this.render2D();
            this.updateStats('COMPLETED', [this.resolution-1, this.resolution-1], this.lines2D.length);
        }
    }

    togglePlay() {
        this.isRunning = !this.isRunning;
        this.playBtn.querySelector('span').textContent = this.isRunning ? 'Pause Simulation' : 'Resume Simulation';
        if (this.isRunning) this.animate();
    }

    step() {
        if (!this.generator) {
            console.log("No generator to step through");
            return;
        }
        
        const result = this.generator.next();
        console.log("Step result:", result.done ? "DONE" : "MORE", result.value?.type);

        if (result.done) {
            this.isRunning = false;
            this.playBtn.querySelector('span').textContent = 'Completed';
            if (this.mode === '3D') {
                this.updateStats('COMPLETED', [this.resolution-1, this.resolution-1, this.resolution-1], this.triangles.length);
            } else {
                this.updateStats('COMPLETED', [this.resolution-1, this.resolution-1], this.lines2D.length);
                this.render2D();
            }
            return;
        }

        const stepVal = result.value;
        if (this.mode === '3D') {
            if (stepVal.type === 'cell_start') {
                this.sceneManager.highlightCell(stepVal.pos.x, stepVal.pos.y, stepVal.pos.z);
                this.updateStats('PROCESSING', [stepVal.pos.x, stepVal.pos.y, stepVal.pos.z], this.triangles.length);
            } else if (stepVal.type === 'cell_complete') {
                this.triangles = this.triangles.concat(stepVal.triangles);
                this.sceneManager.addTriangles(stepVal.triangles);
                this.updateStats('PROCESSING', [stepVal.pos.x, stepVal.pos.y, stepVal.pos.z], this.triangles.length);
            }
        } else { // 2D Mode
            if (stepVal.type === 'cell_start') {
                this.render2D(stepVal.pos);
                this.updateStats('PROCESSING', [stepVal.pos.x, stepVal.pos.y], this.lines2D.length);
            } else if (stepVal.type === 'cell_complete') {
                if (stepVal.lines && stepVal.lines.length > 0) {
                    this.lines2D = this.lines2D.concat(stepVal.lines);
                }
                this.render2D(stepVal.pos);
                this.updateStats('PROCESSING', [stepVal.pos.x, stepVal.pos.y], this.lines2D.length);
            }
        }
    }

    render2D(activeCell = null) {
        if (!this.solver2D) return;
        const showGrid = document.getElementById('show-grid').checked;
        const showPts = document.getElementById('show-vertices').checked;
        this.solver2D.draw(activeCell, this.lines2D, showGrid, showPts);
    }

    animate() {
        if (!this.isRunning) return;
        this.step();
        setTimeout(() => this.animate(), this.mode === '3D' ? 20 : 50); // Control speed
    }

    updateStats(status, cell, count) {
        this.statsDisplay.innerHTML = `
            <div>Status: ${status}</div>
            <div>Current Cell: [${cell.join(', ')}]</div>
            <div>Total Elements: ${count}</div>
        `;
    }
}

new App();
