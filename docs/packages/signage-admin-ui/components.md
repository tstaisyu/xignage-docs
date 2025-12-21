# コンポーネント

## UserContextBar（`signage-admin-ui/src/components/UserContextBar.tsx`）

- ユーザー/顧客/デバイス情報と同期状態を表示
- デバイス/顧客の **セレクタ** を提供
- 「同期」ボタン押下で `onSyncClick` を実行

### Props（抜粋）

```ts
{
  userName: string;
  customerId: string;
  deviceId: string | null;
  availableDevices?: { deviceId: string; label?: string }[];
  customers?: { customerId: string; name: string }[];
  onDeviceChange?: (deviceId: string) => void;
  onCustomerChange?: (customerId: string) => void;
  currentPlaylistTitle?: string | null;
  syncState?: 'none' | 'synced' | 'not_synced';
  syncLoading?: boolean;
  onSyncClick?: () => void;
}
```

## RequireAdmin（`signage-admin-ui/src/components/RequireAdmin.tsx`）

- 管理者ログイン状態をチェック
- 未認証の場合 `/login` にリダイレクト

## UploadDropzone（`signage-admin-ui/src/components/UploadDropzone.tsx`）

- `react-dropzone` を使った D&D アップロード

```ts
type UploadDropzoneProps = {
  onDrop: (accepted: File[], rejected: FileRejection[], event: DropEvent) => void;
  maxSize?: number; // 既定: 100MB
};
```

## MediaGrid（`signage-admin-ui/src/components/MediaGrid.tsx`）

- `File[]` の簡易表示用グリッド
- 現行 UI では未使用（`Upload.tsx` でコメントアウト）

## ui/slider（`signage-admin-ui/src/components/ui/slider.tsx`）

- Radix Slider の薄いラッパ
- 現行画面からは未使用
