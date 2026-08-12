// ============================================================
// js/screens/village.js — Hub Villaggio LifeQuest Battle System
// Mercante, Porto (dungeon), Fabbro, Accademia, Oracolo/Fata.
// Entry point: renderVillage() chiamato da gotoTab('battle').
// ============================================================

import { CUR, DB, persist }         from '../db.js';
import { escHtml, toast, today }    from '../utils.js';
import { playSound }                from '../audio.js';
import { calcLevel }                from '../xp.js';
import { getBattleChar,
         chooseClass,
         syncBattleCharacter,
         loadItems, loadEnemies,
         loadBattleClasses,
         loadBattleAbilities }      from '../battle/character.js';
import { getMerchantSlots,
         buyFromMerchant,
         claimOracleFreeItem,
         openLootBox, canOpenBox,
         loadInventory, sellItem,
         repairItem,
         getDailyEconomySummary }   from '../battle/economy.js';
import { checkDungeonAccess,
         startDungeon, getActiveDungeon } from '../battle/dungeon.js';
import { ECONOMY, PROGRESSION,
         DUNGEONS, GUILDS }         from '../battle/config.js';

// ── Stato navigazione villaggio ───────────────────────────────
let _villageTab = 'map';  // 'map'|'merchant'|'port'|'smith'|'academy'|'oracle'|'inventory'

export function switchVillageTab(t) { _villageTab = t; renderVillage(); }
// ════════════════════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════════════════════

