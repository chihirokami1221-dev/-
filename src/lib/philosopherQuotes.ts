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
];

export function getTodayQuote(date: Date = new Date()): PhilosopherQuote {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return PHILOSOPHER_QUOTES[dayOfYear % PHILOSOPHER_QUOTES.length];
}
