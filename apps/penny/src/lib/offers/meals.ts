// Ingredients (with offer-matching keywords) and family dinner recipes, 4 servings, amounts in kg (litres for liquids).
import type { Ingredient, Recipe } from "./index";

export const INGREDIENTS: Ingredient[] = [
  { id: "oksekod", label: "Hakket oksekød", query: "hakket oksekød", include: ["oksekød"], exclude: ["grønt", "kødboller"], basePricePerKg: 110 },
  { id: "svinekod", label: "Hakket gris/kalv", query: "hakket grisekød", include: ["grisekød", "grise- og kalvekød", "grise/kalvekød", "grise/ kalvekød", "svinekød"], basePricePerKg: 70 },
  { id: "kylling", label: "Kylling", query: "kylling", include: ["kylling"], exclude: ["nuggets", "chunks", "strips", "strimler", "vinger", "wings", "spyd", "poussin", "marked", "kødboller", "oksekød", "kæmpeposen"], basePricePerKg: 90 },
  { id: "laks", label: "Laks", query: "laks", include: ["laks"], exclude: ["røget", "gravad", "rejer", "julefrokost", "tartelet", "røræg", "sockeye", "indbagt"], basePricePerKg: 180 },
  { id: "pasta", label: "Pasta", query: "pasta", include: ["pasta", "spaghetti", "fusilli", "penne", "farfalle", "tortiglioni", "fettuccine"], exclude: ["fyldt", "tortelloni", "ravioli", "lasagne", "færdigret", "squash", "børnemad"], basePricePerKg: 20 },
  { id: "ris", label: "Ris", query: "ris", include: ["jasminris", "basmati", "parboiled", "langkornet"], basePricePerKg: 25 },
  { id: "kartofler", label: "Kartofler", query: "kartofler", include: ["kartofler"], exclude: ["fløde", "menu", "gratin", "røsti", "spegepølse", "smoothie", "middagsretter", "suppe"], basePricePerKg: 15 },
  { id: "gulerodder", label: "Gulerødder", query: "gulerødder", include: ["gulerødder", "gulerod", "orangerødder"], exclude: ["menu", "rugbrød", "snack"], basePricePerKg: 12 },
  { id: "log", label: "Løg", query: "løg", include: ["løg"], exclude: ["forårsløg", "porre", "frikadeller", "hvidløg", "løgringe", "løgismose"], basePricePerKg: 12 },
  { id: "tomater", label: "Hakkede tomater", query: "hakkede tomater", include: ["hakkede tomater", "polpa", "flåede", "mutti tomater"], exclude: ["puré"], basePricePerKg: 30 },
  { id: "maelk", label: "Mælk", query: "mælk", include: ["letmælk", "sødmælk", "minimælk", "skummetmælk"], exclude: ["kakao", "protein", "kefir"], basePricePerKg: 13 },
  { id: "ost", label: "Ost", query: "ost", include: ["skæreost", "samsøost", "danbo", "havarti", "mozzarella", "revet ost", "skiveost"], exclude: ["dessert", "hytteost", "flødeost", "pizza", "smelteost", "tapas"], basePricePerKg: 90 },
  { id: "aeg", label: "Æg", query: "æg", include: ["æg"], exclude: ["julefrokost", "røræg", "fettuccine", "salat", "pålæg"], basePricePerKg: 50 },
  { id: "rugbrod", label: "Rugbrød", query: "rugbrød", include: ["rugbrød", "levebrød", "schwarzbrød", "det gode brød"], exclude: ["rundstykker", "julefrokost", "valsemøllen"], basePricePerKg: 25 },
  { id: "havregryn", label: "Havregryn", query: "havregryn", include: ["havregryn"], basePricePerKg: 18 },
  { id: "frost", label: "Frosne grøntsager", query: "frosne grøntsager", include: ["grøntsagsblanding", "grøntsagsmix", "wokmix", "grøntsager", "ærter", "grønne bønner"], exclude: ["fløde", "brød", "bimi"], basePricePerKg: 30 },
  { id: "flode", label: "Fløde", query: "fløde", include: ["fløde", "cremefine", "madlavningsjævner"], exclude: ["kartofler", "fraiche"], basePricePerKg: 45 },
  { id: "broccoli", label: "Broccoli", query: "broccoli", include: ["broccoli"], exclude: ["blomkålsris"], basePricePerKg: 35 },
  { id: "mel", label: "Hvedemel", query: "hvedemel", include: ["hvedemel"], basePricePerKg: 10 },
];