export async function renderVillage() {
  if (!CUR) return;
  const container = document.getElementById('screen-battle');
  if (!container) return;

  // Carica dati necessari
  await Promise.all([
    syncBattleCharacter(CUR.id),
    loadItems(),
    loadBattleClasses(),
  ]);

  const bc    = getBattleChar(CUR.id);
  const user  = DB.users[CUR.id] || CUR;
  const level = calcLevel(user.xp || 0);

  // Personaggio non ancora creato
  if (!bc) {
    container.innerHTML = renderError('Personaggio in caricamento… riprova tra un momento.');
    return;
  }

  // Selezione classe se non ancora scelta
  if (!bc.class_id && level >= PROGRESSION.UNLOCKS.classChoice) {
    container.innerHTML = renderClassSelection(level, bc);
    return;
  }

  // Schermata tutorial se sotto lv.5
  if (level < PROGRESSION.UNLOCKS.classChoice) {
    container.innerHTML = renderTutorialGate(level, bc);
    return;
  }

// Rendering della tab corrente
  const bgClass = {
    map:       'village-bg-map',
    port:      'village-bg-port',
    merchant:  'village-bg-merchant',
    inventory: 'village-bg-inventory',
    academy:   'village-bg-academy',
    smith:     'village-bg-map',
  }[_villageTab] || 'village-bg-map';

  container.className = bgClass;
  container.innerHTML = `
    ${renderVillageHeader(bc, user, level)}
    ${renderVillageTabs(bc, level)}
    <div id="village-content" class="village-content">
      ${await renderVillageTabContent(bc, user, level)}
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════

function renderVillageHeader(bc, user, level) {
  const classData = (DB.battleClasses || []).find(c => c.id === bc.class_id);
  const classIcon = { warrior:'⚔️', mage:'🔮', bard:'🎸', shadow:'🗡️', oracle:'☀️' }[bc.class_id] || '⚔️';
  const classColor= { warrior:'#DC2626', mage:'#3B82F6', bard:'#F59E0B', shadow:'#6B7280', oracle:'#A855F7' }[bc.class_id] || 'var(--accent)';

  return `
    <div class="village-header">
      <div class="village-hero">
        <div class="village-class-badge" style="background:${classColor}22;border-color:${classColor}44">
          <span class="village-class-icon">${classIcon}</span>
          <div class="village-hero-info">
            <div class="village-hero-name">@${escHtml(user.username)}</div>
            <div class="village-hero-class" style="color:${classColor}">
              ${escHtml(classData?.name || 'Senza Classe')} · Lv.${level}
            </div>
          </div>
        </div>
        <div class="village-gold-badge">
          <span class="village-gold-icon">🪙</span>
          <span class="village-gold-amount" id="village-gold">${(bc.gold || 0).toLocaleString()}</span>
        </div>
      </div>

      <div class="village-stats-bar">
        <div class="village-stat-pill">
          <span class="vstat-icon">❤️</span>
          <div class="vstat-bar-wrap">
            <div class="vstat-bar hp-bar" style="width:${Math.round((bc.hp_current / bc.hp_base) * 100)}%"></div>
          </div>
          <span class="vstat-val">${bc.hp_current}/${bc.hp_base}</span>
        </div>
        <div class="village-stat-pill">
          <span class="vstat-icon">💙</span>
          <div class="vstat-bar-wrap">
            <div class="vstat-bar mana-bar" style="width:${Math.round((bc.mana_current / Math.max(1, bc.mana_max)) * 100)}%"></div>
          </div>
          <span class="vstat-val">${bc.mana_current}/${bc.mana_max}</span>
        </div>
        <div class="village-stat-pill">
          <span class="vstat-icon">✨</span>
          <span class="vstat-val">${bc.skill_points} PA</span>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// TAB NAV
// ════════════════════════════════════════════════════════════

function renderVillageTabs(bc, level) {
  const tabs = [
    { id: 'map',       icon: '🗺️',  label: 'Villaggio' },
    { id: 'port',      icon: '⛵',  label: 'Porto'     },
    { id: 'merchant',  icon: '🛒',  label: 'Mercante'  },
    { id: 'inventory', icon: '🎒',  label: 'Zaino'     },
    { id: 'smith',     icon: '🔨',  label: 'Fabbro'    },
    { id: 'academy',   icon: '📜',  label: 'Accademia' },
  ];

  return `
    <div class="tab-row village-tabs">
      ${tabs.map(t => `
        <button class="tab-btn ${_villageTab === t.id ? 'tab-btn--active' : ''}"
                onclick="window._switchVillageTab?.('${t.id}')">
          ${t.icon} ${t.label}
        </button>
      `).join('')}
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// CONTENUTO TAB
// ════════════════════════════════════════════════════════════

async function renderVillageTabContent(bc, user, level) {
  switch (_villageTab) {
    case 'map':       return renderVillageMap(bc, level);
    case 'port':      return await renderPort(bc, level);
    case 'merchant':  return await renderMerchant(bc, level);
    case 'inventory': return await renderInventory(bc, user);
    case 'smith':     return await renderSmith(bc);
    case 'academy':   return renderAcademy(bc, level);
    default:          return renderVillageMap(bc, level);
  }
}

// ── MAPPA VILLAGGIO ───────────────────────────────────────────

function renderVillageMap(bc, level) {
  const summary = [
    { icon: '⚔️', label: 'Attacco',  val: bc.attack  },
    { icon: '🛡️', label: 'Difesa',   val: bc.defense },
    { icon: '💨', label: 'Velocità', val: bc.speed   },
    { icon: '🍀', label: 'Fortuna',  val: `${bc.luck_pct}%` },
  ];

  return `
    <div class="village-map">
      <!-- Benvenuto -->
      <div class="village-welcome-card">
        <div class="village-scene">
          <div class="village-building" onclick="window._switchVillageTab?.('port')"    title="Porto — Dungeon">⛵<span>Porto</span></div>
          <div class="village-building" onclick="window._switchVillageTab?.('merchant')" title="Mercante">🛒<span>Mercante</span></div>
          <div class="village-building" onclick="window._switchVillageTab?.('smith')"   title="Fabbro">🔨<span>Fabbro</span></div>
          <div class="village-building" onclick="window._switchVillageTab?.('academy')" title="Accademia">📜<span>Accademia</span></div>
        </div>
        <p class="village-welcome-text">Benvenuto nel Villaggio, eroe. Scegli la tua prossima mossa.</p>
      </div>

      <!-- Statistiche rapide -->
      <div class="village-section-title">📊 Statistiche Combattimento</div>
      <div class="village-stats-grid">
        ${summary.map(s => `
          <div class="village-stat-card">
            <span class="vsc-icon">${s.icon}</span>
            <span class="vsc-val">${s.val}</span>
            <span class="vsc-label">${s.label}</span>
          </div>
        `).join('')}
      </div>

      <!-- Economia oggi -->
      <div id="economy-summary-area">
        <div class="feed-loading" style="text-align:center;padding:1rem;color:var(--text-3)">Caricamento economia…</div>
      </div>
    </div>
  `;
}

// ── PORTO (Dungeon) ───────────────────────────────────────────

async function renderPort(bc, level) {
  const tierInfo = [
    { tier: 1, name: 'Grotte dei Goblin',      icon: '🕳️', minLevel: 1  },
    { tier: 2, name: 'Cripta del Necromante',  icon: '💀', minLevel: 10 },
    { tier: 3, name: 'Torre del Drago Minore', icon: '🐉', minLevel: 20 },
    { tier: 4, name: 'Abisso Demoniaco',       icon: '😈', minLevel: 35 },
    { tier: 5, name: 'Dominio dell\'Entità',   icon: '🌌', minLevel: 50 },
  ];

  // Carica nemici T1-T2 se non in cache
  await Promise.all([loadEnemies(1), loadEnemies(2)]);

  const accessChecks = await Promise.all(
    tierInfo.map(t => checkDungeonAccess(CUR.id, t.tier))
  );

  const activeDungeon = getActiveDungeon();

  return `
    <div class="village-port">
      ${activeDungeon ? `
        <div class="village-alert">
          ⚠️ Hai un dungeon Tier ${activeDungeon.tier} in corso!
          Stanza ${activeDungeon.currentRoom + 1} di ${activeDungeon.totalRooms}.
          <button class="btn-sm btn-primary" onclick="window._resumeDungeon?.()">Continua →</button>
        </div>
      ` : ''}

      <div class="village-section-title">⛵ Dungeon Disponibili</div>

      ${tierInfo.map((t, i) => {
        const access  = accessChecks[i];
        const dungeon = DUNGEONS[t.tier - 1];
        const locked  = !access.canEnter;
        return `
          <div class="dungeon-card ${locked ? 'dungeon-card--locked' : ''}">
            <div class="dungeon-card__icon">${t.icon}</div>
            <div class="dungeon-card__info">
              <div class="dungeon-card__name">Tier ${t.tier} — ${t.name}</div>
              <div class="dungeon-card__meta">
                Lv.min ${t.minLevel} · ${dungeon.normalRooms + 1} stanze ·
                <span style="color:var(--gold)">🪙 ${dungeon.goldBonus}G bonus</span> ·
                <span style="color:#fbbf24">⚡ ${dungeon.xpBonus} XP</span>
              </div>
              ${locked ? `<div class="dungeon-card__lock">🔒 ${escHtml(access.reason)}</div>` : ''}
            </div>
            ${!locked ? `
              <button class="btn-sm btn-primary dungeon-enter-btn"
                      onclick="window._enterDungeon?.(${t.tier})">
                Entra
              </button>
            ` : ''}
          </div>
        `;
      }).join('')}

      <div class="village-section-title" style="margin-top:1.5rem">📦 Casse Loot</div>
      <div class="loot-boxes-grid">
        ${renderLootBoxGrid(bc, level)}
      </div>
    </div>
  `;
}

function renderLootBoxGrid(bc, level) {
  const boxes = [
    { type: 'wood',   icon: '📦', name: 'Cassa di Legno',   color: '#92400E', minLevel: 1  },
    { type: 'iron',   icon: '🗃️', name: 'Cassa di Ferro',   color: '#4B5563', minLevel: 1  },
    { type: 'gold',   icon: '💛', name: 'Cassa d\'Oro',      color: '#D97706', minLevel: PROGRESSION.UNLOCKS.goldBoxes  },
    { type: 'mythic', icon: '🌟', name: 'Cassa Mitica',      color: '#DC2626', minLevel: PROGRESSION.UNLOCKS.mythicBoxes },
  ];

  const rarNames = { common:'Comune', uncommon:'Non Comune', rare:'Raro', epic:'Epico', legendary:'Leggendario', mythic:'Mitico' };

  return boxes.map(box => {
    const check     = canOpenBox(CUR.id, box.type);
    const boxCfg    = ECONOMY.LOOT_BOXES[box.type];
    const locked    = level < box.minLevel;
    const rates     = ECONOMY.BOX_RATES[box.type];
    const pityCount = DB.lootBoxHistory?.[CUR.id]?.[box.type] || 0;
    const topRarity = Object.entries(rates).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]).map(([k]) => k)[0];

    return `
      <div class="loot-box-card ${locked ? 'loot-box-card--locked' : ''}"
           style="border-color:${box.color}44">
        <div class="loot-box-icon" style="background:${box.color}22">${box.icon}</div>
        <div class="loot-box-info">
          <div class="loot-box-name" style="color:${box.color}">${box.name}</div>
          <div class="loot-box-cost">🪙 ${boxCfg.cost} Gold</div>
          <div class="loot-box-rates">
            ${Object.entries(rates)
              .filter(([,v]) => v > 0)
              .map(([r, v]) => `<span class="rarity-tag rarity-${r}">${rarNames[r]} ${Math.round(v*100)}%</span>`)
              .join('')}
          </div>
          ${pityCount > 0 ? `
            <div class="pity-counter">
              Pity: ${pityCount}/${boxCfg.pity}
              <div class="pity-bar"><div class="pity-fill" style="width:${Math.round((pityCount/boxCfg.pity)*100)}%"></div></div>
            </div>
          ` : ''}
        </div>
        ${locked
          ? `<div class="loot-box-lock">🔒 Lv.${box.minLevel}</div>`
          : `<button class="btn-sm btn-primary" onclick="window._openBox?.('${box.type}')"
                     ${!check.canOpen && check.reason?.includes('Gold') ? 'disabled title="Gold insufficienti"' : ''}>
               Apri
             </button>`}
      </div>
    `;
  }).join('');
}

// ── MERCANTE ──────────────────────────────────────────────────

async function renderMerchant() {
  const slots     = await getMerchantSlots();
  const freeItem  = DB.merchantFreeItem;
  const freeClaimed = DB[`oracleFreeClaimed_${today()}`]?.[CUR.id];
  const nextRotMs = ECONOMY.MERCHANT.rotationHours * 3_600_000 - (Date.now() - (DB.merchantLastRot || 0));
  const nextRot   = formatCountdown(nextRotMs);

  return `
    <div class="merchant-screen">
      <div class="merchant-npc">
        <div class="merchant-avatar">🧙</div>
        <div class="merchant-speech">
          "Benvenuto, eroe! I miei migliori affari si rinnovano ogni 24 ore."
          <span class="merchant-timer">⏰ Nuovi oggetti tra ${nextRot}</span>
        </div>
      </div>

      ${freeItem ? `
        <div class="oracle-offer">
          <div class="oracle-offer__label">🔮 Offerta Oracolo (gratis oggi!)</div>
          ${renderItemCard(freeItem, 0, !freeClaimed, 'oracle')}
          ${freeClaimed ? '<div style="color:var(--text-3);font-size:0.8rem;text-align:center">Già ritirato oggi.</div>' : ''}
        </div>
      ` : ''}

      <div class="village-section-title">🛒 Catalogo del Giorno</div>
      <div class="merchant-grid">
        ${slots.map(s => renderItemCard(s.item, s.price, true, 'buy')).join('')}
      </div>
    </div>
  `;
}

// ── INVENTARIO ────────────────────────────────────────────────

async function renderInventory(bc, user) {
  const inv  = await loadInventory(CUR.id);
  const equip = DB.characterEquipment?.[CUR.id] || [];

  const rarityOrder = { mythic:5, legendary:4, epic:3, rare:2, uncommon:1, common:0 };
  const sorted = [...inv].sort((a, b) =>
    (rarityOrder[b.items?.rarity] || 0) - (rarityOrder[a.items?.rarity] || 0)
  );

  const slots = ['weapon','armor','helmet','accessory1','accessory2'];
  const slotLabels = { weapon:'⚔️ Arma', armor:'🛡️ Armatura', helmet:'⛑️ Elmo',
                       accessory1:'💍 Acc. 1', accessory2:'📿 Acc. 2' };

  return `
    <div class="inventory-screen">
      <!-- Equipaggiamento attivo -->
      <div class="village-section-title">⚔️ Equipaggiamento</div>
      <div class="equipment-slots">
        ${slots.map(slot => {
          const s    = equip.find(e => e.slot === slot);
          const item = s ? (DB.battleItems || []).find(i => i.id === s.item_id) : null;
          return `
            <div class="equip-slot equip-slot--${slot} ${item ? 'equip-slot--filled' : ''}">
              <div class="equip-slot__label">${slotLabels[slot]}</div>
              ${item ? `
                <div class="equip-slot__item rarity-border-${item.rarity}">
                  <div class="equip-item-icon">${slotEmoji(slot)}</div>
                  <div class="equip-item-name">${escHtml(item.name)}</div>
                  <div class="equip-item-dur">Durabilità: ${s.durability}%</div>
                </div>
              ` : `<div class="equip-slot__empty">Vuoto</div>`}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Inventario -->
      <div class="village-section-title" style="margin-top:1.25rem">
        🎒 Zaino (${sorted.length} oggetti)
      </div>
      ${!sorted.length
        ? '<div class="empty-state" style="padding:2rem">Nessun oggetto. Esplora i dungeon o apri casse loot!</div>'
        : `<div class="inventory-list">
            ${sorted.map(entry => {
              const item = entry.items || (DB.battleItems || []).find(i => i.id === entry.item_id);
              if (!item) return '';
              return renderInventoryItem(entry, item);
            }).join('')}
          </div>`
      }
    </div>
  `;
}

function renderInventoryItem(entry, item) {
  const rarColors = { common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6',
                      epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626' };
  const color     = rarColors[item.rarity] || '#9CA3AF';
  const bonuses   = buildBonusText(item);

  return `
    <div class="inv-item rarity-border-${item.rarity}" data-inv-id="${entry.id}">
      <div class="inv-item__icon" style="background:${color}22">${slotEmoji(item.slot)}</div>
      <div class="inv-item__info">
        <div class="inv-item__name" style="color:${color}">${escHtml(item.name)}</div>
        <div class="inv-item__slot badge">${escHtml(item.slot)}</div>
        ${bonuses ? `<div class="inv-item__bonuses">${bonuses}</div>` : ''}
        ${item.slot === 'consumable' ? `<div class="inv-item__qty">×${entry.quantity || 1}</div>` : ''}
      </div>
      <div class="inv-item__actions">
        ${item.slot !== 'consumable' ? `
          <button class="btn-sm btn-primary" onclick="window._equipItem?.('${entry.id}', '${item.slot}')">
            Equipaggia
          </button>
        ` : ''}
        <button class="btn-sm btn-danger" onclick="window._sellItem?.('${entry.id}')">
          Vendi
        </button>
      </div>
    </div>
  `;
}

// ── FABBRO ────────────────────────────────────────────────────

async function renderSmith(bc) {
  const inv   = await loadInventory(CUR.id);
  const equip = DB.characterEquipment?.[CUR.id] || [];

  // Oggetti da riparare (durabilità < 100)
  const toRepair = equip.filter(s => s.item_id && (s.durability ?? 100) < 100);

  const { EQUIPMENT_DEGRADATION } = await import('../battle/config.js');

  return `
    <div class="smith-screen">
      <div class="smith-npc">
        <div class="smith-avatar">🔨</div>
        <div class="smith-speech">
          "Porto ogni lama al suo antico splendore. Porto pazienza — e Gold!"
        </div>
      </div>

      <div class="village-section-title">🔧 Riparazione</div>
      ${toRepair.length === 0
        ? '<div class="empty-note" style="padding:1rem">Tutto il tuo equipaggiamento è in perfette condizioni.</div>'
        : `<div class="smith-repair-list">
            ${toRepair.map(s => {
              const item  = (DB.battleItems || []).find(i => i.id === s.item_id);
              if (!item) return '';
              const cost  = EQUIPMENT_DEGRADATION.repairCost[item.rarity] || 50;
              const canPay= (bc.gold || 0) >= cost;
              const repId = `equip_${s.slot}`;
              return `
                <div class="repair-item">
                  <div class="repair-item__info">
                    <span>${slotEmoji(s.slot)} ${escHtml(item.name)}</span>
                    <span class="repair-dur" style="color:${s.durability < 30 ? 'var(--danger)' : 'var(--warning)'}">
                      ${s.durability}% durabilità
                    </span>
                  </div>
                  <button class="btn-sm ${canPay ? 'btn-primary' : ''}"
                          ${!canPay ? 'disabled' : ''}
                          onclick="window._repairEquip?.('${s.slot}')">
                    🪙 ${cost}G
                  </button>
                </div>
              `;
            }).join('')}
          </div>`
      }

      <div class="village-section-title" style="margin-top:1.25rem">⬆️ Potenziamento</div>
      <div class="smith-info-card">
        <p style="font-size:0.85rem;color:var(--text-2);line-height:1.6">
          Il Fabbro può potenziare qualsiasi oggetto fino a <strong>+5 livelli</strong>,
          aumentando tutti i bonus del <strong>+10%</strong> per livello.<br>
          Può anche fondere 2 oggetti della stessa rarità in uno della rarità superiore
          (probabilità di successo: <strong>60%</strong>).<br><br>
          <span style="color:var(--text-3)">🔧 Potenziamento e fusione disponibili dalla Fase D.</span>
        </p>
      </div>
    </div>
  `;
}

// ── ACCADEMIA ─────────────────────────────────────────────────

function renderAcademy(bc, level) {
  if (!DB.battleAbilities?.length) {
    loadBattleAbilities(bc.class_id).then(() => renderVillage());
    return '<div class="feed-loading" style="text-align:center;padding:2rem">Caricamento abilità…</div>';
  }

  const classAbilities = (DB.battleAbilities || []).filter(a => a.class_id === bc.class_id);
  const learned        = new Set((DB.characterAbilities?.[CUR.id] || []).map(a => a.ability_id));
  const { SKILL_POINTS, ABILITY_LEVEL_COSTS } = { SKILL_POINTS: { resetCost: 300 }, ABILITY_LEVEL_COSTS: [
    { pa:1, gold:0, minCharLevel:1 },
    { pa:2, gold:50, minCharLevel:5 },
    { pa:3, gold:100, minCharLevel:10 },
    { pa:4, gold:200, minCharLevel:20 },
    { pa:5, gold:500, minCharLevel:30 },
  ]};

  const byBranch = {};
  classAbilities.forEach(a => {
    if (!byBranch[a.branch]) byBranch[a.branch] = [];
    byBranch[a.branch].push(a);
  });

  const typeIcon = { active:'⚡', passive:'✨', ultimate:'🌟' };

  return `
    <div class="academy-screen">
      <div class="academy-npc">
        <div class="academy-avatar">📜</div>
        <div class="academy-speech">
          "La conoscenza è la vera arma. Hai <strong>${bc.skill_points} Punti Abilità</strong> da spendere."
        </div>
      </div>

      <div class="academy-sp-bar">
        <span>PA disponibili: <strong>${bc.skill_points}</strong></span>
        <button class="btn-sm" onclick="window._openResetDialog?.()">
          Reset (${300}G)
        </button>
      </div>

      ${Object.entries(byBranch).map(([branch, abilities]) => `
        <div class="ability-branch">
          <div class="ability-branch__label">Ramo ${branch}</div>
          <div class="ability-branch__list">
            ${abilities.sort((a,b) => a.level - b.level).map(ab => {
              const isLearned  = learned.has(ab.id);
              const cost       = ABILITY_LEVEL_COSTS[ab.level - 1] || ABILITY_LEVEL_COSTS[0];
              const canLearn   = !isLearned && bc.skill_points >= cost.pa && level >= cost.minCharLevel;
              const notEnoughLv= level < cost.minCharLevel;
              const notEnoughPa= bc.skill_points < cost.pa;

              return `
                <div class="ability-card ${isLearned ? 'ability-card--learned' : ''} ${ab.type === 'ultimate' ? 'ability-card--ultimate' : ''}">
                  <div class="ability-card__header">
                    <span class="ability-type-badge">${typeIcon[ab.type] || '⚡'}</span>
                    <strong>${escHtml(ab.name)}</strong>
                    ${isLearned ? '<span class="badge badge--green">Appresa</span>' : ''}
                  </div>
                  <p class="ability-desc">${escHtml(ab.description || '')}</p>
                  <div class="ability-costs">
                    <span>🎯 ${cost.pa} PA</span>
                    ${cost.gold > 0 ? `<span>🪙 ${cost.gold}G</span>` : ''}
                    <span style="color:var(--text-3)">Min Lv.${cost.minCharLevel}</span>
                  </div>
                  ${!isLearned ? `
                    <button class="btn-sm ${canLearn ? 'btn-primary' : ''}"
                            ${!canLearn ? 'disabled' : ''}
                            onclick="window._learnAbility?.('${ab.id}')"
                            title="${notEnoughLv ? `Richiede Lv.${cost.minCharLevel}` : notEnoughPa ? 'PA insufficienti' : 'Impara'}">
                      ${notEnoughLv ? `🔒 Lv.${cost.minCharLevel}` : notEnoughPa ? `${cost.pa} PA` : 'Impara'}
                    </button>
                  ` : '<div class="ability-learned-badge">✅</div>'}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// SELEZIONE CLASSE
// ════════════════════════════════════════════════════════════

function renderClassSelection(level, bc) {
  const classes = [
    { id:'warrior', icon:'⚔️', name:'Guerriero', color:'#DC2626', stat:'Corpo',
      desc:'Alta difesa, abilità fisiche. Attira i colpi in gilda. Evolve in Paladino o Berserker.' },
    { id:'mage',    icon:'🔮', name:'Mago',      color:'#3B82F6', stat:'Mente',
      desc:'Danni magici elemental altissimi. Bassa difesa. Controllo del campo. Evolve in Arcimago o Stregone.' },
    { id:'bard',    icon:'🎸', name:'Bardo',     color:'#F59E0B', stat:'Cultura',
      desc:'Supporto e buff agli alleati. Può chiamare aiuto ogni giorno. Evolve in Cantore o Diplomatico.' },
    { id:'shadow',  icon:'🗡️', name:'Ombra',    color:'#6B7280', stat:'Sfide',
      desc:'Alta evasione, veleno, critici. Può rubare oggetti ai nemici PvE. Evolve in Assassino o Cacciatore.' },
    { id:'oracle',  icon:'☀️', name:'Oracolo',  color:'#A855F7', stat:'Sociale',
      desc:'Guaritore principale, previsione mosse nemico, buff passivo alla gilda. Evolve in Gran Sacerdote o Veggente.' },
  ];

  return `
    <div class="class-selection-screen">
      <div class="class-selection-header">
        <h2 style="font-size:1.4rem;font-weight:800;margin-bottom:0.5rem">⚔️ Scegli la tua Classe</h2>
        <p style="color:var(--text-2);font-size:0.9rem">
          Sei al livello ${level}. La scelta è definitiva — rifletti bene.
        </p>
      </div>
      <div class="class-grid">
        ${classes.map(c => `
          <div class="class-card" style="border-color:${c.color}55"
               onclick="window._selectClass?.('${c.id}')">
            <div class="class-card__icon" style="background:${c.color}22;border-color:${c.color}44">
              ${c.icon}
            </div>
            <h3 class="class-card__name" style="color:${c.color}">${c.name}</h3>
            <div class="class-card__stat">Stat primaria: <strong>${c.stat}</strong></div>
            <p class="class-card__desc">${c.desc}</p>
            <button class="btn-primary" style="background:${c.color};border:none;margin-top:0.75rem">
              Scegli ${c.name}
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// TUTORIAL GATE (< lv.5)
// ════════════════════════════════════════════════════════════

function renderTutorialGate(level, bc) {
  const needed = PROGRESSION.UNLOCKS.classChoice - level;
  return `
    <div class="tutorial-gate">
      <div style="text-align:center;padding:3rem 1rem">
        <div style="font-size:3rem;margin-bottom:1rem">⚔️</div>
        <h2 style="font-size:1.3rem;font-weight:800;margin-bottom:0.75rem">Battle System</h2>
        <p style="color:var(--text-2);font-size:0.9rem;max-width:320px;margin:0 auto 1.5rem">
          Il sistema di combattimento si sblocca al livello <strong>5</strong>.<br>
          Ti mancano ancora <strong>${needed} livelli</strong>.<br><br>
          Completa quest, routine e sessioni di studio per guadagnare XP e sbloccare il battle system!
        </p>
        <div class="progress-bar" style="max-width:260px;margin:0 auto">
          <div class="progress-bar__fill" style="width:${Math.round((level / 5) * 100)}%"></div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-3);margin-top:0.4rem">
          Lv.${level} / Lv.5
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// HELPER UI
// ════════════════════════════════════════════════════════════

function renderItemCard(item, price, canBuy, action) {
  if (!item) return '';
  const rarColors = { common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6',
                      epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626' };
  const color  = rarColors[item.rarity] || '#9CA3AF';
  const bonuses = buildBonusText(item);

  return `
    <div class="merchant-item rarity-border-${item.rarity}">
      <div class="merchant-item__icon" style="background:${color}22">${slotEmoji(item.slot)}</div>
      <div class="merchant-item__info">
        <div class="merchant-item__name" style="color:${color}">${escHtml(item.name)}</div>
        <div class="merchant-item__meta">
          <span class="badge">${escHtml(item.slot)}</span>
          ${item.level_req > 1 ? `<span class="badge">Lv.${item.level_req}+</span>` : ''}
        </div>
        ${bonuses ? `<div class="merchant-item__bonuses">${bonuses}</div>` : ''}
      </div>
      ${price === 0
        ? `<button class="btn-sm btn-primary" onclick="window._claimFreeItem?.()"
                   ${!canBuy ? 'disabled' : ''}>
             Ritira
           </button>`
        : `<button class="btn-sm btn-primary" onclick="window._buyItem?.('${item.id}')"
                   ${!canBuy ? 'disabled' : ''}>
             🪙 ${price}G
           </button>`
      }
    </div>
  `;
}

function buildBonusText(item) {
  const parts = [];
  if (item.bonus_attack  > 0) parts.push(`+${item.bonus_attack} ATK`);
  if (item.bonus_defense > 0) parts.push(`+${item.bonus_defense} DEF`);
  if (item.bonus_hp      > 0) parts.push(`+${item.bonus_hp} PF`);
  if (item.bonus_mana    > 0) parts.push(`+${item.bonus_mana} Mana`);
  if (item.bonus_speed   > 0) parts.push(`+${item.bonus_speed} VEL`);
  if (item.bonus_luck_pct> 0) parts.push(`+${item.bonus_luck_pct}% Fortuna`);
  if (item.heal_pct      > 0) parts.push(`Cura ${item.heal_pct}% PF`);
  if (item.mana_restore_pct > 0) parts.push(`Ripristina ${item.mana_restore_pct}% Mana`);
  return parts.join(' · ');
}

function slotEmoji(slot) {
  return { weapon:'⚔️', armor:'🛡️', helmet:'⛑️', accessory1:'💍', accessory2:'📿', consumable:'🧪' }[slot] || '📦';
}

function formatCountdown(ms) {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function renderError(msg) {
  return `<div class="empty-state" style="padding:3rem 1rem"><p>${escHtml(msg)}</p></div>`;
}

// ════════════════════════════════════════════════════════════
// WINDOW._* — AZIONI GLOBALI
// ════════════════════════════════════════════════════════════

window._switchVillageTab = switchVillageTab;

// Carica l'economy summary inline dopo render mappa
window._loadEconomySummary = async function() {
  const area = document.getElementById('economy-summary-area');
  if (!area) return;
  const summary = await getDailyEconomySummary(CUR.id);
  if (!summary) { area.innerHTML = ''; return; }

  area.innerHTML = `
    <div class="economy-card">
      <div class="economy-card__row">
        <span>🪙 Totale Gold</span>
        <strong style="color:var(--gold)">${summary.totalGold.toLocaleString()}</strong>
      </div>
      <div class="economy-card__row">
        <span>📈 Guadagnati oggi</span>
        <span style="color:#22C55E">+${summary.earnedToday}</span>
      </div>
      <div class="economy-card__row">
        <span>📉 Spesi oggi</span>
        <span style="color:var(--danger)">-${summary.spentToday}</span>
      </div>
      <div class="economy-card__label">
        Obiettivo giornaliero: ${summary.targetDaily}G
      </div>
      <div class="progress-bar" style="margin-top:0.35rem">
        <div class="progress-bar__fill" style="width:${summary.progressPct}%;background:var(--gold)"></div>
      </div>
    </div>
  `;
};

// Chiamato dopo il render mappa

// Scelta classe
window._selectClass = async function(classId) {
  if (!confirm(`Sei sicuro di voler scegliere ${classId}? La scelta è definitiva.`)) return;
  const { ok, error } = await chooseClass(CUR.id, classId);
  if (!ok) return toast(error || 'Errore', 'error');
  playSound('levelup');
  toast(`Classe ${classId} scelta! Buona fortuna, eroe. ⚔️`, 'success');
  renderVillage();
};

// Apertura cassa
window._openBox = async function(boxType) {
  const { openLootBox } = await import('../battle/economy.js');
  const result = await openLootBox(CUR.id, boxType);

  if (!result.ok) return toast(result.error || 'Errore', 'error');

  const rarNames = { common:'Comune', uncommon:'Non Comune', rare:'Raro',
                     epic:'Epico', legendary:'Leggendario', mythic:'Mitico' };
  const rarColors= { common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6',
                     epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626' };

  playSound('trophy');
  toast(
    `📦 ${rarNames[result.rarity]}! ${result.item?.name || 'Oggetto misterioso'} ottenuto!`,
    result.rarity === 'epic' || result.rarity === 'legendary' || result.rarity === 'mythic' ? 'success' : 'info'
  );

  // Mostra overlay risultato
  showLootResult(result.item, result.rarity, rarColors[result.rarity]);
  renderVillage();
};

function showLootResult(item, rarity, color) {
  const overlay = document.createElement('div');
  overlay.className = 'loot-result-overlay';
  overlay.innerHTML = `
    <div class="loot-result-card" style="border-color:${color}">
      <div class="loot-result-icon" style="background:${color}22">${slotEmoji(item?.slot)}</div>
      <div class="loot-result-rarity" style="color:${color}">${rarity.toUpperCase()}</div>
      <div class="loot-result-name">${escHtml(item?.name || 'Oggetto Misterioso')}</div>
      <p style="color:var(--text-2);font-size:0.85rem">${escHtml(item?.description || '')}</p>
      <button class="btn-primary" onclick="this.closest('.loot-result-overlay').remove()">Ottimo!</button>
    </div>
  `;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// Acquisto mercante
window._buyItem = async function(itemId) {
  const result = await buyFromMerchant(CUR.id, itemId);
  if (!result.ok) return toast(result.error || 'Errore', 'error');
  playSound('tap');
  toast(`${result.item?.name || 'Oggetto'} acquistato! 🛒`, 'success');
  renderVillage();
};

// Oggetto gratuito oracolo
window._claimFreeItem = async function() {
  const result = await claimOracleFreeItem(CUR.id);
  if (!result.ok) return toast(result.error, 'info');
  playSound('trophy');
  toast(`🔮 ${result.item?.name} ottenuto dall'Oracolo!`, 'success');
  renderVillage();
};

// Vendi oggetto
window._sellItem = async function(inventoryId) {
  if (!confirm('Vendere questo oggetto?')) return;
  const result = await sellItem(CUR.id, inventoryId);
  if (!result.ok) return toast(result.error || 'Errore', 'error');
  playSound('tap');
  toast(`Venduto per 🪙 ${result.goldEarned} Gold!`, 'success');
  renderVillage();
};

// Ripara oggetto equipaggiato
window._repairEquip = async function(slot) {
  const equip = DB.characterEquipment?.[CUR.id] || [];
  const s     = equip.find(e => e.slot === slot);
  if (!s?.item_id) return toast('Nessun oggetto in questo slot', 'error');

  // Trova nell'inventario tramite item_id
  const invId = DB.battleInventory?.[CUR.id]?.find(i => i.item_id === s.item_id)?.id;
  if (!invId) {
    // Ripara direttamente lo slot dell'equipaggiamento
    const { EQUIPMENT_DEGRADATION } = await import('../battle/config.js');
    const item = (DB.battleItems || []).find(i => i.id === s.item_id);
    const cost = EQUIPMENT_DEGRADATION.repairCost[item?.rarity] || 50;
    const bc   = getBattleChar(CUR.id);

    if ((bc?.gold || 0) < cost) return toast(`Servono ${cost} Gold`, 'error');

    await updateGold(CUR.id, -cost, 'repair', s.item_id);
    s.durability = 100;
    persist();

    const { supabase: sb } = await import('../../supabase.js');
    await sb.from('character_equipment').update({ durability: 100 }).eq('character_id', bc.id).eq('slot', slot);

    playSound('tap');
    toast('Oggetto riparato! 🔨', 'success');
    renderVillage();
    return;
  }

  const result = await repairItem(CUR.id, invId);
  if (!result.ok) return toast(result.error || 'Errore', 'error');
  playSound('tap');
  toast('Oggetto riparato! 🔨', 'success');
  renderVillage();
};

// Apprendi abilità
window._learnAbility = async function(abilityId) {
  const { unlockAbility } = await import('../battle/character.js');
  const result = await unlockAbility(CUR.id, abilityId);
  if (!result.ok) return toast(result.error || 'Errore', 'error');
  playSound('xp');
  toast('Abilità appresa! ✨', 'success');
  renderVillage();
};

// Entra nel dungeon
window._enterDungeon = async function(tier) {
  const result = await startDungeon(CUR.id, tier);

  if (!result.ok) {
    return toast(result.error || 'Errore', 'error');
  }

  const { getCurrentEnemy } = await import('../battle/dungeon.js');
  const enemy = getCurrentEnemy();

  if (!enemy) {
    return toast('Nessun nemico trovato nella stanza.', 'error');
  }

  playSound('challenge');
  toast(`Sei entrato nel dungeon Tier ${tier}! Buona fortuna. ⚔️`, 'success');

  import('./battle_screen.js').then(m => {
    m.renderBattleScreen?.(enemy, {
      tier,
      dungeon: true
    });
  }).catch(err => {
    console.error('[Village] Errore apertura battle screen:', err);
    toast('Errore nell\'apertura della battaglia.', 'error');
  });
};

// Continua dungeon in corso
window._resumeDungeon = async function() {
  const { getCurrentEnemy, getActiveDungeon } = await import('../battle/dungeon.js');
  const enemy = getCurrentEnemy();

  if (!enemy) {
    return toast('Nessun nemico trovato nella stanza corrente.', 'error');
  }

  const activeDungeon = getActiveDungeon();

  import('./battle_screen.js').then(m => {
    m.renderBattleScreen?.(enemy, {
      tier: activeDungeon?.tier || 1,
      dungeon: true
    });
  }).catch(err => {
    console.error('[Village] Errore apertura battle screen:', err);
    toast('Errore nell\'apertura della battaglia.', 'error');
  });
};

// Reset abilità
window._openResetDialog = async function() {
  const bc = getBattleChar(CUR.id);
  if (!confirm(`Reset dell'albero abilità: costo 300 Gold (ne hai ${bc?.gold || 0}). Confermi?`)) return;
  if ((bc?.gold || 0) < 300) return toast('Gold insufficienti (servono 300G)', 'error');

  const { supabase: sb } = await import('../../supabase.js');
  await import('../battle/character.js').then(({ updateGold: ug }) => ug(CUR.id, -300, 'repair', 'skill_reset'));

  // Cancella abilità apprese
  await sb.from('character_abilities').delete().eq('character_id', bc.id);
  DB.characterAbilities[CUR.id] = [];

  // Restituisce i PA spesi (conta dalle abilità dimenticate)
  const paRefund = (DB.battleAbilities || [])
    .filter(a => a.class_id === bc.class_id)
    .reduce((sum, a) => sum + (a.pa_cost || 1), 0);

  await sb.from('battle_characters').update({ skill_points: (bc.skill_points || 0) + paRefund }).eq('id', bc.id);
  DB.battleCharacters[CUR.id].skill_points = (bc.skill_points || 0) + paRefund;
  persist();

  playSound('tap');
  toast(`Abilità resettate. ${paRefund} PA restituiti.`, 'success');
  renderVillage();
};
