export class GlobeRenderer {
    constructor(container) {
        this.container = container;
        this.initScene();
        this.animate();

        this.resizeTimeout = null;
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.onWindowResize(), 100);
        });
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

        el.addEventListener('wheel', (e) => {
            // Prevent default browser scrolling when wheeling over the canvas
            e.preventDefault(); 
            
            // Determine the direction of the scroll
            // e.deltaY is typically negative for scroll up (zoom in) and positive for scroll down (zoom out)
            const zoomFactor = 0.5; // Adjust this value to change sensitivity
            
            // Calculate the new Z position for the camera
            // We move the camera along its Z axis (depth)
            let newZ = this.camera.position.z + e.deltaY * zoomFactor * 0.01; 
            
            // Clamp the zoom distance to sensible limits (e.g., 3 to 15)
            newZ = Math.max(3, Math.min(15, newZ)); 
            
            // Apply the new position
            this.camera.position.z = newZ;
            
            // The scene will be re-rendered on the next animate() frame, 
            // so no need to call this.renderer.render() immediately.
        }, { passive: false }); // Use {passive: false} to allow preventDefault()
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;

        // Get the current container dimensions
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        console.log('Globe container size:', width, 'x', height);
        
        if (width > 0 && height > 0) {
            // Update camera aspect ratio
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            
            // Update renderer size
            this.renderer.setSize(width, height, false);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        // Only auto-rotate when user is not interacting
        if (this.earth && !this.isPointerDown) this.earth.rotation.y += this.rotationSpeed;
        this.renderer.render(this.scene, this.camera);
    }
}