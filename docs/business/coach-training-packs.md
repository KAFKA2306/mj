# 麻雀教室・コーチ向け弱点別トレーニング課題パック

## 現在提供できるもの

技術MVPでは、課題パックを `id + version` で固定し、同じ順序・設定を再現できるJSON契約を提供します。公開用データは `data/training-packs/` に置き、5問sampleと12問coach demoを用意しています。

version `1.1.0` では、配布scenarioに具体的な `context` と具体的な選択肢を必須化しました。`候補A` / `候補B` のようなplaceholderはcontract validationで拒否します。これにより、件数だけを満たす空のdemoを配布可能状態として扱いません。

現時点の配布scenarioは、既存engineが唯一の正答を保証するところまで個別検証できていないため、すべて `REVIEW_REQUIRED` としています。これは未検証の正答を捏造しないためのfail-closed状態です。`SCORABLE` は、推奨候補と許容候補を検証できたscenarioだけに使用します。

## 無料sample

- `coach-sample-v1` / version `1.1.0`
- 5問
- 牌効率、守備、リーチ判断、待ち形、相手読みを横断
- 各問に具体的な手牌・河・巡目など、判断に必要な文脈または未観測条件を明示
- 配布URLは `?pack=coach-sample-v1&version=1.1.0` の形で固定可能

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

現在のdistribution gateは次の二段階です。

1. **配布品質:** `context` が空でない、選択肢が具体的かつ重複しない、placeholderを含まないことを `validatePack()` とCIで検証する。
2. **採点品質:** `ScenarioValidator` で回答候補を個別検証し、推奨・許容候補をrevisionへ固定できるまでは `REVIEW_REQUIRED` を維持する。

次の技術ゲートは、各配布scenarioの構造化された手牌・game stateを既存 `ScenarioValidator` の対応メソッドへ渡すadapterを追加し、検証結果をpack revisionへ固定することです。未対応の待ち形・相手読みは、対応validatorが実装されるまで自動採点へ昇格しません。

## 60日KPI

Issue #1の目標値と実測値は分離します。実測値の正準保存場所は `data/coach-training-kpis.json` です。直接提案、qualified inquiry、demo、有償PoC、継続希望は実在する証拠が確認できた時だけ更新します。
