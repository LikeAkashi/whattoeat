import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// 签名信息（CI 里由环境变量提供；本地可放一个 keystore.properties，且不要提交进仓库）
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) FileInputStream(f).use { load(it) }
}

fun sign(key: String, env: String): String? =
    keystoreProps.getProperty(key) ?: System.getenv(env)

val storePath = sign("storeFile", "KEYSTORE_PATH")
val storePass = sign("storePassword", "KEYSTORE_PASSWORD")
val keyAliasV = sign("keyAlias", "KEY_ALIAS")
val keyPassV = sign("keyPassword", "KEY_PASSWORD")
val keystoreFile = storePath?.let { rootProject.file(it) } ?: rootProject.file("whattoeat.jks")
val hasSigning = keystoreFile.exists() && storePass != null && keyAliasV != null && keyPassV != null

android {
    namespace = "app.whattoeat"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.whattoeat"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
    }

    signingConfigs {
        if (hasSigning) {
            create("release") {
                storeFile = keystoreFile
                storePassword = storePass
                keyAlias = keyAliasV
                keyPassword = keyPassV
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // 有正式签名就用正式的；没有就退回 debug 签名，保证能装能升级（同一个 key 才可升级）
            signingConfig = if (hasSigning) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.11.0")
}
