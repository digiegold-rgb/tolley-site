// <space-field> — subtle magical depth: slow-drifting particle dust + soft nebula glows.
// Reacts gently to scroll (parallax push) and mouse. Transparent canvas.
customElements.define('space-field', class extends HTMLElement {
  connectedCallback() {
    this.style.cssText = 'display:block;position:absolute;inset:0;overflow:hidden;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    this.appendChild(canvas);
    this._dead = false;
    import('https://unpkg.com/three@0.160.0/build/three.module.js').then(THREE => {
      if (this._dead) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 120);
      cam.position.z = 14;
      // particle dust in three depth bands / two tints
      const mkPoints = (n, spread, size, color, opacity) => {
        const g = new THREE.BufferGeometry();
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i += 3) {
          arr[i] = (Math.random() - 0.5) * spread * 2.4;
          arr[i + 1] = (Math.random() - 0.5) * spread * 1.6;
          arr[i + 2] = (Math.random() - 0.5) * spread;
        }
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
        const p = new THREE.Points(g, m); scene.add(p); return p;
      };
      const far = mkPoints(900, 30, 0.05, 0x8f7dff, 0.55);
      const mid = mkPoints(500, 22, 0.09, 0x6fd6ff, 0.5);
      const near = mkPoints(180, 16, 0.16, 0xcfc4ff, 0.65);
      let mx = 0, my = 0;
      const onMove = e => { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; };
      addEventListener('pointermove', onMove);
      const resize = () => { const w = this.clientWidth || innerWidth, h = this.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
      resize(); addEventListener('resize', resize);
      const clock = new THREE.Clock();
      const tick = () => {
        if (this._dead) return;
        const t = clock.getElapsedTime();
        const doc = document.documentElement;
        const sp = doc.scrollHeight > innerHeight ? scrollY / (doc.scrollHeight - innerHeight) : 0;
        far.rotation.y = t * 0.008; far.position.z = sp * 5;
        mid.rotation.y = -t * 0.012; mid.position.z = sp * 9;
        near.rotation.y = t * 0.016; near.position.z = sp * 13;
        cam.position.x += (mx * 0.7 - cam.position.x) * 0.03;
        cam.position.y += (-my * 0.5 - cam.position.y) * 0.03;
        cam.lookAt(0, 0, 0);
        renderer.render(scene, cam);
        requestAnimationFrame(tick);
      };
      tick();
      this._cleanup = () => { removeEventListener('pointermove', onMove); removeEventListener('resize', resize); renderer.dispose(); };
    });
  }
  disconnectedCallback() { this._dead = true; if (this._cleanup) this._cleanup(); }
});
