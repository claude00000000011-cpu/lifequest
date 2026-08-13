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
    market:    'village-bg-merchant',
    inventory: 'village-bg-inventory',
    academy:   'village-bg-academy',
    smith:     'village-bg-map',
    friends:   'village-bg-map',
    chat:      'village-bg-map',
  }[_villageTab] || 'village-bg-map';





         
  container.className = bgClass;
container.innerHTML = `
    ${renderVillageHeader(bc, user, level)}
    ${renderVillageTabs(bc, level)}
    <div id="village-content" class="village-content">
      ${await renderVillageTabContent(bc, user, level)}
    </div>
  `;
  // Carica economia dopo che il DOM è pronto
  if (_villageTab === 'map') {
    setTimeout(() => window._loadEconomySummary?.(), 50);
  }
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
    { id: 'market',    icon: '🏪',  label: 'Mercato'   },
    { id: 'inventory', icon: '🎒',  label: 'Zaino'     },
    { id: 'smith',     icon: '🔨',  label: 'Fabbro'    },
    { id: 'academy',   icon: '📜',  label: 'Accademia' },
    { id: 'friends',   icon: '👥',  label: 'Amici'     },
    { id: 'chat',      icon: '💬',  label: 'Chat'      },
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
    case 'market':    return await renderMarket(bc);
    case 'inventory': return await renderInventory(bc, user);
    case 'smith':     return await renderSmith(bc);
    case 'academy':   return renderAcademy(bc, level);
    case 'friends':   return await renderFriends();
    case 'chat':      return await renderGameChat();
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
              const item = entry.battle_items || (DB.battleItems || []).find(i => i.id === entry.item_id);
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


        
        ${item.slot === 'consumable' && (entry.quantity || 1) > 1
  ? `<button class="btn-sm btn-danger" onclick="window._sellItem?.('${entry.id}', 1)">Vendi 1</button>
     <button class="btn-sm btn-danger" onclick="window._sellItem?.('${entry.id}', ${entry.quantity})">Vendi tutti</button>`
  : `<button class="btn-sm btn-danger" onclick="window._sellItem?.('${entry.id}', 1)">Vendi</button>`
}

        
      </div>
    </div>
  `;
}

// ── FABBRO ────────────────────────────────────────────────────

async function renderSmith(bc) {
  const inv   = await loadInventory(CUR.id);
  const equip = DB.characterEquipment?.[CUR.id] || [];
  const { loadEnhancements, getEnhancementFromCache, getStarDisplay, calcEnhancementCost, canEnhance } = await import('../battle/enhancement.js');
  await loadEnhancements(CUR.id);

  const toRepair = equip.filter(s => s.item_id && (s.durability ?? 100) < 100);
  const { EQUIPMENT_DEGRADATION } = await import('../battle/config.js');

  // Solo item non consumabili per il potenziamento
  const enhanceable = inv.filter(entry => {
    const item = (DB.battleItems || []).find(i => i.id === entry.item_id);
    return item && item.slot !== 'consumable';
  });

  const rarColors = {
    common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6',
    epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626'
  };

  return `
    <div class="smith-screen">

      <!-- NPC -->
      <div class="smith-npc">
        <div class="smith-avatar">🔨</div>
        <div class="smith-speech">
          "Porto ogni lama al suo massimo potenziale. Portami copie e Gold!"
        </div>
      </div>

      <!-- RIPARAZIONE -->
      <div class="village-section-title">🔧 Riparazione</div>
      ${toRepair.length === 0
        ? '<div class="empty-note" style="padding:0.75rem 1rem;color:var(--text-3)">Tutto l\'equipaggiamento è in perfette condizioni.</div>'
        : `<div class="smith-repair-list">
            ${toRepair.map(s => {
              const item  = (DB.battleItems || []).find(i => i.id === s.item_id);
              if (!item) return '';
              const cost  = EQUIPMENT_DEGRADATION.repairCost[item.rarity] || 50;
              const canPay = (bc.gold || 0) >= cost;
              return `
                <div class="repair-item">
                  <div class="repair-item__icon">
                    ${item.icon_path
                      ? `<img src="${escHtml(item.icon_path)}" class="smith-item-gif" alt="${escHtml(item.name)}">`
                      : slotEmoji(s.slot)}
                  </div>
                  <div class="repair-item__info">
                    <span class="repair-item__name">${escHtml(item.name)}</span>
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

      <!-- POTENZIAMENTO -->
      <div class="village-section-title" style="margin-top:1.25rem">⬆️ Potenziamento</div>
      ${enhanceable.length === 0
        ? '<div class="empty-note" style="padding:0.75rem 1rem;color:var(--text-3)">Nessun oggetto potenziabile. Ottieni equipaggiamento dai dungeon o dalle casse!</div>'
         : `<div class="smith-filter-bar">
            ${['tutti','common','uncommon','rare','epic','legendary','mythic'].map(r => `
              <button class="smith-filter-btn" onclick="window._smithFilter?.('${r}')" data-rarity="${r}">
                ${r === 'tutti' ? 'Tutti' : r}
              </button>
            `).join('')}
          </div>
          <div class="smith-enhance-list" id="smith-enhance-list">
            ${await Promise.all(enhanceable.map(async entry => {
              const item  = (DB.battleItems || []).find(i => i.id === entry.item_id);
              if (!item) return '';
              const color = rarColors[item.rarity] || '#9CA3AF';
              const enh   = getEnhancementFromCache(entry.id, CUR.id);
              const lvl   = enh?.enhancement_lvl || 1;
              const cost  = await calcEnhancementCost(entry.id, CUR.id);
              const check = await canEnhance(entry.id, CUR.id);

              // Conta copie disponibili (esclusa questa)
              const copies = inv.filter(i =>
                i.item_id === entry.item_id && i.id !== entry.id
              ).reduce((sum, i) => sum + (i.quantity || 1), 0);

              const bonusLines = enh ? [
                enh.bonus_attack  > 0 ? `+${enh.bonus_attack} ATK`           : '',
                enh.bonus_defense > 0 ? `+${enh.bonus_defense} DEF`          : '',
                enh.bonus_hp      > 0 ? `+${enh.bonus_hp} PF`                : '',
                enh.crit_rate     > 0 ? `+${enh.crit_rate}% Critico`         : '',
                enh.crit_damage   > 0 ? `+${enh.crit_damage}% Danno Critico` : '',
                enh.burn_chance   > 0 ? `+${enh.burn_chance}% Bruciatura`    : '',
                enh.poison_chance > 0 ? `+${enh.poison_chance}% Veleno`      : '',
                enh.dot_damage    > 0 ? `+${enh.dot_damage} Danno/turno`     : '',
              ].filter(Boolean).join(' · ') : '';

              return `
                <div class="enhance-item" style="border-color:${color}44" data-rarity="${item.rarity}">

                  <!-- Icona item -->
                  <div class="enhance-item__icon" style="background:${color}22">
                    ${item.icon_path
                      ? `<img src="${escHtml(item.icon_path)}" class="smith-item-gif" alt="${escHtml(item.name)}">`
                      : slotEmoji(item.slot)}
                  </div>

                  <!-- Info -->
                  <div class="enhance-item__info">
                    <div class="enhance-item__name" style="color:${color}">
                      ${escHtml(item.name)}
                      <span class="enhance-star">⭐${lvl}</span>
                    </div>
                    <div class="enhance-item__rarity badge" style="background:${color}22;color:${color}">
                      ${item.rarity}
                    </div>
                    ${bonusLines ? `<div class="enhance-item__bonuses">${bonusLines}</div>` : ''}

                    <!-- Costo prossimo up -->
                    ${cost ? `
                      <div class="enhance-item__cost">
                        ${cost.onlyGold
                          ? `<span>🪙 ${cost.goldCost}G (solo Gold)</span>`
                          : `<span>🪙 ${cost.goldCost}G</span>
                             <span>📦 ${cost.copiesNeeded} cop. (hai ${copies})</span>`
                        }
                      </div>
                    ` : ''}
                  </div>

                  <!-- Bottone -->
                  <div class="enhance-item__footer">
                    ${!cost?.onlyGold ? `
                      <div class="enhance-copies ${copies >= (cost?.copiesNeeded || 0) ? 'copies-ok' : 'copies-missing'}">
                        📦 ${copies}/${cost?.copiesNeeded || '?'} copie
                      </div>
                    ` : `<div class="enhance-copies copies-ok">💰 Solo Gold</div>`}
                    <button class="btn-sm ${check.canEnhance ? 'btn-primary' : ''}"
                            ${!check.canEnhance ? 'disabled' : ''}
                            title="${!check.canEnhance ? escHtml(check.reason || '') : `Potenzia a ⭐${lvl + 1}`}"
                            onclick="window._enhanceItem?.('${entry.id}')">
                      ⬆️ +1
                    </button>
                  </div>

                </div>
              `;
            })).then(r => r.join(''))}
          </div>`
      }
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




// ── MERCATO GLOBALE ───────────────────────────────────────────

let _marketFilter = { slot: 'tutti', rarity: 'tutti', class_id: 'tutti' };

async function renderMarket(bc) {
  const { supabase } = await import('../../supabase.js');

  // Pulizia listing scaduti (sold/cancelled non mostrarli)
  let query = supabase
    .from('market_listings')
    .select(`
      id, price, quantity, created_at, seller_id,
      battle_items ( id, name, slot, rarity, class_id, icon_path,
        bonus_attack, bonus_defense, bonus_hp, bonus_mana, bonus_speed ),
      battle_characters ( id, user_id,
        users ( id, username, avatar_url ) )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);

  if (_marketFilter.slot    !== 'tutti') query = query.eq('battle_items.slot',     _marketFilter.slot);
  if (_marketFilter.rarity  !== 'tutti') query = query.eq('battle_items.rarity',   _marketFilter.rarity);
  if (_marketFilter.class_id !== 'tutti') query = query.eq('battle_items.class_id', _marketFilter.class_id);

  const { data: listings, error } = await query;
  if (error) console.warn('[Market] load error:', error.message);

  const rarColors = { common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6',
                      epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626' };

  // Oggetti dello zaino del giocatore (per mettere in vendita)
  const inv = await loadInventory(CUR.id);
  const sellable = inv.filter(e => {
    const item = e.battle_items || (DB.battleItems || []).find(i => i.id === e.item_id);
    return item && item.slot !== 'consumable';
  });

  return `
    <div class="market-screen">

      <!-- Header -->
      <div class="market-header">
        <div class="village-section-title" style="margin:0">🏪 Mercato Globale</div>
        <button class="btn-sm btn-primary" onclick="window._openSellModal?.()">+ Vendi</button>
      </div>

      <!-- Filtri -->
      <div class="market-filters">
        <select onchange="window._setMarketFilter?.('slot', this.value)">
          <option value="tutti">Tutti gli slot</option>
          ${['weapon','armor','helmet','leggings','gloves','shoes','ring','cloak','talisman','pet'].map(s =>
            `<option value="${s}" ${_marketFilter.slot === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
        <select onchange="window._setMarketFilter?.('rarity', this.value)">
          <option value="tutti">Tutte le rarità</option>
          ${['common','uncommon','rare','epic','legendary','mythic'].map(r =>
            `<option value="${r}" ${_marketFilter.rarity === r ? 'selected' : ''}>${r}</option>`
          ).join('')}
        </select>
        <select onchange="window._setMarketFilter?.('class_id', this.value)">
          <option value="tutti">Tutte le classi</option>
          ${['warrior','mage','shadow','oracle','bard'].map(c =>
            `<option value="${c}" ${_marketFilter.class_id === c ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>

      <!-- Lista annunci -->
      <div class="market-list">
        ${!listings?.length
          ? '<div class="empty-note" style="padding:1rem">Nessun oggetto in vendita. Sii il primo!</div>'
          : listings.map(l => {
              const item    = l.battle_items;
              const seller  = l.battle_characters?.users;
              if (!item) return '';
              const color   = rarColors[item.rarity] || '#9CA3AF';
              const isMe    = l.seller_id === DB.battleCharacters?.[CUR.id]?.id;
              const bonuses = buildBonusText(item);
              return `
                <div class="market-item rarity-border-${item.rarity}">
                  <div class="market-item__icon" style="background:${color}22">
                    ${item.icon_path
                      ? `<img src="${escHtml(item.icon_path)}" style="width:36px;height:36px;object-fit:contain;image-rendering:pixelated" alt="">`
                      : slotEmoji(item.slot)}
                  </div>
                  <div class="market-item__info">
                    <div class="market-item__name" style="color:${color}">${escHtml(item.name)}</div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;margin:2px 0">
                      <span class="badge">${item.slot}</span>
                      <span class="badge rarity-${item.rarity}">${item.rarity}</span>
                      ${item.class_id ? `<span class="badge">${item.class_id}</span>` : ''}
                    </div>
                    ${bonuses ? `<div class="market-item__bonuses">${bonuses}</div>` : ''}
                    <div class="market-item__seller">
                      🧑 @${escHtml(seller?.username || '?')}
                      ${!isMe ? `
                        <button class="btn-sm" style="font-size:0.3rem;padding:2px 5px"
                                onclick="window._addGameFriend?.('${seller?.id}', '${escHtml(seller?.username || '')}')">
                          +Amico
                        </button>
                        <button class="btn-sm" style="font-size:0.3rem;padding:2px 5px"
                                onclick="window._viewUserProfile?.('${seller?.id}')">
                          Profilo
                        </button>
                      ` : '<span style="color:var(--rpg-gold);font-size:0.35rem"> (tu)</span>'}
                    </div>
                  </div>
                  <div class="market-item__buy">
                    <div class="market-item__price">🪙 ${l.price.toLocaleString()}</div>
                    ${isMe
                      ? `<button class="btn-sm btn-danger" onclick="window._cancelListing?.('${l.id}')">Ritira</button>`
                      : `<button class="btn-sm btn-primary"
                                 onclick="window._buyFromMarket?.('${l.id}', ${l.price})"
                                 ${(bc.gold || 0) < l.price ? 'disabled title="Gold insufficienti"' : ''}>
                           Compra
                         </button>`
                    }
                  </div>
                </div>
              `;
            }).join('')
        }
      </div>

      <!-- Registro vendite -->
      <div class="village-section-title" style="margin-top:1.5rem">📋 Le mie vendite</div>
      <div id="market-sales-log">
        <div style="color:var(--rpg-gray);font-family:var(--font-pixel);font-size:0.38rem;padding:0.5rem">
          Caricamento…
        </div>
      </div>
    </div>

    <!-- Modal vendita (nascosto) -->
    <div id="sell-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9000;
         align-items:center;justify-content:center;padding:1rem">
      <div style="background:var(--rpg-panel);border:3px solid var(--rpg-border-gold);
                  padding:1.5rem;width:100%;max-width:340px;position:relative">
        <div style="font-family:var(--font-pixel);font-size:0.55rem;color:var(--rpg-gold);margin-bottom:1rem">
          🏪 Metti in vendita
        </div>
        <div style="margin-bottom:0.75rem">
          <label style="font-family:var(--font-pixel);font-size:0.36rem;color:var(--rpg-gray);display:block;margin-bottom:4px">
            Oggetto
          </label>
          <select id="sell-item-select" style="width:100%;font-family:var(--font-pixel);font-size:0.38rem;
                  background:var(--rpg-panel2);color:var(--rpg-white);border:2px solid var(--rpg-border);padding:6px">
            <option value="">— Seleziona —</option>
            ${sellable.map(e => {
              const item = e.battle_items || (DB.battleItems || []).find(i => i.id === e.item_id);
              if (!item) return '';
              return `<option value="${e.id}" data-item-id="${item.id}">${escHtml(item.name)} (${item.rarity})</option>`;
            }).join('')}
          </select>
        </div>
        <div style="margin-bottom:0.75rem">
          <label style="font-family:var(--font-pixel);font-size:0.36rem;color:var(--rpg-gray);display:block;margin-bottom:4px">
            Prezzo (Gold)
          </label>
          <input type="number" id="sell-price-input" min="1" placeholder="Es. 500"
                 style="width:100%;font-family:var(--font-pixel);font-size:0.42rem;
                        background:var(--rpg-panel2);color:var(--rpg-white);border:2px solid var(--rpg-border);padding:8px">
        </div>
        <div style="display:flex;gap:8px;margin-top:1rem">
          <button class="btn-primary" style="flex:1" onclick="window._confirmSellListing?.()">Pubblica</button>
          <button class="btn-secondary" style="flex:1" onclick="window._closeSellModal?.()">Annulla</button>
        </div>
      </div>
    </div>
  `;
}

// ── AMICI DI GIOCO ────────────────────────────────────────────

async function renderFriends() {
  const { supabase } = await import('../../supabase.js');
  const myId = CUR.id;

  const { data, error } = await supabase
    .from('game_friends')
    .select('user_a, user_b, users!game_friends_user_a_fkey(id,username,avatar_url), users!game_friends_user_b_fkey(id,username,avatar_url)')
    .or(`user_a.eq.${myId},user_b.eq.${myId}`);

  if (error) console.warn('[Friends]', error.message);

  const friends = (data || []).map(row => {
    const isA = row.user_a === myId;
    return isA ? row['users!game_friends_user_b_fkey'] : row['users!game_friends_user_a_fkey'];
  }).filter(Boolean);

  return `
    <div class="friends-screen">
      <div class="village-section-title">👥 Amici di Gioco (${friends.length})</div>
      ${!friends.length
        ? '<div class="empty-note" style="padding:1rem">Nessun amico ancora. Aggiungili dal Mercato!</div>'
        : `<div class="friends-list">
            ${friends.map(f => `
              <div class="friend-item">
                <div class="friend-avatar">
                  ${f.avatar_url
                    ? `<img src="${escHtml(f.avatar_url)}" style="width:36px;height:36px;border-radius:0;object-fit:cover">`
                    : `<div style="width:36px;height:36px;background:var(--rpg-accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-pixel);font-size:0.5rem">
                         ${escHtml(f.username.slice(0,2).toUpperCase())}
                       </div>`}
                </div>
                <div style="flex:1;font-family:var(--font-pixel);font-size:0.42rem">
                  @${escHtml(f.username)}
                </div>
                <button class="btn-sm" onclick="window._viewUserProfile?.('${f.id}')">Profilo</button>
                <button class="btn-sm btn-danger" onclick="window._removeGameFriend?.('${f.id}')">Rimuovi</button>
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;
}

// ── CHAT DI GIOCO ─────────────────────────────────────────────
async function renderGameChat() {
  const { supabase } = await import('../../supabase.js');

  // Carica amici per DM
  const { data: friendRows } = await supabase
    .from('game_friends')
    .select('user_a, user_b, ua:users!game_friends_user_a_fkey(id,username), ub:users!game_friends_user_b_fkey(id,username)')
    .or(`user_a.eq.${CUR.id},user_b.eq.${CUR.id}`);

  const friends = (friendRows || []).map(row =>
    row.user_a === CUR.id ? row.ub : row.ua
  ).filter(Boolean);

  // Pulizia messaggi > 24h
  await supabase.rpc('cleanup_game_chat');

  // Carica messaggi (globali + DM che mi riguardano)
  const { data: messages } = await supabase
    .from('game_chat')
    .select('id, user_id, username, message, created_at, recipient_id')
    .or(`recipient_id.is.null,recipient_id.eq.${CUR.id},user_id.eq.${CUR.id}`)
    .order('created_at', { ascending: true })
    .limit(100);

  return `
    <div class="chat-screen">
      <div class="village-section-title">💬 Chat di Gioco</div>
      <div class="chat-messages" id="chat-messages">
        ${!(messages?.length)
          ? '<div class="empty-note" style="padding:1rem">Nessun messaggio. Di\' qualcosa!</div>'
          : messages.map(m => {
              const isMe = m.user_id === CUR.id;
              const isDM = m.recipient_id !== null;
              return `
                <div class="chat-msg ${isMe ? 'chat-msg--me' : ''} ${isDM ? 'chat-msg--dm' : ''}">
                  <span class="chat-msg__user"
                        style="color:${isMe ? 'var(--rpg-gold)' : 'var(--rpg-gray)'};
                               ${!isMe ? 'cursor:pointer;text-decoration:underline dotted' : ''}"
                        ${!isMe ? `onclick="window._addGameFriend?.('${m.user_id}', '${escHtml(m.username)}')"
                                   title="Aggiungi @${escHtml(m.username)} agli amici"` : ''}>
                    @${escHtml(m.username)}${isDM ? ' 🔒' : ''}
                  </span>
                  <span class="chat-msg__text">${escHtml(m.message)}</span>
                  <span class="chat-msg__time">${new Date(m.created_at).toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              `;
            }).join('')}
      </div>

      <div class="chat-input-area">
        <div class="chat-dm-row">
          <span style="font-family:var(--font-pixel);font-size:0.32rem;color:var(--rpg-gray);white-space:nowrap">A:</span>
          <select id="chat-dm-select" style="flex:1;font-family:var(--font-pixel);font-size:0.32rem;
                  background:var(--rpg-panel2);color:var(--rpg-white);border:2px solid var(--rpg-border);padding:4px">
            <option value="">🌐 Tutti (globale)</option>
            ${(friends || []).map(f =>
              `<option value="${f.id}">@${escHtml(f.username)}</option>`
            ).join('')}
          </select>
        </div>
        <input type="text" id="chat-input" placeholder="Scrivi un messaggio…" maxlength="200"
               style="width:100%;font-family:var(--font-pixel);font-size:0.38rem;background:var(--rpg-panel2);
                      color:var(--rpg-white);border:2px solid var(--rpg-border);padding:8px;box-sizing:border-box"
               onkeydown="if(event.key==='Enter') window._sendChatMessage?.()">
        <button class="btn-sm btn-primary" style="width:100%" onclick="window._sendChatMessage?.()">
          Invia
        </button>
      </div>
    </div>
  `;


}



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
  playSound('class_select');
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



         

  const isRare = ['epic','legendary','mythic'].includes(result.rarity);
  playSound(isRare ? 'loot_rare' : 'lootbox');
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
    playSound('buy');
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


window._sellItem = async function(inventoryId, qty = 1) {
  if (!confirm(`Vendere ${qty === 1 ? 'un oggetto' : 'tutti gli oggetti'}?`)) return;
  const result = await sellItem(CUR.id, inventoryId, qty);




         
  if (!result.ok) return toast(result.error || 'Errore', 'error');
  playSound('sell');
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

    playSound('repair');
    toast('Oggetto riparato! 🔨', 'success');
    renderVillage();
    return;
  }

  const result = await repairItem(CUR.id, invId);
  if (!result.ok) return toast(result.error || 'Errore', 'error');
  playSound('repair');
  toast('Oggetto riparato! 🔨', 'success');
  renderVillage();
};

// Apprendi abilità
window._learnAbility = async function(abilityId) {
  const { unlockAbility } = await import('../battle/character.js');
  const result = await unlockAbility(CUR.id, abilityId);
  if (!result.ok) return toast(result.error || 'Errore', 'error');
  playSound('learn');
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

 playSound('dungeon_enter');
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


window._enhanceItem = async function(inventoryId) {
  const { enhanceItem } = await import('../battle/enhancement.js');
  const result = await enhanceItem(inventoryId, CUR.id);
  if (!result.ok) return toast(result.error || 'Errore', 'error');
 playSound('enhance');
  const enh = result.enhancement;
  toast(`⭐${enh.enhancement_lvl} — Potenziamento riuscito!`, 'success');
  renderVillage();
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


window._smithFilter = function(rarity) {
  document.querySelectorAll('.smith-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.rarity === rarity);
  });
  document.querySelectorAll('.enhance-item').forEach(el => {
    const r = el.dataset.rarity;
    el.style.display = (rarity === 'tutti' || r === rarity) ? '' : 'none';
  });
};


// ── MERCATO — azioni ──────────────────────────────────────────

window._setMarketFilter = function(key, val) {
  _marketFilter[key] = val;
  switchVillageTab('market');
};

window._openSellModal = function() {
  const modal = document.getElementById('sell-modal');
  if (modal) modal.style.display = 'flex';
};

window._closeSellModal = function() {
  const modal = document.getElementById('sell-modal');
  if (modal) modal.style.display = 'none';
};

window._confirmSellListing = async function() {
  const select = document.getElementById('sell-item-select');
  const priceInput = document.getElementById('sell-price-input');
  const inventoryId = select?.value;
  const price = parseInt(priceInput?.value || '0');

  if (!inventoryId) return toast('Seleziona un oggetto', 'error');
  if (!price || price < 1) return toast('Inserisci un prezzo valido', 'error');

  const { supabase } = await import('../../supabase.js');
  const bc = getBattleChar(CUR.id);
  if (!bc) return;

  const inv = DB.battleInventory?.[CUR.id] || [];
  const entry = inv.find(i => i.id === inventoryId);
  if (!entry) return toast('Oggetto non trovato', 'error');

  const { error } = await supabase.from('market_listings').insert({
    seller_id:    bc.id,
    item_id:      entry.item_id,
    inventory_id: inventoryId,
    quantity:     1,
    price,
    status:       'active',
  });

  if (error) return toast('Errore nella pubblicazione: ' + error.message, 'error');

  playSound('gold');
  toast('Oggetto messo in vendita! 🏪', 'success');
  window._closeSellModal?.();
  switchVillageTab('market');
};

window._buyFromMarket = async function(listingId, price) {
  const bc = getBattleChar(CUR.id);
  if (!bc) return;
  if ((bc.gold || 0) < price) return toast('Gold insufficienti', 'error');

  if (!confirm(`Acquistare per 🪙 ${price} Gold?`)) return;

  const { supabase } = await import('../../supabase.js');

  // Leggi il listing
  const { data: listing, error: le } = await supabase
    .from('market_listings')
    .select('*')
    .eq('id', listingId)
    .eq('status', 'active')
    .single();

  if (le || !listing) return toast('Annuncio non più disponibile', 'error');

  // Transazione: aggiorna listing, trasferisci gold, aggiungi a inventario
  const { error: ue } = await supabase
    .from('market_listings')
    .update({ status: 'sold', sold_at: new Date().toISOString() })
    .eq('id', listingId);

  if (ue) return toast('Errore nell\'acquisto', 'error');

  // Scala gold acquirente
  await import('../battle/character.js').then(({ updateGold: ug }) =>
    ug(CUR.id, -price, 'market_buy', listingId)
  );

  // Dai gold al venditore (trova il suo user_id)
  const { data: sellerBc } = await supabase
    .from('battle_characters')
    .select('user_id')
    .eq('id', listing.seller_id)
    .single();

  if (sellerBc?.user_id) {
    await supabase
      .from('battle_characters')
      .update({ gold: supabase.rpc('increment_gold', { bc_id: listing.seller_id, amount: price }) })
      .eq('id', listing.seller_id);
  }

  // Aggiungi item all'inventario acquirente
  await addToInventory(CUR.id, bc.id, listing.item_id);

  // Log vendita
  await supabase.from('market_sales').insert({
    listing_id: listingId,
    buyer_id:   bc.id,
    seller_id:  listing.seller_id,
    item_id:    listing.item_id,
    quantity:   1,
    price,
  });

  playSound('buy');
  toast('Acquisto completato! 🎉', 'success');
  switchVillageTab('market');
};

window._cancelListing = async function(listingId) {
  if (!confirm('Ritirare questo annuncio?')) return;
  const { supabase } = await import('../../supabase.js');
  await supabase.from('market_listings').update({ status: 'cancelled' }).eq('id', listingId);
  toast('Annuncio ritirato', 'info');
  switchVillageTab('market');
};

// ── AMICI — azioni ────────────────────────────────────────────

window._addGameFriend = async function(userId, username) {
  if (userId === CUR.id) return toast('Non puoi aggiungere te stesso', 'error');
  const { supabase } = await import('../../supabase.js');

  const userA = CUR.id < userId ? CUR.id : userId;
  const userB = CUR.id < userId ? userId : CUR.id;

  const { error } = await supabase.from('game_friends').insert({ user_a: userA, user_b: userB });
  if (error?.code === '23505') return toast(`@${username} è già tra i tuoi amici`, 'info');
  if (error) return toast('Errore: ' + error.message, 'error');

  playSound('tap');
  toast(`@${username} aggiunto agli amici! 👥`, 'success');
};

window._removeGameFriend = async function(userId) {
  if (!confirm('Rimuovere questo amico?')) return;
  const { supabase } = await import('../../supabase.js');

  const userA = CUR.id < userId ? CUR.id : userId;
  const userB = CUR.id < userId ? userId : CUR.id;

  await supabase.from('game_friends').delete().eq('user_a', userA).eq('user_b', userB);
  toast('Amico rimosso', 'info');
  switchVillageTab('friends');
};

// ── CHAT — azioni ─────────────────────────────────────────────

window._sendChatMessage = async function() {
  const input = document.getElementById('chat-input');
  const message = input?.value.trim();
  if (!message) return;
  if (message.length > 200) return toast('Messaggio troppo lungo (max 200 caratteri)', 'error');

  const { supabase } = await import('../../supabase.js');
  const { error } = await supabase.from('game_chat').insert({
    user_id:  CUR.id,
    username: CUR.username,
    message,
  });

  if (error) return toast('Errore invio messaggio', 'error');

  input.value = '';
  playSound('tap');

  // Aggiungi messaggio al DOM senza ricaricare
  const msgs = document.getElementById('chat-messages');
  if (msgs) {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg--me';
    div.innerHTML = `
      <span class="chat-msg__user" style="color:var(--rpg-gold)">@${escHtml(CUR.username)}</span>
      <span class="chat-msg__text">${escHtml(message)}</span>
      <span class="chat-msg__time">${new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span>
    `;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }
};




