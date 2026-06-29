import { useRef, useEffect } from 'react';

// Matrix rain characters: Katakana + Latin + PC symbols
const MATRIX_CHARS = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン0123456789ABCDEF░▒▓█▓▒░═║╬╪╫┌┐└┘│─├┤┬┴┼◢◣◤◥◯●◉◎◐◑◒◓▪▫■□▬▭▮▯◆◇▰▱▲△▴▵▸▹►▻◄◅◊◈☼☀☁☂☃☄★☆☇☈☉☊☋☌☍☎☏☐☑☒☓☔☕☖☗☘☙☚☛☜☝☞☟☠☡☢☣☤☥☦☧☨☩☪☫☬☭☮☯☰☱☲☳☴☵☶☷☸☹☺☻☼☽☾☿♀♁♂♃♄♅♆♇♈♉♊♋♌♍♎♏♐♑♒♓♔♕♖♗♘♙♚♛♜♝♞♟♠♡♢♣♤♥♦♧♨♩♪♫♬♭♮♯♰♱♲♳♴♵♶♷♸♹♺♻♼♽♾♿⚀⚁⚂⚃⚄⚅⚆⚇⚈⚉⚊⚋⚌⚍⚎⚏⚐⚑⚒⚓⚔⚕⚖⚗⚘⚙⚚⚛⚜⚝⚞⚟⚠⚡⚢⚣⚤⚥⚦⚧⚨⚩⚪⚫⚬⚭⚮⚯⚰⚱⚲⚳⚴⚵⚶⚷⚸⚹⚺⚻⚼⚽⚾⚿⛀⛁⛂⛃⛄⛅⛆⛇⛈⛉⛊⛋⛌⛍⎷√∛∜∞∟∠∡∢∣∤∥∦∧∨∩∪∫∬∭∮∯∰∱∲∳∴∵∶∷∸∹∺∻∼∽∾∿≀≁≂≃≄≅≆≇≈≉≊≋≌≍≎≏≐≑≒≓≔≕≖≗≘≙≚≛≜≝≞≟≠≡≢≣≤≥≦≧≨≩≪≫≬≭≮≯≰≱≲≳≴≵≶≷≸≹≺≻≼≽≾≿⊀⊁⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋⊌⊍⊎⊏⊐⊑⊒⊓⊔⊕⊖⊗⊘⊙⊚⊛⊜⊝⊞⊟⊠⊡⊢⊣⊤⊥⊦⊧⊨⊩⊪⊫⊬⊭⊮⊯⊰⊱⊲⊳⊴⊵⊶⊷⊸⊹⊺⊻⊼⊽⊾⊿⋀⋁⋂⋃⋄⋅⋆⋇⋈⋉⋊⋋⋌⋍⋎⋏⋐⋑⋒⋓⋔⋕⋖⋗⋘⋙⋚⋛⋜⋝⋞⋟⋠⋡⋢⋣⋤⋥⋦⋧⋨⋩⋪⋫⋬⋭⋮⋯⋰⋱⋲⋳⋴⋵⋶⋷⋸⋹⋺⋻⋼⋽⋾⋿';

// Detailed PC component shapes for Matrix silhouette effect
// Using block characters for better density
const SHAPES = [
  {
    name: 'cpu',
    // 18x10 detailed CPU
    art: [
      '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
      '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
      '  ▓▓░░░░░░░░░░░░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░▓▓▓▓▓▓▓▓▓▓▓░▓▓  ',
      '  ▓▓░░░░░░░░░░░░▓▓  ',
      '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
      '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
    ],
    color: '#00ff88',
  },
  {
    name: 'gpu',
    // 22x10 detailed triple-fan GPU (based on reference image)
    art: [
      ' ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ',
      ' ▓▓                  ▓▓ ',
      ' ▓▓  ◯◯◯      ◯◯◯   ▓▓ ',
      ' ▓▓ ◯◯◯◯◯    ◯◯◯◯◯  ▓▓ ',
      ' ▓▓ ◯◯◯◯◯    ◯◯◯◯◯  ▓▓ ',
      ' ▓▓  ◯◯◯      ◯◯◯   ▓▓ ',
      ' ▓▓  ◯◯◯      ◯◯◯   ▓▓ ',
      ' ▓▓ ◯◯◯◯◯    ◯◯◯◯◯  ▓▓ ',
      ' ▓▓ ◯◯◯◯◯    ◯◯◯◯◯  ▓▓ ',
      ' ▓▓  ◯◯◯      ◯◯◯   ▓▓ ',
      ' ▓▓                  ▓▓ ',
      ' ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ',
    ],
    color: '#00d4ff',
  },
  {
    name: 'case',
    // 24x16 PC case with RGB fans (based on reference image)
    art: [
      ' ┌────────────────────┐ ',
      ' │                    │ ',
      ' │   ┌──────────┐     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   └──────────┘     │ ',
      ' │                    │ ',
      ' │   ┌──────────┐     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   └──────────┘     │ ',
      ' │                    │ ',
      ' │   ┌──────────┐     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   │ ◯◯◯◯◯◯ ◯ │     │ ',
      ' │   └──────────┘     │ ',
      ' │                    │ ',
      ' │                    │ ',
      ' └────────────────────┘ ',
    ],
    color: '#ffaa00',
  },
];

interface MatrixColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  brightness: number[];
  length: number;
}

