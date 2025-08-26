export type HadithCollection = {
  id: string; // slug for route
  englishName: string;
  arabicName?: string;
  alias?: string[]; // other names people might search
};

export const sixCollections: HadithCollection[] = [
  { id: "bukhari",   englishName: "Sahih al-Bukhari",  arabicName: "صحيح البخاري", alias: ["al-bukhari", "bukhari"] },
  { id: "muslim",    englishName: "Sahih Muslim",      arabicName: "صحيح مسلم",     alias: ["sahih muslim", "muslim"] },
  { id: "abudawood", englishName: "Sunan Abu Dawood",  arabicName: "سنن أبي داود",  alias: ["abu dawud", "abu dawood", "abudawood"] },
  { id: "tirmidhi",  englishName: "Jamiʿ at-Tirmidhi", arabicName: "جامع الترمذي",  alias: ["jami at-tirmidhi", "tirmidhi"] },
  { id: "nasai",     englishName: "Sunan an-Nasa’i",   arabicName: "سنن النسائي",   alias: ["an-nasai", "al-nasai", "nasai"] },
  { id: "ibnmajah",  englishName: "Sunan Ibn Majah",   arabicName: "سنن ابن ماجه",  alias: ["ibn majah", "ibn maja", "maja"] },
];
