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
         loadBattleAbilities,
         loadEquipment,
         canEquipItem,
         syncPowerLevel,
         getFightStreak,
         calcStreakMultiplier }     from '../battle/character.js';
import { getMerchantSlots,
         buyFromMerchant,
         claimOracleFreeItem,
         openLootBox, canOpenBox,
         loadInventory, sellItem,
         repairItem,
         getDailyEconomySummary }   from '../battle/economy.js';
import { checkDungeonAccess,
         startDungeon, getActiveDungeon,
         resumeDungeon }                  from '../battle/dungeon.js';
import { ECONOMY, PROGRESSION,
         DUNGEONS, GUILDS }         from '../battle/config.js';
import { renderDungeonMap, renderDungeonDetail } from './dungeon_map.js';
import { startDungeonBattle }                    from './dungeon_battle.js';

// ── Stato navigazione villaggio ───────────────────────────────
let _villageTab = 'map';  // 'map'|'merchant'|'port'|'smith'|'academy'|'oracle'|'inventory'

let _chatRealtimeChannel = null;

export function switchVillageTab(t) {
  if (t !== 'chat' && _chatRealtimeChannel) {
    _chatRealtimeChannel.unsubscribe();
    _chatRealtimeChannel = null;
  }
  _villageTab = t;
  renderVillage();
}
// ════════════════════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════════════════════

export async function renderVillage() {
  if (!CUR) return;
  const container = document.getElementById('screen-battle');
  if (!container) return;

  // Carica dati necessari
const [,,,,fightStreak] = await Promise.all([
    syncBattleCharacter(CUR.id),
    loadItems(),
    loadBattleClasses(),
    loadEquipment(CUR.id),
    getFightStreak(CUR.id),
  ]);

  // Aggiorna badge streak dopo render
  setTimeout(() => {
    const el = document.getElementById('village-streak');
    if (el) {
      const mult = calcStreakMultiplier(fightStreak);
      el.textContent = `${fightStreak} battaglie (×${mult.toFixed(1)} gold)`;
    }
  }, 50);

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










// Frecce tab: aggiorna stato e scroll automatico alla tab attiva
  setTimeout(() => {
    _updateVillageTabArrows();
    const activeBtn = document.querySelector('.village-tabs .tab-btn--active');
    activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    document.getElementById('village-tabs-scroll')?.addEventListener('scroll', _updateVillageTabArrows);
  }, 100);









         

         
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
    setTimeout(() => window._loadSummonStatus?.(), 80);
  }
}
// ════════════════════════════════════════════════════════════
// HEADER
// ════════════════════════════════════════════════════════════

