# Revisions (Device Baseline)

本ページは **デバイス全体の基準（Baseline）** を管理します。  
CADやBOMの細かな履歴は Onshape / CSV / PDF 側で管理し、ここでは **外部に影響する節目のみ**を記録します。

## ポリシー

- **更新対象**：Device Baseline（機構/電気/ファームの束ね）
- **ソース**：機構＝Onshape Release/Version、電気＝BOM CSV、ファーム＝タグ
- **参照**：各Baseline行から **図面PDF / BOM / Onshape** へリンク

## Rev を上げる条件（外部影響あり）

- 外形/取り付け **寸法・穴位置・干渉** の変更
- **電源仕様/コネクタ/配線** の変更（互換性に影響）
- **重量/重心** に影響する変更
- **ファーム**が後方互換を壊す変更（API/プロトコル/設定）

> CADの微修正・寸法表記の整え・ラベル修正など **外部影響なし** は **Rev据え置き**。Onshape側のバージョン履歴に任せます。

## Baseline 一覧

| Device Rev | Date | Mechanical | Electrical | Firmware | Summary | Links |
| --- | --- | --- | --- | --- | --- | --- |
| A | 2025-09-27 | **Mech A** | **Elec A** | v1.0.1 | 初版（外形 440×260×52, 2.4kg/無バッテリ） | [Frame PDF](./mechanical/drawings/Body-FrontShell_t1.0_v1.0.1.pdf), [BOM CSV](./electrical/bom_rev_a.csv), [BOM PDF](./electrical/bom_rev_a.pdf), [Onshape](https://cad.onshape.com/documents/e463a92fe1d1db8a5ae7cfb8/v/c37d62b9bf250e3bedfc0c82/e/8fe36e96feed050b3a66f4dc) |

> **Mechanical/Electrical の Rev 表記**は、機構＝**Mech A/B…**、電気＝**Elec A/B…** のように簡素なレターで管理（詳細は各ページへ）。

## Change log（要点のみ）

### Device Rev A（2025-09-27）

- 機構: FrontShell/RearCover/BattBox **t1.0** 初版。外形 **440×260×52mm**、質量 **2.4kg（電池除く）**。
- 電気: DC 19–24V in、5Vレール供給構成の暫定。BOM Rev A で公開。
- ファーム: signage-aws-nodejs **v1.0.0**, device local server **v1.0.0**（互換性あり）。
- 互換性: 初版のため該当なし。
