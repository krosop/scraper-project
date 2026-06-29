import { useRef, useEffect } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  glow: boolean;
  decay: number;
  drift: number;
}

export default function DataStreamBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const spawn = () => {
      const glow = Math.random() < 0.15; // 15% are "hot deal" particles
      particlesRef.current.push({
        x: Math.random() * w,
        y: h + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.5 - Math.random() * 1.5,
        size: glow ? 2 + Math.random() * 2 : 1 + Math.random() * 1.5,
        alpha: glow ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3,
        glow,
        decay: 0.998 + Math.random() * 0.001,
        drift: (Math.random() - 0.5) * 0.02,
      });
    };

    let spawnTimer = 0;

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      spawnTimer++;
      if (spawnTimer % 3 === 0) spawn(); // Spawn every 3 frames
      if (spawnTimer % 2 === 0) spawn(); // Extra spawn for density

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Mouse turbulence - push nearby particles
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120;
          p.vx += (dx / dist) * force * 0.3;
          p.vy += (dy / dist) * force * 0.15;
        }

        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.vx += p.drift;
        p.vx *= 0.99; // Damping
        p.alpha *= p.decay;

        // Draw
        if (p.glow) {
          // Glow effect for hot deal particles
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
          gradient.addColorStop(0, `rgba(0, 212, 170, ${p.alpha * 0.8})`);
          gradient.addColorStop(0.5, `rgba(0, 180, 216, ${p.alpha * 0.3})`);
          gradient.addColorStop(1, `rgba(0, 212, 170, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fill();

          // Core
          ctx.fillStyle = `rgba(0, 255, 220, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Normal particle
          ctx.fillStyle = `rgba(0, 212, 170, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Remove dead or off-screen particles
        if (p.y < -10 || p.alpha < 0.01) {
          particles.splice(i, 1);
        }
      }

      // Draw connecting lines between nearby particles (subtle network effect)
      ctx.strokeStyle = 'rgba(0, 212, 170, 0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.globalAlpha = (1 - dist / 80) * 0.08;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ zIndex: 0 }}
    />
  );
}
