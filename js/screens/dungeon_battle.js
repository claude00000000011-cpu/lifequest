// ============================================================
// dungeon_battle.js — Modalità Storia: usa nemici reali dal DB
// ============================================================
import { DB } from '../db.js';
import { renderBattleResult } from './dungeon_map.js';

export function startDungeonBattle(containerEl, dungeon, room, player, onContinue, onMap) {
  const enemy = buildEnemyForRoom(room, dungeon);

window._storyBattleResolve = (outcome, playerHpEnd) => {
    window._storyBattleResolve = null;
    if (outcome === 'win-back') {
      // Ha vinto ma vuole tornare alla mappa — salva progresso e mostra mappa
      onContinue(dungeon, null);
    } else {
      renderBattleResult(containerEl, dungeon, room, outcome, playerHpEnd, onContinue, onMap);
    }
    window._gotoTab?.('battle');
    window._switchVillageTab?.('dungeon_map');
  };

  import('./battle_screen.js').then(m => {
    m.renderBattleScreen?.(enemy, { storyMode: true });
  });

  window._gotoTab?.('battle');
}

function buildEnemyForRoom(room, dungeon, playerLevel = 1) {
  const dungeonIndex = parseInt(dungeon.id.replace('dungeon_', ''), 10) - 1;
  const roomIndex    = room.room - 1;
  const tier         = Math.ceil((dungeonIndex + 1) / 4) + 1;
  const CONFIGS = [
    { minLevel:1,  hpBase:120, atkBase:14, defBase:8,  bossHpMult:3.0, bossAtkMult:1.6, scalingPerLevel:0.04 },
    { minLevel:10, hpBase:200, atkBase:22, defBase:15, bossHpMult:3.0, bossAtkMult:1.8, scalingPerLevel:0.04 },
    { minLevel:20, hpBase:350, atkBase:36, defBase:24, bossHpMult:3.2, bossAtkMult:2.0, scalingPerLevel:0.04 },
    { minLevel:35, hpBase:580, atkBase:58, defBase:36, bossHpMult:3.5, bossAtkMult:2.2, scalingPerLevel:0.04 },
    { minLevel:50, hpBase:850, atkBase:90, defBase:35, bossHpMult:3.5, bossAtkMult:2.5, scalingPerLevel:0.035 },
  ];
  const config   = CONFIGS[Math.min(dungeonIndex, CONFIGS.length - 1)];
  const scaling  = 1 + Math.max(0, playerLevel - config.minLevel) * config.scalingPerLevel;
  const roomMult = 1 + roomIndex * 0.18;
  const isBoss   = room.isBoss;
  const bossMultH = isBoss ? config.bossHpMult    : 1;
  const bossMultA = isBoss ? config.bossAtkMult   : 1;

  const isBoss = room.isBoss;

  // Icone temporanee per tipo nemico — verranno sostituite con gif reali
  const ENEMY_ICONS = [
    { name: 'Slime',            loop_gif: '/lifequest/assets/battle/enemies/slime_loop.gif',              attack_gif: '/lifequest/assets/battle/enemies/slime_attack.gif'              },
    { name: 'Goblin',           loop_gif: '/lifequest/assets/battle/enemies/goblin_loop.gif',             attack_gif: '/lifequest/assets/battle/enemies/goblin_attack.gif'             },
    { name: 'Lupo Selvatico',   loop_gif: '/lifequest/assets/battle/enemies/wolf_loop.gif',               attack_gif: '/lifequest/assets/battle/enemies/wolf_attack.gif'               },
    { name: 'Scheletro',        loop_gif: '/lifequest/assets/battle/enemies/skeleton_loop.gif',           attack_gif: '/lifequest/assets/battle/enemies/skeleton_attack.gif'           },
    { name: 'Orco',             loop_gif: '/lifequest/assets/battle/enemies/orc_loop.gif',                attack_gif: '/lifequest/assets/battle/enemies/orc_attack.gif'                },
    { name: 'Elementale Fuoco', loop_gif: '/lifequest/assets/battle/enemies/fire_elemental_loop.gif',     attack_gif: '/lifequest/assets/battle/enemies/fire_elemental_attack.gif'     },
    { name: 'Elementale Ghiaccio', loop_gif: '/lifequest/assets/battle/enemies/ice_elemental_loop.gif',  attack_gif: '/lifequest/assets/battle/enemies/ice_elemental_attack.gif'      },
    { name: 'Assassino Ombra',  loop_gif: '/lifequest/assets/battle/enemies/shadow_assassin_loop.gif',   attack_gif: '/lifequest/assets/battle/enemies/shadow_assassin_attack.gif'    },
    { name: 'Cavaliere Oscuro', loop_gif: '/lifequest/assets/battle/enemies/dark_knight_loop.gif',       attack_gif: '/lifequest/assets/battle/enemies/dark_knight_attack.gif'        },
  ];

  const BOSS_ICONS = [
    { name: 'Re Goblin',    loop_gif: '/lifequest/assets/battle/bosses/goblin_loop.gif', attack_gif: '/lifequest/assets/battle/bosses/goblin_attack.gif' },
    { name: 'Re degli Orchi', loop_gif: '/lifequest/assets/battle/bosses/orc_loop.gif', attack_gif: '/lifequest/assets/battle/bosses/orc_attack.gif'    },
    { name: 'Drago Minore', loop_gif: '/lifequest/assets/battle/bosses/drago_loop.gif',  attack_gif: '/lifequest/assets/battle/bosses/drago_attack.gif'  },
  ];

  // Scegli icona in base alla stanza (ciclica)
  const pool  = isBoss ? BOSS_ICONS : ENEMY_ICONS;
  const icon  = pool[(dungeonIndex + roomIndex) % pool.length];

  // Stats base scalate
const baseHp  = Math.floor(config.hpBase  * bossMultH * scaling * roomMult);
  const baseAtk = Math.floor(config.atkBase * bossMultA * scaling * roomMult);
  const baseDef = Math.floor(config.defBase * scaling   * roomMult);
  const baseSpd = Math.round(5 + roomIndex * 0.3);

 // Legge meccaniche boss da Supabase (DB.bossMechanics) invece che da config.js
  const bossMech = (isBoss && room.bossId && DB.bossMechanics)
    ? DB.bossMechanics[room.bossId] || null
    : null;

  return {
    name:        isBoss ? `👑 ${icon.name}` : icon.name,
    hp_base:     baseHp,
    attack:      baseAtk,
    defense:     baseDef,
    speed:       baseSpd,
    xp_reward:   room.xp,
    gold_reward: room.gold,
    is_boss:     isBoss,
    loop_gif:    icon.loop_gif,
    attack_gif:  icon.attack_gif,
    icon_path:   null,
    tier:        Math.ceil(dungeonIndex / 4) + 1,
    // Meccaniche boss da Supabase — null per nemici normali
    extraAbility:       bossMech?.extraAbility       || null,
    extraAbilityParams: bossMech ? { ...bossMech }   : {},
    description:        bossMech?.description        || null,
  };





  
}
