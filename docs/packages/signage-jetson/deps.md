# 依存パッケージ -（ deps ）

セットアップでは **APT 依存は `scripts/lib/config.sh` の `DEPENDENCIES` 配列**、
**pip 依存は venv（/opt/signage-core/venv）** に導入します。

!!! note "TODO"
    `deps/apt-packages.txt` は現行スクリプトから参照されていません。  
    TODO: 本ファイルを使う運用が残っているか確認（根拠：`signage-jetson/scripts/setup/005_apt_bootstrap.sh`, `signage-jetson/scripts/lib/config.sh`）。

---

## **APT（Jetson）**

```text
fonts-noto-cjk
language-pack-ja
git
unzip
jq
curl
netplan.io
chrony
hostapd
dnsmasq
ufw
lighttpd
nginx
python3-pip
xserver-xorg
xinit
openbox
unclutter
chromium-browser
avahi-daemon
libnss-mdns
pipewire
wireplumber
build-essential
cmake
libopencv-dev
python3-opencv
libopenblas-dev
liblapack-dev
libjpeg-dev
pkg-config
ninja-build
```

## **APT（Raspberry Pi）**

```text
fonts-noto-cjk
language-pack-ja
git
unzip
jq
curl
netplan.io
chrony
hostapd
dnsmasq
ufw
lighttpd
nginx
python3-pip
xserver-xorg
xinit
openbox
unclutter
chromium-browser
ffmpeg
gstreamer1.0-tools
gstreamer1.0-plugins-base
gstreamer1.0-plugins-good
gstreamer1.0-x
x11-xserver-utils
pulseaudio
avahi-daemon
libnss-mdns
pipewire
wireplumber
raspi-config
python3-venv
python3-libgpiod
python3-paho-mqtt
```

---

## **pip（共通）**

```text
flask==2.3.3
```

## **pip（Jetson）**

```text
--extra-index-url https://pypi.nvidia.com
openface
```

## **pip（Raspberry Pi）**

`deps/pip-raspi.txt` は現在 **空**（追加依存なし）。