export const RECIPES: Recipe[] = [
  { id: "bolognese", name: "Spaghetti bolognese", emoji: "🍝", servings: 4, items: [
    { ingredient: "oksekod", kg: 0.5 }, { ingredient: "pasta", kg: 0.5 }, { ingredient: "tomater", kg: 0.8 }, { ingredient: "log", kg: 0.15 }, { ingredient: "gulerodder", kg: 0.2 },
  ] },
  { id: "frikadeller", name: "Frikadeller med kartofler", emoji: "🥔", servings: 4, items: [
    { ingredient: "svinekod", kg: 0.6 }, { ingredient: "kartofler", kg: 1.2 }, { ingredient: "log", kg: 0.1 }, { ingredient: "aeg", kg: 0.06 }, { ingredient: "maelk", kg: 0.1 }, { ingredient: "mel", kg: 0.05 },
  ] },
  { id: "kyllingegryde", name: "Kyllingegryde med ris", emoji: "🍲", servings: 4, items: [
    { ingredient: "kylling", kg: 0.6 }, { ingredient: "ris", kg: 0.3 }, { ingredient: "gulerodder", kg: 0.3 }, { ingredient: "log", kg: 0.15 }, { ingredient: "flode", kg: 0.25 },
  ] },
  { id: "laks", name: "Laks med ris og broccoli", emoji: "🐟", servings: 4, items: [
    { ingredient: "laks", kg: 0.5 }, { ingredient: "ris", kg: 0.3 }, { ingredient: "broccoli", kg: 0.5 },
  ] },
  { id: "boller", name: "Boller i karry", emoji: "🍛", servings: 4, items: [
    { ingredient: "svinekod", kg: 0.5 }, { ingredient: "ris", kg: 0.3 }, { ingredient: "log", kg: 0.2 }, { ingredient: "aeg", kg: 0.06 }, { ingredient: "maelk", kg: 0.3 }, { ingredient: "mel", kg: 0.08 },
  ] },
  { id: "pizza", name: "Hjemmelavet pizza", emoji: "🍕", servings: 4, items: [
    { ingredient: "mel", kg: 0.5 }, { ingredient: "tomater", kg: 0.4 }, { ingredient: "ost", kg: 0.3 }, { ingredient: "log", kg: 0.1 }, { ingredient: "svinekod", kg: 0.2 },
  ] },
  { id: "suppe", name: "Grøntsagssuppe med rugbrød", emoji: "🥕", servings: 4, items: [
    { ingredient: "kartofler", kg: 0.5 }, { ingredient: "gulerodder", kg: 0.5 }, { ingredient: "log", kg: 0.2 }, { ingredient: "frost", kg: 0.5 }, { ingredient: "rugbrod", kg: 0.4 },
  ] },
  { id: "aeggekage", name: "Æggekage med rugbrød", emoji: "🍳", servings: 4, items: [
    { ingredient: "aeg", kg: 0.6 }, { ingredient: "kartofler", kg: 0.4 }, { ingredient: "maelk", kg: 0.1 }, { ingredient: "rugbrod", kg: 0.4 }, { ingredient: "log", kg: 0.1 },
  ] },
  { id: "ovnkylling", name: "Kylling i ovn med rodfrugter", emoji: "🍗", servings: 4, items: [
    { ingredient: "kylling", kg: 1 }, { ingredient: "kartofler", kg: 1 }, { ingredient: "gulerodder", kg: 0.4 }, { ingredient: "log", kg: 0.2 },
  ] },
  { id: "chili", name: "Chili con carne", emoji: "🌶️", servings: 4, items: [
    { ingredient: "oksekod", kg: 0.5 }, { ingredient: "tomater", kg: 0.8 }, { ingredient: "ris", kg: 0.3 }, { ingredient: "log", kg: 0.15 }, { ingredient: "frost", kg: 0.3 },
  ] },
  { id: "laksepasta", name: "Pasta med laks og fløde", emoji: "🍜", servings: 4, items: [
    { ingredient: "pasta", kg: 0.4 }, { ingredient: "laks", kg: 0.3 }, { ingredient: "flode", kg: 0.25 }, { ingredient: "broccoli", kg: 0.3 },
  ] },
];
