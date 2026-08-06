// "use server" dosyaları (horse-pedigree.actions.ts) yalnız async fonksiyon export edebilir —
// tip tanımları bu yüzden ayrı, sunucu-eylemi olmayan bir dosyada tutulur.
export type PedigreeAncestor = { name: string; year: number | null; note: string | null } | null;

export type PedigreeTree = {
  sire: PedigreeAncestor; dam: PedigreeAncestor;
  sireSire: PedigreeAncestor; sireDam: PedigreeAncestor;
  damSire: PedigreeAncestor; damDam: PedigreeAncestor;
  sireSireSire: PedigreeAncestor; sireSireDam: PedigreeAncestor;
  sireDamSire: PedigreeAncestor; sireDamDam: PedigreeAncestor;
  damSireSire: PedigreeAncestor; damSireDam: PedigreeAncestor;
  damDamSire: PedigreeAncestor; damDamDam: PedigreeAncestor;
};
