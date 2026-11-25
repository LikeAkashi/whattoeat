# 出 APK 的三条路

先说结论：**这台机器出不了 APK**。没有 JDK、没有 Gradle、没有 Android SDK，而且 shell 完全没有外网
（`curl` 对 github.com / registry.npmjs.org 全是 000），装不了任何东西。
所以我把「壳」的源码和云端构建流水线都写好了，你在有网的机器上一条命令就能拿到 apk。

网页部分已经在真机尺寸（390×844 @3x）下逐屏验证过。接上 HowToCook 全量数据（374 道）后
`assets/www` 一共 **836 KB**，其中 `data/dishes.generated.js` 占 779 KB；没有任何依赖和网络请求，
冷启动基本就是 WebView 起来的时间。

---

## 路线 A：GitHub Actions 出包（推荐，零本地环境）

`.github/workflows/android.yml` 已经写好。把 `dinner-app/` 推到 GitHub，Actions 会自动：

1. 装 JDK 17
2. 把网页复制进 `assets/www`
3. `gradle assembleDebug`
4. 把 apk 作为 artifact 上传（仓库 Actions 页面下载 `whattoeat-apk`）

也可以手动触发（`workflow_dispatch`）。免费额度足够。

---

## 路线 B：Android Studio（要改代码时最顺）

1. 装 Android Studio（自带 JDK 和 SDK）
2. 先同步网页：`powershell -ExecutionPolicy Bypass -File delivery\sync-web.ps1`
3. `File → Open` 选 `delivery/android`，等 Gradle 同步完
4. 手机开 USB 调试，点 Run；或者 `Build → Build App Bundle(s)/APK(s) → Build APK(s)`

debug 包直接用，装到手机上没有任何限制。

---

## 路线 C：纯命令行

```bash
# 1. 网页同步进 assets
bash delivery/sync-web.sh            # Windows: powershell -ExecutionPolicy Bypass -File delivery\sync-web.ps1

# 2. 需要 JDK 17 + Android SDK（cmdline-tools），并且 export ANDROID_HOME=...
cd delivery/android
gradle assembleDebug
# 产物 app/build/outputs/apk/debug/app-debug.apk
```

没有 `gradlew`（这台机器生成不了 wrapper），所以直接用系统 `gradle`；
装了 Android Studio 后也可以 `gradle wrapper` 生成一份再提交，之后就用 `./gradlew`。

---

## 壳是怎么做的，为什么这么做

`delivery/android/app/src/main/java/app/whattoeat/MainActivity.kt`

- **不用 `file://` 加载**。用 `WebViewAssetLoader` 把 assets 映射到
  `https://appassets.androidplatform.net/`，这样 localStorage（记住偏好）行为跟正常网页一致；
  直接 `file://` 在部分机型上会踩同源限制，偏好记不住。
- **不申请 INTERNET 权限**。页面全在包里，纯离线。点「看视频」这种外链通过
  `shouldOverrideUrlLoading` 交给系统浏览器，WebView 自己不联网。
- **返回键**：先 `webView.goBack()`，回不去了才退出 App。
- **深色模式**：`values-night/themes.xml` 里窗口背景给黑色，避免启动白闪。
- 禁用 `allowFileAccess` / `allowContentAccess`，减少攻击面。

参数：包名 `app.whattoeat`，minSdk 24（Android 7.0），targetSdk 35，UI 全在 assets 里，
改界面不用碰 Kotlin。

---

## 签名

debug 包用系统调试签名，自己装没问题。
要发给别人或上架，得自己生成 keystore：

```bash
keytool -genkey -v -keystore whattoeat.jks -keyalg RSA -keysize 2048 -validity 10000 -alias whattoeat
```

然后在 `app/build.gradle.kts` 里配 `signingConfigs`，CI 里用 repository secrets 传 keystore。
这一步涉及你的密钥，我没替你生成，也没往仓库里写任何凭据。
