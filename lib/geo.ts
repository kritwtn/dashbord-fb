/** Country / province helpers for the audience page. */

let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(["th"], { type: "region" });
} catch {
  regionNames = null;
}

export const countryName = (code: string) => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

/** 🇹🇭 from "TH" */
export const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🏳️";

const TH_PROVINCES: Record<string, string> = {
  Bangkok: "กรุงเทพมหานคร", "Amnat Charoen": "อำนาจเจริญ", "Ang Thong": "อ่างทอง", "Bueng Kan": "บึงกาฬ", "Buri Ram": "บุรีรัมย์",
  Chachoengsao: "ฉะเชิงเทรา", "Chai Nat": "ชัยนาท", Chaiyaphum: "ชัยภูมิ", Chanthaburi: "จันทบุรี", "Chiang Mai": "เชียงใหม่",
  "Chiang Rai": "เชียงราย", "Chon Buri": "ชลบุรี", Chumphon: "ชุมพร", Kalasin: "กาฬสินธุ์", "Kamphaeng Phet": "กำแพงเพชร",
  Kanchanaburi: "กาญจนบุรี", "Khon Kaen": "ขอนแก่น", Krabi: "กระบี่", Lampang: "ลำปาง", Lamphun: "ลำพูน", Loei: "เลย",
  "Lop Buri": "ลพบุรี", "Mae Hong Son": "แม่ฮ่องสอน", "Maha Sarakham": "มหาสารคาม", Mukdahan: "มุกดาหาร", "Nakhon Nayok": "นครนายก",
  "Nakhon Pathom": "นครปฐม", "Nakhon Phanom": "นครพนม", "Nakhon Ratchasima": "นครราชสีมา", "Nakhon Sawan": "นครสวรรค์",
  "Nakhon Si Thammarat": "นครศรีธรรมราช", Nan: "น่าน", Narathiwat: "นราธิวาส", "Nong Bua Lam Phu": "หนองบัวลำภู", "Nong Khai": "หนองคาย",
  Nonthaburi: "นนทบุรี", "Pathum Thani": "ปทุมธานี", Pattani: "ปัตตานี", "Phang Nga": "พังงา", Phatthalung: "พัทลุง", Phayao: "พะเยา",
  Phetchabun: "เพชรบูรณ์", Phetchaburi: "เพชรบุรี", Phichit: "พิจิตร", Phitsanulok: "พิษณุโลก", "Phra Nakhon Si Ayutthaya": "พระนครศรีอยุธยา",
  Ayutthaya: "พระนครศรีอยุธยา", Phrae: "แพร่", Phuket: "ภูเก็ต", "Prachin Buri": "ปราจีนบุรี", "Prachuap Khiri Khan": "ประจวบคีรีขันธ์",
  Ranong: "ระนอง", Ratchaburi: "ราชบุรี", Rayong: "ระยอง", "Roi Et": "ร้อยเอ็ด", "Sa Kaeo": "สระแก้ว", "Sakon Nakhon": "สกลนคร",
  "Samut Prakan": "สมุทรปราการ", "Samut Sakhon": "สมุทรสาคร", "Samut Songkhram": "สมุทรสงคราม", Saraburi: "สระบุรี", Satun: "สตูล",
  "Si Sa Ket": "ศรีสะเกษ", "Sing Buri": "สิงห์บุรี", Songkhla: "สงขลา", Sukhothai: "สุโขทัย", "Suphan Buri": "สุพรรณบุรี",
  "Surat Thani": "สุราษฎร์ธานี", Surin: "สุรินทร์", Tak: "ตาก", Trang: "ตรัง", Trat: "ตราด", "Ubon Ratchathani": "อุบลราชธานี",
  "Udon Thani": "อุดรธานี", "Uthai Thani": "อุทัยธานี", Uttaradit: "อุตรดิตถ์", Yala: "ยะลา", Yasothon: "ยโสธร",
};

/**
 * Meta city strings look like "Bangkok, Thailand", "Chiang Mai, Thailand" or
 * "Amphoe Kumphawapi, Udon Thani, Thailand". Thai entries are rolled up to their province;
 * cities abroad are kept as "City, Country".
 */
export function provinceOf(city: string): { key: string; label: string; thai: boolean } {
  const parts = city.split(",").map((s) => s.trim());
  const country = parts.at(-1) ?? "";
  // Meta sometimes sends a bare Thai province ("Phra Nakhon Si Ayutthaya") without ", Thailand"
  if (parts.length === 1 && TH_PROVINCES[parts[0].replace(/ Province$/, "")]) {
    const prov = parts[0].replace(/ Province$/, "");
    return { key: prov, label: TH_PROVINCES[prov], thai: true };
  }
  if (country !== "Thailand") return { key: city, label: parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(", ")})` : city, thai: false };
  const prov = (parts.length >= 3 ? parts[parts.length - 2] : parts[0]).replace(/ Province$/, "");
  return { key: prov, label: TH_PROVINCES[prov] ?? prov, thai: true };
}
