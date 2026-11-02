// 公開向けに編集した紹介文。制作資料やスキルの指示本文は読み込まない。
const styleGroups = [
  { title: '土台', lead: '文章全体の調子を決める、一つのベース。', items: [
    ['標準文体（既定）', '飾らず正確に書くための基本と、AIに出やすい表現の癖の点検。'],
    ['Mixスキル（いいとこ取り）', '標準文体に、精読・読みやすさ・ジャンルに共通する技法をまとめた土台。'],
    ['勢いスキル（アンチClaude）', '語り手の声、感情、ツッコミ、章末の引きで進むネット小説の調子。'],
    ['GPT風スキル', '短い段落、乾いた語り、短い会話の応酬、繰り返すギャグと回収。'],
    ['指定なし', '文体や展開の追加指示を置かず、依頼・設定・プロットと共通の表記で書く。'],
  ] },
  { title: '追加', lead: '土台に重ねて、文章を点検する観点。', items: [
    ['スロップ精読スキル', '自然に見えても、よく読むと意味が通らない比喩や描写、圧縮しすぎた文を点検する。'],
    ['読みやすさスキル', '係り受け、修飾の順、一文の情報量などを見直し、一度で追える文へ整える。'],
  ] },
  { title: '作風', lead: 'ジャンルや語り口に合わせて、物語の読み味をつくる。', items: [
    ['女神様スキル', '欲望に正直な主人公の一人称とツッコミで進む、テンポ重視の異世界コメディ。'],
    ['純文学', '知覚と語りの距離、物に託した気持ち、意味を言い切らない余韻。'],
    ['ミステリ・探偵小説', 'フェアな手がかりを置き、講釈や自白だけに頼らず謎を解く。'],
    ['SF・冒険', '架空の技術や異常現象を、場面や暮らしの中で見せる。'],
    ['時代・歴史', '身分や呼び方、時代らしい会話を、今の読みやすい日本語に織り込む。'],
    ['ホラー・怪奇', '日常の細部から不穏さを育て、怪異を説明しきらずに見せる。'],
    ['恋愛・青春', '自覚、ぎこちなさ、言い損ないなど、関係の変化から気持ちを描く。'],
    ['百合', '女性どうしの恋や親しさを、触れ合い、嫉妬、関係の重心の変化から描く。'],
    ['百合（王道外し）', '定番の告白や結末などを意識して外す、通常の百合スキルに代わる作風。'],
    ['童話・ファンタジー', '動物や物の声、不思議、繰り返し、擬音を生かす童話の語り。'],
  ] },
];

