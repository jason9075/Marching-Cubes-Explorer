import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.init();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2e3440); // Nord 0

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.camera.position.set(15, 15, 15);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xd8dee9, 0.5); // Nord 4
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

        // Accumulated triangle positions for step-by-step mesh (single draw call)
        this._positions = [];

        // Groups for organization
        this.gridGroup = new THREE.Group();
        this.scene.add(this.gridGroup);

        this.meshGroup = new THREE.Group();
        this.scene.add(this.meshGroup);

        this.highlightGroup = new THREE.Group();
        this.scene.add(this.highlightGroup);

        this.pointsGroup = new THREE.Group();
        this.scene.add(this.pointsGroup);

        // Materials
        this.meshMaterial = new THREE.MeshPhongMaterial({
            color: 0x88c0d0, // Nord 8
            side: THREE.DoubleSide,
            flatShading: true,
            transparent: true,
            opacity: 1.0 // Increased opacity
        });

        this.wireMaterial = new THREE.LineBasicMaterial({
            color: 0xd8dee9, // Nord 4 - Brighter color for grid
            transparent: true,
            opacity: 0.5
        });

        this.highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xebcb8b, // Nord 13 (Yellow) - More visible highlight
            wireframe: true
        });

        this.animate();
    }

    resize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    clear() {
        this.gridGroup.clear();
        this.meshGroup.clear();
        this.highlightGroup.clear();
        this.pointsGroup.clear();
        this._positions = [];
    }

    setupGrid(resolution) {
        this.clear();
        this.resolution = resolution;

        // Create a visual grid box
        const size = resolution;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, this.wireMaterial);
        line.position.set(size/2, size/2, size/2);
        this.gridGroup.add(line);

        // Center the camera
        this.controls.target.set(size/2, size/2, size/2);
        this.camera.position.set(size * 1.5, size * 1.5, size * 1.5);
    }

    setupPoints(resolution, solver) {
        this.pointsGroup.clear();
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshPhongMaterial();
        const total = (resolution + 1) ** 3;
        const mesh = new THREE.InstancedMesh(geometry, material, total);

        // Compute value range for normalization
        let minVal = Infinity, maxVal = -Infinity;
        for (let z = 0; z <= resolution; z++) {
            for (let y = 0; y <= resolution; y++) {
                for (let x = 0; x <= resolution; x++) {
                    const v = solver.getScalarValue(x, y, z);
                    if (v < minVal) minVal = v;
                    if (v > maxVal) maxVal = v;
                }
            }
        }
        const range = maxVal - minVal || 1;

        // Nord 9 (#81a1c1) → Nord 13 (#ebcb8b) → Nord 11 (#bf616a)
        const colorA = new THREE.Color(0x81a1c1);
        const colorB = new THREE.Color(0xebcb8b);
        const colorC = new THREE.Color(0xa3be8c); // Nord 14 - green (high value)
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        for (let z = 0, idx = 0; z <= resolution; z++) {
            for (let y = 0; y <= resolution; y++) {
                for (let x = 0; x <= resolution; x++, idx++) {
                    dummy.position.set(x, y, z);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(idx, dummy.matrix);

                    const t = (solver.getScalarValue(x, y, z) - minVal) / range;
                    if (t <= 0.5) {
                        color.copy(colorA).lerp(colorB, t * 2);
                    } else {
                        color.copy(colorB).lerp(colorC, (t - 0.5) * 2);
                    }
                    mesh.setColorAt(idx, color);
                }
            }
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        this.pointsGroup.add(mesh);
    }

    highlightCell(x, y, z) {
        this.highlightGroup.clear();
        const geometry = new THREE.BoxGeometry(1.05, 1.05, 1.05);
        const box = new THREE.Mesh(geometry, this.highlightMaterial);
        box.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.highlightGroup.add(box);
    }

    addTriangles(triangles) {
        for (const tri of triangles) {
            this._positions.push(
                tri[0].x, tri[0].y, tri[0].z,
                tri[1].x, tri[1].y, tri[1].z,
                tri[2].x, tri[2].y, tri[2].z,
            );
        }
        this._rebuildMesh();
    }

    _rebuildMesh() {
        this.meshGroup.clear();
        if (this._positions.length === 0) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(this._positions, 3));
        geometry.computeVertexNormals();
        this.meshGroup.add(new THREE.Mesh(geometry, this.meshMaterial));
    }

    updateFullMesh(triangles) {
        this._positions = [];
        for (const tri of triangles) {
            this._positions.push(
                tri[0].x, tri[0].y, tri[0].z,
                tri[1].x, tri[1].y, tri[1].z,
                tri[2].x, tri[2].y, tri[2].z,
            );
        }
        this._rebuildMesh();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
