/**
 * Formas que solo se usan para generar las imágenes de los productos (modo captura).
 * Usan la paleta genérica del shader para ids >= S_SOLAR: el tipo elige el color
 * (0 hielo, 1 aqua, 2 cielo, 3 solar, 4 coral, 5 violeta, 6 mapa de calor, 7 relleno
 * tenue) y el parámetro el brillo (0.7 es el brillo normal; en el tipo 6, el calor).
 */
import { ShapeBuilder, fillSegments, makeNoise2D, onSphere, rotateX, rotateY, smoothstep, type Rng, type Vec3 } from './util';

type Seg = [Vec3, Vec3];

function pushV(b: ShapeBuilder, p: Vec3, type: number, param: number) {
  b.push(p[0], p[1], p[2], type, param);
}

/** Puntos repartidos en un disco o una esfera alrededor de c. */
function ball(rng: Rng, c: Vec3, r: number): Vec3 {
  const d = onSphere(rng);
  const k = r * Math.cbrt(rng());
  return [c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k];
}

/** Polígono cerrado como lista de segmentos. */
function loop(pts: Vec3[]): Seg[] {
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as Seg);
}

/* ------------------------------------------------------------------ */
/* SolarMe: azotea con filas de paneles inclinados, sombras y sol.     */
/* ------------------------------------------------------------------ */