export function makingHtml() {
  return `<article class="wrap about-page making-page" aria-labelledby="makingTitle">
    <header class="about-intro">
      <p class="about-label">Novel Studio / Making</p>
      <h1 id="makingTitle">仕組みとスキル</h1>
      <p class="about-lead">物語ができるまでを、<br>ひとつの仕組みに。</p>
      <p>この書架の制作環境「Novel Studio」は、フルムーンが自作したAIハーネスです。AIに渡す資料、担当する役割、作業の順番、確認と修正の手続きをまとめ、ClaudeやCodexで小説づくりを進めます。</p>
      <p>人間が企画と監修を担い、AIが設定・構成・本文・校閲を担当する。その間をつなぐのが、制作工程を動かすスキルと、文章の読み味を決める文体スキルです。</p>
    </header>

    <section class="making-section" aria-labelledby="makingFlow">
      <p class="making-number">01 / WORKFLOW</p>
      <h2 id="makingFlow">一話ずつ、書いて確かめる</h2>
      <p>通常の自動制作は、次の流れで進みます。途中で設定やプロットを確認して止めたり、続きから再開したりすることもできます。</p>
      <ol class="making-flow">
        <li><h3>依頼と設定</h3><p>書きたい話、登場人物、世界観、作品のルール、文体を整理します。</p></li>
        <li><h3>プロットと批評</h3><p>全体構成と各話の展開、伏線を設計。本文に入る前に、主人公の能動性や結末までの運びを批評して直します。</p></li>
        <li><h3>場面設計と執筆</h3><p>一話の場面を組み立てて本文を書き、要約と人物・出来事の状態を次の話へ引き継ぎます。</p></li>
        <li><h3>整合性と文体の校閲</h3><p>設定・時系列・伏線との一致と、日本語の自然さ・選んだ作風との一致を、それぞれの観点から確かめます。</p></li>
        <li><h3>修正と再確認</h3><p>指摘をもとに直し、校閲記録と機械チェックで確認。判定に応じて再確認し、次の話へ進みます。</p></li>
        <li><h3>全体確認と公開</h3><p>全話の通し校閲と、AI読者の内部コメントの検討を行います。公開対象に選ばれた作品の、公開条件を満たす話をサイトへ書き出します。</p></li>
      </ol>
      <aside class="making-note"><h3>長い物語を支える記録</h3><p>設定、各話の要約、人物の状態、伏線表、校閲結果を分けて保存し、次の担当へ必要な情報を渡します。本文や設定の版、工程ごとの制作担当も記録します。</p></aside>
    </section>

    <section class="making-section" aria-labelledby="makingSkills">
      <p class="making-number">02 / SKILLS</p>
      <h2 id="makingSkills">工程を動かすスキル</h2>
      <p>ここでいう「スキル」は、AIが読む作業手順と判断基準のまとまりです。設定担当、構成担当、執筆担当、校閲担当、修正担当といった役割を、目的に合わせて順に動かします。</p>
      <dl class="making-commands">
        <div><dt><code>/novel</code><span>全体を進める</span></dt><dd>設定から全話の執筆、校閲、修正、書き出しまでをつなぐ入口。</dd></div>
        <div><dt><code>/novel-setup</code><span>設計する</span></dt><dd>設定とプロットをつくり、本文を書く前に止めて確認する。</dd></div>
        <div><dt><code>/novel-write</code><span>書き進める</span></dt><dd>次の一話、指定した範囲、残りの話を執筆・校閲し、途中から再開する。</dd></div>
        <div><dt><code>/novel-check</code><span>見直す</span></dt><dd>既存の本文を校閲する。手で編集した後の確認にも使う。</dd></div>
        <div><dt><code>/novel-revise</code><span>指示して直す</span></dt><dd>設定、構成、特定の話を、作者の修正指示に沿って見直す。</dd></div>
        <div><dt><code>/novel-room</code><span>相談を重ねる</span></dt><dd>制作側の会議室で、相談と決定の記録をもとに企画を練る。</dd></div>
        <div><dt><code>/novel-view</code><span>制作を見渡す</span></dt><dd>制作側のビューアを開き、設定・本文・校閲記録・進行を確認する。</dd></div>
      </dl>
      <p class="making-caption">これらは制作環境で使う機能です。この公開サイトでは、公開された作品を探して読めます。</p>
    </section>

    <section class="making-section" aria-labelledby="makingStyles">
      <p class="making-number">03 / STYLE</p>
      <h2 id="makingStyles">読み味を選ぶ、文体スキル</h2>
      <p>文体スキルは「どう書くか」と「どこを見直すか」をまとめたもの。執筆・文体校閲・修正の担当が、作品で選んだスキルを使います。使うAIと文体は別々に選べるので、ClaudeでもCodexでも同じ文体スキルを使えます。</p>
      <div class="making-formula" aria-label="組み合わせ例：標準文体を土台に、読みやすさとミステリの作風を加える">
        <span><small>土台を一つ</small>標準文体</span><b aria-hidden="true">＋</b><span><small>必要に応じて追加</small>読みやすさ</span><b aria-hidden="true">＋</b><span><small>作品に合う作風</small>ミステリ</span>
      </div>
      <p class="making-caption">組み合わせの一例です。作品の指示や設定が優先され、スキルどうしの相性も確認します。「GPT風」や「アンチClaude」は作風の名前で、使用するAIを指定するものではありません。</p>
      ${styleGroups.map((group) => `<section class="making-style-group" aria-label="${group.title}の文体スキル"><h3>${group.title}</h3><p>${group.lead}</p><dl class="making-style-list">${group.items.map(([name, description]) => `<div><dt>${name}</dt><dd>${description}</dd></div>`).join('')}</dl></section>`).join('')}
    </section>

    <section class="making-section" aria-labelledby="makingReview">
      <p class="making-number">04 / REVIEW</p>
      <h2 id="makingReview">確かめ方も、作品に合わせて</h2>
      <p>上の流れを基本に、作品ごとに制作方法を選びます。すべての作品で、すべての方法を使っているわけではありません。</p>
      <dl class="making-options">
        <div><dt>交差校閲</dt><dd>Claudeが書いたらCodexが、Codexが書いたらClaudeが校閲します。執筆と違うAIの視点を入れる、任意の方法です。</dd></div>
        <div><dt>人間校閲</dt><dd>各話の執筆後と最後の通し確認で止まり、人間の修正指示や承認を待ちます。修正後は再び確認し、本文が変わると以前の承認は失効します。</dd></div>
        <div><dt>節約モード</dt><dd>各話の整合性と文体の校閲をまとめ、使用量と時間を抑えます。プロット批評や必要な修正、全体確認は行います。</dd></div>
        <div><dt>機械チェック</dt><dd>原稿の形式、文字数、会話率、表現の候補などを確認します。表現への指摘は文脈に照らして判断し、自動校閲では会話率などの数値条件も確認します。</dd></div>
      </dl>
    </section>

    <footer class="making-footer">
      <h2>作品から、読み味をたどる</h2>
      <p>作品ページの「制作担当」では、記録されている工程別の担当や、使用した文体スキルの名前と版を確認できます。同じAIでも、設定とスキルの組み合わせで変わる語り口を楽しんでください。</p>
      <div class="actions"><a class="btn primary" href="./" data-route="/">書架で作品を探す</a><a class="btn" href="about/" data-route="/about">この書架について</a></div>
    </footer>
  </article>`;
}