export default function CyberMatrixBackground() {
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
    const columns: MatrixColumn[] = [];
    let shapeIndex = 0;
    let shapePhase: 'forming' | 'holding' | 'dissolving' = 'forming';
    let shapeTimer = 0;
    let rgbHue = 0;
    let shapeGrid: boolean[][] = [];
    let shapeChars: string[][] = [];

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

      cellW = 12;
      cellH = 16;
      cols = Math.ceil(w / cellW);
      rows = Math.ceil(h / cellH);

      // Reset columns
      columns.length = 0;
      for (let c = 0; c < cols; c++) {
        spawnColumn(c, true);
      }

      loadShape(shapeIndex);
    };

    const randomChar = () =>
      MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];

    const loadShape = (idx: number) => {
      const shape = SHAPES[idx];
      const art = shape.art;
      const artH = art.length;
      const artW = art[0].length;

      const startRow = Math.floor((rows - artH) / 2);
      const startCol = Math.floor((cols - artW) / 2);

      shapeGrid = [];
      shapeChars = [];
      for (let r = 0; r < rows; r++) {
        shapeGrid[r] = [];
        shapeChars[r] = [];
        for (let c = 0; c < cols; c++) {
          shapeGrid[r][c] = false;
          shapeChars[r][c] = ' ';
        }
      }

      for (let r = 0; r < artH; r++) {
        for (let c = 0; c < artW; c++) {
          const gr = startRow + r;
          const gc = startCol + c;
          if (gr >= 0 && gr < rows && gc >= 0 && gc < cols) {
            const ch = art[r][c];
            if (ch !== ' ') {
              shapeGrid[gr][gc] = true;
              shapeChars[gr][gc] = ch;
            }
          }
        }
      }
    };

    const spawnColumn = (colIndex: number, randomY: boolean = false) => {
      const length = Math.floor(5 + Math.random() * 15);
      const chars: string[] = [];
      const brightness: number[] = [];
      for (let i = 0; i < length; i++) {
        chars.push(randomChar());
        brightness.push(i === 0 ? 1 : Math.max(0.1, 1 - i / length));
      }
      columns.push({
        x: colIndex,
        y: randomY ? Math.random() * rows * cellH : -length * cellH,
        speed: 0.3 + Math.random() * 1.2,
        chars,
        brightness,
        length,
      });
    };

    let frame = 0;

    const animate = () => {
      // Dark fade effect for trails
      ctx.fillStyle = 'rgba(10, 14, 20, 0.15)';
      ctx.fillRect(0, 0, w, h);

      frame++;
      rgbHue = (rgbHue + 0.8) % 360;
      shapeTimer++;

      const shape = SHAPES[shapeIndex];
      const isCase = shape.name === 'case';

      // Phase management
      let totalShapeCells = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (shapeGrid[r]?.[c]) {
            totalShapeCells++;
          }
        }
      }

      if (shapePhase === 'forming') {
        if (shapeTimer > 180) {
          shapePhase = 'holding';
          shapeTimer = 0;
        }
      } else if (shapePhase === 'holding') {
        if (shapeTimer > 150) {
          shapePhase = 'dissolving';
          shapeTimer = 0;
        }
      } else if (shapePhase === 'dissolving') {
        if (shapeTimer > 120) {
          shapeIndex = (shapeIndex + 1) % SHAPES.length;
          shapePhase = 'forming';
          shapeTimer = 0;
          loadShape(shapeIndex);
        }
      }

      // Dissolve progress (0-1)
      const dissolveProgress =
        shapePhase === 'dissolving' ? Math.min(1, shapeTimer / 120) : 0;
      const formProgress =
        shapePhase === 'forming' ? Math.min(1, shapeTimer / 180) : 1;

      // Update and draw columns
      ctx.font = '13px "JetBrains Mono", "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = columns.length - 1; i >= 0; i--) {
        const col = columns[i];
        col.y += col.speed;

        const colRow = Math.floor(col.y / cellH);

        // Draw each character in the column
        for (let j = 0; j < col.length; j++) {
          const charRow = colRow - j;
          if (charRow < 0 || charRow >= rows) continue;

          const px = col.x * cellW + cellW / 2;
          const py = charRow * cellH + cellH / 2;

          const isShapeCell = shapeGrid[charRow]?.[col.x] ?? false;
          const shapeChar = shapeChars[charRow]?.[col.x] ?? ' ';
          const isFan = isCase && shapeChar === '◯';

          let alpha = col.brightness[j];
          let color: string;
          let char = col.chars[j];

          if (isShapeCell) {
            // Shape cell — use the shape character or the rain char
            if (shapePhase === 'forming') {
              alpha *= formProgress;
            } else if (shapePhase === 'dissolving') {
              alpha *= 1 - dissolveProgress;
            }

            if (isFan) {
              // RGB fan effect
              const hue = (rgbHue + charRow * 15 + col.x * 20) % 360;
              color = `hsl(${hue}, 90%, 55%)`;
              // Make fan characters brighter
              alpha = Math.min(1, alpha * 1.5);
            } else {
              color = shape.color;
            }

            // Use the shape's intended character for settled cells
            if (
              shapePhase !== 'dissolving' ||
              dissolveProgress < 0.5
            ) {
              char = shapeChar;
            }
          } else {
            // Background rain — Matrix green/cyan
            if (j === 0) {
              // Head of the column — bright white
              color = '#ffffff';
              alpha = Math.min(1, alpha * 0.8);
            } else if (j === 1) {
              color = '#00ff88';
            } else {
              color = '#00d4aa';
              alpha *= 0.6;
            }
          }

          if (alpha > 0.02) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.fillText(char, px, py);
          }
        }

        // Reset column if it goes off screen
        if (col.y > (rows + col.length) * cellH) {
          columns.splice(i, 1);
          spawnColumn(col.x);
        }
      }

      // Ensure minimum column density
      while (columns.length < cols * 0.8) {
        const randomCol = Math.floor(Math.random() * cols);
        spawnColumn(randomCol);
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
