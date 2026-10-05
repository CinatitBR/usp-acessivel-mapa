import { type IndoorPlan, ROOM_CATEGORIES, type RoomCategory } from '../../../src/domain/indoor';
import { type BuildingFrame, buildingToMap } from './frame';
import type { Point } from './svgPaths';

type Extent = [x1: number, y1: number, x2: number, y2: number];

/** data/indoor/<building>/source.json: where the building's axes sit on the map, and its floors. */
export type IndoorSource = BuildingFrame & {
  building: string;
  credit: string;
  defaultLevel: number;
  sheets: {
    level: number;
    name: string;
    elevations: string;
    /** The floor's box in metres on the building's axes, when it is smaller than the building. */
    floor?: Extent;
  }[];
};

/** data/indoor/<building>/walls.json: per level, x1, y1, x2, y2 of every wall line, on the building's axes. */
export type IndoorWalls = { unit: 'cm'; levels: Record<string, number[]> };

/**
 * data/indoor/<building>/rooms.json, curated by hand: rooms in metres on the building's axes,
 * each a `box` or a `ring` of corners, in drawing order.
 */
export type IndoorRooms = {
  unit: 'm';
  rooms: { level: number; name: string; cat: string; box?: Extent; ring?: Point[] }[];
};

/** How far outside the building's box a room may reach, in metres: the drawing is not exact. */
const ROOM_TOLERANCE = 0.5;

/** Area of a ring in square metres, by the shoelace formula. */
function ringArea(ring: Point[]): number {
  let twice = 0;
  ring.forEach(([x, y], index) => {
    const [nextX, nextY] = ring[(index + 1) % ring.length]!;
    twice += x * nextY - nextX * y;
  });
  return Math.abs(twice) / 2;
}

const CENTIMETERS = 100;
/** 1 cm on the ground: the two faces of a thin wall must stay apart. */
const DECIMALS = 7;

const round = (value: number) => Number(value.toFixed(DECIMALS));

/** The published indoor plan of a building: floors, slabs and walls in map coordinates. */
export function buildIndoorPlan(source: IndoorSource, walls: IndoorWalls, rooms: IndoorRooms = { unit: 'm', rooms: [] }): IndoorPlan {
  const { toLngLat } = buildingToMap(source);
  const place = (point: Point): Point => {
    const [lng, lat] = toLngLat(point);
    return [round(lng), round(lat)];
  };
  const [width, depth] = source.size;
  const levels = [...source.sheets].sort((a, b) => a.level - b.level);
  if (!levels.some(({ level }) => level === source.defaultLevel)) throw new Error(`Default level ${source.defaultLevel} is not one of the floors`);

  // The plan's "up" runs from the far side of the box (y = depth) to its origin side.
  const [from, to] = [toLngLat([0, depth]), toLngLat([0, 0])];
  const east = (to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180);
  const bearing = (Math.atan2(east, to[1] - from[1]) * 180) / Math.PI;

  return {
    building: source.building,
    credit: source.credit,
    defaultLevel: source.defaultLevel,
    bearing: Math.round(((bearing + 540) % 360) - 180),
    center: place([width / 2, depth / 2]),
    size: source.size,
    levels: levels.map(({ level, name, elevations }) => ({ id: level, name, elevations })),
    slabs: {
      type: 'FeatureCollection',
      features: levels.map(({ level, floor: [x1, y1, x2, y2] = [0, 0, width, depth] }) => ({
        type: 'Feature',
        properties: { level },
        geometry: { type: 'Polygon', coordinates: [([[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]] as Point[]).map(place)] },
      })),
    },
    walls: {
      type: 'FeatureCollection',
      features: levels.map(({ level }) => {
        const values = walls.levels[level];
        if (!values || values.length % 4 !== 0) throw new Error(`walls.json has no usable lines for level ${level}`);
        const lines: Point[][] = [];
        for (let index = 0; index < values.length; index += 4) {
          const [x1, y1, x2, y2] = values.slice(index, index + 4).map((value) => value / CENTIMETERS) as Extent;
          lines.push([place([x1, y1]), place([x2, y2])]);
        }
        return { type: 'Feature', properties: { level }, geometry: { type: 'MultiLineString', coordinates: lines } };
      }),
    },
    rooms: {
      type: 'FeatureCollection',
      features: rooms.rooms.map(({ level, name, cat, box, ring: corners }, index) => {
        const where = `Room ${index + 1} (${name}, level ${level})`;
        if (!levels.some((sheet) => sheet.level === level)) throw new Error(`${where} is on a floor the building does not have`);
        if (!ROOM_CATEGORIES.includes(cat as RoomCategory)) throw new Error(`${where} has an unknown category: ${cat}`);
        if (!name.trim()) throw new Error(`${where} has no name`);
        if ((box === undefined) === (corners === undefined)) throw new Error(`${where} needs either a box or a ring`);
        const ring: Point[] = box ? [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]] : corners!;
        if (ring.length < 3 || ringArea(ring) < 0.5) throw new Error(`${where} is not a polygon`);
        if (ring.some(([x, y]) => x < -ROOM_TOLERANCE || y < -ROOM_TOLERANCE || x > width + ROOM_TOLERANCE || y > depth + ROOM_TOLERANCE)) {
          throw new Error(`${where} reaches outside the building`);
        }
        return {
          type: 'Feature',
          properties: { id: `room/${index + 1}`, level, name, cat: cat as RoomCategory, area: Math.round(ringArea(ring)) },
          geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]!].map(place)] },
        };
      }),
    },
  };
}