export function solar(b: ShapeBuilder) {
  const { rng } = b;
  const place = (p: Vec3): Vec3 => rotateX(rotateY(p, -0.5), 0.52);
  const Y0 = -0.62;
  const RX = 2.35;
  const RZ = 1.5;
  const tilt = 0.45;
  const L = 0.56;
  const dz = L * Math.cos(tilt);
  const dy = L * Math.sin(tilt);
  const legH = 0.07;
  const rowsZ = [1.12, 0.37, -0.38, -1.13];
  const nPanels = 6;
  const panelW = 0.6;
  const gapW = 0.05;
  const rowX0 = -(nPanels * panelW + (nPanels - 1) * gapW) / 2;
  const rowX1 = -rowX0;

  /** Punto de un panel: u a lo ancho (0..1), v a lo largo de la pendiente (0..1). */
  const panel = (row: number, k: number, u: number, v: number): Vec3 =>
    place([rowX0 + k * (panelW + gapW) + u * panelW, Y0 + legH + v * dy, rowsZ[row] - v * dz]);

  // Superficie de las celdas.
  const nSurface = b.quota(0.28);
  for (let i = 0; i < nSurface; i++) {
    const row = Math.floor(rng() * rowsZ.length);
    const k = Math.floor(rng() * nPanels);
    pushV(b, panel(row, k, rng(), rng()), 2, 0.3 + rng() * 0.18);
  }

  // Marco de cada panel y líneas de las celdas (6 × 3).
  const frame: Seg[] = [];
  const cells: Seg[] = [];
  for (let row = 0; row < rowsZ.length; row++) {
    for (let k = 0; k < nPanels; k++) {
      const c00 = panel(row, k, 0, 0);
      const c10 = panel(row, k, 1, 0);
      const c11 = panel(row, k, 1, 1);
      const c01 = panel(row, k, 0, 1);
      frame.push(...loop([c00, c10, c11, c01]));
      for (let u = 1; u < 6; u++) cells.push([panel(row, k, u / 6, 0), panel(row, k, u / 6, 1)]);
      for (let v = 1; v < 3; v++) cells.push([panel(row, k, 0, v / 3), panel(row, k, 1, v / 3)]);
    }
  }
  fillSegments(b, frame, b.quota(0.1), 1, 0.92, 0.006);
  fillSegments(b, cells, b.quota(0.09), 1, 0.5, 0.004);

  // Soportes: patas delanteras cortas y traseras altas.
  const legs: Seg[] = [];
  for (let row = 0; row < rowsZ.length; row++) {
    for (let k = 0; k <= nPanels; k += 2) {
      const x = Math.min(rowX1, rowX0 + k * (panelW + gapW));
      legs.push([place([x, Y0, rowsZ[row]]), place([x, Y0 + legH, rowsZ[row]])]);
      legs.push([place([x, Y0, rowsZ[row] - dz]), place([x, Y0 + legH + dy, rowsZ[row] - dz])]);
    }
  }
  fillSegments(b, legs, b.quota(0.015), 0, 0.55, 0.004);

  // Sombra de cada fila: termina antes de llegar a la siguiente (la separación del solsticio).
  const nShade = b.quota(0.05);
  for (let i = 0; i < nShade; i++) {
    const row = Math.floor(rng() * (rowsZ.length - 1));
    const back = rowsZ[row] - dz;
    const len = 0.2 * Math.sqrt(rng());
    pushV(b, place([rowX0 + rng() * (rowX1 - rowX0), Y0 + 0.004, back - len]), 5, 0.3 + rng() * 0.15);
  }

  // Azotea: pretil (borde inferior y superior), piso tenue y muros que se desvanecen.
  const corners = (y: number): Vec3[] => [
    place([-RX, y, -RZ]),
    place([RX, y, -RZ]),
    place([RX, y, RZ]),
    place([-RX, y, RZ]),
  ];
  const parapet: Seg[] = [...loop(corners(Y0)), ...loop(corners(Y0 + 0.11))];
  for (const [x, z] of [[-RX, -RZ], [RX, -RZ], [RX, RZ], [-RX, RZ]]) parapet.push([place([x, Y0, z]), place([x, Y0 + 0.11, z])]);
  fillSegments(b, parapet, b.quota(0.055), 0, 0.72, 0.005);

  const nFloor = b.quota(0.06);
  for (let i = 0; i < nFloor; i++) pushV(b, place([(rng() * 2 - 1) * RX, Y0, (rng() * 2 - 1) * RZ]), 7, 0.25);

  // Muros frontal y derecho: rejilla de pisos y columnas, más tenue hacia abajo.
  const wallH = 0.72;
  const nWall = b.quota(0.06);
  for (let i = 0; i < nWall; i++) {
    const front = rng() < 0.62;
    const vertical = rng() < 0.5;
    let x: number;
    let z: number;
    let y: number;
    if (vertical) {
      const col = Math.floor(rng() * (front ? 13 : 9));
      y = Y0 - rng() * wallH;
      x = front ? -RX + (col / 12) * 2 * RX : RX;
      z = front ? RZ : -RZ + (col / 8) * 2 * RZ;
    } else {
      const floor = Math.floor(rng() * 2);
      y = Y0 - 0.08 - floor * 0.34;
      const t = rng() * 2 - 1;
      x = front ? t * RX : RX;
      z = front ? RZ : t * RZ;
    }
    const fade = 1 - (Y0 - y) / wallH;
    pushV(b, place([x, y, z]), 0, 0.05 + fade * 0.45);
  }

  // Sol arriba a la derecha: disco, corona y rayos.
  const S: Vec3 = [2.3, 1.42, -0.4];
  const nDisc = b.quota(0.07);
  for (let i = 0; i < nDisc; i++) pushV(b, ball(rng, S, 0.3), 3, 0.62 + rng() * 0.3);
  const nCorona = b.quota(0.025);
  for (let i = 0; i < nCorona; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.4 + rng() * 0.04;
    pushV(b, [S[0] + Math.cos(a) * r, S[1] + Math.sin(a) * r, S[2]], 3, 0.5);
  }
  const rays: Seg[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.13;
    rays.push([
      [S[0] + Math.cos(a) * 0.52, S[1] + Math.sin(a) * 0.52, S[2]],
      [S[0] + Math.cos(a) * 0.76, S[1] + Math.sin(a) * 0.76, S[2]],
    ]);
  }
  fillSegments(b, rays, b.quota(0.025), 3, 0.62, 0.008);

  // Rayos de luz punteados hacia la parte alta de tres filas.
  const beams: Seg[] = [
    [S, panel(0, 4, 0.5, 1)],
    [S, panel(1, 2, 0.5, 1)],
    [S, panel(2, 0, 0.5, 1)],
  ];
  const nBeam = b.quota(0.03);
  let made = 0;
  while (made < nBeam) {
    const [a, c] = beams[Math.floor(rng() * beams.length)];
    const t = 0.18 + rng() * 0.8;
    if ((t * 26) % 1 > 0.55) continue;
    pushV(b, [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t], 3, 0.32);
    made++;
  }

  // Lo que sobra refuerza las celdas.
  const rest = b.remaining;
  for (let i = 0; i < rest; i++) {
    const row = Math.floor(rng() * rowsZ.length);
    const k = Math.floor(rng() * nPanels);
    pushV(b, panel(row, k, rng(), rng()), 2, 0.3 + rng() * 0.18);
  }
  return b.finish();
}

/* ------------------------------------------------------------------ */
/* Model Builder: eje, cubo con corte y chaveta paralela, con malla de */
/* elementos finitos y mapa de esfuerzos alrededor de la chaveta.      */
/* ------------------------------------------------------------------ */

