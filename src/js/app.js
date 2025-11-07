import { GlobeRenderer } from './globe.js';
import { Projections } from './projections.js';

class MapProjectionApp {
    constructor() {
        document.addEventListener('DOMContentLoaded', () => this.start());
        this.isGraticuleDisplayed = true;

        this.projectionInfo = {
            'equirectangular' : {
                name : 'Equirectangular',
                description : 'A simple cylindrical projection that maps meridians and parallels to equally spaced vertical and horizontal lines.',
                uses : 'uses',
            },
            'mercator' : {
                name : '',
                description : '',
                uses : '',
            },
            'mollweide' : {
                name : '',
                description : '',
                uses : '',
            },
            'bonne' : {
                name : '',
                description : '',
                uses : '',
            }
        }
    }

    start() {
        const container = document.getElementById('map-canvas');
        if (!container) {
            console.error("Container with id 'map-canvas' not found");
            return;
        }

        // Ensure container has a sensible height
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.minHeight = '600px';

        // Create the globe renderer
        this.renderer = new GlobeRenderer(container);

        // Setup projection UI if present
        this.projectionSelect = document.getElementById('projection-select');
        this.projectionCanvas = document.getElementById('projection-canvas');

        if (this.projectionCanvas) {
            this.setupProjectionCanvas();
            const initial = (this.projectionSelect && this.projectionSelect.value) || 'equirectangular';
            this.renderProjection(initial);
            this.updateProjectionInfo(initial);
        }

        if (this.projectionSelect) {
            this.projectionSelect.addEventListener('change', () => this.renderProjection(this.projectionSelect.value));
        }

        const graticuleCheckbox = document.getElementById('toggleGraticule');
        if (graticuleCheckbox) {
            // Set initial state from checkbox (assuming 'checked' in HTML)
            this.isGraticuleDisplayed = graticuleCheckbox.checked;
            
            graticuleCheckbox.addEventListener('change', (e) => {
                this.isGraticuleDisplayed = e.target.checked;
                // Re-render the projection immediately to apply the change
                const currentProj = (this.projectionSelect && this.projectionSelect.value) || 'equirectangular';
                this.renderProjection(currentProj);
            });
        }

        this.setupResizeHandling();
    }

