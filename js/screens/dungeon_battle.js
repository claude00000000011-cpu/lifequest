// ============================================================
// dungeon_battle.js — Modalità Storia: usa nemici reali dal DB
// ============================================================
import { BOSS_DATA } from '../battle/config.js';
import { renderBattleResult } from './dungeon_map.js';

export function startDungeonBattle(containerEl, dungeon, room, player, onContinue, onMap) {
  const enemy = buildEnemyForRoom(room, dungeon);

  window._storyBattleResolve = (outcome, playerHpEnd) => {
    window._storyBattleResolve = null;
    renderBattleResult(containerEl, dungeon, room, outcome, playerHpEnd, onContinue, onMap);
    // Torna alla schermata villaggio/storia
    window._gotoTab?.('battle');
    window._switchVillageTab?.('dungeon_map');
  };

  import('./battle_screen.js').then(m => {
    m.renderBattleScreen?.(enemy, { storyMode: true });
  });

  window._gotoTab?.('battle');
}

function buildEnemyForRoom(room, dungeon) {
  // Scala i nemici del DB in base alla stanza (1-10) e al dungeon (1-17)
  const dungeonIndex = parseInt(dungeon.id.replace('dungeon_', ''), 10) - 1;
  const roomIndex    = room.room - 1; // 0-9
  const scale        = 1 + dungeonIndex * 0.4 + roomIndex * 0.15;

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
  const baseHp  = Math.round(30  * scale);
  const baseAtk = Math.round(6   * scale);
  const baseDef = Math.round(2   * scale);
  const baseSpd = Math.round(5   + roomIndex * 0.3);

  return {
    // Campi richiesti da renderBattleScreen / initBattle
    name:       isBoss ? `👑 ${icon.name}` : icon.name,
    hp_base:    baseHp,
    attack:     baseAtk,
    defense:    baseDef,
    speed:      baseSpd,
    xp_reward:  room.xp,
    gold_reward: room.gold,
    is_boss:    isBoss,
    loop_gif:   icon.loop_gif,
    attack_gif: icon.attack_gif,
    icon_path:  null,
    tier:       Math.ceil(dungeonIndex / 4) + 1,
  };
}