export function shaft(b: ShapeBuilder) {
  const { rng } = b;
  const place = (p: Vec3): Vec3 => rotateX(rotateY(p, -0.55), 0.42);
  const R = 0.5;
  const X0 = -2.25;
  const X1 = 2.25;
  const RH = 1.05;
  const HX = 0.85;
  const KX = 0.7;
  const KZ = 0.14;
  const KY0 = R - 0.17;
  const KY1 = R + 0.13;
  // Corte del cubo: se quita el cuadrante frontal superior para ver la chaveta.
  const CUT0 = -0.15;
  const CUT1 = 1.78;
  const inCut = (phi: number) => phi > CUT0 && phi < CUT1;
  const cyl = (x: number, r: number, phi: number): Vec3 => [x, Math.sin(phi) * r, Math.cos(phi) * r];

  /** Esfuerzo: alto en los flancos de la chaveta y del lado donde entra el par. */
  const stress = (p: Vec3) => {
    const dz = Math.max(0, Math.abs(p[2]) - KZ);
    const dyk = p[1] - R;
    const d2 = dz * dz + dyk * dyk;
    const along = smoothstep(KX + 0.6, KX - 0.15, Math.abs(p[0])) * (0.7 + 0.3 * smoothstep(KX, -KX, p[0]));
    // Fondo: el par carga todo el tramo entre la entrada y el cubo.
    const base = 0.1 + 0.22 * smoothstep(X0 + 0.2, -KX, p[0]) * smoothstep(KX + 0.9, KX, p[0]);
    return Math.min(0.98, base + 0.85 * Math.exp(-d2 / 0.16) * along);
  };

  // Superficie del eje (sin el chavetero) con mapa de esfuerzos; parte de los puntos
  // se concentra alrededor de la chaveta, donde está el gradiente.
  const shaftPoint = (): Vec3 | null => {
    const nearKey = rng() < 0.45;
    const x = nearKey ? (rng() * 2 - 1) * 1.05 : X0 + rng() * (X1 - X0);
    const phi = nearKey ? Math.PI / 2 + (rng() * 2 - 1) * 1.1 : rng() * Math.PI * 2 - Math.PI / 2;
    const p = cyl(x, R, phi);
    if (Math.abs(x) < KX + 0.05 && Math.abs(p[2]) < KZ + 0.01 && p[1] > 0) return null;
    return p;
  };
  const nShaft = b.quota(0.16);
  let made = 0;
  while (made < nShaft) {
    const p = shaftPoint();
    if (!p) continue;
    pushV(b, place(p), 6, stress(p));
    made++;
  }

  // Malla del eje: anillos y generatrices; cara del extremo con anillos y radios.
  const mesh: Seg[] = [];
  const ring = (x: number, r: number, from = 0, to = Math.PI * 2, n = 40) => {
    for (let i = 0; i < n; i++) {
      const a0 = from + ((to - from) * i) / n;
      const a1 = from + ((to - from) * (i + 1)) / n;
      mesh.push([place(cyl(x, r, a0)), place(cyl(x, r, a1))]);
    }
  };
  for (let x = X0; x <= X1 + 1e-6; x += 0.15) ring(x, R);
  for (let k = 0; k < 18; k++) {
    const phi = (k / 18) * Math.PI * 2;
    mesh.push([place(cyl(X0, R, phi)), place(cyl(X1, R, phi))]);
  }
  for (const r of [0.18, 0.34]) ring(X1, r);
  for (let k = 0; k < 12; k++) {
    const phi = (k / 12) * Math.PI * 2;
    mesh.push([place([X1, 0, 0]), place(cyl(X1, R, phi))]);
  }
  fillSegments(b, mesh, b.quota(0.13), 0, 0.7, 0.003);

  const nFace = b.quota(0.02);
  for (let i = 0; i < nFace; i++) {
    const r = R * Math.sqrt(rng());
    const phi = rng() * Math.PI * 2;
    const p = cyl(X1, r, phi);
    pushV(b, place(p), 6, 0.1 + 0.15 * (r / R));
  }

  // Cubo: superficie exterior e interior fuera del corte, y caras del corte.
  const nHub = b.quota(0.08);
  made = 0;
  while (made < nHub) {
    const x = (rng() * 2 - 1) * HX;
    const phi = rng() * Math.PI * 2 - Math.PI / 2;
    if (inCut(phi)) continue;
    const outer = rng() < 0.78;
    const r = outer ? RH : R + 0.01;
    const p = cyl(x, r, phi);
    pushV(b, place(p), 6, outer ? 0.12 + 0.1 * rng() : stress([x, Math.sin(phi) * R, Math.cos(phi) * R]) * 0.8);
    made++;
  }
  const nHubEnds = b.quota(0.04);
  made = 0;
  while (made < nHubEnds) {
    const phi = rng() * Math.PI * 2 - Math.PI / 2;
    if (inCut(phi)) continue;
    const r = R + (RH - R) * Math.sqrt(rng());
    const x = rng() < 0.5 ? -HX : HX;
    pushV(b, place(cyl(x, r, phi)), 6, 0.1 + 0.25 * (1 - (r - R) / (RH - R)));
    made++;
  }
  const nCutFaces = b.quota(0.09);
  for (let i = 0; i < nCutFaces; i++) {
    const phi = rng() < 0.5 ? CUT0 : CUT1;
    const r = R + (RH - R) * rng();
    const x = (rng() * 2 - 1) * HX;
    const p = cyl(x, r, phi);
    const near = phi === CUT1 ? Math.exp(-Math.pow((r - R) / 0.22, 2)) : 0.35 * Math.exp(-Math.pow((r - R) / 0.3, 2));
    const along = smoothstep(HX, 0.2, Math.abs(x));
    pushV(b, place(p), 6, 0.14 + 0.7 * near * along);
  }

  // Malla del cubo.
  const hubMesh: Seg[] = [];
  const hubRing = (x: number, r: number) => {
    const n = 36;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (Math.PI * 2 * i) / n;
      const a1 = -Math.PI / 2 + (Math.PI * 2 * (i + 1)) / n;
      if (inCut(a0) || inCut(a1)) continue;
      hubMesh.push([place(cyl(x, r, a0)), place(cyl(x, r, a1))]);
    }
  };
  for (let x = -HX; x <= HX + 1e-6; x += 0.17) hubRing(x, RH);
  for (let k = 0; k < 24; k++) {
    const phi = -Math.PI / 2 + (k / 24) * Math.PI * 2;
    if (inCut(phi)) continue;
    hubMesh.push([place(cyl(-HX, RH, phi)), place(cyl(HX, RH, phi))]);
  }
  for (const phi of [CUT0, CUT1]) {
    for (let r = R; r <= RH + 1e-6; r += (RH - R) / 4) hubMesh.push([place(cyl(-HX, r, phi)), place(cyl(HX, r, phi))]);
    for (let x = -HX; x <= HX + 1e-6; x += 0.17) hubMesh.push([place(cyl(x, R, phi)), place(cyl(x, RH, phi))]);
  }
  fillSegments(b, hubMesh, b.quota(0.09), 0, 0.62, 0.003);

  // Chaveta: caras con esfuerzo alto en los flancos y aristas brillantes.
  const nKey = b.quota(0.07);
  for (let i = 0; i < nKey; i++) {
    const face = rng();
    let p: Vec3;
    if (face < 0.4) p = [(rng() * 2 - 1) * KX, KY0 + rng() * (KY1 - KY0), rng() < 0.5 ? KZ : -KZ];
    else if (face < 0.8) p = [(rng() * 2 - 1) * KX, KY1, (rng() * 2 - 1) * KZ];
    else p = [rng() < 0.5 ? KX : -KX, KY0 + rng() * (KY1 - KY0), (rng() * 2 - 1) * KZ];
    const flank = Math.abs(Math.abs(p[2]) - KZ) < 1e-6 ? 0.9 : 0.55;
    pushV(b, place(p), 6, flank * (0.8 + 0.2 * smoothstep(KX, -KX, p[0])));
  }
  const kc: Vec3[] = [];
  for (const x of [-KX, KX]) for (const y of [KY0, KY1]) for (const z of [-KZ, KZ]) kc.push([x, y, z]);
  const keyEdges: Seg[] = [];
  for (let i = 0; i < kc.length; i++) {
    for (let j = i + 1; j < kc.length; j++) {
      const diff = [0, 1, 2].filter((a) => kc[i][a] !== kc[j][a]).length;
      if (diff === 1) keyEdges.push([place(kc[i]), place(kc[j])]);
    }
  }
  fillSegments(b, keyEdges, b.quota(0.04), 3, 0.85, 0.004);

  // Bordes del chavetero en el eje.
  const slot: Seg[] = [
    [place([-KX - 0.05, R, -KZ - 0.01]), place([KX + 0.05, R, -KZ - 0.01])],
    [place([-KX - 0.05, R, KZ + 0.01]), place([KX + 0.05, R, KZ + 0.01])],
  ];
  fillSegments(b, slot, b.quota(0.015), 3, 0.5, 0.003);

  // Flecha curva del par de entrada en el extremo izquierdo.
  const arrow: Seg[] = [];
  const AR = 0.78;
  const AX = X0 + 0.45;
  const n = 28;
  const a0 = 0.3;
  const a1 = 0.3 + Math.PI * 1.25;
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    arrow.push([place(cyl(AX, AR, t0)), place(cyl(AX, AR, t1))]);
  }
  const tip = cyl(AX, AR, a1);
  const back = cyl(AX, AR, a1 - 0.25);
  for (const dr of [0.12, -0.12]) arrow.push([place(tip), place([back[0], back[1] * (1 + dr / AR), back[2] * (1 + dr / AR)])]);
  fillSegments(b, arrow, b.quota(0.03), 3, 0.75, 0.008);

  // Resto: más malla y más superficie del eje.
  fillSegments(b, [...mesh, ...hubMesh], b.quota(0.1), 0, 0.7, 0.003);
  while (b.remaining > 0) {
    const p = shaftPoint();
    if (p) pushV(b, place(p), 6, stress(p));
  }
  return b.finish();
}

