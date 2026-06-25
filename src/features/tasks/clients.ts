// Catalog of advertising clients for `reklaam` projects. Unlike brands /
// products these have no logo assets in the repo, so entries omit
// `thumbnail` and render a neutral placeholder (see BrandThumb). To add
// logos later, drop SVGs in src/publications/Klient/ and set `thumbnail`
// per entry — the rest of the picker/row/filter code already handles it.

import { type Publication } from "./publications";

export const CLIENT_CATEGORY = "Kliendid";

export const CLIENTS: Publication[] = [
  { slug: "denim-dream",   name: "Denim Dream",   category: CLIENT_CATEGORY },
  { slug: "autopay",       name: "Autopay",       category: CLIENT_CATEGORY },
  { slug: "tartu-ulikool", name: "Tartu Ülikool", category: CLIENT_CATEGORY },
  { slug: "pangaliit",     name: "Pangaliit",     category: CLIENT_CATEGORY },
  { slug: "247-fitness",   name: "24/7 Fitness",  category: CLIENT_CATEGORY },
  { slug: "tele2",         name: "Tele2",         category: CLIENT_CATEGORY },
  { slug: "swedbank",      name: "Swedbank",      category: CLIENT_CATEGORY },
  { slug: "luminor",       name: "Luminor",       category: CLIENT_CATEGORY },
  { slug: "synlab",        name: "Synlab",        category: CLIENT_CATEGORY },
  { slug: "seesam",        name: "Seesam",        category: CLIENT_CATEGORY },
  { slug: "erimell",       name: "Erimell",       category: CLIENT_CATEGORY },
  { slug: "storytel",      name: "Storytel",      category: CLIENT_CATEGORY },
  { slug: "samsung",       name: "Samsung",       category: CLIENT_CATEGORY },
  { slug: "lyfery",        name: "Lyfery",        category: CLIENT_CATEGORY },
  { slug: "viasat",        name: "Viasat",        category: CLIENT_CATEGORY },
  { slug: "muu",           name: "Muu",           category: CLIENT_CATEGORY },
];