function renderVillageHeader(bc, user, level) {
    const classData  = DB.battleClasses?.[bc.class_id] || null;
  const classIcon  = { warrior:'⚔️', mage:'🔮', bard:'🎸', shadow:'🗡️', oracle:'☀️' }[bc.class_id] || '⚔️';
  const classColor = { warrior:'#DC2626', mage:'#3B82F6', bard:'#F59E0B', shadow:'#6B7280', oracle:'#A855F7' }[bc.class_id] || 'var(--accent)';

  // Livello di combattimento dal power_level in DB (aggiornato da syncBattleCharacter)
  const combatLevel = bc.power_level ?? '—';

  const hpPct   = Math.round((bc.hp_current / Math.max(1, bc.hp_base)) * 100);
  const manaPct = Math.round((bc.mana_current / Math.max(1, bc.mana_max)) * 100);

  return `
    <div class="village-header">

      <!-- Riga 1: Personaggio | Livello combattimento | Gold -->
      <div class="village-hud-top">

        <div class="village-class-badge" style="background:${classColor}22;border-color:${classColor}44">
          <span class="village-class-icon">${classIcon}</span>
          <div>
            <div class="village-hero-name">@${escHtml(user.username)}</div>
            <div class="village-hero-class" style="color:${classColor}">
              ${escHtml(classData?.name || 'Senza Classe')} · Lv.${level}
            </div>
          </div>
        </div>

        <div class="village-combat-level">
          <div class="village-combat-level__label">Livello di<br>combattimento</div>
          <div class="village-combat-level__val" id="village-combat-level">${combatLevel}</div>
        </div>





        <div class="village-gold-badge">
          <span class="village-gold-icon">🪙</span>
          <span id="village-gold">${(bc.gold || 0).toLocaleString()}</span>
        </div>
        <div class="village-streak-badge" id="village-streak-badge">
          🔥 <span id="village-streak">…</span>
        </div>





      </div>

      <!-- Riga 2: HP | Mana | PA -->
      <div class="village-stats-bar">

        <div class="village-stat-pill">
          <span class="vstat-icon">❤️</span>
          <div class="vstat-bar-wrap">
            <div class="vstat-bar hp-bar" style="width:${hpPct}%"></div>
          </div>
          <span class="vstat-val">${bc.hp_current}/${bc.hp_base}</span>
        </div>

        <div class="village-stat-pill">
          <span class="vstat-icon">💙</span>
          <div class="vstat-bar-wrap">
            <div class="vstat-bar mana-bar" style="width:${manaPct}%"></div>
          </div>
          <span class="vstat-val">${bc.mana_current}/${bc.mana_max}</span>
        </div>

        <div class="village-pa-pill">
          ✨ ${bc.skill_points} PA
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
    { id: 'map',         icon: '🗺️',  label: 'Villaggio'          },
    { id: 'merchant',    icon: '🛒',  label: 'Mercante'            },
    { id: 'market',      icon: '🏪',  label: 'Mercato'             },
    { id: 'inventory',   icon: '🎒',  label: 'Zaino'               },
    { id: 'smith',       icon: '🔨',  label: 'Fabbro'              },
    { id: 'academy',     icon: '📜',  label: 'Accademia'           },
    { id: 'dungeon_map', icon: '📖',  label: 'Storia'              },
    { id: 'port',        icon: '⚔️',  label: 'Dungeon Giornalieri' },
    { id: 'friends',     icon: '👥',  label: 'Amici'               },
    { id: 'chat',        icon: '💬',  label: 'Chat'                },
  ];

  return `
    <div class="village-tabs-wrap">
      <button class="village-tabs-arrow" id="vtab-arrow-left" onclick="window._villageTabScroll?.(-120)" aria-label="Scorri sinistra">‹</button>
      <div class="tab-row village-tabs" id="village-tabs-scroll">
        ${tabs.map(t => `
          <button class="tab-btn ${_villageTab === t.id ? 'tab-btn--active' : ''}"
                  onclick="window._switchVillageTab?.('${t.id}')">
            ${t.icon} ${t.label}
          </button>
        `).join('')}
      </div>
      <button class="village-tabs-arrow village-tabs-arrow--right" id="vtab-arrow-right" onclick="window._villageTabScroll?.(120)" aria-label="Scorri destra">›</button>
    </div>
  `;
}

// Aggiungi questa funzione globale subito dopo renderVillageTabs
window._villageTabScroll = function(delta) {
  const el = document.getElementById('village-tabs-scroll');
  if (!el) return;
  el.scrollBy({ left: delta, behavior: 'smooth' });
  setTimeout(_updateVillageTabArrows, 200);
};

function _updateVillageTabArrows() {
  const el    = document.getElementById('village-tabs-scroll');
  const left  = document.getElementById('vtab-arrow-left');
  const right = document.getElementById('vtab-arrow-right');
  if (!el || !left || !right) return;
  left.disabled  = el.scrollLeft < 4;
  right.disabled = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
}

// Chiama dopo ogni renderVillage — aggiungi in fondo alla funzione renderVillage,
// dentro il setTimeout esistente o subito dopo il container.innerHTML = ...
// setTimeout(_updateVillageTabArrows, 100);
// ════════════════════════════════════════════════════════════
// CONTENUTO TAB
// ════════════════════════════════════════════════════════════

async function renderVillageTabContent(bc, user, level) {
  // Tutorial prima-volta dopo scelta classe
  if (DB._showClassTutorial) {
    DB._showClassTutorial = false;
    return `
      <div class="tutorial-screen">
        <div class="tutorial-scanline"></div>

        <div class="tutorial-crown">👑</div>
        <div class="tutorial-title">BENVENUTO,<br>EROE!</div>
        <div class="tutorial-subtitle">— La tua avventura inizia ora —</div>

        <div class="tutorial-divider"></div>

        <div class="tutorial-entries">
          <div class="tutorial-entry">
            <span class="tutorial-entry__icon">🌍</span>
            <div>
              <div class="tutorial-entry__label">IL VILLAGGIO</div>
              <div class="tutorial-entry__text">La tua base. Esplora la mappa, entra nei dungeon, potenzia il personaggio.</div>
            </div>
          </div>
          <div class="tutorial-entry">
            <span class="tutorial-entry__icon">📈</span>
            <div>
              <div class="tutorial-entry__label">PUNTI ESPERIENZA</div>
              <div class="tutorial-entry__text">Gli XP si guadagnano solo nella vita reale — quest, studio, lettura, allenamento.</div>
            </div>
          </div>
          <div class="tutorial-entry">
            <span class="tutorial-entry__icon">⚔️</span>
            <div>
              <div class="tutorial-entry__label">LIVELLO & CLASSE</div>
              <div class="tutorial-entry__text">Salendo di livello le tue stat crescono. La classe determina i tuoi punti di forza.</div>
            </div>
          </div>
          <div class="tutorial-entry">
            <span class="tutorial-entry__icon">🎒</span>
            <div>
              <div class="tutorial-entry__label">EQUIPAGGIAMENTO</div>
              <div class="tutorial-entry__text">Trova oggetti nei dungeon, compra al mercante, potenzia al fabbro.</div>
            </div>
          </div>
          <div class="tutorial-entry">
            <span class="tutorial-entry__icon">🗺️</span>
            <div>
              <div class="tutorial-entry__label">MODALITÀ STORIA</div>
              <div class="tutorial-entry__text">17 dungeon in ordine. 10 stanze + boss finale. Completa un dungeon per sbloccare il successivo.</div>
            </div>
          </div>
        </div>

        <div class="tutorial-divider"></div>

        <button class="tutorial-btn"
                onclick="this.closest('.tutorial-screen').remove(); window._switchVillageTab?.('map')">
          ▶ INIZIA L'AVVENTURA
        </button>
      </div>



      
    `;
  }

  switch (_villageTab) {
    case 'map':       return renderVillageMap(bc, level);
    case 'port':      return await renderPort(bc, level);
    case 'merchant':  return await renderMerchant(bc, level);
    case 'market':    return await renderMarket(bc);
    case 'inventory': return await renderInventory(bc, user);
    case 'smith':     return await renderSmith(bc);
    case 'academy':   return renderAcademy(bc, level);
    case 'friends':   return await renderFriends();
    case 'chat': {
      const chatHtml = await renderGameChat();
      setTimeout(() => window._initChatRealtime?.(), 100);
      return chatHtml;
    }
case 'dungeon_map': {
      setTimeout(() => {
        const contentEl = document.getElementById('village-content');
        const playerLevel = level;
        const showMap = () => {
          renderDungeonMap(contentEl, playerLevel, (dungeon, state) => {
            showDetail(dungeon);
          });
        };
        const showDetail = (dungeon) => {
          renderDungeonDetail(contentEl, dungeon, playerLevel,
            (dungeon, room) => {
              const player = {
                maxHp:   bc.hp_base,
                hp:      bc.hp_current,
                attack:  bc.attack,
                defense: bc.defense,
                speed:   bc.speed,
              };
             startDungeonBattle(contentEl, dungeon, room, player, playerLevel,
                (dungeon, nextRoom) => {
                  if (nextRoom) {
                    startDungeonBattle(contentEl, dungeon, nextRoom, player, playerLevel,
                      (d, r) => showDetail(d),
                      showMap
                    );
                  } else {
                    showMap();
                  }
                },
                showMap
              );
            },
            showMap
          );
        };
        showMap();
      }, 50);
      return '';
    }


               
    
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



      

       <!-- Effetti attivi dall'equipaggiamento -->
      ${(() => {
        const equip = DB.characterEquipment?.[CUR.id] || [];
        const effects = equip
          .filter(e => e.item?.effect_type || (Array.isArray(e.item?.bonus_secondary) && e.item.bonus_secondary.length))
          .map(e => {
            const parts = [];
            if (e.item.effect_type) parts.push(`✨ ${e.item.effect_type}`);
            (e.item.bonus_secondary || []).forEach(b => {
              parts.push(`🔸 ${b.description || `${b.type}: ${b.value}`}`);
            });
            return `<div class="veffect-row"><span class="veffect-slot">${slotEmoji(e.slot)}</span><span>${parts.join(' · ')}</span></div>`;
          });
        return effects.length ? `
          <div class="village-section-title" style="margin-top:1rem">✨ Effetti Attivi</div>
          <div class="village-effects-list">${effects.join('')}</div>
        ` : '';
      })()}

      <!-- Alleato evocato -->
      <div id="summon-status-area"></div>

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

 // Controlla sessione attiva: prima in memoria, poi su Supabase
  let activeDungeon = getActiveDungeon();
  if (!activeDungeon) {
    const { resumeDungeon } = await import('../battle/dungeon.js');
    const result = await resumeDungeon(CUR.id);
    if (result.ok) activeDungeon = result.dungeon;
  }

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
    <span class="merchant-timer">🛒 Catalogo sempre disponibile</span>
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
  const inv   = await loadInventory(CUR.id);
  const equip = DB.characterEquipment?.[CUR.id] || [];
  const rarityOrder = { mythic:5, legendary:4, epic:3, rare:2, uncommon:1, common:0 };
  const sorted = [...inv].sort((a, b) =>
    (rarityOrder[b.items?.rarity] || 0) - (rarityOrder[a.items?.rarity] || 0)
  );

  const slots = ['weapon','armor','helmet','leggings','gloves','shoes','ring','cloak','talisman','pet'];
  const slotLabels = {
    weapon:   '⚔️ Arma',
    armor:    '🛡️ Armatura',
    helmet:   '⛑️ Elmo',
    leggings: '👖 Gambali',
    gloves:   '🧤 Guanti',
    shoes:    '👟 Scarpe',
    ring:     '💍 Anello',
    cloak:    '🧣 Mantello',
    talisman: '📿 Talismano',
    pet:      '🐾 Pet'
  };

  return `
    <div class="inventory-screen">
      <div class="village-section-title">⚔️ Equipaggiamento</div>
      <div class="equipment-slots">
        ${slots.map(slot => {
          const s    = equip.find(e => e.slot === slot);
          const item = s?.item || null;
          return `
            <div class="equip-slot equip-slot--${slot} ${item ? 'equip-slot--filled' : ''}">
              <div class="equip-slot__label">${slotLabels[slot]}</div>
              ${item ? `
                <div class="equip-slot__item rarity-border-${item.rarity}">
                  <div class="equip-item-icon">${slotEmoji(slot)}</div>
                  <div class="equip-item-name">${escHtml(item.name)}</div>
                  <div class="equip-item-dur">Durabilità: ${s.durability}%</div>
                  <button class="btn-sm btn-danger"
                    onclick="window._unequipItem?.('${s.id}', '${slot}')">
                    Rimuovi
                  </button>
                </div>
              ` : `<div class="equip-slot__empty">Vuoto</div>`}
            </div>
          `;
        }).join('')}
      </div>

      <div class="village-section-title" style="margin-top:1.25rem">
        🎒 Zaino (${sorted.length} oggetti)
      </div>

      <!-- Filtri zaino -->
      <div class="inv-filters" id="inv-filters">
        <select class="inv-filter-select" id="inv-filter-slot" onchange="window._applyInvFilters?.()">
          <option value="">Tutti i tipi</option>
          <option value="weapon">⚔️ Arma</option>
          <option value="armor">🛡️ Armatura</option>
          <option value="helmet">⛑️ Elmo</option>
          <option value="leggings">👖 Gambali</option>
          <option value="gloves">🧤 Guanti</option>
          <option value="shoes">👟 Scarpe</option>
          <option value="ring">💍 Anello</option>
          <option value="cloak">🧣 Mantello</option>
          <option value="talisman">📿 Talismano</option>
          <option value="pet">🐾 Pet</option>
          <option value="consumable">🧪 Consumabile</option>
        </select>
        <select class="inv-filter-select" id="inv-filter-rarity" onchange="window._applyInvFilters?.()">
          <option value="">Tutte le rarità</option>
          <option value="common">⬜ Comune</option>
          <option value="uncommon">🟩 Non comune</option>
          <option value="rare">🟦 Raro</option>
          <option value="epic">🟪 Epico</option>
          <option value="legendary">🟧 Leggendario</option>
          <option value="mythic">🟥 Mitico</option>
        </select>
        <select class="inv-filter-select" id="inv-filter-class" onchange="window._applyInvFilters?.()">
          <option value="">Tutte le classi</option>
          <option value="warrior">⚔️ Warrior</option>
          <option value="mage">🔮 Mage</option>
          <option value="shadow">🗡️ Shadow</option>
          <option value="oracle">☀️ Oracle</option>
          <option value="bard">🎸 Bard</option>
        </select>
        <select class="inv-filter-select" id="inv-filter-sort" onchange="window._applyInvFilters?.()">
          <option value="rarity">Ordina: Rarità</option>
          <option value="attack">Ordina: ATK</option>
          <option value="defense">Ordina: DEF</option>
          <option value="hp">Ordina: PF</option>
          <option value="effect">Ordina: Effetti</option>
        </select>
        <button class="btn-sm btn-ghost" onclick="window._resetInvFilters?.()">✖ Reset</button>
      </div>

      <div id="inv-list-wrap">
      ${!sorted.length
        ? '<div class="empty-state" style="padding:2rem">Nessun oggetto. Esplora i dungeon o apri casse loot!</div>'
        : `<div class="inventory-list" id="inventory-list">
            ${sorted.map(entry => {
              const item = entry.item || entry.battle_items || null;
              if (!item) return '';
              return renderInventoryItem(entry, item, CUR.id);
            }).join('')}
          </div>`
      }
      </div>







      
    </div>
  `;
}






function renderInventoryItem(entry, item, userId) {
  const rarColors = {
    common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6',
    epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626'
  };
  const color   = rarColors[item.rarity] || '#9CA3AF';
  const bonuses = buildBonusText(item);
  const isEquip = item.slot !== 'consumable';

  // Verifica classe e livello prima di mostrare il bottone
 const canEquip = isEquip;
  const equipBtn = isEquip
    ? (canEquip
        ? `<button class="btn-sm btn-primary"
             onclick="window._equipItem?.('${entry.id}', '${item.id}', '${item.slot}')">
             Equipaggia
           </button>`
        : `<span class="btn-sm btn-disabled" title="Classe o livello insufficiente">
             🔒 Non utilizzabile
           </span>`)
    : '';

  const sellBtn = item.slot === 'consumable' && (entry.quantity || 1) > 1
    ? `<button class="btn-sm btn-danger"
         onclick="window._sellItem?.('${entry.id}', 1)">Vendi 1</button>
       <button class="btn-sm btn-danger"
         onclick="window._sellItem?.('${entry.id}', ${entry.quantity})">Vendi tutti</button>`
    : `<button class="btn-sm btn-danger"
         onclick="window._sellItem?.('${entry.id}', 1)">Vendi</button>`;

  return `
    <div class="inv-item rarity-border-${item.rarity}" data-inv-id="${entry.id}">
      <div class="inv-item__icon" style="background:${color}22">${slotEmoji(item.slot)}</div>
      <div class="inv-item__info">
        <div class="inv-item__name" style="color:${color}">${escHtml(item.name)}</div>
        <div class="inv-item__slot badge">${escHtml(item.slot)}</div>
        ${bonuses ? `<div class="inv-item__bonuses">${bonuses}</div>` : ''}
        ${item.slot === 'consumable'
          ? `<div class="inv-item__qty">×${entry.quantity || 1}</div>`
          : ''}
        ${item.class_restriction?.length
          ? `<div class="inv-item__class">
               Classe: ${item.class_restriction.map(c => `<span class="badge badge--class">${c}</span>`).join(' ')}
             </div>`
          : ''}
      </div>
      <div class="inv-item__actions">
        ${equipBtn}
        ${sellBtn}
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
   // Mappa ability_id → livello attuale (0 = non appresa)
  const learnedMap = Object.fromEntries(
    (DB.characterAbilities?.[CUR.id] || []).map(a => [a.ability_id, a.level || 1])
  );
// ABILITY_LEVEL_COSTS rimosso — ora i costi vengono calcolati dinamicamente
  // in base al livello corrente dell'abilità (vedi unlockAbility in character.js)

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



                     
             const currentLv  = learnedMap[ab.id] || 0;
              const isLearned  = currentLv > 0;
              const nextLv     = currentLv + 1;
              const paCost     = nextLv === 1 ? (ab.pa_cost || 1) : nextLv;
              const goldCost   = nextLv === 1 ? (ab.gold_cost || 0) : nextLv * 100;
              const minLevel   = ab.min_char_level || 1;
              const canUpgrade = bc.skill_points >= paCost && bc.gold >= goldCost && level >= minLevel;
              const notEnoughLv= level < minLevel;
              const notEnoughPa= bc.skill_points < paCost;
              const notEnoughG = bc.gold < goldCost;
              return `
                <div class="ability-card ${isLearned ? 'ability-card--learned' : ''} ${ab.type === 'ultimate' ? 'ability-card--ultimate' : ''}">
                  <div class="ability-card__header">
                    <span class="ability-type-badge">${typeIcon[ab.type] || '⚡'}</span>
                    <strong>${escHtml(ab.name)}</strong>
                    ${isLearned ? `<span class="badge badge--green">Lv.${currentLv}</span>` : ''}
                  </div>
                  <p class="ability-desc">${escHtml(ab.description || '')}</p>
                  <div class="ability-costs">
                    <span>🎯 ${paCost} PA</span>
                    ${goldCost > 0 ? `<span>🪙 ${goldCost}G</span>` : ''}
                    <span style="color:var(--text-3)">Min Lv.${minLevel}</span>
                  </div>
                  <button class="btn-sm ${canUpgrade ? 'btn-primary' : ''}"
                          ${!canUpgrade ? 'disabled' : ''}
                          onclick="window._learnAbility?.('${ab.id}')"
                          title="${notEnoughLv ? `Richiede Lv.${minLevel}` : notEnoughPa ? 'PA insufficienti' : notEnoughG ? 'Gold insufficienti' : isLearned ? `Potenzia a Lv.${nextLv}` : 'Impara'}">
                    ${notEnoughLv ? `🔒 Lv.${minLevel}` : isLearned ? `⬆️ Potenzia (Lv.${nextLv})` : 'Impara'}
                  </button>
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
  // Legge le classi da Supabase invece che hardcodate
  const classes = DB.battleClasses ? Object.values(DB.battleClasses) : [];

  if (!classes.length) {
    // Fallback: ricarica e riprova
    import('../battle/character.js').then(({ loadBattleClasses }) =>
      loadBattleClasses().then(() => renderVillage())
    );
    return '<div class="feed-loading">Caricamento classi…</div>';
  }

  return `
    <div class="class-selection-screen">
      <div class="class-selection-header">
        <h2 style="font-size:1.4rem;font-weight:800;margin-bottom:0.5rem">⚔️ Scegli la tua Classe</h2>
        <p style="color:var(--text-2);font-size:0.9rem">
          Sei al livello ${level}. La scelta è definitiva — rifletti bene.
        </p>
      </div>
      <div class="class-grid">
        ${classes.map(c => {
          const color = c.color_class || '#DC2626';
          const stat  = { corpo:'Corpo', mente:'Mente', cultura:'Cultura', sfide:'Sfide', sociale:'Sociale' }[c.primary_stat] || c.primary_stat;
          return `
            <div class="class-card" style="border-color:${color}55"
                 onclick="window._selectClass?.('${c.id}')">
              <div class="class-card__icon" style="background:${color}22;border-color:${color}44">
                ${c.icon || '⚔️'}
              </div>
              <h3 class="class-card__name" style="color:${color}">${escHtml(c.name)}</h3>
              <div class="class-card__stat">Stat primaria: <strong>${stat}</strong></div>
              <p class="class-card__desc">${escHtml(c.description || '')}</p>
              ${c.evolution_desc ? `<div class="class-card__evo">🔀 Evolve in: <em>${escHtml(c.evolution_desc)}</em></div>` : ''}
              <button class="btn-primary" style="background:${color};border:none;margin-top:0.75rem">
                Scegli ${escHtml(c.name)}
              </button>
            </div>
          `;
        }).join('')}
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
  if (item.bonus_attack      > 0) parts.push(`+${item.bonus_attack} ATK`);
  if (item.bonus_defense     > 0) parts.push(`+${item.bonus_defense} DEF`);
  if (item.bonus_hp          > 0) parts.push(`+${item.bonus_hp} PF`);
  if (item.bonus_mana        > 0) parts.push(`+${item.bonus_mana} Mana`);
  if (item.bonus_speed       > 0) parts.push(`+${item.bonus_speed} VEL`);
  if (item.bonus_luck_pct    > 0) parts.push(`+${item.bonus_luck_pct}% Fortuna`);
  if (item.bonus_strength    > 0) parts.push(`+${item.bonus_strength} FOR`);
  if (item.bonus_intelligence> 0) parts.push(`+${item.bonus_intelligence} INT`);
  if (item.bonus_agility     > 0) parts.push(`+${item.bonus_agility} AGI`);
  if (item.bonus_vitality    > 0) parts.push(`+${item.bonus_vitality} VIT`);
  if (item.bonus_spirit      > 0) parts.push(`+${item.bonus_spirit} SPI`);
  if (item.bonus_charisma    > 0) parts.push(`+${item.bonus_charisma} CAR`);
  if (item.bonus_luck        > 0) parts.push(`+${item.bonus_luck} LUCK`);
  if (item.heal_pct          > 0) parts.push(`Cura ${item.heal_pct}% PF`);
  if (item.mana_restore_pct  > 0) parts.push(`Ripristina ${item.mana_restore_pct}% Mana`);
  if (item.damage_flat       > 0) parts.push(`+${item.damage_flat} DMG`);
  if (item.absorb_pct        > 0) parts.push(`Assorbi ${item.absorb_pct}% danno`);
  if (item.effect_type)           parts.push(`✨ ${item.effect_type}`);
  // bonus_secondary è un array JSON [{type, value, description}]
  const secondary = Array.isArray(item.bonus_secondary) ? item.bonus_secondary : [];
  secondary.forEach(b => {
    if (b.description) parts.push(`🔸 ${b.description}`);
    else if (b.type && b.value) parts.push(`🔸 ${b.type}: ${b.value}`);
  });
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
    .select('user_a, user_b, ua:users!game_friends_user_a_fkey(id,username,avatar_url), ub:users!game_friends_user_b_fkey(id,username,avatar_url)')
    .or(`user_a.eq.${myId},user_b.eq.${myId}`);





         
  if (error) console.warn('[Friends]', error.message);




         
  const friends = (data || []).map(row => {
    const isA = row.user_a === myId;
    return isA ? row.ub : row.ua;
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
                <button class="btn-sm" onclick="window._openPlayerProfile?.('${f.id}')">Profilo</button>
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



                               
                       ${!isMe ? `onclick="window._openPlayerProfile?.('${m.user_id}')"
                                   title="Vedi profilo di @${escHtml(m.username)}"` : ''}>


                                   
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




window._openPlayerProfile = async function(userId) {
  const { supabase } = await import('../../supabase.js');
  const { data: bc } = await supabase
    .from('battle_characters')
    .select('*, users(id, username, avatar_url)')
    .eq('user_id', userId)
    .single();
  if (!bc) return toast('Personaggio non trovato', 'error');
  const { data: equip } = await supabase
    .from('character_equipment')
    .select('*, battle_items(*)')
    .eq('character_id', bc.id);



         
  const myId = CUR.id;
  const ids = [myId, userId].sort();
  const userA = ids[0];
  const userB = ids[1];


         
  const { data: friendshipData, error: friendshipError } = await supabase
    .from('game_friends')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle();
  const alreadyFriend = !friendshipError && !!friendshipData;





         
  console.log('[Profile Debug]', { userId, curId: CUR.id, alreadyFriend, sameUser: userId === CUR.id });
  const todayStr = new Date().toISOString().slice(0, 10);
  const summonKey = `summon_${userId}_${todayStr}`;
  const summonCount = parseInt(localStorage.getItem(summonKey) || '0');
  const canSummon = summonCount < 10;
  const classIcon = { warrior:'⚔️', mage:'🔮', bard:'🎸', shadow:'🗡️', oracle:'☀️' }[bc.class_id] || '⚔️';
  const rarColors = { common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6', epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626' };
  const equipHtml = (equip || []).map(e => {
    if (!e.battle_items) return '';
    const item = e.battle_items;
    const color = rarColors[item.rarity] || '#9CA3AF';
    return `
      <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--rpg-border)">
        <span style="font-size:1rem">${slotEmoji(e.slot)}</span>
        <span style="font-family:var(--font-pixel);font-size:0.35rem;color:${color}">${escHtml(item.name)}</span>
        <span style="font-family:var(--font-pixel);font-size:0.3rem;color:var(--rpg-gray);margin-left:auto">${item.rarity}</span>
      </div>`;
  }).join('') || '<div style="font-family:var(--font-pixel);font-size:0.35rem;color:var(--rpg-gray)">Nessun equipaggiamento</div>';
  const existing = document.getElementById('player-profile-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'player-profile-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9100;display:flex;align-items:center;justify-content:center;padding:1rem`;
  modal.innerHTML = `
    <div style="background:var(--rpg-panel);border:3px solid var(--rpg-border-gold);padding:1.25rem;width:100%;max-width:340px;position:relative;max-height:85dvh;overflow-y:auto">
      <button onclick="document.getElementById('player-profile-modal').remove()"
              style="position:absolute;top:8px;right:8px;background:transparent;border:none;color:var(--rpg-gray);font-family:var(--font-pixel);font-size:0.5rem;cursor:pointer">✕</button>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem">
        <div style="font-size:2rem;background:rgba(0,0,0,0.3);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border:2px solid var(--rpg-border)">${classIcon}</div>
        <div>
          <div style="font-family:var(--font-pixel);font-size:0.52rem;color:var(--rpg-gold)">@${escHtml(bc.users?.username || '?')}</div>
          <div style="font-family:var(--font-pixel);font-size:0.38rem;color:var(--rpg-gray);margin-top:3px">${bc.class_id} · Lv.${bc.level || 1}</div>
        </div>
      </div>
      <div style="font-family:var(--font-pixel);font-size:0.4rem;color:var(--rpg-gold);margin-bottom:6px;border-left:3px solid var(--rpg-gold-dark);padding-left:6px">📊 Statistiche</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:1rem">
        ${[['⚔️ Attacco',bc.attack],['🛡️ Difesa',bc.defense],['❤️ HP',`${bc.hp_current}/${bc.hp_base}`],['💙 Mana',`${bc.mana_current}/${bc.mana_max}`],['💨 Velocità',bc.speed],['🍀 Fortuna',`${bc.luck_pct}%`]].map(([label,val]) => `
          <div style="background:var(--rpg-panel2);border:1px solid var(--rpg-border);padding:5px 7px">
            <div style="font-family:var(--font-pixel);font-size:0.3rem;color:var(--rpg-gray)">${label}</div>
            <div style="font-family:var(--font-pixel);font-size:0.45rem;color:var(--rpg-white)">${val}</div>
          </div>`).join('')}
      </div>
      <div style="font-family:var(--font-pixel);font-size:0.4rem;color:var(--rpg-gold);margin-bottom:6px;border-left:3px solid var(--rpg-gold-dark);padding-left:6px">⚔️ Equipaggiamento</div>
      <div style="margin-bottom:1rem">${equipHtml}</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:0.5rem">
        ${!alreadyFriend && userId !== CUR.id ? `
          <button class="btn-primary" style="width:100%"
                  onclick="window._addGameFriendFromProfile?.('${userId}', '${escHtml(bc.users?.username || '')}')">
            👥 Aggiungi agli amici
          </button>` : userId !== CUR.id ? `
          <div style="font-family:var(--font-pixel);font-size:0.36rem;color:var(--rpg-hp);text-align:center">✅ Già amici</div>` : ''}
        ${userId !== CUR.id ? `
          <button class="btn-sm btn-primary" style="width:100%"
                  ${!canSummon ? 'disabled title="Limite giornaliero raggiunto (10/10)"' : ''}
                  onclick="window._summonPlayer?.('${userId}', '${bc.id}')">
            ⚡ Evoca (${summonCount}/10 oggi)
          </button>` : ''}
      </div>
    </div>`;
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
};






window._summonPlayer = async function(userId, bcId) {
  const { supabase } = await import('../../supabase.js');

  // Controlla se ho già un alleato attivo
  const { data: existing } = await supabase
    .from('active_summons')
    .select('id, status')
    .eq('summoner_id', CUR.id)
    .maybeSingle();

  if (existing?.status === 'active') {
    return toast('Hai già un alleato evocato. Congedalo prima dal Villaggio.', 'error');
  }
  if (existing?.status === 'dead') {
    return toast('Il tuo alleato è caduto. Rianimalo o aspetta domani.', 'error');
  }

  // Carica le stat attuali del personaggio evocato
  const { data: bc } = await supabase
    .from('battle_characters')
    .select('*')
    .eq('id', bcId)
    .single();

  if (!bc) return toast('Personaggio non trovato', 'error');

  // Inserisci evocazione
  const { error } = await supabase.from('active_summons').upsert({
    summoner_id:      CUR.id,
    summoned_bc_id:   bcId,
    summoned_user_id: userId,
    hp_current:       bc.hp_base,
    hp_max:           bc.hp_base,
    status:           'active',
    summoned_at:      new Date().toISOString(),
    died_at:          null,
    revives_at:       null,
  }, { onConflict: 'summoner_id' });

  if (error) return toast('Errore evocazione: ' + error.message, 'error');

  // Dai gold al proprietario dell'alleato (50G per evocazione)
  await supabase.rpc('increment_gold', { bc_id: bcId, amount: 50 });

  // Salva in cache locale
  if (!DB.activeSummon) DB.activeSummon = {};
  DB.activeSummon[CUR.id] = { bcId, userId, hp: bc.hp_base, hpMax: bc.hp_base, stats: bc };
  persist();

  playSound('tap');
  toast(`⚡ ${bc.class_id} evocato come alleato!`, 'success');
  document.getElementById('player-profile-modal')?.remove();
  renderVillage();
};

window._addGameFriendFromProfile = async function(userId, username) {




  const { supabase } = await import('../../supabase.js');
  const userA = CUR.id < userId ? CUR.id : userId;
  const userB = CUR.id < userId ? userId : CUR.id;
  const { error } = await supabase.from('game_friends').insert({ user_a: userA, user_b: userB });
  if (error?.code === '23505') return toast(`@${username} è già tra i tuoi amici`, 'info');
  if (error) return toast('Errore: ' + error.message, 'error');
  playSound('tap');
  toast(`@${username} aggiunto agli amici! 👥`, 'success');
  const modal = document.getElementById('player-profile-modal');
  if (modal) {
    const btn = modal.querySelector(`button[onclick*="_addGameFriendFromProfile"]`);
     if (btn) btn.outerHTML = `<div style="font-family:var(--font-pixel);font-size:0.36rem;color:var(--rpg-hp);text-align:center">✅ Già amici</div>`;
  }
};

window._initChatRealtime = function() {
  if (_chatRealtimeChannel) {
    _chatRealtimeChannel.unsubscribe();
    _chatRealtimeChannel = null;
  }
  import('../../supabase.js').then(({ supabase }) => {
    _chatRealtimeChannel = supabase
      .channel('game_chat_live')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'game_chat',
      }, payload => {
        const m = payload.new;
        if (m.recipient_id && m.recipient_id !== CUR.id && m.user_id !== CUR.id) return;
        if (m.user_id === CUR.id) return;
        const msgs = document.getElementById('chat-messages');
        if (!msgs) return;
        const isDM = !!m.recipient_id;
        const div = document.createElement('div');
        div.className = `chat-msg${isDM ? ' chat-msg--dm' : ''}`;
        div.innerHTML = `
          <span class="chat-msg__user"
                style="color:var(--rpg-gray);cursor:pointer;text-decoration:underline dotted"
                onclick="window._openPlayerProfile?.('${m.user_id}')"
                title="Vedi profilo di @${escHtml(m.username)}">
            @${escHtml(m.username)}${isDM ? ' 🔒' : ''}
          </span>
          <span class="chat-msg__text">${escHtml(m.message)}</span>
          <span class="chat-msg__time">${new Date(m.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span>
        `;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
      })
      .subscribe();
  });
};

window._switchVillageTab = switchVillageTab;



window._loadSummonStatus = async function() {
  const area = document.getElementById('summon-status-area');
  if (!area) return;

  const { supabase } = await import('../../supabase.js');
  const { data: summon } = await supabase
    .from('active_summons')
    .select('*, bc:battle_characters!active_summons_summoned_bc_id_fkey(*), u:users!active_summons_summoned_user_id_fkey(username)')
    .eq('summoner_id', CUR.id)
    .maybeSingle();

  if (!summon) { area.innerHTML = ''; return; }

  const classIcon = { warrior:'⚔️', mage:'🔮', bard:'🎸', shadow:'🗡️', oracle:'☀️' }[summon.bc?.class_id] || '⚔️';
  const hpPct = Math.round((summon.hp_current / summon.hp_max) * 100);
  const isDead = summon.status === 'dead';

  // Controlla se revives_at è passato → auto-rianimazione
  if (isDead && summon.revives_at && new Date(summon.revives_at) <= new Date()) {
    await supabase.from('active_summons')
      .update({ status: 'active', hp_current: summon.hp_max, died_at: null, revives_at: null })
      .eq('summoner_id', CUR.id);
    toast('Il tuo alleato si è rianimato!', 'success');
    window._loadSummonStatus?.();
    return;
  }

  area.innerHTML = `
    <div class="village-section-title">⚡ Alleato Evocato</div>
    <div style="background:var(--rpg-panel);border:2px solid ${isDead ? '#7f1d1d' : 'var(--rpg-border-gold)'};padding:10px;display:flex;gap:10px;align-items:center">
      <div style="font-size:1.8rem">${classIcon}</div>
      <div style="flex:1">
        <div style="font-family:var(--font-pixel);font-size:0.42rem;color:${isDead ? 'var(--rpg-hp-low)' : 'var(--rpg-gold)'}">
          @${escHtml(summon.u?.username || '?')} ${isDead ? '💀 CADUTO' : ''}
        </div>
        <div style="font-family:var(--font-pixel);font-size:0.32rem;color:var(--rpg-gray);margin:3px 0">
          ${summon.bc?.class_id} · ❤️ ${summon.hp_current}/${summon.hp_max}
        </div>
        <div style="height:6px;background:#000;border:1px solid var(--rpg-border);margin-top:3px">
          <div style="height:100%;width:${hpPct}%;background:${hpPct > 30 ? 'var(--rpg-hp)' : 'var(--rpg-hp-low)'}"></div>
        </div>
        ${isDead && summon.revives_at ? `
          <div style="font-family:var(--font-pixel);font-size:0.3rem;color:var(--rpg-gray);margin-top:3px">
            Si rianima il ${new Date(summon.revives_at).toLocaleDateString('it-IT')}
          </div>
        ` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${isDead ? `
          <button class="btn-sm btn-primary" onclick="window._reviveSummon?.()">🧪 Rianima</button>
        ` : `
          <button class="btn-sm btn-danger" onclick="window._dismissSummon?.()">Congeda</button>
        `}
      </div>
    </div>
  `;
};

window._loadEconomySummary = async function() {


// Carica l'economy summary inline dopo render mappa
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

window._selectClass = async function(classId) {
  if (!confirm(`Sei sicuro di voler scegliere ${classId}? La scelta è definitiva.`)) return;
  const { ok, error } = await chooseClass(CUR.id, classId);
  if (!ok) return toast(error || 'Errore', 'error');
  playSound('class_select');
  // Forza reload del personaggio da Supabase prima di rerenderizzare
  const { syncBattleCharacter } = await import('../battle/character.js');
  await syncBattleCharacter(CUR.id);
  toast(`Classe ${classId} scelta! Buona fortuna, eroe. ⚔️`, 'success');
  // Mostra tutorial prima-volta
  DB._showClassTutorial = true;
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
  const { getCurrentEnemy, getActiveDungeon, resumeDungeon: resume } = await import('../battle/dungeon.js');

  // Se _activeDungeon è null (dopo refresh), ricostruiscilo da Supabase
  let activeDungeon = getActiveDungeon();
  if (!activeDungeon) {
    const result = await resume(CUR.id);
    if (!result.ok) return toast(result.error || 'Sessione non trovata', 'error');
    activeDungeon = result.dungeon;
  }

  const enemy = getCurrentEnemy();
  if (!enemy) return toast('Nessun nemico trovato nella stanza corrente.', 'error');

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
 // Restituisce solo i PA effettivamente spesi sulle abilità apprese
  const learned = DB.characterAbilities[CUR.id] || [];
  await sb.from('character_abilities').delete().eq('character_id', bc.id);
  DB.characterAbilities[CUR.id] = [];
  const paRefund = learned.reduce((sum, ca) => {
    const ab = (DB.battleAbilities || []).find(a => a.id === ca.ability_id);
    if (!ab) return sum;
    const lv = ca.level || 1;
    // Livello 1: pa_cost base; livelli 2+: 1+2+...+lv = lv*(lv+1)/2 - 1 + pa_cost
    const paSpent = (ab.pa_cost || 1) + (lv > 1 ? Array.from({length: lv - 1}, (_, i) => i + 2).reduce((a, b) => a + b, 0) : 0);
    return sum + paSpent;
  }, 0);

  await sb.from('battle_characters').update({ skill_points: (bc.skill_points || 0) + paRefund }).eq('id', bc.id);
  DB.battleCharacters[CUR.id].skill_points = (bc.skill_points || 0) + paRefund;
  persist();

  playSound('tap');
  toast(`Abilità resettate. ${paRefund} PA restituiti.`, 'success');
  renderVillage();
};



window._dismissSummon = async function() {
  if (!confirm('Congedare l\'alleato?')) return;
  const { supabase } = await import('../../supabase.js');
  await supabase.from('active_summons')
    .update({ status: 'dismissed' })
    .eq('summoner_id', CUR.id);
  delete DB.activeSummon?.[CUR.id];
  persist();
  toast('Alleato congedato.', 'info');
  renderVillage();
};

window._reviveSummon = async function() {
  const { supabase } = await import('../../supabase.js');

  // Cerca elisir_vita nell'inventario
  const inv = DB.battleInventory?.[CUR.id] || [];
  const elisir = inv.find(i => i.item_id === 'b26d2d44-abd6-41bb-98a2-8d201fb702bf');

  if (!elisir) return toast('Serve un Elisir della Vita per rianimare l\'alleato!', 'error');
  if (!confirm('Usare un Elisir della Vita per rianimare l\'alleato?')) return;

  // Rimuovi elisir dall'inventario
  const bc = getBattleChar(CUR.id);
  const newQty = (elisir.quantity || 1) - 1;
  if (newQty <= 0) {
    DB.battleInventory[CUR.id] = inv.filter(i => i.id !== elisir.id);
    await supabase.from('inventory').delete()
      .eq('character_id', bc.id).eq('item_id', elisir.item_id);
  } else {
    elisir.quantity = newQty;
    await supabase.from('inventory').update({ quantity: newQty })
      .eq('character_id', bc.id).eq('item_id', elisir.item_id);
  }
  persist();

  // Aggiorna stato evocazione
  const { data: summon } = await supabase
    .from('active_summons')
    .select('hp_max')
    .eq('summoner_id', CUR.id)
    .single();

  await supabase.from('active_summons')
    .update({ status: 'active', hp_current: summon?.hp_max || 100, died_at: null, revives_at: null })
    .eq('summoner_id', CUR.id);

  playSound('trophy');
  toast('Alleato rianimato! ⚡', 'success');
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

  // Rimuovi l'item dall'inventario mentre è in vendita
  const { error: delErr } = await supabase
    .from('inventory')
    .delete()
    .eq('id', inventoryId);

  if (delErr) {
    // Rollback: cancella il listing appena creato
    await supabase.from('market_listings').update({ status: 'cancelled' }).eq('inventory_id', inventoryId);
    return toast('Errore nella rimozione dall\'inventario', 'error');
  }

  playSound('gold');
  toast('Oggetto messo in vendita! 🏪', 'success');
  await loadInventory(CUR.id);
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

  // Leggi il listing per sapere inventory_id
  const { data: listing, error: le } = await supabase
    .from('market_listings')
    .select('inventory_id, item_id, seller_id')
    .eq('id', listingId)
    .single();

  if (le || !listing) return toast('Listing non trovato', 'error');

  // Aggiorna status
  const { error } = await supabase
    .from('market_listings')
    .update({ status: 'cancelled' })
    .eq('id', listingId);

  if (error) return toast('Errore nel ritiro: ' + error.message, 'error');

// Rimetti l'item in inventory
  const bc = getBattleChar(CUR.id);
  await supabase.from('inventory').insert({
    character_id: bc.id,
    item_id:      listing.item_id,
    quantity:     1,
    durability:   100,
  });

  toast('Annuncio ritirato — oggetto di nuovo nel tuo zaino', 'info');
  await loadInventory(CUR.id);
  switchVillageTab('inventory');
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







window._equipItem = async function(inventoryId, itemId, slot) {
  const bc = getBattleChar(CUR.id);
  if (!bc) return toast('Personaggio non trovato', 'error');

  const { supabase: sb } = await import('../../supabase.js');

  const { error } = await sb
    .from('character_equipment')
    .upsert({
      character_id: bc.id,
      slot,
      item_id:     itemId,
      durability:  100,
      equipped_at: new Date().toISOString()
    }, { onConflict: 'character_id,slot' });

  if (error) {
    console.error('[Equip] error:', error.message);
    return toast(
      error.message.includes('non autorizzata')
        ? 'Classe non autorizzata per questo item'
        : `Errore: ${error.message}`,
      'error'
    );
  }

  await loadEquipment(CUR.id);
  await syncBattleCharacter(CUR.id);
  await syncPowerLevel(CUR.id);

  playSound('equip');
  toast('Oggetto equipaggiato! ⚔️', 'success');
  renderVillage();
};






















// ── Filtri inventario ─────────────────────────────────────────
window._applyInvFilters = function() {
  const slot    = document.getElementById('inv-filter-slot')?.value    || '';
  const rarity  = document.getElementById('inv-filter-rarity')?.value  || '';
  const cls     = document.getElementById('inv-filter-class')?.value   || '';
  const sort    = document.getElementById('inv-filter-sort')?.value    || 'rarity';

  const rarityOrder = { mythic:5, legendary:4, epic:3, rare:2, uncommon:1, common:0 };
  const inv = DB.battleInventory?.[CUR.id] || [];

  let filtered = inv.map(entry => ({
    entry,
    item: entry.item || entry.battle_items || null
  })).filter(({ item }) => {
    if (!item) return false;
    if (slot   && item.slot !== slot) return false;
    if (rarity && item.rarity !== rarity) return false;
    if (cls    && !(item.class_restriction || []).includes(cls)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const ia = a.item, ib = b.item;
    if (sort === 'rarity')  return (rarityOrder[ib.rarity] || 0) - (rarityOrder[ia.rarity] || 0);
    if (sort === 'attack')  return (ib.bonus_attack  || 0) - (ia.bonus_attack  || 0);
    if (sort === 'defense') return (ib.bonus_defense || 0) - (ia.bonus_defense || 0);
    if (sort === 'hp')      return (ib.bonus_hp      || 0) - (ia.bonus_hp      || 0);
    if (sort === 'effect')  return (ib.effect_type ? 1 : 0) - (ia.effect_type ? 1 : 0);
    return 0;
  });

  const wrap = document.getElementById('inventory-list');
  if (!wrap) return;
  wrap.innerHTML = filtered.length
    ? filtered.map(({ entry, item }) => renderInventoryItem(entry, item, CUR.id)).join('')
    : '<div class="empty-state" style="padding:2rem">Nessun oggetto corrisponde ai filtri.</div>';
};

window._resetInvFilters = function() {
  ['inv-filter-slot','inv-filter-rarity','inv-filter-class','inv-filter-sort']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = id === 'inv-filter-sort' ? 'rarity' : ''; });
  window._applyInvFilters?.();
};