/* ------------------------------------------------------------------ */
/* Momentum: «mi vida en semanas», una cuadrícula ondulada de semanas  */
/* vividas, la semana actual encendida y las que faltan en contorno.   */
/* ------------------------------------------------------------------ */

export function weeks(b: ShapeBuilder) {
  const { rng } = b;
  const COLS = 52;
  const ROWS = 26;
  const SP = 0.092;
  const H = 0.033;
  const NOW_ROW = 18;
  const NOW_COL = 33;
  const x0 = (-(COLS - 1) * SP) / 2;
  const y0 = ((ROWS - 1) * SP) / 2;
  const place = (x: number, y: number, lift = 0): Vec3 => {
    const z = 0.3 * Math.sin(0.72 * x + 0.5) + 0.12 * Math.cos(1.25 * y) - 0.05 * x * x + lift;
    return rotateY(rotateX([x, y, z], -0.3), 0.5);
  };
  const cell = (row: number, col: number): [number, number] => [x0 + col * SP, y0 - row * SP];
  const lived = (row: number, col: number) => row < NOW_ROW || (row === NOW_ROW && col < NOW_COL);

  const past: [number, number][] = [];
  const future: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === NOW_ROW && c === NOW_COL) continue;
      (lived(r, c) ? past : future).push([r, c]);
    }
  }

  // Semanas vividas: cuadros rellenos, más brillantes cuanto más recientes.
  const nPast = b.quota(0.64);
  for (let i = 0; i < nPast; i++) {
    const [r, c] = past[Math.floor(rng() * past.length)];
    const [cx, cy] = cell(r, c);
    const p = place(cx + (rng() * 2 - 1) * H, cy + (rng() * 2 - 1) * H);
    pushV(b, p, 1, 0.38 + 0.4 * (r / NOW_ROW));
  }

  // Semanas por vivir: un punto pequeño y tenue en el centro de cada celda.
  const nFuture = b.quota(0.12);
  for (let i = 0; i < nFuture; i++) {
    const [r, c] = future[Math.floor(rng() * future.length)];
    const [cx, cy] = cell(r, c);
    const a = rng() * Math.PI * 2;
    const k = 0.011 * Math.sqrt(rng());
    pushV(b, place(cx + Math.cos(a) * k, cy + Math.sin(a) * k), 0, 0.42);
  }

  // Semana actual: cuadro encendido y un halo que la rodea.
  const [nx, ny] = cell(NOW_ROW, NOW_COL);
  const nNow = b.quota(0.025);
  for (let i = 0; i < nNow; i++) pushV(b, place(nx + (rng() * 2 - 1) * H * 1.2, ny + (rng() * 2 - 1) * H * 1.2, 0.01), 3, 0.95);
  const nHalo = b.quota(0.03);
  for (let i = 0; i < nHalo; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() < 0.6 ? 0.1 + rng() * 0.012 : 0.17 + rng() * 0.01;
    pushV(b, place(nx + Math.cos(a) * r, ny + Math.sin(a) * r, 0.02), 3, r < 0.15 ? 0.7 : 0.35);
  }

  // Lo que sobra va a las semanas vividas.
  while (b.remaining > 0) {
    const [r, c] = past[Math.floor(rng() * past.length)];
    const [cx, cy] = cell(r, c);
    pushV(b, place(cx + (rng() * 2 - 1) * H, cy + (rng() * 2 - 1) * H), 1, 0.38 + 0.4 * (r / NOW_ROW));
  }
  return b.finish();
}

