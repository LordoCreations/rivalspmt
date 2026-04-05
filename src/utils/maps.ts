export interface Map {
  gameMode: string;
  id: string;
  name: string;
  mapIds: number[];
}

export const MAPS: Map[] = [
  {
    id: "hall-of-djalia",
    name: "Hall of Djalia",
    mapIds: [1035, 1099, 1101, 1255, 1267],
    gameMode: "Convergence",
  },
  {
    id: "symbiotic-surface",
    name: "Symbiotic Surface",
    mapIds: [1096, 1109, 1110, 1214, 1240, 1285, 1290],
    gameMode: "Convergence",
  },
  {
    id: "shin-shibuya",
    name: "Shin-Shibuya",
    mapIds: [
      1021, 1034, 1098, 1104, 1106, 1122, 1133, 1140, 1151, 1152, 1153, 1160,
      1164, 1187, 1203, 1215, 1228, 1230, 1238, 1250, 1251, 1252, 1253, 1266,
    ],
    gameMode: "Convergence",
  },
  {
    id: "central-park",
    name: "Central Park",
    mapIds: [1111, 1217, 1223, 1242, 1292],
    gameMode: "Convergence",
  },
  {
    id: "celestial-husk",
    name: "Celestial Husk",
    mapIds: [1317, 1318],
    gameMode: "Domination",
  },
  {
    id: "hells-heaven",
    name: "Hell's Heaven",
    mapIds: [1287, 1288],
    gameMode: "Domination",
  },
  {
    id: "birnin-tchalla",
    name: "Birnin T'Challa",
    mapIds: [1108, 1235, 1272, 1302],
    gameMode: "Domination",
  },
  {
    id: "royal-palace",
    name: "Royal Palace",
    mapIds: [1070, 1170, 1236, 1360],
    gameMode: "Domination",
  },
  {
    id: "krakoa",
    name: "Krakoa",
    mapIds: [1309, 1310],
    gameMode: "Domination",
  },
  {
    id: "yggdrasill-path",
    name: "Yggdrasill Path",
    mapIds: [
      1003, 1018, 1032, 1095, 1125, 1126, 1127, 1131, 1138, 1190, 1202, 1229,
      1231, 1262, 1370,
    ],
    gameMode: "Convoy",
  },
  {
    id: "spider-islands",
    name: "Spider-Islands",
    mapIds: [
      1105, 1107, 1113, 1119, 1120, 1134, 1141, 1148, 1157, 1158, 1159, 1237,
      1245, 1264, 1305, 1306, 1350,
    ],
    gameMode: "Convoy",
  },
  {
    id: "midtown",
    name: "Midtown",
    mapIds: [1112, 1201, 1224, 1291],
    gameMode: "Convoy",
  },
  {
    id: "arakko",
    name: "Arakko",
    mapIds: [1248, 1286, 1311],
    gameMode: "Convoy",
  },
  {
    id: "heart-of-heaven",
    name: "Heart of Heaven",
    mapIds: [2042],
    gameMode: "Convergence",
  },
  {
    id: "museum-of-contemplation",
    name: "Museum of Contemplation",
    mapIds: [1418],
    gameMode: "Convoy",
  },
];

export function idToMap(id: number): Map {
  for (let map of MAPS) {
    if (map.mapIds.includes(id)) {
      return map;
    }
  }

  throw new Error(`Map with ID ${id} not found`);
}
