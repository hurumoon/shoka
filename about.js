// 書き出し前と公開先でディレクトリが変わるため、このモジュールは単独で使えるようにする。
const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const OPERATOR = 'フルムーン';

// ブラウザ表示と、JavaScriptなしでも読める公開HTMLで同じ案内を使う。
export function aboutHtml(title) {
  return `<article class="wrap about-page" aria-labelledby="aboutTitle">
    <header class="about-intro">
      <p class="about-label">About</p>
      <h1 id="aboutTitle">この書架について</h1>
      <p class="about-lead">気になる物語を、<br>あなたの読み方で。</p>
      <p>「${esc(title)}」は、Novel Studioで制作した小説を読める公開サイトです。短い物語から、じっくり読める連載やシリーズまで、書架から気になる一冊を探してみてください。会員登録なしで読めます。</p>
      <a class="btn primary" href="./" data-route="/">作品を探す</a>
    </header>
    <div class="about-sections">
      <section aria-labelledby="aboutProduction">
        <h2 id="aboutProduction">AIを使った制作について</h2>
        <p>このサイトでは、ClaudeやCodexなどのAIを使って制作した小説を公開しています。設定やプロットづくり、執筆、校閲・修正のほか、表紙や挿絵の制作にもAIを使っています。</p>
        <p>作品ごとの制作担当は、作品ページの「制作担当」を開くと確認できます。</p>
      </section>
      <section aria-labelledby="aboutOperator">
        <h2 id="aboutOperator">運営者</h2>
        <p><b>${esc(OPERATOR)}</b>　企画と監修を担当しています。何を書くかを決め、AIが設定から校閲まで進める制作の仕組み（Novel Studio）を自作し、公開する作品を選んでいます。本文を書いているのはClaudeやCodexなどのAIです。</p>
        <p>ガジェットとおたくテックのブログ「<a href="https://pixelpassion.jp" target="_blank" rel="noopener">ぴくせるぱっしょん</a>」も運営しています。</p>
      </section>
      <section aria-labelledby="aboutReading">
        <h2 id="aboutReading">作品を探す・読む</h2>
        <p>書架では、題名・作者・タグ・あらすじなどで検索できます。ジャンルのほか、シリーズ、完結・連載中、作品の長さでも絞り込めます。</p>
        <p>作品ページで紹介文と目次を確認し、「最初から読む」または読みたい話を選んでください。シリーズ作品には、読む順番と同じシリーズの作品への案内があります。</p>
        <p>読書画面では、縦書き・横書き、書体、文字サイズ、行間、背景色などを好みに合わせて変えられます。</p>
      </section>
      <section aria-labelledby="aboutStorage">
        <h2 id="aboutStorage">栞と表示設定の保存</h2>
        <p>読んだ位置は自動で栞に保存され、作品ページの「続きから読む」から再開できます。既読の話や表示設定、書架の検索条件も、お使いのブラウザに保存します。</p>
        <p>保存内容は別の端末やブラウザとは共有されません。ブラウザのデータを削除した場合や、保存を制限する設定では、栞や設定が残らないことがあります。</p>
      </section>
      <section aria-labelledby="aboutAdult">
        <h2 id="aboutAdult">成人向け作品について</h2>
        <p>成人向け作品には「R18」を表示し、本文を開く前に18歳以上であることを確認します。18歳未満の方は閲覧できません。作品ページのタグや紹介文も、読む作品を選ぶ際の参考にしてください。</p>
      </section>
    </div>
    <footer class="about-return"><a class="btn" href="./" data-route="/">書架へ戻る</a></footer>
  </article>`;
}