/* ------------------------------------------------------------------ */
/* WorldBrain: cerebro con circunvoluciones, cerebelo, tronco y         */
/* chispas neuronales unidas por arcos.                                */
/* ------------------------------------------------------------------ */

export function brain(b: ShapeBuilder) {
  const { rng } = b;
  const noise = makeNoise2D(4242);
  const place = (p: Vec3): Vec3 => rotateX(rotateY(p, 0.95), 0.2);
  const RX = 0.8;
  const RY = 0.92;
  const RZ = 1.34;
  const GAP = 0.045;

  /** Punto de la corteza de un hemisferio (s = ±1) a partir de una dirección. */
  const cortex = (s: number, d: Vec3): Vec3 => {
    const dx = Math.abs(d[0]) * s;
    let x = dx * RX * (1 - 0.1 * Math.max(0, d[2]));
    let y = d[1] * RY + 0.12;
    const z = d[2] * RZ;
    // Lóbulo temporal: abulta los costados en la parte baja media.
    const temporal = Math.exp(-Math.pow((y + 0.3) / 0.28, 2)) * Math.exp(-Math.pow((z - 0.2) / 0.6, 2));
    x += s * 0.1 * temporal * Math.abs(d[0]);
    if (y < -0.28) y = -0.28 + (y + 0.28) * 0.55;
    return [x + s * GAP, y, z];
  };
  /** Valor del ruido en la superficie: sus curvas de nivel dibujan los surcos. */
  const field = (p: Vec3) => 0.5 * noise(p[0] * 2.1 + 11, p[1] * 2.1) + 0.5 * noise(p[2] * 2.1, p[1] * 2.1 + 7);

  const nLines = b.quota(0.42);
  const nFill = b.quota(0.24);
  let lines = 0;
  let fill = 0;
  let guard = 0;
  while ((lines < nLines || fill < nFill) && guard++ < 4_000_000) {
    const s = rng() < 0.5 ? -1 : 1;
    const p = cortex(s, onSphere(rng));
    const f = (field(p) * 9) % 1;
    const front = (p[2] / RZ + 1) / 2;
    if (f < 0.085 && lines < nLines) {
      pushV(b, place(p), front > 0.5 ? 1 : 5, 0.55 + 0.35 * Math.abs(front - 0.5) * 2);
      lines++;
    } else if (f >= 0.085 && fill < nFill && rng() < 0.35) {
      pushV(b, place(p), 7, front);
      fill++;
    }
  }

  // Cerebelo con estrías horizontales.
  const CB: Vec3 = [0, -0.5, -0.92];
  const nCb = b.quota(0.08);
  let cb = 0;
  guard = 0;
  while (cb < nCb && guard++ < 2_000_000) {
    const d = onSphere(rng);
    const p: Vec3 = [CB[0] + d[0] * 0.62, CB[1] + d[1] * 0.3, CB[2] + d[2] * 0.42];
    // Solo la parte que asoma bajo los hemisferios.
    if (p[1] > -0.34 && p[2] > -0.95) continue;
    const stripe = (Math.abs(p[1] - CB[1]) * 16 + d[2] * 2) % 1;
    if (stripe > 0.45 && rng() < 0.75) continue;
    pushV(b, place(p), 2, stripe <= 0.45 ? 0.62 : 0.3);
    cb++;
  }

  // Tronco encefálico.
  const nStem = b.quota(0.03);
  for (let i = 0; i < nStem; i++) {
    const t = rng();
    const a = rng() * Math.PI * 2;
    const r = 0.14 * (1 - 0.3 * t);
    const c: Vec3 = [0, -0.45 - t * 0.75, -0.42 - t * 0.12];
    pushV(b, place([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]), 2, 0.4);
  }

  // Chispas neuronales sobre la corteza y arcos entre algunas de ellas.
  const sparks: Vec3[] = [];
  for (let k = 0; k < 46; k++) sparks.push(cortex(rng() < 0.5 ? -1 : 1, onSphere(rng)));
  const nSpark = b.quota(0.05);
  for (let i = 0; i < nSpark; i++) {
    const c = sparks[i % sparks.length];
    pushV(b, place(ball(rng, c, 0.035)), 3, 0.75 + rng() * 0.24);
  }
  const arcs: Seg[] = [];
  for (let k = 0; k < 22; k++) {
    const a = sparks[k];
    const c = sparks[(k * 7 + 5) % sparks.length];
    const mid: Vec3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    const len = Math.hypot(mid[0], mid[1], mid[2]) || 1;
    const lift = 1.18;
    const m: Vec3 = [(mid[0] / len) * Math.max(len, 0.9) * lift, (mid[1] / len) * Math.max(len, 0.9) * lift, (mid[2] / len) * Math.max(len, 0.9) * lift];
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const q = (t: number): Vec3 => {
        const u = 1 - t;
        return [u * u * a[0] + 2 * u * t * m[0] + t * t * c[0], u * u * a[1] + 2 * u * t * m[1] + t * t * c[1], u * u * a[2] + 2 * u * t * m[2] + t * t * c[2]];
      };
      arcs.push([place(q(t0)), place(q(t1))]);
    }
  }
  fillSegments(b, arcs, b.quota(0.05), 3, 0.32, 0.004);

  // Resto: más relleno de la corteza.
  while (b.remaining > 0) {
    const s = rng() < 0.5 ? -1 : 1;
    const p = cortex(s, onSphere(rng));
    pushV(b, place(p), 7, (p[2] / RZ + 1) / 2);
  }
  return b.finish();
}

