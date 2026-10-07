# GitHub Sync

The tracker can sync its personal tracker data through a GitHub repository using an encrypted JSON file.

## Setup
1. Create a GitHub fine-grained Personal Access Token for the tracker repository.
2. Give it **Contents: Read and write** permission for this repository only.
3. Open the tracker on each device, click **☁ GitHub Sync**.
4. Enter the same token and the same sync password on both devices.
5. Click **⬆ Đẩy lên GitHub** after making changes.
6. On another device click **⬇ Lấy từ GitHub** to load the latest data.

The tracker data is encrypted with AES-GCM before being uploaded. The GitHub token and sync password are stored only in that browser's localStorage. Do not use a token with access to unrelated repositories.

### Important
- This is a test/manual sync layer, not a real-time database.
- If both devices change data independently, choose one version and push/pull deliberately to avoid overwriting changes.
- `game-data.json` remains separate from tracker sync data.
