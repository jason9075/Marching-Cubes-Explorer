import * as THREE from 'three';
import { EDGE_TABLE, TRI_TABLE, VERTEX_OFFSETS, EDGE_V_MAP } from './lut2.js';

export class MarchingCubesSolver {
    constructor(resolution = 8, isoValue = 0.5) {
        this.resolution = resolution;
        this.isoValue = isoValue;
        this.grid = this.generateScalarField();
    }

    generateScalarField() {
        const size = this.resolution + 1;
        const grid = new Float32Array(size * size * size);
        
        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const idx = x + y * size + z * size * size;
                    
                    // Simple radial field (sphere) for the demo
                    const dx = (x / this.resolution) - 0.5;
                    const dy = (y / this.resolution) - 0.5;
                    const dz = (z / this.resolution) - 0.5;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    grid[idx] = 1.0 - (dist * 2.0); // 1.0 at center, 0.0 at edge
                }
            }
        }
        return grid;
    }

    getScalarValue(x, y, z) {
        const size = this.resolution + 1;
        if (x < 0 || x >= size || y < 0 || y >= size || z < 0 || z >= size) return 0;
        return this.grid[x + y * size + z * size * size];
    }

    // Generator for the algorithm
    *solveStepByStep() {
        const triangles = [];
        const res = this.resolution;

        for (let z = 0; z < res; z++) {
            for (let y = 0; y < res; y++) {
                for (let x = 0; x < res; x++) {
                    // Cell status
                    yield { 
                        type: 'cell_start', 
                        pos: { x, y, z },
                        message: `Processing Cell [${x}, ${y}, ${z}]`
                    };

                    const cubeValues = new Float32Array(8);
                    let cubeIndex = 0;

                    for (let i = 0; i < 8; i++) {
                        const offset = VERTEX_OFFSETS[i];
                        const val = this.getScalarValue(x + offset[0], y + offset[1], z + offset[2]);
                        cubeValues[i] = val;
                        if (val > this.isoValue) cubeIndex |= (1 << i);
                    }

                    if (EDGE_TABLE[cubeIndex] === 0) continue;

                    // Interpolate vertices on edges
                    const vertList = new Array(12);
                    for (let i = 0; i < 12; i++) {
                        if (EDGE_TABLE[cubeIndex] & (1 << i)) {
                            const vIndex1 = EDGE_V_MAP[i][0];
                            const vIndex2 = EDGE_V_MAP[i][1];
                            
                            const o1 = VERTEX_OFFSETS[vIndex1];
                            const o2 = VERTEX_OFFSETS[vIndex2];
                            
                            const p1 = new THREE.Vector3(x + o1[0], y + o1[1], z + o1[2]);
                            const p2 = new THREE.Vector3(x + o2[0], y + o2[1], z + o2[2]);
                            
                            const val1 = cubeValues[vIndex1];
                            const val2 = cubeValues[vIndex2];
                            
                            // Linear Interpolation
                            const lerp = (this.isoValue - val1) / (val2 - val1);
                            vertList[i] = new THREE.Vector3().lerpVectors(p1, p2, lerp);
                        }
                    }

                    // Create triangles from TRI_TABLE
                    const offset = cubeIndex * 16;
                    const cellTriangles = [];
                    for (let i = 0; TRI_TABLE[offset + i] !== -1; i += 3) {
                        const triangle = [
                            vertList[TRI_TABLE[offset + i]],
                            vertList[TRI_TABLE[offset + i + 1]],
                            vertList[TRI_TABLE[offset + i + 2]]
                        ];
                        cellTriangles.push(triangle);
                        triangles.push(triangle);
                    }

                    if (cellTriangles.length > 0) {
                        yield { 
                            type: 'cell_complete', 
                            pos: { x, y, z }, 
                            triangles: cellTriangles,
                            totalTriangles: triangles.length
                        };
                    }
                }
            }
        }

        yield { type: 'complete', triangles };
    }
}
