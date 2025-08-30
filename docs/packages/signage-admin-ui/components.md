# コンポーネント

## **MediaGrid（`src/components/MediaGrid.tsx`）**

- ローカル状態の `File[]` を簡易グリッド表示（3列）

> **Props**

```ts
type Props = { files: File[] };
```

> **実施内容**

- `aspect-video` の矩形に `f.name` を表示（プレビューなしのプレースホルダ）

## **UploadDropzone（`src/components/UploadDropzone.tsx`）**

- `react-dropzone` を用いた D&D アップロード入力

> **Props**

```ts
type UploadDropzoneProps = {
  onDrop: (accepted: File[], rejected: FileRejection[], event: DropEvent) => void;
  maxSize?: number; // 既定：100MB
};
```

!!! note "型の出典"
    `FileRejection` / `DropEvent` は **react-dropzone** の型です。

> **実施内容**

1) `useDropzone({ onDrop, maxSize })` を生成

2) ルート要素に `getRootProps()` / `getInputProps()` をスプレッド

3) `isDragActive` で文言を切替

!!! tip "バリデーション"
    拡張子の制限が必要なら `accept` を `useDropzone` に付与してください。

## **ui/slider（src/components/ui/slider.tsx）**

- Radix Slider（`@radix-ui/react-slider`）前提のスライダー薄ラッパ
- `value` / `defaultValue` からハンドル数を推定し、`Thumb` を複数描画

> **主要 Props（抜粋）**

```ts
function Slider({
  className, defaultValue, value, min = 0, max = 100, ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) { ... }
```

> **実施内容**

- `data-slot` 属性（`slider-*`）を付与し、テーマ側で装飾しやすくしている
- `cn()`（`src/lib/utils.ts`）でクラス結合

!!! note "依存"
    `@radix-ui/react-slider` と `clsx` / `tailwind-merge` が必要です。
