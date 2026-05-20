// Catalog of publications a task can be tagged with. The DB stores the
// slug string in `tasks.publication`; the picker UI reads name+thumbnail
// from here. Adding a new publication = drop a PNG in src/Publications/
// <Category>/ and add an entry below.

import arileht from "@/publications/Delfi/arileht.png";
import arvamus from "@/publications/Delfi/arvamus.png";
import delfi from "@/publications/Delfi/delfi.png";
import delfisport from "@/publications/Delfi/delfisport.png";
import geenius from "@/publications/Delfi/geenius.png";
import kultuur from "@/publications/Delfi/kultuur.png";
import piletitasku from "@/publications/Delfi/piletitasku.png";
import tasku from "@/publications/Delfi/tasku.png";

import annestiil from "@/publications/Paper/annestiil.png";
import eestiekspress from "@/publications/Paper/eestiekspress.png";
import eestinaine from "@/publications/Paper/eestinaine.png";
import kroonika from "@/publications/Paper/kroonika.png";
import lp from "@/publications/Paper/lp.png";
import maakodu from "@/publications/Paper/maakodu.png";
import maaleht from "@/publications/Paper/maaleht.png";
import omamaitse from "@/publications/Paper/omamaitse.png";
import perejakodu from "@/publications/Paper/perejakodu.png";

import elamus from "@/publications/Events/elamus.png";

export type PublicationCategory = "Delfi" | "Paper" | "Events";

export type Publication = {
  slug: string;
  name: string;
  category: PublicationCategory;
  thumbnail: string;
};

export const PUBLICATIONS: Publication[] = [
  { slug: "delfi", name: "Delfi", category: "Delfi", thumbnail: delfi },
  { slug: "arileht", name: "Ärileht", category: "Delfi", thumbnail: arileht },
  { slug: "arvamus", name: "Arvamus", category: "Delfi", thumbnail: arvamus },
  { slug: "delfisport", name: "Delfi Sport", category: "Delfi", thumbnail: delfisport },
  { slug: "geenius", name: "Geenius", category: "Delfi", thumbnail: geenius },
  { slug: "kultuur", name: "Kultuur", category: "Delfi", thumbnail: kultuur },
  { slug: "tasku", name: "Tasku", category: "Delfi", thumbnail: tasku },
  { slug: "piletitasku", name: "Piletitasku", category: "Delfi", thumbnail: piletitasku },

  { slug: "eestiekspress", name: "Eesti Ekspress", category: "Paper", thumbnail: eestiekspress },
  { slug: "maaleht", name: "Maaleht", category: "Paper", thumbnail: maaleht },
  { slug: "lp", name: "LP", category: "Paper", thumbnail: lp },
  { slug: "kroonika", name: "Kroonika", category: "Paper", thumbnail: kroonika },
  { slug: "eestinaine", name: "Eesti Naine", category: "Paper", thumbnail: eestinaine },
  { slug: "annestiil", name: "Anne & Stiil", category: "Paper", thumbnail: annestiil },
  { slug: "perejakodu", name: "Pere ja Kodu", category: "Paper", thumbnail: perejakodu },
  { slug: "maakodu", name: "Maakodu", category: "Paper", thumbnail: maakodu },
  { slug: "omamaitse", name: "Oma Maitse", category: "Paper", thumbnail: omamaitse },

  { slug: "elamus", name: "Elamus", category: "Events", thumbnail: elamus },
];

export const PUBLICATION_CATEGORIES: PublicationCategory[] = ["Delfi", "Paper", "Events"];

export function getPublication(slug: string | null | undefined): Publication | undefined {
  if (!slug) return undefined;
  return PUBLICATIONS.find((p) => p.slug === slug);
}
