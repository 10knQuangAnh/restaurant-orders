import { mkdir, writeFile } from "node:fs/promises";

const dishes = [
  ["com-chien-dua-bo", "#c45c26", "#e8c07a", "Cơm chiên dưa bò"],
  ["com-chien-ghe", "#b45309", "#fde68a", "Cơm chiên ghẹ"],
  ["com-chien-trung", "#d97706", "#fef3c7", "Cơm chiên trứng"],
  ["com-suon", "#7c2d12", "#fbbf24", "Cơm sườn"],
  ["com-ga", "#ca8a04", "#fef9c3", "Cơm gà"],
  ["pho-bo", "#9a3412", "#fdba74", "Phở bò"],
  ["bun-cha", "#854d0e", "#facc15", "Bún chả"],
  ["bun-bo-hue", "#b91c1c", "#fecaca", "Bún bò Huế"],
  ["goi-bo", "#166534", "#bbf7d0", "Gỏi bò"],
  ["nem-nuong", "#9a3412", "#fed7aa", "Nem nướng"],
  ["dau-hu", "#a16207", "#fde68a", "Đậu hũ"],
  ["cocktail-xoai", "#ea580c", "#fdba74", "Xoài muối ớt"],
  ["cocktail-xi-muoi", "#9f1239", "#fecdd3", "Xí muội quế"],
  ["bia-hoi", "#ca8a04", "#fef08a", "Bia hơi"],
  ["bia-saigon", "#1d4ed8", "#bfdbfe", "Sài Gòn"],
  ["coca", "#991b1b", "#fecaca", "Coca-Cola"],
  ["aquafina", "#0369a1", "#bae6fd", "Aquafina"],
  ["nuoc-mia", "#4d7c0f", "#d9f99d", "Nước mía"],
  ["tra-dao", "#c2410c", "#fed7aa", "Trà đào"],
  ["tao-meo", "#7c2d12", "#e7b08a", "Táo mèo"],
  ["nep-tu-le", "#44403c", "#d6d3d1", "Nếp tú lệ"],
  ["nep-cam", "#431407", "#9a3412", "Nếp cẩm"],
  ["nep-hoa-vang", "#a16207", "#fef3c7", "Hoa vàng"],
  ["nep-than", "#1c1917", "#78716c", "Nếp than"],
  ["ech-xao", "#3f6212", "#d9f99d", "Ếch xào"],
  ["ech-om", "#854d0e", "#fde68a", "Ếch om"],
  ["lau-ech", "#9a3412", "#fdba74", "Lẩu ếch"],
  ["lau-thai", "#c2410c", "#fecaca", "Lẩu thái"],
  ["lau-ga", "#b45309", "#fcd34d", "Lẩu gà"],
];

await mkdir("public/dishes", { recursive: true });
for (const [id, a, b, label] of dishes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="1" stop-color="${b}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <ellipse cx="320" cy="300" rx="220" ry="70" fill="#000" opacity=".18"/>
  <circle cx="320" cy="230" r="150" fill="#fff" opacity=".16"/>
  <circle cx="250" cy="200" r="46" fill="#fff" opacity=".22"/>
  <circle cx="390" cy="250" r="34" fill="#1c1917" opacity=".2"/>
  <rect x="40" y="400" width="560" height="48" rx="8" fill="#1c1917" opacity=".45"/>
  <text x="320" y="432" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#fff">${label}</text>
</svg>`;
  await writeFile(`public/dishes/${id}.svg`, svg);
}

const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="60" fill="#E85D04"/>
  <circle cx="64" cy="64" r="50" fill="none" stroke="#fff" stroke-width="3"/>
  <text x="64" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="700" fill="#fff">TĐ</text>
</svg>`;
await writeFile("public/logo-tu-do.svg", logo);

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="40" fill="#E85D04"/>
  <text x="90" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#fff">TĐ</text>
</svg>`;
await writeFile("public/icons/apple-touch-icon.svg", icon);
console.log("dishes ok");
