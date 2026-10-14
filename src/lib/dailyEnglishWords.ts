import { getNoRepeatDailyIndex } from "@/lib/dateUtils";

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
  { word: "departure gate", meaning: "出発ゲート", example: "Which departure gate is my flight?", exampleJa: "私のフライトの出発ゲートはどこですか。" },
  { word: "connecting flight", meaning: "乗り継ぎ便", example: "I'm worried about missing my connecting flight.", exampleJa: "乗り継ぎ便に乗り遅れないか心配です。" },
  { word: "overbooked", meaning: "予約過多の(満席以上に予約を取っている)", example: "This flight is overbooked.", exampleJa: "このフライトは予約過多です。" },
  { word: "aisle seat", meaning: "通路側の席", example: "I'd prefer an aisle seat.", exampleJa: "通路側の席がいいです。" },
  { word: "window seat", meaning: "窓側の席", example: "Could I change to a window seat?", exampleJa: "窓側の席に変更できますか。" },
  { word: "turbulence", meaning: "(飛行機の)揺れ、気流の乱れ", example: "We may experience some turbulence.", exampleJa: "多少の揺れが予想されます。" },
  { word: "baggage claim", meaning: "荷物受取所", example: "Where is the baggage claim?", exampleJa: "荷物受取所はどこですか。" },
  { word: "double room", meaning: "ダブルルーム(2人用の部屋)", example: "I'd like to book a double room.", exampleJa: "ダブルルームを予約したいです。" },
  { word: "wake-up call", meaning: "モーニングコール", example: "Could I have a wake-up call at 6?", exampleJa: "6時にモーニングコールをお願いできますか。" },
  { word: "housekeeping", meaning: "ハウスキーピング、清掃サービス", example: "Could you send housekeeping to my room?", exampleJa: "部屋に清掃サービスをお願いできますか。" },
  { word: "check-out time", meaning: "チェックアウトの時間", example: "What time is check-out?", exampleJa: "チェックアウトは何時ですか。" },
  { word: "concierge", meaning: "コンシェルジュ(案内係)", example: "Ask the concierge for restaurant suggestions.", exampleJa: "レストランのおすすめはコンシェルジュに聞きましょう。" },
  { word: "complimentary", meaning: "無料の、サービスの", example: "Breakfast is complimentary at this hotel.", exampleJa: "このホテルは朝食が無料です。" },
  { word: "transit visa", meaning: "乗り継ぎ用の査証", example: "Do I need a transit visa for this layover?", exampleJa: "この乗り継ぎには通過査証が必要ですか。" },
  { word: "SIM card", meaning: "SIMカード", example: "Where can I buy a SIM card?", exampleJa: "SIMカードはどこで買えますか。" },
  { word: "Wi-Fi password", meaning: "Wi-Fiのパスワード", example: "What's the Wi-Fi password here?", exampleJa: "ここのWi-Fiパスワードは何ですか。" },
  { word: "map app", meaning: "地図アプリ", example: "I'll use a map app to find the station.", exampleJa: "地図アプリで駅を探します。" },
  { word: "one-way ticket", meaning: "片道チケット", example: "One-way ticket to the airport, please.", exampleJa: "空港までの片道チケットをお願いします。" },
  { word: "transfer (trains)", meaning: "(電車の)乗り換え", example: "Where do I transfer for the airport line?", exampleJa: "空港線への乗り換えはどこですか。" },
  { word: "taxi stand", meaning: "タクシー乗り場", example: "Is there a taxi stand near the exit?", exampleJa: "出口の近くにタクシー乗り場はありますか。" },
  { word: "tip (gratuity)", meaning: "チップ", example: "Is a tip included in the price?", exampleJa: "料金にチップは含まれていますか。" },
  { word: "vegetarian", meaning: "ベジタリアンの、菜食主義者", example: "Do you have vegetarian options?", exampleJa: "ベジタリアン向けのメニューはありますか。" },
  { word: "spicy", meaning: "辛い", example: "Is this dish very spicy?", exampleJa: "この料理はとても辛いですか。" },
  { word: "to go / takeout", meaning: "持ち帰り", example: "Can I get this to go?", exampleJa: "これは持ち帰りにできますか。" },
  { word: "split the bill", meaning: "割り勘にする", example: "Could we split the bill?", exampleJa: "割り勘にしてもらえますか。" },
  { word: "cash only", meaning: "現金のみ", example: "Sorry, we're cash only here.", exampleJa: "すみません、こちらは現金のみです。" },
  { word: "price tag", meaning: "価格タグ、値札", example: "The price tag says 2,000 yen.", exampleJa: "値札には2,000円と書いてあります。" },
  { word: "fitting room", meaning: "試着室", example: "Where is the fitting room?", exampleJa: "試着室はどこですか。" },
  { word: "souvenir", meaning: "お土産", example: "I'm looking for souvenirs for my family.", exampleJa: "家族へのお土産を探しています。" },
  { word: "warranty", meaning: "保証(書)", example: "Does this come with a warranty?", exampleJa: "これには保証がついていますか。" },
  { word: "out of order", meaning: "故障中", example: "The elevator is out of order.", exampleJa: "エレベーターは故障中です。" },
  { word: "first aid", meaning: "応急処置", example: "Is there a first aid kit here?", exampleJa: "応急処置キットはここにありますか。" },
  { word: "travel insurance", meaning: "旅行保険", example: "Make sure you have travel insurance.", exampleJa: "旅行保険に入っておきましょう。" },
  { word: "embassy", meaning: "大使館", example: "Where is the nearest embassy?", exampleJa: "最寄りの大使館はどこですか。" },
  { word: "power outlet", meaning: "電源コンセント", example: "Is there a power outlet near my seat?", exampleJa: "席の近くに電源コンセントはありますか。" },
  { word: "voltage adapter", meaning: "変圧器、電圧アダプター", example: "I need a voltage adapter for this country.", exampleJa: "この国用の変圧器が必要です。" },
];

export function getTodayWord(date: Date = new Date()): EnglishWordEntry {
  const index = getNoRepeatDailyIndex(date, ENGLISH_WORDS.length, "daily-english-word");
  return ENGLISH_WORDS[index];
}
