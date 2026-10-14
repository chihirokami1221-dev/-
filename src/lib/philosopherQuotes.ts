import { getNoRepeatDailyIndex } from "@/lib/dateUtils";

export interface PhilosopherQuote {
  text: string;
  author: string;
  meaning: string;
}

// 誤引用のリスクを避けるため、出典・著者が広く確立されている短い名言のみを厳選している。
export const PHILOSOPHER_QUOTES: PhilosopherQuote[] = [
  {
    text: "汝自身を知れ。",
    author: "ソクラテス",
    meaning: "自分が何を知らないかを自覚することから、真の知恵が始まるという教え。",
  },
  {
    text: "我思う、ゆえに我あり。",
    author: "デカルト",
    meaning: "あらゆるものを疑っても、疑っている自分の存在だけは疑えない、という思考の出発点。",
  },
  {
    text: "人間は社会的(政治的)動物である。",
    author: "アリストテレス",
    meaning: "人は共同体の中でしか本来の人間らしさを発揮できない、という人間観。",
  },
  {
    text: "人間は考える葦である。",
    author: "パスカル",
    meaning: "人間は自然の中では葦のようにか弱い存在だが、考える力によって尊厳を持つという意味。",
  },
  {
    text: "同じ河に二度入ることはできない。",
    author: "ヘラクレイトス",
    meaning: "世界は常に変化し続けており、同じ状態は二度と訪れないという考え方。",
  },
  {
    text: "己の欲せざるところは人に施すことなかれ。",
    author: "孔子",
    meaning: "自分がされたくないことは、他人にもしてはいけないという思いやりの基本。",
  },
  {
    text: "千里の行も足下に始まる。",
    author: "老子",
    meaning: "どんな大きな目標も、まず目の前の小さな一歩から始まるという教え。",
  },
  {
    text: "無知は諸悪の根源である。",
    author: "プラトン",
    meaning: "物事を正しく知らないことが、誤った判断や行動を引き起こすという考え。",
  },
  {
    text: "知は力なり。",
    author: "フランシス・ベーコン",
    meaning: "正しい知識を持つことが、物事を変える力になるという近代科学の精神を表す言葉。",
  },
  {
    text: "習慣は第二の天性である。",
    author: "アリストテレス",
    meaning: "繰り返し行うことは、やがて生まれ持った性質のように自然になるという意味。",
  },
  {
    text: "私を殺さないものは、私を強くする。",
    author: "ニーチェ",
    meaning: "『偶像の黄昏』にある言葉。困難や試練を乗り越えることが、人を成長させるという考え方。",
  },
  {
    text: "踊ることを知らぬ日は、失われた日と思うべきである。",
    author: "ニーチェ",
    meaning: "『ツァラトゥストラはこう言った』より。生を軽やかに楽しむ姿勢の大切さを説いた言葉。",
  },
  {
    text: "実存は本質に先立つ。",
    author: "サルトル",
    meaning: "人間はあらかじめ決められた本質を持たず、自らの選択と行動によって自分自身を作っていくという考え方。",
  },
  {
    text: "汝の意志の格率が、常に同時に普遍的立法の原理として妥当するように行為せよ。",
    author: "カント",
    meaning: "『人倫の形而上学の基礎づけ』にある「定言命法」。誰もがそうすべきだと言える行動だけをせよ、という道徳の原則。",
  },
];

export function getTodayQuote(date: Date = new Date()): PhilosopherQuote {
  const index = getNoRepeatDailyIndex(date, PHILOSOPHER_QUOTES.length, "philosopher-quote");
  return PHILOSOPHER_QUOTES[index];
}
