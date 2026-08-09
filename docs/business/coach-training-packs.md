# 麻雀教室・コーチ向け弱点別トレーニング課題パック

## 現在提供できるもの

技術MVPでは、課題パックを `id + version` で固定し、同じ順序・設定を再現できるJSON契約を提供します。公開用データは `data/training-packs/` に置き、5問sampleと12問coach demoを用意しています。

現時点の配布scenarioは、既存engineが唯一の正答を保証するところまで個別検証できていないため、すべて `REVIEW_REQUIRED` としています。これは未検証の正答を捏造しないためのfail-closed状態です。`SCORABLE` は、推奨候補と許容候補を検証できたscenarioだけに使用します。

## 無料sample

- `coach-sample-v1` / version `1.0.0`
- 5問
- 牌効率、守備、リーチ判断、待ち形、相手読みを横断
- 配布URLは `?pack=coach-sample-v1&version=1.0.0` の形で固定可能

## 有償PoCの想定範囲

技術MVPと実際の有償実績を分離します。現時点では有償PoCの成立実績を記録していません。

PoCで提供する候補は次の通りです。

- 教室・コーチ向けの10問以上のversioned pack
- focus別の匿名集計
- `MATCH | ACCEPTABLE | REVIEW_REQUIRED | INVALID` の明示状態
- 月次での課題差し替えは新versionとして管理

個人名、メールアドレス、牌譜本文は集計に必須としません。KPI台帳 `data/coach-training-kpis.json` は観測した集計イベントだけを記録し、営業・有償実績を推測で増やしません。

## CTA

1. **5問を試す** — `data/training-packs/sample.json`
2. **教室用パックを相談する** — GitHub Issueで利用人数・指導テーマ・希望時期を記載
3. **自分の講義テーマで作る** — 既存scenario typeに対応できるテーマから要件を整理

## 評価の限界

麻雀の局面評価には複数の妥当な選択肢があり得ます。現行 `scenario-validator.js` は牌効率・守備・リーチ判断などの個別判定関数を持ちますが、任意の配布scenarioを一括で認証するgeneric APIはまだありません。そのため、pack contractだけを通った局面を「唯一の正解」とは扱いません。

次の技術ゲートは、各配布scenarioに具体的な手牌・game state・回答候補を持たせ、既存 `ScenarioValidator` の対応メソッドを実行して、検証結果をpackのrevisionへ固定することです。そのゲートを通るまでは `REVIEW_REQUIRED` を維持します。

## 60日KPI

Issue #1の目標値と実測値は分離します。実測値の正準保存場所は `data/coach-training-kpis.json` です。直接提案、qualified inquiry、demo、有償PoC、継続希望は実在する証拠が確認できた時だけ更新します。