/* ------------------------------------------------------------------ */
/* CulturaMe: mapa de una ciudad inclinado, con calles, capa de         */
/* densidad cultural, marcadores por tipo de espacio y «cerca de mí».  */
/* ------------------------------------------------------------------ */

export function cityMap(b: ShapeBuilder) {
  const { rng } = b;
  const place = (p: Vec3): Vec3 => rotateX(rotateY(p, -0.28), 0.88);
  const MX = 2.7;
  const MZ = 1.75;
  const CENTER: Vec3 = [0.15, 0, 0.05];

  // Calles: rejilla con ligeras curvas, más fina en el centro histórico.
  const grid: Seg[] = [];
  const wobble = (x: number, z: number, k: number): Vec3 => [x, 0, z + 0.035 * Math.sin(x * 1.7 + k * 1.3)];
  for (let k = 0; k <= 10; k++) {
    const z = -MZ + (k / 10) * 2 * MZ;
    for (let i = 0; i < 24; i++) {
      const xa = -MX + (i / 24) * 2 * MX;
      const xb = -MX + ((i + 1) / 24) * 2 * MX;
      grid.push([place(wobble(xa, z, k)), place(wobble(xb, z, k))]);
    }
  }
  for (let k = 0; k <= 16; k++) {
    const x = -MX + (k / 16) * 2 * MX;
    grid.push([place([x + 0.04 * Math.sin(k), 0, -MZ]), place([x - 0.04 * Math.sin(k), 0, MZ])]);
  }
  fillSegments(b, grid, b.quota(0.13), 0, 0.3, 0.004);

  const center: Seg[] = [];
  for (let k = -4; k <= 4; k++) {
    const o = k * 0.085;
    center.push([place([CENTER[0] - 0.4, 0, CENTER[2] + o]), place([CENTER[0] + 0.4, 0, CENTER[2] + o])]);
    center.push([place([CENTER[0] + o, 0, CENTER[2] - 0.4]), place([CENTER[0] + o, 0, CENTER[2] + 0.4])]);
  }
  fillSegments(b, center, b.quota(0.035), 0, 0.42, 0.003);

  // Avenidas principales y un periférico.
  const avenues: Seg[] = [];
  const curve = (pts: Vec3[]) => {
    for (let i = 0; i < pts.length - 1; i++) avenues.push([place(pts[i]), place(pts[i + 1])]);
  };
  const steps = 40;
  curve(Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [-MX + t * 2 * MX, 0, -1.2 + t * 2.3 + 0.25 * Math.sin(t * 5)] as Vec3;
  }));
  curve(Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [-1.9 + t * 3.6, 0, MZ - t * 2 * MZ + 0.2 * Math.cos(t * 4)] as Vec3;
  }));
  curve(Array.from({ length: 73 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    return [CENTER[0] + Math.cos(a) * 1.35, 0, CENTER[2] + Math.sin(a) * 0.95] as Vec3;
  }));
  fillSegments(b, avenues, b.quota(0.06), 0, 0.75, 0.012);

  const nFill = b.quota(0.07);
  for (let i = 0; i < nFill; i++) pushV(b, place([(rng() * 2 - 1) * MX, 0, (rng() * 2 - 1) * MZ]), 7, 0.3);

  // Densidad cultural: mezcla de gaussianas, con el calor según la densidad.
  const blobs: { c: Vec3; s: number; w: number }[] = [
    { c: CENTER, s: 0.38, w: 1 },
    { c: [-1.35, 0, 0.62], s: 0.42, w: 0.55 },
    { c: [1.55, 0, -0.75], s: 0.36, w: 0.5 },
    { c: [0.95, 0, 1.05], s: 0.28, w: 0.35 },
  ];
  const density = (x: number, z: number) =>
    blobs.reduce((sum, bl) => sum + bl.w * Math.exp(-((x - bl.c[0]) ** 2 + (z - bl.c[2]) ** 2) / (2 * bl.s * bl.s)), 0);
  const totalW = blobs.reduce((s, bl) => s + bl.w, 0);
  const nHeat = b.quota(0.2);
  for (let i = 0; i < nHeat; i++) {
    let pick = rng() * totalW;
    let k = 0;
    while (k < blobs.length - 1 && pick > blobs[k].w) pick -= blobs[k++].w;
    const bl = blobs[k];
    const r = bl.s * Math.sqrt(-2 * Math.log(1 - rng() * 0.98));
    const a = rng() * Math.PI * 2;
    const x = bl.c[0] + Math.cos(a) * r;
    const z = bl.c[2] + Math.sin(a) * r;
    if (Math.abs(x) > MX || Math.abs(z) > MZ) continue;
    pushV(b, place([x, 0.01, z]), 6, Math.min(0.95, density(x, z) * 0.9));
  }

  // «Cerca de mí»: anillo punteado alrededor de una posición.
  const ME: Vec3 = [-0.75, 0, -0.55];
  const nNear = b.quota(0.025);
  let made = 0;
  while (made < nNear) {
    const a = rng() * Math.PI * 2;
    if (((a / (Math.PI * 2)) * 36) % 1 > 0.55) continue;
    pushV(b, place([ME[0] + Math.cos(a) * 0.62, 0.02, ME[2] + Math.sin(a) * 0.62]), 0, 0.85);
    made++;
  }
  const nMe = b.quota(0.012);
  for (let i = 0; i < nMe; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() < 0.55 ? 0.05 * Math.sqrt(rng()) : 0.09 + rng() * 0.01;
    pushV(b, place([ME[0] + Math.cos(a) * r, 0.03, ME[2] + Math.sin(a) * r]), 0, 0.99);
  }

  // Marcadores en forma de gota, de frente a la cámara, con color por tipo de espacio.
  const pins: { base: Vec3; type: number }[] = [];
  const types = [1, 1, 3, 4, 5, 2];
  for (let k = 0; k < 32; k++) {
    const bl = k < 13 ? blobs[0] : blobs[1 + (k % 3)];
    const spread = k < 13 ? 0.32 : 0.45;
    const x = Math.max(-MX + 0.2, Math.min(MX - 0.2, bl.c[0] + (rng() * 2 - 1) * spread));
    const z = Math.max(-MZ + 0.2, Math.min(MZ - 0.2, bl.c[2] + (rng() * 2 - 1) * spread * 0.8));
    pins.push({ base: [x, 0, z], type: types[Math.floor(rng() * types.length)] });
  }
  const PH = 0.3;
  const PR = 0.1;
  const tanA = PR / Math.sqrt(PH * PH - PR * PR);
  const inside = (x: number, y: number) => x * x + (y - PH) ** 2 <= PR * PR || (y >= 0 && y <= PH && Math.abs(x) <= y * tanA);
  const nPins = b.quota(0.3);
  for (let i = 0; i < nPins; i++) {
    const pin = pins[i % pins.length];
    const base = place(pin.base);
    let x = 0;
    let y = 0;
    do {
      x = (rng() * 2 - 1) * PR;
      y = rng() * (PH + PR);
    } while (!inside(x, y) || x * x + (y - PH) ** 2 < 0.034 * 0.034);
    const edge = !inside(x * 1.18, (y - PH) * 1.18 + PH) || !inside(x, y + 0.02) ? 0.95 : 0.6;
    pushV(b, [base[0] + x, base[1] + y, base[2] + 0.05], pin.type, edge);
  }
  const nBases = b.quota(0.02);
  for (let i = 0; i < nBases; i++) {
    const pin = pins[i % pins.length];
    const a = rng() * Math.PI * 2;
    pushV(b, place([pin.base[0] + Math.cos(a) * 0.06, 0.005, pin.base[2] + Math.sin(a) * 0.06]), pin.type, 0.4);
  }

  // Resto: más densidad cultural sobre el centro.
  while (b.remaining > 0) {
    const bl = blobs[0];
    const r = bl.s * Math.sqrt(-2 * Math.log(1 - rng() * 0.98));
    const a = rng() * Math.PI * 2;
    const x = bl.c[0] + Math.cos(a) * r;
    const z = bl.c[2] + Math.sin(a) * r;
    pushV(b, place([x, 0.01, z]), 6, Math.min(0.95, density(x, z) * 0.9));
  }
  return b.finish();
}
