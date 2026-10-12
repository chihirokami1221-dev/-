export interface EnglishWordEntry {
  word: string;
  meaning: string;
  example: string;
  exampleJa: string;
}

// 海外旅行の現地(空港・ホテル・レストラン・移動・買い物・トラブル対応)で実際に使う頻度が高い、
// 基本的で誤解の少ない単語・フレーズのみを選んでいる。
export const ENGLISH_WORDS: EnglishWordEntry[] = [
  { word: "boarding pass", meaning: "搭乗券", example: "Can I see your boarding pass, please?", exampleJa: "搭乗券を見せていただけますか。" },
  { word: "layover", meaning: "乗り継ぎ、経由", example: "I have a three-hour layover in Seoul.", exampleJa: "ソウルで3時間の乗り継ぎがあります。" },
  { word: "carry-on", meaning: "機内持ち込み手荷物", example: "This bag fits as a carry-on.", exampleJa: "このバッグは機内持ち込みサイズです。" },
  { word: "immigration", meaning: "入国審査", example: "Please fill out this form before immigration.", exampleJa: "入国審査の前にこの用紙を記入してください。" },
  { word: "customs declaration", meaning: "税関申告", example: "Do I need a customs declaration form?", exampleJa: "税関申告書は必要ですか。" },
  { word: "check-in", meaning: "チェックイン", example: "I'd like to check in, please.", exampleJa: "チェックインをお願いします。" },
  { word: "reservation", meaning: "予約", example: "I have a reservation under the name Kamichihiro.", exampleJa: "カミチヒロの名前で予約しています。" },
  { word: "vacancy", meaning: "空室", example: "Do you have any vacancy for tonight?", exampleJa: "今夜空いている部屋はありますか。" },
  { word: "receptionist", meaning: "フロント係", example: "Ask the receptionist for a city map.", exampleJa: "フロント係に市内地図をもらいましょう。" },
  { word: "currency exchange", meaning: "両替", example: "Where is the nearest currency exchange?", exampleJa: "一番近い両替所はどこですか。" },
  { word: "fare", meaning: "運賃", example: "What is the fare to the airport?", exampleJa: "空港までの運賃はいくらですか。" },
  { word: "platform", meaning: "(駅の)ホーム", example: "Which platform does the train leave from?", exampleJa: "電車はどのホームから出ますか。" },
  { word: "round trip", meaning: "往復", example: "I'd like a round trip ticket, please.", exampleJa: "往復チケットをお願いします。" },
  { word: "reservation (restaurant)", meaning: "(飲食店の)予約", example: "Table for two, please.", exampleJa: "2名でお願いします。" },
  { word: "recommend", meaning: "おすすめする", example: "What do you recommend?", exampleJa: "おすすめは何ですか。" },
  { word: "allergic", meaning: "アレルギーがある", example: "I'm allergic to peanuts.", exampleJa: "ピーナッツにアレルギーがあります。" },
  { word: "check, please", meaning: "お会計をお願いします", example: "Could we have the check, please?", exampleJa: "お会計をお願いできますか。" },
  { word: "receipt", meaning: "領収書", example: "Could I get a receipt, please?", exampleJa: "領収書をいただけますか。" },
  { word: "try on", meaning: "試着する", example: "Can I try this on?", exampleJa: "これを試着してもいいですか。" },
  { word: "size up / down", meaning: "ワンサイズ大きく/小さく", example: "Do you have this one size up?", exampleJa: "これのワンサイズ大きいものはありますか。" },
  { word: "duty-free", meaning: "免税の", example: "Is this shop duty-free?", exampleJa: "このお店は免税ですか。" },
  { word: "lost and found", meaning: "忘れ物取扱所", example: "I left my phone. Where is the lost and found?", exampleJa: "携帯を忘れました。忘れ物取扱所はどこですか。" },
  { word: "refund", meaning: "返金", example: "I would like to request a refund.", exampleJa: "返金をお願いしたいです。" },
  { word: "emergency", meaning: "緊急事態", example: "This is an emergency. I need help.", exampleJa: "緊急です。助けてください。" },
  { word: "pharmacy", meaning: "薬局", example: "Is there a pharmacy nearby?", exampleJa: "近くに薬局はありますか。" },
];

export function getTodayWord(date: Date = new Date()): EnglishWordEntry {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return ENGLISH_WORDS[dayOfYear % ENGLISH_WORDS.length];
}
