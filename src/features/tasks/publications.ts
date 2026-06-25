// Catalog of publications a task can be tagged with. The DB stores the
// slug string in `tasks.publication`; the picker UI reads name+thumbnail
// from here. Adding a new publication = drop an SVG in
// src/publications/Brands/ and add an entry below.

import annestiil from "@/publications/Brands/annestiil.svg";
import arileht from "@/publications/Brands/arileht.svg";
import arvamus from "@/publications/Brands/arvamus.svg";
import delfi from "@/publications/Brands/delfi.svg";
import delfisport from "@/publications/Brands/delfisport.svg";
import delfitv from "@/publications/Brands/delfitv.svg";
import eestiekspress from "@/publications/Brands/eestiekspress.svg";
import eestinaine from "@/publications/Brands/eestinaine.svg";
import ekkk from "@/publications/Brands/ekkk.svg";
import forte from "@/publications/Brands/forte.svg";
import geenius from "@/publications/Brands/geenius.svg";
import ilmateade from "@/publications/Brands/ilmateade.svg";
import kroonika from "@/publications/Brands/kroonika.svg";
import kultuur from "@/publications/Brands/kultuur.svg";
import lood from "@/publications/Brands/lood.svg";
import lp from "@/publications/Brands/lp.svg";
import maakodu from "@/publications/Brands/maakodu.svg";
import maaleht from "@/publications/Brands/maaleht.svg";
import moodnekodu from "@/publications/Brands/moodnekodu.svg";
import omamaitse from "@/publications/Brands/omamaitse.svg";
import perejakodu from "@/publications/Brands/perejakodu.svg";
import piletitasku from "@/publications/Brands/piletitasku.svg";
import retseptiveeb from "@/publications/Brands/retseptiveeb.svg";
import rusdelfi from "@/publications/Brands/rusdelfi.svg";
import tasku from "@/publications/Brands/tasku.svg";
import tervispluss from "@/publications/Brands/tervispluss.svg";

// Category is a free-form group label so other project kinds (products)
// can define their own groups; the marketing brand catalog uses "Delfi" /
// "Paper". Lookups + the active group order come from the catalog profile
// (see catalog.ts), not from these module-level constants.
export type PublicationCategory = string;

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
  { slug: "delfitv", name: "Delfi TV", category: "Delfi", thumbnail: delfitv },
  { slug: "rusdelfi", name: "RusDelfi", category: "Delfi", thumbnail: rusdelfi },
  { slug: "forte", name: "Forte", category: "Delfi", thumbnail: forte },
  { slug: "geenius", name: "Geenius", category: "Delfi", thumbnail: geenius },
  { slug: "kultuur", name: "Kultuur", category: "Delfi", thumbnail: kultuur },
  { slug: "ilmateade", name: "Ilmateade", category: "Delfi", thumbnail: ilmateade },
  { slug: "retseptiveeb", name: "Retseptiveeb", category: "Delfi", thumbnail: retseptiveeb },
  { slug: "lood", name: "Lood", category: "Delfi", thumbnail: lood },
  { slug: "ekkk", name: "EKKK", category: "Delfi", thumbnail: ekkk },
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
  { slug: "moodnekodu", name: "Moodne Kodu", category: "Paper", thumbnail: moodnekodu },
  { slug: "tervispluss", name: "Tervis Pluss", category: "Paper", thumbnail: tervispluss },
];

export const PUBLICATION_CATEGORIES: PublicationCategory[] = ["Delfi", "Paper"];
