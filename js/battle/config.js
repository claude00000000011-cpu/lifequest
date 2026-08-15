// ============================================================
// WORLD_DUNGEONS — config.js (sostituzione completa del blocco)
// ============================================================
// MODIFICHE RISPETTO ALLA VERSIONE PRECEDENTE:
//   1. _buildRooms ora accetta baseAtk e baseDef come parametri
//      espliciti — ATK e DEF nemici NON dipendono più dagli HP
//   2. Tutti i 17 dungeon hanno parametri ricalibrati sulla
//      simulazione integrata player+equip (generazioni G1-G9)
//   3. Bug fix: dungeon_09 aveva una } mancante
// ============================================================

function _buildRooms({ baseHp, hpScale, baseAtk, baseDef, baseGold, xpPerRoom, bossId }) {
  return Array.from({ length: 10 }, (_, i) => {
    const isBoss = i === 9;
    const hp  = Math.round(baseHp  * Math.pow(hpScale, i));
    const atk = Math.round(baseAtk * Math.pow(hpScale, i));   // scala uguale agli HP
    const def = Math.round(baseDef * (1 + i * 0.12));         // scala lineare +12%/stanza
    return {
      room:        i + 1,
      isBoss,
      enemyHp:     hp,
      enemyMaxHp:  hp,
      gold:        Math.round(baseGold  * (1 + i * 0.30)),
      xp:          Math.round(xpPerRoom * (1 + i * 0.25)),
      bossId:      isBoss ? bossId : null,
      enemyName:   isBoss ? `Boss: ${bossId.replace(/_/g, ' ')}` : `Nemico Stanza ${i + 1}`,
      enemyAttack: atk,
      enemyDef:    def,
    };
  });
}

