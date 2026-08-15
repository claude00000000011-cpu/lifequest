// ============================================================
// dungeon_battle.js — Modalità Storia: usa nemici reali dal DB
// ============================================================
import { DB } from '../db.js';
import { renderBattleResult } from './dungeon_map.js';

export function startDungeonBattle(containerEl, dungeon, room, player, playerLevel = 1, onContinue, onMap) {
  const enemy = buildEnemyForRoom(room, dungeon, playerLevel);

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
  const isBoss       = room.isBoss;

  // Usa direttamente i valori calibrati da WORLD_DUNGEONS/_buildRooms
  // Piccolo bonus se il player è sovra-livellato rispetto al dungeon (+2% per livello in eccesso, cap ×1.3)
  const levelExcess  = Math.max(0, playerLevel - dungeon.requiredLevel);
  const levelMult    = Math.min(1 + levelExcess * 0.02, 1.3);
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
// Stats da WORLD_DUNGEONS — già calibrate stanza per stanza
  const baseHp  = Math.floor(room.enemyHp     * levelMult);
  const baseAtk = Math.floor(room.enemyAttack * levelMult);
  const baseDef = Math.floor(room.enemyDef    * levelMult);
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
     tier:          Math.ceil((dungeonIndex + 1) / 2),
    already_scaled: true,
    attack_base:   baseAtk,
    defense_base:  baseDef,
    // Meccaniche boss da Supabase — null per nemici normali
    extraAbility:       bossMech?.extraAbility       || null,
    extraAbilityParams: bossMech ? { ...bossMech }   : {},
    description:        bossMech?.description        || null,
  };





  
}