    setupResizeHandling() {
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.handleResize(), 250);
        });
    }

    handleResize() {
        console.log('Handling unified resize');
        
        // 1. Handle projection canvas resize
        if (this.projectionCanvas) {
            this.setupProjectionCanvas();
            
            // Re-render current projection
            const currentProj = (this.projectionSelect && this.projectionSelect.value) || 'equirectangular';
            this.renderProjection(currentProj);
        }
        
        // 2. Handle globe resize (if needed)
        if (this.renderer && this.renderer.onWindowResize) {
            this.renderer.onWindowResize();
        }
    }

    setupProjectionCanvas() {
        const canvas = this.projectionCanvas;
        if (!canvas) return;
        
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(300, rect.width);
        const h = Math.max(200, rect.height);
        
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        
        this.projCtx = canvas.getContext('2d');
        this.projCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Clear any previous content
        this.projCtx.clearRect(0, 0, w, h);
    }

    updateProjectionInfo(projectionType) {
        const info = this.projectionInfo[projectionType];
        const footer = document.getElementById('projection-info-footer');
        
        if (info && footer) {
            document.getElementById('projection-name').textContent = info.name;
            document.getElementById('projection-description').textContent = info.description;
            document.getElementById('projection-uses').textContent = info.uses;
            
            // Show the footer
            footer.style.display = 'block';
        } else if (footer) {
            // Hide footer if no info available
            footer.style.display = 'none';
        }
    }

    renderProjection(projName) {
        this.updateProjectionInfo(projName);
        if (!this.projCtx || typeof Projections === 'undefined') return;
        const ctx = this.projCtx;
        const canvas = this.projectionCanvas;
        const widthCss = canvas.clientWidth;
        const heightCss = canvas.clientHeight;

        // Ensure source texture is loaded into an offscreen canvas
        if (!this.projSrcCanvas) {
            this.projSrcCanvas = document.createElement('canvas');
            this.projSrcImg = new Image();
            this.projSrcImg.src = new URL('textures/8k_earth_daymap.jpg', location.href).href;
            this.projSrcImg.onload = () => {
                this.projSrcCanvas.width = this.projSrcImg.naturalWidth;
                this.projSrcCanvas.height = this.projSrcImg.naturalHeight;
                const sctx = this.projSrcCanvas.getContext('2d');
                sctx.drawImage(this.projSrcImg, 0, 0);
                this.projSrcData = sctx.getImageData(0, 0, this.projSrcCanvas.width, this.projSrcCanvas.height).data;
                // Retry rendering now that source is ready
                this.renderProjection(projName);
            };
            this.projSrcImg.onerror = (e) => console.error('Failed to load projection source image', e);
            return; // wait for image
        }

        const srcW = this.projSrcCanvas.width;
        const srcH = this.projSrcCanvas.height;
        if (!this.projSrcData) {
            const sctx = this.projSrcCanvas.getContext('2d');
            this.projSrcData = sctx.getImageData(0, 0, srcW, srcH).data;
        }

        // Prepare mapping parameters (use CSS pixel space)
        const scale = Math.min(widthCss, heightCss) * 0.45;
        const cx = widthCss / 2;
        const cy = heightCss / 2;
        const mapToLonLat = (x, y) => {
            const nx = (x - cx) / scale;
            const ny = (cy - y) / scale;
            const inv = Projections.inverse[projName];
            if (!inv) return null;
            return inv(nx, ny);
        };

        // Paint the projected map by sampling the source texture
        // Iterate at physical (device) pixel resolution and map back to CSS coords for projection
        const dpr = window.devicePixelRatio || 1;
        const widthPhys = canvas.width;
        const heightPhys = canvas.height;

        ctx.clearRect(0, 0, widthCss, heightCss);
        const sdata = this.projSrcData;

        // Loop over physical pixels
        for (let py = 0; py < heightPhys; py++) {
            for (let px = 0; px < widthPhys; px++) {
                // Map physical pixel center to CSS coordinates used by inverse projection
                const cssX = (px + 0.5) / dpr;
                const cssY = (py + 0.5) / dpr;
                const lonlat = mapToLonLat(cssX, cssY);
                if (!lonlat) continue;
                let lon = lonlat.lon;
                let lat = lonlat.lat;
                if (!isFinite(lon) || !isFinite(lat)) continue;

                // Wrap longitude into [-180,180]
                if (lon > 180) lon = ((lon + 180) % 360) - 180;
                if (lon < -180) lon = ((lon - 180) % 360) + 180;

                // Source UV
                const u = (lon + 180) / 360;
                const v = (90 - lat) / 180;
                if (u < 0 || u > 1 || v < 0 || v > 1) {
                    continue;
                }

                const sx = Math.floor(u * (srcW - 1));
                const sy = Math.floor(v * (srcH - 1));
                const si = (sy * srcW + sx) * 4;
                const r = sdata[si], g = sdata[si + 1], b = sdata[si + 2], a = sdata[si + 3];

                const projCoords = Projections[projName](lon, lat);
                if (!projCoords) continue;

                // Draw at CSS position scaled so that with ctx transform (dpr) it paints one physical pixel
                ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
                ctx.fillRect(cssX, cssY, 1 / dpr, 1 / dpr);
            }
        }

        // Draw graticule on top
        if (this.isGraticuleDisplayed) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#2b6ea3';
            for (let lon = -180; lon <= 180; lon += 15) {
                ctx.beginPath();
                let started = false;
                for (let lat = -89; lat <= 89; lat += 2) {
                    const p = Projections[projName](lon, lat);
                    if (!isFinite(p.x) || !isFinite(p.y)) { started = false; continue; }
                    const c = { x: cx + p.x * scale, y: cy - p.y * scale };
                    if (!started) { ctx.moveTo(c.x, c.y); started = true; } else ctx.lineTo(c.x, c.y);
                }
                ctx.stroke();
            }

            for (let lat = -80; lat <= 80; lat += 10) {
                ctx.beginPath();
                let started = false;
                for (let lon = -180; lon <= 180; lon += 2) {
                    const p = Projections[projName](lon, lat);
                    if (!isFinite(p.x) || !isFinite(p.y)) { started = false; continue; }
                    const c = { x: cx + p.x * scale, y: cy - p.y * scale };
                    if (!started) { ctx.moveTo(c.x, c.y); started = true; } else ctx.lineTo(c.x, c.y);
                }
                ctx.stroke();
            }

            // Equator and prime meridian
            ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b3b5a';
            ctx.beginPath(); let s=false;
            for (let lon=-180; lon<=180; lon+=2){ const p=Projections[projName](lon,0); if(!isFinite(p.x)||!isFinite(p.y)){s=false;continue;} const c={x:cx+p.x*scale,y:cy-p.y*scale}; if(!s){ctx.moveTo(c.x,c.y);s=true}else ctx.lineTo(c.x,c.y);} ctx.stroke();
            ctx.beginPath(); s=false;
            for (let lat=-89; lat<=89; lat+=2){ const p=Projections[projName](0,lat); if(!isFinite(p.x)||!isFinite(p.y)){s=false;continue;} const c={x:cx+p.x*scale,y:cy-p.y*scale}; if(!s){ctx.moveTo(c.x,c.y);s=true}else ctx.lineTo(c.x,c.y);} ctx.stroke();

        }
    }
}

window.mapApp = new MapProjectionApp();