export const WORLD_DUNGEONS = [
  {
    id: 'dungeon_01', name: 'Faro della Costa',
    mapX: 0.38, mapY: 0.56, requiredLevel: 1, theme: 'coastal',
    description: 'Un vecchio faro infestato da creature marine.',
    rooms: _buildRooms({ baseHp: 31,  baseAtk: 7,  baseDef: 1,  hpScale: 1.35, baseGold: 5,    xpPerRoom: 8,    bossId: 'sea_guardian'       }),
  },
  {
    id: 'dungeon_02', name: 'Porto Meridionale',
    mapX: 0.44, mapY: 0.64, requiredLevel: 3, theme: 'port',
    description: 'Contrabbandieri e mostri delle profondità controllano il porto.',
    rooms: _buildRooms({ baseHp: 35,  baseAtk: 7,  baseDef: 2,  hpScale: 1.40, baseGold: 12,   xpPerRoom: 18,   bossId: 'harbor_master'      }),
  },
  {
    id: 'dungeon_03', name: 'Isola Fortificata',
    mapX: 0.18, mapY: 0.67, requiredLevel: 6, theme: 'fortress',
    description: 'Una fortezza caduta in mano a mercenari corrotti.',
    rooms: _buildRooms({ baseHp: 26,  baseAtk: 12, baseDef: 2,  hpScale: 1.42, baseGold: 22,   xpPerRoom: 35,   bossId: 'iron_warden'        }),
  },
  {
    id: 'dungeon_04', name: "Villaggio sull'Isola",
    mapX: 0.22, mapY: 0.50, requiredLevel: 9, theme: 'village',
    description: 'Un villaggio maledetto dove i morti non restano tali.',
    rooms: _buildRooms({ baseHp: 33,  baseAtk: 15, baseDef: 4,  hpScale: 1.45, baseGold: 35,   xpPerRoom: 55,   bossId: 'village_elder'      }),
  },
  {
    id: 'dungeon_05', name: "Montagne dell'Isola",
    mapX: 0.27, mapY: 0.42, requiredLevel: 12, theme: 'mountain',
    description: 'Caverne profonde abitate da giganti di pietra.',
    rooms: _buildRooms({ baseHp: 27,  baseAtk: 15, baseDef: 4,  hpScale: 1.47, baseGold: 50,   xpPerRoom: 80,   bossId: 'stone_titan'        }),
  },
  {
    id: 'dungeon_06', name: 'Foresta Intricata',
    mapX: 0.34, mapY: 0.30, requiredLevel: 15, theme: 'forest',
    description: 'Una foresta antica dove gli alberi stessi sono nemici.',
    rooms: _buildRooms({ baseHp: 34,  baseAtk: 19, baseDef: 6,  hpScale: 1.50, baseGold: 70,   xpPerRoom: 115,  bossId: 'ancient_treant'     }),
  },
  {
    id: 'dungeon_07', name: 'Torre del Sentiero',
    mapX: 0.46, mapY: 0.42, requiredLevel: 18, theme: 'tower',
    description: 'Una torre di guardia occupata da stregoni ribelli.',
    rooms: _buildRooms({ baseHp: 32,  baseAtk: 18, baseDef: 6,  hpScale: 1.50, baseGold: 95,   xpPerRoom: 160,  bossId: 'tower_sentinel'     }),
  },
  {
    id: 'dungeon_08', name: 'Fortezza del Nord',
    mapX: 0.54, mapY: 0.18, requiredLevel: 22, theme: 'fortress',
    description: 'Fortezza di confine caduta dopo un assedio demoniaco.',
    rooms: _buildRooms({ baseHp: 44,  baseAtk: 25, baseDef: 10, hpScale: 1.52, baseGold: 130,  xpPerRoom: 220,  bossId: 'fortress_lord'      }),
  },
  {
    id: 'dungeon_09', name: 'Torre Settentrionale',
    mapX: 0.65, mapY: 0.20, requiredLevel: 26, theme: 'tower',
    description: 'Una torre ghiacciata con un guardiano immortale.',
    rooms: _buildRooms({ baseHp: 40,  baseAtk: 22, baseDef: 10, hpScale: 1.52, baseGold: 175,  xpPerRoom: 300,  bossId: 'frost_watcher'      }),
  },
  {
    id: 'dungeon_10', name: 'Castello della Capitale',
    mapX: 0.52, mapY: 0.46, requiredLevel: 30, theme: 'castle',
    description: 'Il castello reale, corrotto dall\'interno da un re ombra.',
    rooms: _buildRooms({ baseHp: 52,  baseAtk: 28, baseDef: 14, hpScale: 1.55, baseGold: 230,  xpPerRoom: 400,  bossId: 'capital_king'       }),
  },
  {
    id: 'dungeon_11', name: 'Vulcano Attivo',
    mapX: 0.60, mapY: 0.52, requiredLevel: 34, theme: 'volcano',
    description: 'Le profondità di un vulcano dove vive un demone del fuoco.',
    rooms: _buildRooms({ baseHp: 47,  baseAtk: 24, baseDef: 13, hpScale: 1.55, baseGold: 300,  xpPerRoom: 530,  bossId: 'magma_lord'         }),
  },
  {
    id: 'dungeon_12', name: "Oasi del Deserto",
    mapX: 0.78, mapY: 0.55, requiredLevel: 38, theme: 'desert',
    description: 'Sotto l\'oasi si nasconde un labirinto di sabbia e morte.',
    rooms: _buildRooms({ baseHp: 65,  baseAtk: 33, baseDef: 20, hpScale: 1.57, baseGold: 380,  xpPerRoom: 680,  bossId: 'sand_pharaoh'       }),
  },
  {
    id: 'dungeon_13', name: 'Lago Tropicale',
    mapX: 0.52, mapY: 0.72, requiredLevel: 42, theme: 'tropical',
    description: 'Acque cristalline che nascondono un\'idra millenaria.',
    rooms: _buildRooms({ baseHp: 60,  baseAtk: 28, baseDef: 17, hpScale: 1.57, baseGold: 470,  xpPerRoom: 860,  bossId: 'lagoon_hydra'       }),
  },
  {
    id: 'dungeon_14', name: 'Castello Meridionale',
    mapX: 0.50, mapY: 0.62, requiredLevel: 46, theme: 'castle',
    description: 'Il secondo castello, sede di un duca caduto nell\'oscurità.',
    rooms: _buildRooms({ baseHp: 77,  baseAtk: 36, baseDef: 27, hpScale: 1.60, baseGold: 570,  xpPerRoom: 1050, bossId: 'shadow_duke'        }),
  },
  {
    id: 'dungeon_15', name: 'Isole Fluttuanti Est',
    mapX: 0.80, mapY: 0.28, requiredLevel: 50, theme: 'floating',
    description: 'Isole nel cielo pattugliate da colossi di pietra e nuvole.',
    rooms: _buildRooms({ baseHp: 73,  baseAtk: 31, baseDef: 23, hpScale: 1.60, baseGold: 680,  xpPerRoom: 1280, bossId: 'sky_colossus'       }),
  },
  {
    id: 'dungeon_16', name: 'Isole Fluttuanti Ovest',
    mapX: 0.18, mapY: 0.22, requiredLevel: 55, theme: 'floating',
    description: 'Isole avvolte nel vuoto, dimora di un titano del nulla.',
    rooms: _buildRooms({ baseHp: 100, baseAtk: 43, baseDef: 35, hpScale: 1.62, baseGold: 820,  xpPerRoom: 1550, bossId: 'void_titan'         }),
  },
  {
    id: 'dungeon_17', name: 'Castello Fluttuante',
    mapX: 0.88, mapY: 0.18, requiredLevel: 60, theme: 'floating_castle',
    description: 'Il trono finale. Chi lo governa non è di questo mondo.',
    rooms: _buildRooms({ baseHp: 121, baseAtk: 48, baseDef: 43, hpScale: 1.65, baseGold: 1000, xpPerRoom: 1900, bossId: 'celestial_overlord'  }),
  },
];

// BOSS_DATA rimosso — ora gestito da Supabase (tabella boss_mechanics_data)
// Letto tramite loadEnemies() → DB.bossMechanics
