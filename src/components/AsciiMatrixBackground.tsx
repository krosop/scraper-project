import { useRef, useEffect } from 'react';

// ASCII art for PC components (each row is a string, spaces are empty)
const SHAPES = [
  {
    name: 'cpu',
    // 16x6 CPU with heat spreader
    art: [
      '  ▓▓▓▓▓▓▓▓▓▓▓▓  ',
      '  ▓▓░░░░░░░░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░░░░░░░░▓▓  ',
      '  ▓▓▓▓▓▓▓▓▓▓▓▓  ',
    ],
    color: '#00d4aa', // Cyan
  },
  {
    name: 'gpu',
    // 18x6 GPU with dual fan
    art: [
      ' ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ',
      ' ▓▓  ◯◯    ◯◯  ▓▓ ',
      ' ▓▓ ◯◯◯◯  ◯◯◯◯ ▓▓ ',
      ' ▓▓  ◯◯    ◯◯  ▓▓ ',
      ' ▓▓            ▓▓ ',
      ' ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ',
    ],
    color: '#00b4d8', // Blue
  },
  {
    name: 'case',
    // 18x14 PC case front view with 3 RGB fans
    art: [
      ' ┌──────────────┐ ',
      ' │              │ ',
      ' │   ╔══════╗   │ ',
      ' │   ║ ◯  ◯ ║   │ ',
      ' │   ║  ◯◯  ║   │ ',
      ' │   ╚══════╝   │ ',
      ' │              │ ',
      ' │   ╔══════╗   │ ',
      ' │   ║ ◯  ◯ ║   │ ',
      ' │   ║  ◯◯  ║   │ ',
      ' │   ╚══════╝   │ ',
      ' │              │ ',
      ' │   ╔══════╗   │ ',
      ' │   ║ ◯  ◯ ║   │ ',
      ' │   ║  ◯◯  ║   │ ',
      ' │   ╚══════╝   │ ',
      ' │              │ ',
      ' └──────────────┘ ',
    ],
    color: '#a855f7', // Purple for RGB case
  },
];

const RAIN_CHARS = '0123456789ABCDEF░▒▓█│─┌┐└┘├┤┬┴┼╱╲╳◯●◉';

interface Cell {
  char: string;
  targetChar: string | null;
  brightness: number; // 0-1
  settled: boolean;
  inShape: boolean;
  y: number;
  x: number;
}

