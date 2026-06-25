// Catalog of "products" a task can be tagged with in a `product`-kind
// project (e.g. Tootedisain). Mirrors the brand catalog shape so the same
// picker/row/filter code renders both — the active catalog is selected per
// project from its `kind` (see catalog.ts). Add a product = drop an SVG in
// src/publications/Tootedisain/ and add an entry below.

import { type Publication } from "./publications";

import delfi from "@/publications/Tootedisain/delfi.svg";
import delfiApp from "@/publications/Tootedisain/delfi-app.svg";
import geenius from "@/publications/Tootedisain/geenius.svg";
import iseteenindus from "@/publications/Tootedisain/iseteenindus.svg";
import piletitasku from "@/publications/Tootedisain/piletitasku.svg";
import retseptiveeb from "@/publications/Tootedisain/retseptiveeb.svg";
import rmp from "@/publications/Tootedisain/rmp.svg";
import sisetooriist from "@/publications/Tootedisain/sisetooriist.svg";
import siseveeb from "@/publications/Tootedisain/siseveeb.svg";
import tasku from "@/publications/Tootedisain/tasku.svg";

// Single category — products render as a flat list (the picker omits the
// group header when a profile has at most one category). The label is only
// surfaced in the cross-project "My tasks" filter, where products group
// under it alongside the Delfi/Paper brand groups.
export const PRODUCT_CATEGORY = "Tooted";

export const PRODUCTS: Publication[] = [
  { slug: "delfi", name: "Delfi", category: PRODUCT_CATEGORY, thumbnail: delfi },
  { slug: "delfi-app", name: "Delfi App", category: PRODUCT_CATEGORY, thumbnail: delfiApp },
  { slug: "geenius", name: "Geenius", category: PRODUCT_CATEGORY, thumbnail: geenius },
  { slug: "tasku", name: "Tasku", category: PRODUCT_CATEGORY, thumbnail: tasku },
  { slug: "piletitasku", name: "Piletitasku", category: PRODUCT_CATEGORY, thumbnail: piletitasku },
  { slug: "retseptiveeb", name: "Retseptiveeb", category: PRODUCT_CATEGORY, thumbnail: retseptiveeb },
  { slug: "iseteenindus", name: "Iseteenindus", category: PRODUCT_CATEGORY, thumbnail: iseteenindus },
  { slug: "siseveeb", name: "Siseveeb", category: PRODUCT_CATEGORY, thumbnail: siseveeb },
  { slug: "sisetooriist", name: "Sisetööriist", category: PRODUCT_CATEGORY, thumbnail: sisetooriist },
  { slug: "rmp", name: "RMP", category: PRODUCT_CATEGORY, thumbnail: rmp },
];
