// Fictional placeholder data used until a Qloo key is set. Every name here is made up.
import type { EntityType, QlooEntity } from "./qloo";

const SAMPLE: Record<EntityType, QlooEntity[]> = {
  "urn:entity:book": [
    { id: "sample-book-1", name: "The Salt Orchard", affinity: 0.91, popularity: 0.42 },
    { id: "sample-book-2", name: "Lanterns Over Kestrel Bay", affinity: 0.88, popularity: 0.37 },
    { id: "sample-book-3", name: "A Small Inheritance of Storms", affinity: 0.84, popularity: 0.55 },
    { id: "sample-book-4", name: "The Glasshouse Year", affinity: 0.79, popularity: 0.97 },
    { id: "sample-book-5", name: "Night Ferry to Corran", affinity: 0.76, popularity: 0.31 },
    { id: "sample-book-6", name: "What the River Kept", affinity: 0.72, popularity: 0.28 },
  ],
  "urn:entity:person": [
    { id: "sample-author-1", name: "Mara Ellison", affinity: 0.9, popularity: 0.4 },
    { id: "sample-author-2", name: "Theo Varga", affinity: 0.85, popularity: 0.35 },
    { id: "sample-author-3", name: "June Okafor", affinity: 0.81, popularity: 0.96 },
    { id: "sample-author-4", name: "Iris Calloway", affinity: 0.77, popularity: 0.3 },
  ],
  "urn:entity:podcast": [
    { id: "sample-pod-1", name: "Margins & Mysteries", affinity: 0.89 },
    { id: "sample-pod-2", name: "The Slow Shelf", affinity: 0.83 },
    { id: "sample-pod-3", name: "Coastal Ghost Stories", affinity: 0.78 },
  ],
  "urn:entity:tv_show": [
    { id: "sample-tv-1", name: "Harbour Lights", affinity: 0.87 },
    { id: "sample-tv-2", name: "The Keeper's Daughter", affinity: 0.82 },
    { id: "sample-tv-3", name: "Low Tide", affinity: 0.76 },
  ],
  "urn:entity:movie": [
    { id: "sample-film-1", name: "The Quiet Season", affinity: 0.84 },
    { id: "sample-film-2", name: "Saltwater Letters", affinity: 0.8 },
  ],
  "urn:entity:artist": [
    { id: "sample-artist-1", name: "The Fen Lanterns", affinity: 0.81 },
    { id: "sample-artist-2", name: "Ada Merrow", affinity: 0.77 },
  ],
  "urn:entity:brand": [
    { id: "sample-brand-1", name: "Tidewater Tea Co.", affinity: 0.79 },
    { id: "sample-brand-2", name: "Inkwell Stationers", affinity: 0.74 },
  ],
  "urn:entity:destination": [
    { id: "sample-dest-1", name: "Portland, Maine", affinity: 0.88 },
    { id: "sample-dest-2", name: "Edinburgh", affinity: 0.84 },
    { id: "sample-dest-3", name: "Asheville", affinity: 0.8 },
    { id: "sample-dest-4", name: "Halifax", affinity: 0.77 },
  ],
};

export function sampleSearch(query: string, type: EntityType): QlooEntity[] {
  const id = `sample-${type.split(":").pop()}-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return [{ id, name: query, type, popularity: 0.5 }];
}

export function sampleInsights(type: EntityType): QlooEntity[] {
  return SAMPLE[type] ?? [];
}
