export class GlobeRenderer {
    constructor(container) {
        this.container = container;
        this.initScene();
        this.animate();
        window.addEventListener('resize', () => this.onWindowResize());
    }

    initScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x081028);

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 6);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.domElement.style.display = 'block';
        // Clear any previous children and append
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambient);

        const dir = new THREE.DirectionalLight(0xffffff, 0.6);
        dir.position.set(5, 3, 5);
        this.scene.add(dir);

        // Earth
        const geometry = new THREE.SphereGeometry(2, 64, 64);
        const loader = new THREE.TextureLoader();

        const texturePath = new URL('textures/8k_earth_daymap.jpg', location.href).href;
        const texture = loader.load(
            texturePath,
            () => { /* texture loaded */ },
            undefined,
            (err) => {
                console.error('Failed to load local earth texture:', err);
            }
        );

        const material = new THREE.MeshPhongMaterial({ map: texture });
        this.earth = new THREE.Mesh(geometry, material);
        this.scene.add(this.earth);

        // Small subtle rotation speed
        this.rotationSpeed = 0.0012;

        // Set up pointer drag controls
        this.setupControls();
    }

    setupControls() {
        // Use Pointer Events for unified mouse/touch handling
        this.isPointerDown = false;
        this.pointer = { x: 0, y: 0 };

        const el = this.renderer.domElement;
        if (!el) return;
        el.style.touchAction = 'none'; // prevent default browser gestures

        el.addEventListener('pointerdown', (e) => {
            this.isPointerDown = true;
            this.pointer.x = e.clientX;
            this.pointer.y = e.clientY;
            try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        });

        el.addEventListener('pointermove', (e) => {
            if (!this.isPointerDown || !this.earth) return;
            const dx = e.clientX - this.pointer.x;
            const dy = e.clientY - this.pointer.y;
            this.pointer.x = e.clientX;
            this.pointer.y = e.clientY;

            // Rotate sensitivity
            this.earth.rotation.y += dx * 0.005; // horizontal drag -> yaw
            this.earth.rotation.x += dy * 0.005; // vertical drag -> pitch

            // Clamp x rotation to avoid flipping
            const halfPi = Math.PI / 2 - 0.01;
            this.earth.rotation.x = Math.max(-halfPi, Math.min(halfPi, this.earth.rotation.x));
        });

        el.addEventListener('pointerup', (e) => {
            this.isPointerDown = false;
            try { el.releasePointerCapture && el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        });

        el.addEventListener('pointerleave', () => {
            this.isPointerDown = false;
        });
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        // Only auto-rotate when user is not interacting
        if (this.earth && !this.isPointerDown) this.earth.rotation.y += this.rotationSpeed;
        this.renderer.render(this.scene, this.camera);
    }
}