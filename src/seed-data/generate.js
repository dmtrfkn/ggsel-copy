// Детерминированный генератор большого каталога для задачи 5 (мгновенный поиск).
// Один и тот же seed -> один и тот же каталог, чтобы проверки были воспроизводимы.

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GAMES = [
  'Cyberframe', 'Void Raiders', 'Aether Legends', 'Neon Circuit', 'Dungeon Depths',
  'Star Convoy', 'Crimson Tactics', 'Frostfall', 'Iron Harvest II', 'Pixel Realms',
  'Shadow Protocol', 'Galaxy Forge', 'Last Citadel', 'Rally Rush', 'Deep Sea Odyssey',
  'Arcane Arena', 'Mech Assault', 'Kingdom Reborn', 'Turbo Drift', 'Echo Hunter',
  'Skybound', 'Nightmarket', 'Blade and Bloom', 'Quantum Heist', 'Wild Frontier',
  'Orbital', 'Runescar', 'Bunker 77', 'Hextech Heroes', 'Solar Ashes',
];
const PLATFORMS = ['Steam', 'Epic', 'PS5', 'Xbox', 'Nintendo', 'Battle.net', 'EA App', 'Ubisoft'];
const EDITIONS = ['Standard', 'Deluxe', 'Ultimate', 'GOTY', 'Collector', 'Gold', 'Complete'];
const TOPUP_BRANDS = ['Steam', 'PlayStation Store', 'Xbox', 'Nintendo eShop', 'Roblox', 'Discord', 'Riot', 'Apple'];
const SUBS = ['Game Pass', 'PS Plus', 'EA Play', 'Nitro', 'YouTube Premium', 'Spotify', 'Ubisoft+', 'Humble Choice'];
const GIFT_BRANDS = ['Steam', 'PSN', 'Xbox', 'Roblox', 'Nintendo', 'App Store', 'Amazon', 'Google Play'];
const PERIODS = ['1 месяц', '3 месяца', '6 месяцев', '12 месяцев'];

export function generateProducts(count, seed = 20260909) {
  const rand = rng(seed);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const out = [];

  for (let i = 1; i <= count; i += 1) {
    const kind = i % 4;
    let name;
    let type;
    let price;

    if (kind === 0) {
      name = `${pick(GAMES)} ${pick(EDITIONS)} - ключ ${pick(PLATFORMS)}`;
      type = 'key';
      price = 199 + Math.floor(rand() * 4800);
    } else if (kind === 1) {
      const amt = pick([300, 500, 1000, 1500, 2000, 3000, 5000]);
      name = `Пополнение ${pick(TOPUP_BRANDS)} ${amt} ₽`;
      type = 'topup';
      price = amt;
    } else if (kind === 2) {
      name = `${pick(SUBS)} - ${pick(PERIODS)}`;
      type = 'subscription';
      price = 149 + Math.floor(rand() * 2800);
    } else {
      const amt = pick([500, 1000, 1500, 2500, 5000]);
      name = `${pick(GIFT_BRANDS)} Gift Card ${amt} ₽`;
      type = 'giftcard';
      price = amt;
    }

    out.push({
      sku: `GEN-${String(i).padStart(6, '0')}`,
      name,
      type,
      price,
      currency: 'RUB',
      image: null,
      stock: Math.floor(rand() * 60),
    });
  }
  return out;
}
