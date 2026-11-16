// The opening grid on the test homepage (/home-grid): which projects appear, in
// what order, and how each one's full picture fits the grid when it's revealed.
// Each project's square is public/images/portfolio/opening/tile-<slug>.webp, a crop
// of its single most telling detail. Title, category and the full picture come
// from the project's own content file.
//
// fit: 'cover' fills the grid and trims the edges (art, photos);
//      'contain' shows the whole picture on white (products shot on white).
// focus: which part to keep when trimming, 0–1 across and down.

export interface OpeningSquare {
  slug: string;
  name: string;
  fit: 'cover' | 'contain';
  focus: [number, number];
}

export const openingSquares: OpeningSquare[] = [
  { slug: "pabst-blue-ribbon-light", name: "Pabst Blue Ribbon Light", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "connie-portrait", name: "Connie", fit: 'cover', focus: [0.5, 0.3] },
  { slug: "artists-are-jerks", name: "Artists Are Jerks", fit: 'cover', focus: [0.5, 0.5] },
  { slug: "java-jacket-logo", name: "Java Jacket", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "2023-winemaking-handbook-cover", name: "Scott Labs 2023", fit: 'cover', focus: [0.5, 0.55] },
  { slug: "petsmart-gift-card-carrier-sets", name: "PetSmart", fit: 'cover', focus: [0.5, 0.6] },
  { slug: "alan-just-self-portrait", name: "Self Portrait", fit: 'cover', focus: [0.5, 0.3] },
  { slug: "lone-star-beer-label-design", name: "Lone Star", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "2022-cidermaking-handbook", name: "Cidermaking", fit: 'cover', focus: [0.5, 0.4] },
  { slug: "petes-head", name: "Pete Ihrig", fit: 'cover', focus: [0.5, 0.35] },
  { slug: "old-style-beer-cubs-ivy-can", name: "Old Style", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "wolfermans-be-merry-gift-tin", name: "Wolferman's", fit: 'cover', focus: [0.5, 0.5] },
  { slug: "paul-missal-portrait", name: "Paul Missal", fit: 'cover', focus: [0.5, 0.4] },
  { slug: "petsmarts-simply-nourish-source-petfood-packaging", name: "Simply Nourish", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "tempus-cellars-wine-labels", name: "Tempus Cellars", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "pose-pacer", name: "Pose Pacer", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "waldeaux-smithie-waldette-wine-labels", name: "Forgeron Cellars", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "breyers-gelato-style-ice-cream-concepts", name: "Soft Scoop", fit: 'cover', focus: [0.5, 0.5] },
  { slug: "harry-david-gift-tower-concept", name: "Harry & David", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "old-milwaukee-sweepstakes", name: "Old Milwaukee", fit: 'cover', focus: [0.5, 0.5] },
  { slug: "hidden-grammar-of-art", name: "Hidden Grammar", fit: 'cover', focus: [0.5, 0.4] },
  { slug: "colt-premium-beer-identity", name: "Colt Premium", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "phil-bradfield-portrait", name: "Phil Bradfield", fit: 'cover', focus: [0.5, 0.35] },
  { slug: "scott-lab-fermentation-handbook-the-game-of-wine", name: "The Game of Wine", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "harry-david-cocktail-mixers", name: "H&D Mixers", fit: 'cover', focus: [0.5, 0.45] },
  { slug: "anvil-by-forgeron-cellars", name: "Anvil", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "scott-lab-fermentation-handbook-celebrating-75-years-of-character", name: "75 Years of Character", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "wolfermans-holiday-tote-and-muffin-labels", name: "Wolferman's Tote", fit: 'cover', focus: [0.5, 0.45] },
  { slug: "pbr-light-concept", name: "PBR Light Concept", fit: 'contain', focus: [0.5, 0.5] },
  { slug: "grammar-of-things", name: "Grammar of Things", fit: 'cover', focus: [0.5, 0.3] },
  { slug: "scott-lab-fermentation-2009-handbook", name: "Scott Labs 2009", fit: 'contain', focus: [0.5, 0.5] },
];
