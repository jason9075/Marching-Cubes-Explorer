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
        const matInside = new THREE.MeshPhongMaterial({ color: 0xa3be8c }); // Nord 14 Green
        const matOutside = new THREE.MeshPhongMaterial({ color: 0xbf616a }); // Nord 11 Red

        const total = (resolution + 1) ** 3;
        const meshInside = new THREE.InstancedMesh(geometry, matInside, total);
        const meshOutside = new THREE.InstancedMesh(geometry, matOutside, total);
        const dummy = new THREE.Object3D();
        let iCount = 0;
        let oCount = 0;

        for (let z = 0; z <= resolution; z++) {
            for (let y = 0; y <= resolution; y++) {
                for (let x = 0; x <= resolution; x++) {
                    dummy.position.set(x, y, z);
                    dummy.updateMatrix();
                    if (solver.getScalarValue(x, y, z) > solver.isoValue) {
                        meshInside.setMatrixAt(iCount++, dummy.matrix);
                    } else {
                        meshOutside.setMatrixAt(oCount++, dummy.matrix);
                    }
                }
            }
        }

        meshInside.count = iCount;
        meshOutside.count = oCount;
        meshInside.instanceMatrix.needsUpdate = true;
        meshOutside.instanceMatrix.needsUpdate = true;
        this.pointsGroup.add(meshInside, meshOutside);
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
