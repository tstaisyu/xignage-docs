# 依存パッケージ -（ deps ）

セットアップスクリプトでは `deps/` 配下のリストを読み取り、OS パッケージ（apt）と Python パッケージ（pip）をインストールします。  

## **記述ルール**

- **1 行 1 パッケージ**、`#` 以降はコメントとして無視されます。空行 OK。
- **apt** は基本的にパッケージ名のみ（必要に応じて `pkg=version` も可）。  
- **pip** は `pkg` または `pkg==version`。Jetson / RasPi 固有は各ファイルに分離。
- **共通は `pip-common.txt` に置く**。アーキ依存や重量級（例：CUDA/PyTorch 等）は **機種別ファイル**へ。

!!! tip "インストールの堅牢化（スクリプト抜粋）"
    ```bash
    # apt
    grep -Ev '^\s*#|^\s*$' deps/apt-packages.txt \
      | xargs -r -n 25 sudo apt-get install -y

    # pip（共通）
    pip3 install -U pip wheel setuptools
    pip3 install -r <(grep -Ev '^\s*#|^\s*$' deps/pip-common.txt)

    # pip（Jetson / RasPi は環境判定のうえで追加）
    if dpkg -l | grep -q nvidia-l4t-core; then
      pip3 install -r <(grep -Ev '^\s*#|^\s*$' deps/pip-jetson.txt)
    elif grep -qi raspberry /proc/device-tree/model 2>/dev/null; then
      pip3 install -r <(grep -Ev '^\s*#|^\s*$' deps/pip-raspi.txt)
    fi
    ```

## **APT パッケージ一覧**
<!-- markdownlint-disable-next-line MD046 -->
```text
avahi-daemon
chromium-browser
chrony
curl
dnsmasq
ffmpeg
fonts-noto-cjk
gstreamer1.0-plugins-base
gstreamer1.0-plugins-good
gstreamer1.0-tools
git
hostapd
jq
language-pack-ja
libnss-mdns
lighttpd
linux-modules-extra-raspi
netplan.io
nginx
openbox
pipewire
pulseaudio
python3-pip
raspi-config
ufw
unclutter
wireplumber
x11-xserver-utils
xinit
xserver-xorg
nodejs
build-essential
cmake
libopencv-dev
python3-opencv
libopenblas-dev
liblapack-dev
libjpeg-dev
pkg-config
```

## **pip（共通）**
<!-- markdownlint-disable-next-line MD046 -->
```text
flask==2.3.3
paho-mqtt==1.6.1
```

## **pip（Jetson）**
<!-- markdownlint-disable-next-line MD046 -->
```text
openface
```

## **pip（Raspberry Pi）**
<!-- markdownlint-disable-next-line MD046 -->
```text
python3-rpi.gpio
```