export default function AsciiMatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let cellW = 0;
    let cellH = 0;
    const grid: Cell[][] = [];
    let rainDrops: { x: number; y: number; speed: number; trail: string[] }[] = [];
    let shapeIndex = 0;
    let shapePhase: 'forming' | 'holding' | 'dissolving' = 'forming';
    let shapeTimer = 0;
    let rgbHue = 0; // For RGB fan cycling

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

      // Recalculate grid based on monospace font size
      cellW = 14; // approximate char width
      cellH = 18; // approximate char height
      cols = Math.ceil(w / cellW);
      rows = Math.ceil(h / cellH);

      // Reset grid
      grid.length = 0;
      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          grid[r][c] = {
            char: randomChar(),
            targetChar: null,
            brightness: 0.1 + Math.random() * 0.1,
            settled: false,
            inShape: false,
            y: r,
            x: c,
          };
        }
      }

      loadShape(shapeIndex);
    };

    const randomChar = () => RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];

    const loadShape = (idx: number) => {
      const shape = SHAPES[idx];
      const art = shape.art;
      const artH = art.length;
      const artW = art[0].length;

      // Center the shape in the grid
      const startRow = Math.floor((rows - artH) / 2);
      const startCol = Math.floor((cols - artW) / 2);

      // Reset all cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          grid[r][c].targetChar = null;
          grid[r][c].settled = false;
          grid[r][c].inShape = false;
          grid[r][c].brightness = 0.05 + Math.random() * 0.1;
        }
      }

      // Mark shape cells
      for (let r = 0; r < artH; r++) {
        for (let c = 0; c < artW; c++) {
          const gr = startRow + r;
          const gc = startCol + c;
          if (gr >= 0 && gr < rows && gc >= 0 && gc < cols) {
            const ch = art[r][c];
            if (ch !== ' ') {
              grid[gr][gc].targetChar = ch;
              grid[gr][gc].inShape = true;
            }
          }
        }
      }
    };

    const spawnRain = () => {
      // Spawn more rain over shape areas to help form them faster
      const shape = SHAPES[shapeIndex];
      const artW = shape.art[0].length;
      const startCol = Math.floor((cols - artW) / 2);

      // 70% chance to rain over shape area, 30% random
      let x: number;
      if (Math.random() < 0.7) {
        x = startCol + Math.floor(Math.random() * artW);
      } else {
        x = Math.floor(Math.random() * cols);
      }

      rainDrops.push({
        x,
        y: 0,
        speed: 0.5 + Math.random() * 1.5,
        trail: [],
      });
    };

    let frame = 0;

    const animate = () => {
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, w, h);

      frame++;
      rgbHue = (rgbHue + 0.5) % 360;

      // Shape phase management
      shapeTimer++;

      // Count settled cells in shape
      let settledCount = 0;
      let totalShapeCells = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c].inShape) {
            totalShapeCells++;
            if (grid[r][c].settled) settledCount++;
          }
        }
      }

      if (shapePhase === 'forming') {
        if (settledCount / totalShapeCells > 0.85) {
          shapePhase = 'holding';
          shapeTimer = 0;
        }
      } else if (shapePhase === 'holding') {
        if (shapeTimer > 120) { // Hold for ~2 seconds at 60fps
          shapePhase = 'dissolving';
          shapeTimer = 0;
        }
      } else if (shapePhase === 'dissolving') {
        // Dissolve from bottom up
        const dissolveRow = Math.floor((shapeTimer / 90) * rows);
        for (let r = rows - 1; r >= rows - dissolveRow; r--) {
          for (let c = 0; c < cols; c++) {
            if (grid[r][c].settled) {
              grid[r][c].settled = false;
              grid[r][c].brightness = 0.1;
            }
          }
        }
        if (shapeTimer > 90) {
          shapeIndex = (shapeIndex + 1) % SHAPES.length;
          shapePhase = 'forming';
          shapeTimer = 0;
          loadShape(shapeIndex);
        }
      }

      // Spawn rain
      if (frame % 2 === 0) spawnRain();
      if (frame % 3 === 0) spawnRain();

      // Update rain drops
      for (let i = rainDrops.length - 1; i >= 0; i--) {
        const drop = rainDrops[i];
        drop.y += drop.speed;
        const row = Math.floor(drop.y);
        const col = Math.floor(drop.x);

        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          const cell = grid[row][col];

          if (cell.inShape && !cell.settled && shapePhase === 'forming') {
            // Rain hits an unsettled shape cell — it settles!
            cell.settled = true;
            cell.char = cell.targetChar || randomChar();
            cell.brightness = 1;
          } else if (!cell.settled) {
            // Just a passing rain drop
            cell.char = randomChar();
            cell.brightness = 0.3 + Math.random() * 0.3;
          }

          // Leave a trail
          for (let t = 1; t <= 3; t++) {
            const tr = row - t;
            if (tr >= 0 && tr < rows) {
              const trailCell = grid[tr][col];
              if (!trailCell.settled) {
                trailCell.char = randomChar();
                trailCell.brightness = 0.15 - t * 0.04;
              }
            }
          }
        }

        if (drop.y > rows + 5) {
          rainDrops.splice(i, 1);
        }
      }

      // Draw grid
      ctx.font = '14px "JetBrains Mono", "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const shape = SHAPES[shapeIndex];
      const isCase = shape.name === 'case';

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c];
          const px = c * cellW + cellW / 2;
          const py = r * cellH + cellH / 2;

          let color: string;
          let alpha: number;

          if (cell.settled) {
            // Settled shape cell
            alpha = cell.brightness;

            if (isCase && cell.char === '◯') {
              // RGB fan effect for PC case
              const hue = (rgbHue + r * 20 + c * 15) % 360;
              color = `hsl(${hue}, 80%, 60%)`;
            } else {
              color = shape.color;
            }

            // Fade settled cells during dissolve
            if (shapePhase === 'dissolving') {
              const dissolveRow = Math.floor((shapeTimer / 90) * rows);
              if (r > rows - dissolveRow - 3) {
                alpha *= Math.max(0, (rows - r) / (dissolveRow + 3));
              }
            }
          } else {
            // Background rain
            alpha = cell.brightness * 0.5;
            color = '#00d4aa';
          }

          if (alpha > 0.02) {
            ctx.globalAlpha = Math.min(alpha, 1);
            ctx.fillStyle = color;
            ctx.fillText(cell.char, px, py);
          }
        }
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
