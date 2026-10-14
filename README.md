# electron-starter

An Electron application with React and TypeScript

## 自动更新
```shell
python3 -m http.server 8000
```
security find-identity -v -p codesigning
security find-identity -v -p codesigning ~/Library/Keychains/login.keychain-db
security find-identity -v -p codesigning ~/Library/Keychains/ios-build.keychain-db

# 导入 p12 证书到登录 keychain
security import ~/Downloads/app.p12 -k ~/Library/Keychains/login.keychain-db -P "$P12_PASSWORD" -T /usr/bin/codesign -T /usr/bin/productbuild

## macOS 文件
```shell
security unlock-keychain ~/Library/Keychains/login.keychain-db

export CSC_KEY_PASSWORD="<p12-password>"
export CSC_IDENTITY_AUTO_DISCOVERY=true
export CSC_LINK="<path-to>/app.p12"
export CSC_KEYCHAIN="~/Library/Keychains/ios-build.keychain-db"

security find-identity -v -p codesigning ~/Library/Keychains/login.keychain-db
  1) <SHA1-FINGERPRINT> "Apple Development: <NAME> (<TEAM_ID>)"
  2) <SHA1-FINGERPRINT> "Apple Development: <NAME> (<TEAM_ID>)"
  3) <SHA1-FINGERPRINT> "Developer ID Application: <NAME> (<TEAM_ID>)"
     3 valid identities found

export CSC_KEY_PASSWORD="<p12-password>"
export CSC_IDENTITY_AUTO_DISCOVERY=true
export CSC_LINK="<path-to>/app.p12"
export CSC_NAME="<SHA1-FINGERPRINT>"
export CSC_KEYCHAIN="~/Library/Keychains/login.keychain"
```
以上不重要，核心是安装 developerID_application.cer 到系统级别


## Todo

- [x] 接入登录
- [ ] 接入支付
- [ ] 主题
- [ ] right menubar panel
- [ ] 积分奖励
- [x] 日志
  - [x] remove console
- [x] clarity
- [x] i18n
- [ ] CI/CD
- [x] 错误处理
- [x] deeplink
- [x] Router
- [x] Toolbar
- [x] Message
- [x] popupbar
- [x] drizzle
- [x] Window Top Bar
- [x] icon
- [x] Antd

## Project Setup

### Install

```bash
$ pnpm install[Installation.url](../../../AppData/Local/Temp/Installation.url)
```

### Development

```bash
$ pnpm dev
```

### DB 环境

```bash
$ pnpm db:migrate-local
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

## 项目结构

```shell
├──resources/ 公共资源,如:图标、可执行程序、wasm 文件
├──src/
│  ├──main
│  ├──preload
│  └──renderer
├──electron.vite.config.js
└──package.json
```

## 常见问题

- [issue.md](docs/issue.md)

## 参考项目

- [electron-drizzle](https://github.com/djyde/electron-drizzle-sqlite-demo/blob/main/package.json)
- [electron-drizzle](https://juejin.cn/post/7360520652519276582)
- [electron-router](https://github.com/daltonmenezes/electron-router-dom)
- [electron-menubar](https://github.com/max-mapper/menubar)
- [electron-menubar2](https://github.com/rousan/electron-menubar)
- [electron-toolkit](https://github.com/alex8088/electron-toolkit)
- [electron-screenshot](https://docs.ffffee.com/electron/electron-screenshot/0-electron%E6%88%AA%E5%B1%8F%E8%BD%AF%E4%BB%B6%E5%BC%80%E5%8F%91%E4%BB%BB%E5%8A%A1%E6%8B%86%E8%A7%A3.html)
- [icons](https://lucide.dev/icons/)
- [uikit](https://github.com/alex8088/electron-uikit)
- [electron-positioner](https://github.com/jenslind/electron-positioner)

- [shadowizer](https://github.com/alex8088/shadowizer)

### i18n

- [i18n](https://juejin.cn/post/7047065246413897765)
- [i18n](https://github.com/tpps88206/michael-react-electron-i18n-example)
- [i18n](https://www.i18next.com/overview/first-setup-help#)
- [i18n](https://github.com/reZach/secure-electron-template/blob/master/app/electron/main.js)
